/**
 * DATA ACCESS SERVICE - Recent Foods
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { FoodMaster, CalorieEntry } from '@/utils/types';
import { getServingsForFoods, getDefaultServingWithNutrients } from '@/lib/servings';

export type DefaultServingInfo = {
  defaultServingQty: number;
  defaultServingUnit: string;
  defaultServingCalories: number;
};

export type LatestEntryInfo = {
  latestEntry: CalorieEntry | null;
  latestServingQty: number;
  latestServingUnit: string;
  latestServingCalories: number;
};

export type RecentFood = FoodMaster & {
  lastUsedAt: string;
} & DefaultServingInfo & LatestEntryInfo;

/**
 * Fetch recent foods (last 50 most recent foods used from food_master)
 * 
 * @param userId - The user's ID
 * @param mealType - Meal type (currently not used in query, but kept for future use)
 * @returns Array of RecentFood objects with default serving info
 */
export async function fetchRecentFoods(
  userId: string,
  mealType?: string
): Promise<RecentFood[]> {
  if (!userId) {
    return [];
  }

  try {
    // First, get recent entries with food_id to find unique foods
    // Include id field so we can fetch full entry data later
    const { data: entriesData, error: entriesError } = await supabase
      .from('calorie_entries')
      .select('id, food_id, created_at')
      .eq('user_id', userId)
      .not('food_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000); // Get enough entries to find 50 unique foods

    if (entriesError) {
      console.error('Error fetching recent entries for foods:', entriesError);
      return [];
    }

    if (!entriesData || entriesData.length === 0) {
      return [];
    }

    // Process entries to get unique food_ids with their most recent entry
    // Store the full entry data for the latest entry per food
    const foodMap = new Map<string, { foodId: string; lastUsedAt: string; latestEntryId: string }>();
    const entryIdMap = new Map<string, typeof entriesData[0]>();
    
    // Store all entries by ID for later lookup
    for (const entry of entriesData) {
      if (entry.id) {
        entryIdMap.set(entry.id, entry);
      }
    }
    
    for (const entry of entriesData) {
      if (entry.food_id && !foodMap.has(entry.food_id)) {
        foodMap.set(entry.food_id, {
          foodId: entry.food_id,
          lastUsedAt: entry.created_at,
          latestEntryId: entry.id || '',
        });
        
        // Stop once we have 50 unique foods
        if (foodMap.size >= 50) {
          break;
        }
      }
    }

    // Convert to array and sort by lastUsedAt (most recent first)
    const uniqueFoods = Array.from(foodMap.values())
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
      .slice(0, 50);

    // Fetch food details for all unique food_ids
    const foodIds = uniqueFoods.map(f => f.foodId);
    const { data: foodsData, error: foodsError } = await supabase
      .from('food_master')
      .select('*')
      .in('id', foodIds);

    if (foodsError) {
      console.error('Error fetching food master for recent foods:', foodsError);
      return [];
    }

    // Fetch the latest full entry data for each food
    const latestEntryIds = uniqueFoods.map(f => f.latestEntryId).filter(Boolean);
    const { data: latestEntriesData, error: latestEntriesError } = await supabase
      .from('calorie_entries')
      .select('*')
      .in('id', latestEntryIds);

    if (latestEntriesError) {
      console.error('Error fetching latest entries for recent foods:', latestEntriesError);
    }

    // Create a map of food_id -> latest entry
    const latestEntryMap = new Map<string, CalorieEntry>();
    if (latestEntriesData) {
      for (const entry of latestEntriesData) {
        if (entry.food_id) {
          // Only store if this is the most recent entry for this food
          const existing = latestEntryMap.get(entry.food_id);
          if (!existing || new Date(entry.created_at) > new Date(existing.created_at)) {
            latestEntryMap.set(entry.food_id, entry as CalorieEntry);
          }
        }
      }
    }

    // Batch fetch servings for all foods using centralized data access
    const servingsMap = await getServingsForFoods(foodIds);

    // Combine food details with lastUsedAt, default serving info, and latest entry info
    const foodsMap = new Map((foodsData || []).map(food => [food.id, food]));
    const recentFoodsList: RecentFood[] = uniqueFoods
      .map(({ foodId, lastUsedAt, latestEntryId }) => {
        const food = foodsMap.get(foodId);
        if (!food) return null;
        
        // Get servings for this food and compute default serving
        const foodServings = servingsMap.get(foodId) || [];
        const { defaultServing, nutrients } = getDefaultServingWithNutrients(food, foodServings);
        
        // Get latest entry for this food
        const latestEntry = latestEntryMap.get(foodId) || null;
        
        // Use latest entry serving info if available, otherwise use default
        const latestServingQty = latestEntry ? latestEntry.quantity : defaultServing.quantity;
        const latestServingUnit = latestEntry ? latestEntry.unit : defaultServing.unit;
        const latestServingCalories = latestEntry ? Math.round(latestEntry.calories_kcal) : Math.round(nutrients.calories_kcal);
        
        return {
          id: food.id,
          name: food.name,
          brand: food.brand,
          serving_size: food.serving_size,
          serving_unit: food.serving_unit,
          calories_kcal: food.calories_kcal,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
          fiber_g: food.fiber_g,
          saturated_fat_g: food.saturated_fat_g,
          trans_fat_g: food.trans_fat_g,
          sugar_g: food.sugar_g,
          sodium_mg: food.sodium_mg,
          source: food.source,
          is_custom: food.is_custom,
          lastUsedAt,
          defaultServingQty: defaultServing.quantity,
          defaultServingUnit: defaultServing.unit,
          defaultServingCalories: Math.round(nutrients.calories_kcal),
          latestEntry,
          latestServingQty,
          latestServingUnit,
          latestServingCalories,
        };
      })
      .filter((food): food is RecentFood => food !== null);

    return recentFoodsList;
  } catch (error) {
    console.error('Exception fetching recent foods:', error);
    return [];
  }
}

