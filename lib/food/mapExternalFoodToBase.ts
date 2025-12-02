/**
 * Shared mapping function to convert external food cache data to food_master format.
 * 
 * This function extracts the pure conversion logic used when creating custom foods
 * or promoting external foods to food_master. It performs:
 * - Conversion of per-100g nutrition values to per-serving values
 * - Unit conversions (e.g., sodium from grams to milligrams)
 * - Calculation of derived fields (e.g., unsaturated_fat)
 * 
 * IMPORTANT: This logic must match exactly with the existing "create custom food
 * from OpenFoodFacts" flow. Any changes to conversion rules should be made here
 * and reused everywhere.
 * 
 * Following engineering guidelines:
 * - Pure function with no side effects
 * - No React/browser/UI imports
 * - Platform-agnostic logic
 */

import { ExternalFoodCache } from '@/utils/types';
import { sodiumGramsToMg } from '@/services/openfoodfacts';

export type ExternalFoodToBaseInput = {
  externalFood: ExternalFoodCache;
  servingSize: number; // e.g., default_serving_size from grid
  servingUnit: string; // e.g., default_serving_unit from grid
};

export type FoodBaseMapping = {
  name: string | null;
  brand: string | null;
  barcode: string | null;
  source: string | null;
  serving_size: number;
  serving_unit: string;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  unsaturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
};

/**
 * Converts external food cache data (per 100g) to food_master format (per serving).
 * 
 * This function replicates the exact business rules used in the existing
 * "create custom food from OpenFoodFacts" flow, including:
 * - Rounding rules for calories and macros
 * - Handling of null values
 * - Sodium conversion from grams to milligrams
 * - Calculation of unsaturated fat from total fat - saturated fat - trans fat
 */
export function mapExternalFoodToBase(input: ExternalFoodToBaseInput): FoodBaseMapping {
  const { externalFood, servingSize, servingUnit } = input;
  
  // Conversion factor: how many 100g units in the serving size?
  // Note: This assumes servingSize is in grams when servingUnit is 'g'
  // For other units (ml, oz, etc.), we'd need more complex conversion logic.
  // Currently, the existing code assumes servingSize is always in grams for simplicity.
  const servingGrams = servingUnit.toLowerCase() === 'g' ? servingSize : servingSize;
  const factor = servingGrams / 100;
  
  // Convert per-100g values to per-serving values
  // Using the same rounding rules as calculateNutritionForServing
  const calories = externalFood.energy_kcal_100g != null 
    ? Math.round((externalFood.energy_kcal_100g) * factor)
    : null;
  
  const protein = externalFood.protein_100g != null
    ? Math.round((externalFood.protein_100g) * factor * 10) / 10
    : null;
  
  const carbs = externalFood.carbs_100g != null
    ? Math.round((externalFood.carbs_100g) * factor * 10) / 10
    : null;
  
  const fat = externalFood.fat_100g != null
    ? Math.round((externalFood.fat_100g) * factor * 10) / 10
    : null;
  
  const fiber = externalFood.fiber_100g != null
    ? Math.round((externalFood.fiber_100g) * factor * 10) / 10
    : null;
  
  const saturatedFat = externalFood.saturated_fat_100g != null
    ? Math.round((externalFood.saturated_fat_100g) * factor * 10) / 10
    : null;
  
  const transFat = externalFood.trans_fat_100g != null
    ? Math.round((externalFood.trans_fat_100g) * factor * 10) / 10
    : null;
  
  const sugar = externalFood.sugars_100g != null
    ? Math.round((externalFood.sugars_100g) * factor * 10) / 10
    : null;
  
  // Convert sodium from grams (per 100g) to milligrams (per serving)
  const sodiumMg = externalFood.sodium_100g != null
    ? Math.round(externalFood.sodium_100g * 1000 * factor)
    : null;
  
  // Calculate unsaturated fat: total fat - saturated fat - trans fat
  // This is a derived field that may not exist in the external cache
  let unsaturatedFat: number | null = null;
  if (fat != null) {
    const saturated = saturatedFat ?? 0;
    const trans = transFat ?? 0;
    const calculatedUnsaturated = fat - saturated - trans;
    // Only set if the result is meaningful (>= 0)
    if (calculatedUnsaturated >= 0) {
      unsaturatedFat = Math.round(calculatedUnsaturated * 10) / 10;
    }
  }
  
  return {
    name: externalFood.product_name,
    brand: externalFood.brand,
    barcode: externalFood.barcode,
    source: externalFood.source || 'openfoodfacts',
    serving_size: servingSize,
    serving_unit: servingUnit,
    calories_kcal: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: fiber,
    saturated_fat_g: saturatedFat,
    unsaturated_fat_g: unsaturatedFat,
    trans_fat_g: transFat,
    sugar_g: sugar,
    sodium_mg: sodiumMg,
  };
}

