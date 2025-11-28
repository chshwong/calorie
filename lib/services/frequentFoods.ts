/**
 * DATA ACCESS SERVICE - Frequent Foods
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

export type FrequentFood = FoodMaster & {
  logCount: number;
  lastLoggedAt: string;
} & DefaultServingInfo;

/**
 * Fetch frequent foods (foods logged in last 14 months)
 * Uses database function for efficient single-query aggregation
 * 
 * @param userId - The user's ID
 * @param mealType - Meal type (currently not used in query, but kept for future use)
 * @returns Array of FrequentFood objects with default serving info
 */
export async function fetchFrequentFoods(
  userId: string,
  mealType?: string
): Promise<FrequentFood[]> {
  if (!userId) {
    return [];
  }

  try {
    // Use database function for efficient single-query aggregation
    const { data, error } = await supabase.rpc('get_frequent_foods', {
      p_user_id: userId,
      p_months_back: 14,
      p_limit_count: 30,
    });

    if (error) {
      // Fallback to empty array if function doesn't exist yet
      console.error('Error fetching frequent foods:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get food IDs for batch fetching servings
    const foodIds = data.map((row: any) => row.id);
    
    // Batch fetch servings for all foods using centralized data access
    const servingsMap = await getServingsForFoods(foodIds);

    // Map database result to FrequentFood type with default serving info
    const frequentFoodsList: FrequentFood[] = data.map((row: any) => {
      const food: FoodMaster = {
        id: row.id,
        name: row.name,
        brand: row.brand,
        serving_size: row.serving_size,
        serving_unit: row.serving_unit,
        calories_kcal: row.calories_kcal,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fat_g: row.fat_g,
        fiber_g: row.fiber_g,
        saturated_fat_g: row.saturated_fat_g,
        sugar_g: row.sugar_g,
        sodium_mg: row.sodium_mg,
        source: row.source,
        is_custom: row.is_custom,
      };
      
      // Get servings for this food and compute default serving
      const foodServings = servingsMap.get(row.id) || [];
      const { defaultServing, nutrients } = getDefaultServingWithNutrients(food, foodServings);
      
      return {
        ...food,
        logCount: Number(row.log_count),
        lastLoggedAt: row.last_logged_at,
        defaultServingQty: defaultServing.quantity,
        defaultServingUnit: defaultServing.unit,
        defaultServingCalories: Math.round(nutrients.calories_kcal),
      };
    });

    return frequentFoodsList;
  } catch (error) {
    console.error('Exception fetching frequent foods:', error);
    return [];
  }
}

