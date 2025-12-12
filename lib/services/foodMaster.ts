/**
 * DATA ACCESS SERVICE - Food Master
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service is platform-agnostic and can be reused in React Native.
 */

import { supabase } from '@/lib/supabase';
import type { FoodMaster } from '@/utils/nutritionMath';

export type FoodMasterMetadata = {
  id: string;
  is_custom: boolean;
  brand: string | null;
};

/**
 * Fetch full food_master row by ID
 */
export async function getFoodMasterById(foodId: string): Promise<FoodMaster | null> {
  if (!foodId) return null;

  try {
    const { data, error } = await supabase
      .from('food_master')
      .select('*')
      .eq('id', foodId)
      .single<FoodMaster>();

    if (error) {
      console.error('Error fetching food master by id:', error);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.error('Exception fetching food master by id:', error);
    return null;
  }
}

/**
 * Fetch food master metadata for multiple food IDs
 * 
 * @param foodIds - Array of food IDs to fetch
 * @returns Array of FoodMasterMetadata objects, or empty array on error
 */
export async function getFoodMasterByIds(
  foodIds: string[]
): Promise<FoodMasterMetadata[]> {
  if (!foodIds || foodIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('food_master')
      .select('id, is_custom, brand')
      .in('id', foodIds);

    if (error) {
      console.error('Error fetching food master metadata:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching food master metadata:', error);
    return [];
  }
}

