/**
 * DATA ACCESS SERVICE - Recent Foods
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { FoodMaster } from '@/utils/types';
import { getServingsForFoods, getDefaultServingWithNutrients } from '@/lib/servings';

export type DefaultServingInfo = {
  defaultServingQty: number;
  defaultServingUnit: string;
  defaultServingCalories: number;
};

export type RecentFood = FoodMaster & {
  lastUsedAt: string;
} & DefaultServingInfo;

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
    const { data: entriesData, error: entriesError } = await supabase
      .from('calorie_entries')
      .select('food_id, created_at')
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

    // Process entries to get unique food_ids with their most recent created_at
    const foodMap = new Map<string, { foodId: string; lastUsedAt: string }>();
    
    for (const entry of entriesData) {
      if (entry.food_id && !foodMap.has(entry.food_id)) {
        foodMap.set(entry.food_id, {
          foodId: entry.food_id,
          lastUsedAt: entry.created_at,
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

    // Batch fetch servings for all foods using centralized data access
    const servingsMap = await getServingsForFoods(foodIds);

    // Combine food details with lastUsedAt and default serving info
    const foodsMap = new Map((foodsData || []).map(food => [food.id, food]));
    const recentFoodsList: RecentFood[] = uniqueFoods
      .map(({ foodId, lastUsedAt }) => {
        const food = foodsMap.get(foodId);
        if (!food) return null;
        
        // Get servings for this food and compute default serving
        const foodServings = servingsMap.get(foodId) || [];
        const { defaultServing, nutrients } = getDefaultServingWithNutrients(food, foodServings);
        
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
          sugar_g: food.sugar_g,
          sodium_mg: food.sodium_mg,
          source: food.source,
          is_custom: food.is_custom,
          lastUsedAt,
          defaultServingQty: defaultServing.quantity,
          defaultServingUnit: defaultServing.unit,
          defaultServingCalories: Math.round(nutrients.calories_kcal),
        };
      })
      .filter((food): food is RecentFood => food !== null);

    return recentFoodsList;
  } catch (error) {
    console.error('Exception fetching recent foods:', error);
    return [];
  }
}

