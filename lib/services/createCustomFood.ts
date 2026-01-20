/**
 * DATA ACCESS SERVICE - Create Custom Food screen
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - Avoid select('*'); select only required columns
 */

import { supabase } from '@/lib/supabase';

export type FoodMasterForCustomFood = {
  id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string | null;
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
};

export type DefaultFoodServing = {
  serving_name: string;
  weight_g: number | null;
  volume_ml: number | null;
};

const FOOD_MASTER_COLUMNS = `
  id,
  name,
  brand,
  serving_size,
  serving_unit,
  calories_kcal,
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  saturated_fat_g,
  trans_fat_g,
  sugar_g,
  sodium_mg
`;

const FOOD_SERVING_DEFAULT_COLUMNS = `
  serving_name,
  weight_g,
  volume_ml
`;

export async function getFoodForEditing(params: {
  userId: string;
  foodId: string;
}): Promise<FoodMasterForCustomFood | null> {
  const { userId, foodId } = params;
  if (!userId || !foodId) return null;

  const { data, error } = await supabase
    .from('food_master')
    .select(FOOD_MASTER_COLUMNS)
    .eq('id', foodId)
    .eq('owner_user_id', userId)
    .single<FoodMasterForCustomFood>();

  if (error) return null;
  return data ?? null;
}

export async function getFoodForCloning(params: {
  foodId: string;
}): Promise<FoodMasterForCustomFood | null> {
  const { foodId } = params;
  if (!foodId) return null;

  const { data, error } = await supabase
    .from('food_master')
    .select(FOOD_MASTER_COLUMNS)
    .eq('id', foodId)
    .single<FoodMasterForCustomFood>();

  if (error) return null;
  return data ?? null;
}

export async function getDefaultServingForFood(params: {
  foodId: string;
}): Promise<DefaultFoodServing | null> {
  const { foodId } = params;
  if (!foodId) return null;

  const { data, error } = await supabase
    .from('food_servings')
    .select(FOOD_SERVING_DEFAULT_COLUMNS)
    .eq('food_id', foodId)
    .eq('is_default', true)
    .single<DefaultFoodServing>();

  if (error) return null;
  return data ?? null;
}

export async function checkDuplicateCustomFood(params: {
  userId: string;
  name: string;
  brand: string | null;
}): Promise<boolean> {
  const { userId, name, brand } = params;
  if (!userId || !name) return false;

  let query = supabase
    .from('food_master')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('is_custom', true)
    .eq('name', name);

  if (brand) query = query.eq('brand', brand);
  else query = query.is('brand', null);

  const { data, error } = await query;
  if (error) return false;
  return !!(data && data.length > 0);
}

export async function countCustomFoods(params: { userId: string }): Promise<number | null> {
  const { userId } = params;
  if (!userId) return null;

  const { count, error } = await supabase
    .from('food_master')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId)
    .eq('is_custom', true);

  if (error) return null;
  return count ?? null;
}

export async function upsertCustomFood(params: {
  userId: string;
  isEditing: boolean;
  foodId?: string;
  foodUpdateData: {
    name: string;
    brand: string | null;
    serving_size: number;
    serving_unit: string;
    calories_kcal: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    saturated_fat_g: number | null;
    trans_fat_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
  };
}): Promise<{ id: string } | null> {
  const { userId, isEditing, foodId, foodUpdateData } = params;
  if (!userId) return null;

  if (isEditing) {
    if (!foodId) return null;
    const { data, error } = await supabase
      .from('food_master')
      .update(foodUpdateData)
      .eq('id', foodId)
      .eq('owner_user_id', userId)
      .select('id')
      .single<{ id: string }>();

    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }
    if (!data) {
      throw new Error('No updated food returned');
    }
    return data;
  }

  const { data, error } = await supabase
    .from('food_master')
    .insert({
      ...foodUpdateData,
      barcode: null,
      is_custom: true,
      owner_user_id: userId,
      source: 'user_created',
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }
  if (!data) {
    throw new Error('No created food returned');
  }
  return data;
}

