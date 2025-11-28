/**
 * DATA ACCESS SERVICE - Custom Foods
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

export type CustomFood = FoodMaster & DefaultServingInfo;

/**
 * Fetch custom foods for the current user
 * 
 * @param userId - The user's ID
 * @returns Array of CustomFood objects with default serving info
 */
export async function fetchCustomFoods(userId: string): Promise<CustomFood[]> {
  if (!userId) {
    return [];
  }

  try {
    // Fetch custom foods - order by order_index if available, otherwise by name
    const { data, error } = await supabase
      .from('food_master')
      .select('*')
      .eq('is_custom', true)
      .eq('owner_user_id', userId)
      .order('order_index', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }); // Fallback if order_index is null

    if (error) {
      console.error('Error fetching custom foods:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }

    // Batch fetch servings for all foods using centralized data access
    const foodIds = data.map((food: any) => food.id);
    const servingsMap = await getServingsForFoods(foodIds);

    // Enrich foods with default serving info
    const customFoodsList: CustomFood[] = data.map((food: any) => {
      const foodServings = servingsMap.get(food.id) || [];
      const { defaultServing, nutrients } = getDefaultServingWithNutrients(food, foodServings);
      
      return {
        ...food,
        defaultServingQty: defaultServing.quantity,
        defaultServingUnit: defaultServing.unit,
        defaultServingCalories: Math.round(nutrients.calories_kcal),
      };
    });

    return customFoodsList;
  } catch (error) {
    console.error('Exception fetching custom foods:', error);
    return [];
  }
}

