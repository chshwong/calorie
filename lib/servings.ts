/**
 * CENTRALIZED SERVING LOGIC - SINGLE SOURCE OF TRUTH
 * 
 * This module contains the only approved logic for:
 * 1. Finding the default serving for a food
 * 2. Scaling nutrients from food_master to a serving
 * 
 * All UI and components must use these functions instead of implementing
 * their own serving/nutrient logic.
 * 
 * Per engineering guidelines section 7:
 * - Platform-agnostic (no DOM/browser APIs)
 * - No React imports - pure TypeScript utilities
 * - Can be reused in React Native
 */

import { supabase } from '@/lib/supabase';
import type { FoodMaster, FoodServing, Nutrients } from '@/utils/nutritionMath';
import { isVolumeUnit, isWeightUnit } from '@/utils/nutritionMath';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result from getDefaultServingForFood
 */
export interface DefaultServingResult {
  /** The quantity to use (e.g., 1 for "1 slice", 100 for "100 g") */
  quantity: number;
  /** The unit label for display (e.g., "g", "ml", "slice") */
  unit: string;
  /** The FoodServing record if a default exists, undefined if using food_master fallback */
  serving?: FoodServing;
}

/**
 * Input for computing nutrients from a serving
 */
export interface ServingInput {
  weight_g?: number | null;
  volume_ml?: number | null;
}

/**
 * Scaled nutrients result
 */
export interface FoodNutrients {
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
}

// ============================================================================
// COLUMN DEFINITIONS
// ============================================================================

/** Columns for food_servings table - use new weight_g/volume_ml columns */
export const FOOD_SERVING_COLUMNS = `
  id,
  food_id,
  serving_name,
  weight_g,
  volume_ml,
  sort_order,
  is_default
`;

// ============================================================================
// DATA ACCESS
// ============================================================================

/**
 * Fetch servings for a specific food
 * 
 * @param foodId - The food_master ID
 * @returns Array of FoodServing objects, sorted by is_default DESC, sort_order ASC
 */
export async function getServingsForFood(foodId: string): Promise<FoodServing[]> {
  if (!foodId) return [];

  try {
    const { data, error } = await supabase
      .from('food_servings')
      .select(FOOD_SERVING_COLUMNS)
      .eq('food_id', foodId)
      .order('is_default', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Error fetching servings:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching servings:', error);
    return [];
  }
}

/**
 * Batch fetch servings for multiple foods
 * More efficient than calling getServingsForFood for each food
 * 
 * @param foodIds - Array of food_master IDs
 * @returns Map of food_id to array of FoodServing objects
 */
export async function getServingsForFoods(
  foodIds: string[]
): Promise<Map<string, FoodServing[]>> {
  const result = new Map<string, FoodServing[]>();
  
  if (foodIds.length === 0) return result;

  try {
    const { data, error } = await supabase
      .from('food_servings')
      .select(FOOD_SERVING_COLUMNS)
      .in('food_id', foodIds)
      .order('is_default', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Error fetching servings batch:', error);
      return result;
    }

    // Group servings by food_id
    for (const serving of (data || [])) {
      const foodServings = result.get(serving.food_id) || [];
      foodServings.push(serving);
      result.set(serving.food_id, foodServings);
    }

    return result;
  } catch (error) {
    console.error('Exception fetching servings batch:', error);
    return result;
  }
}

// ============================================================================
// DEFAULT SERVING RESOLUTION (SINGLE SOURCE OF TRUTH)
// ============================================================================

/**
 * Get the default serving for a food
 * 
 * This is the SINGLE SOURCE OF TRUTH for determining default servings.
 * All screens must use this function instead of duplicating logic.
 * 
 * Rules:
 * 1. If there is at least one food_servings row with is_default = true,
 *    pick the one with the lowest sort_order (or first if ties)
 * 2. Otherwise, fallback to the canonical amount & unit from food_master
 * 
 * @param food - The FoodMaster record
 * @param servings - Array of FoodServing records for this food
 * @returns DefaultServingResult with quantity, unit, and optional serving
 */
export function getDefaultServingForFood(
  food: FoodMaster,
  servings: FoodServing[]
): DefaultServingResult {
  // Find default servings (is_default = true)
  const defaultServings = servings.filter(s => s.is_default);

  if (defaultServings.length > 0) {
    // Sort by sort_order (nulls treated as 0), then by id as fallback
    const sortedDefaults = defaultServings.sort((a, b) => {
      const aOrder = a.sort_order ?? 0;
      const bOrder = b.sort_order ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id.localeCompare(b.id);
    });

    const defaultServing = sortedDefaults[0];
    
    return {
      quantity: 1, // Default to 1 of the named serving
      unit: defaultServing.serving_name,
      serving: defaultServing,
    };
  }

  // No default serving found - fallback to food_master canonical amount & unit
  return {
    quantity: food.serving_size,
    unit: food.serving_unit,
    serving: undefined,
  };
}

// ============================================================================
// NUTRIENT SCALING (SINGLE SOURCE OF TRUTH)
// ============================================================================

/**
 * Compute nutrients for a serving
 * 
 * This is the SINGLE SOURCE OF TRUTH for nutrient calculations.
 * All nutrient display and logging must use this function.
 * 
 * Rules:
 * - Let baseAmount and baseUnit be the canonical amount and unit from food_master
 * - If baseUnit is grams ('g'):
 *   - We use weight_g for scaling
 *   - factor = (serving.weight_g ?? baseAmount) / baseAmount
 * - If baseUnit is milliliters ('ml'):
 *   - We use volume_ml for scaling
 *   - factor = (serving.volume_ml ?? baseAmount) / baseAmount
 * - Then multiply all nutrient fields by factor
 * 
 * @param food - The FoodMaster record with canonical nutrients
 * @param serving - The serving input with weight_g and/or volume_ml
 * @returns FoodNutrients with scaled values
 */
export function computeNutrientsForServing(
  food: FoodMaster,
  serving: ServingInput
): FoodNutrients {
  const baseAmount = food.serving_size;
  const baseUnit = food.serving_unit.toLowerCase();

  let factor: number;

  if (isWeightUnit(baseUnit)) {
    // Weight-based food: use weight_g for scaling
    // If weight_g is null/undefined, fall back to baseAmount (factor = 1)
    const servingWeight = serving.weight_g ?? baseAmount;
    factor = servingWeight / baseAmount;
  } else if (isVolumeUnit(baseUnit)) {
    // Volume-based food: use volume_ml for scaling
    // If volume_ml is null/undefined, fall back to baseAmount (factor = 1)
    const servingVolume = serving.volume_ml ?? baseAmount;
    factor = servingVolume / baseAmount;
  } else {
    // Unknown unit type (e.g., "piece", "serving")
    // Assume 1:1 mapping with canonical serving
    factor = 1;
  }

  // Scale all nutrients
  return {
    calories_kcal: food.calories_kcal * factor,
    protein_g: food.protein_g != null ? food.protein_g * factor : null,
    carbs_g: food.carbs_g != null ? food.carbs_g * factor : null,
    fat_g: food.fat_g != null ? food.fat_g * factor : null,
    saturated_fat_g: food.saturated_fat_g != null ? food.saturated_fat_g * factor : null,
    trans_fat_g: food.trans_fat_g != null ? food.trans_fat_g * factor : null,
    sugar_g: food.sugar_g != null ? food.sugar_g * factor : null,
    fiber_g: food.fiber_g != null ? food.fiber_g * factor : null,
    sodium_mg: food.sodium_mg != null ? food.sodium_mg * factor : null,
  };
}

/**
 * Compute nutrients for a FoodServing record
 * 
 * Convenience function that extracts weight_g/volume_ml from FoodServing
 * and delegates to computeNutrientsForServing.
 * 
 * @param food - The FoodMaster record
 * @param serving - The FoodServing record
 * @param quantity - How many of this serving (default: 1)
 * @returns FoodNutrients with scaled values
 */
export function computeNutrientsForFoodServing(
  food: FoodMaster,
  serving: FoodServing,
  quantity: number = 1
): FoodNutrients {
  const baseUnit = food.serving_unit.toLowerCase();
  
  // Get the appropriate measurement based on food type, with fallback to grams
  let servingInput: ServingInput;
  
  if (isVolumeUnit(baseUnit)) {
    // Volume-based food: use volume_ml
    const volumeValue = (serving.volume_ml ?? 0) * quantity;
    servingInput = { volume_ml: volumeValue };
  } else {
    // Weight-based food: use weight_g
    const weightValue = (serving.weight_g ?? 0) * quantity;
    servingInput = { weight_g: weightValue };
  }
  
  return computeNutrientsForServing(food, servingInput);
}

/**
 * Compute nutrients for the default serving of a food
 * 
 * Convenience function that combines getDefaultServingForFood and
 * computeNutrientsForServing.
 * 
 * @param food - The FoodMaster record
 * @param servings - Array of FoodServing records for this food
 * @returns Object with default serving info and computed nutrients
 */
export function getDefaultServingWithNutrients(
  food: FoodMaster,
  servings: FoodServing[]
): {
  defaultServing: DefaultServingResult;
  nutrients: FoodNutrients;
} {
  const defaultServing = getDefaultServingForFood(food, servings);
  
  let nutrients: FoodNutrients;
  
  if (defaultServing.serving) {
    // Use the FoodServing record for calculation
    nutrients = computeNutrientsForFoodServing(
      food,
      defaultServing.serving,
      defaultServing.quantity
    );
  } else {
    // Using canonical fallback - nutrients are as defined in food_master
    nutrients = {
      calories_kcal: food.calories_kcal,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      saturated_fat_g: food.saturated_fat_g,
      trans_fat_g: food.trans_fat_g,
      sugar_g: food.sugar_g,
      fiber_g: food.fiber_g,
      sodium_mg: food.sodium_mg,
    };
  }
  
  return { defaultServing, nutrients };
}

/**
 * Compute nutrients for a raw quantity in a given unit
 * 
 * Used when user enters a direct amount like "250 ml" or "150 g"
 * 
 * @param food - The FoodMaster record
 * @param quantity - The quantity in the given unit
 * @param unit - The unit (e.g., "g", "ml", "oz", "cup")
 * @returns FoodNutrients with scaled values
 */
export function computeNutrientsForRawQuantity(
  food: FoodMaster,
  quantity: number,
  unit: string
): FoodNutrients {
  const normalizedUnit = unit.toLowerCase();
  const baseUnit = food.serving_unit.toLowerCase();
  
  // Convert quantity to the base unit
  let quantityInBaseUnit: number;
  
  if (isWeightUnit(normalizedUnit) && isWeightUnit(baseUnit)) {
    quantityInBaseUnit = convertWeightToGrams(quantity, normalizedUnit);
    if (baseUnit !== 'g') {
      quantityInBaseUnit = convertGramsToUnit(quantityInBaseUnit, baseUnit);
    }
  } else if (isVolumeUnit(normalizedUnit) && isVolumeUnit(baseUnit)) {
    quantityInBaseUnit = convertVolumeToMl(quantity, normalizedUnit);
    if (baseUnit !== 'ml') {
      quantityInBaseUnit = convertMlToUnit(quantityInBaseUnit, baseUnit);
    }
  } else if (normalizedUnit === baseUnit) {
    quantityInBaseUnit = quantity;
  } else {
    // Cross-category or unknown - use as-is
    quantityInBaseUnit = quantity;
  }
  
  // Create serving input based on food type
  const servingInput: ServingInput = isVolumeUnit(baseUnit)
    ? { volume_ml: quantityInBaseUnit }
    : { weight_g: quantityInBaseUnit };
  
  return computeNutrientsForServing(food, servingInput);
}

// ============================================================================
// UNIT CONVERSION HELPERS
// ============================================================================

function convertWeightToGrams(quantity: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'g':  return quantity;
    case 'kg': return quantity * 1000;
    case 'oz': return quantity * 28.3495;
    case 'lb': return quantity * 453.592;
    default:   return quantity;
  }
}

function convertGramsToUnit(grams: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'g':  return grams;
    case 'kg': return grams / 1000;
    case 'oz': return grams / 28.3495;
    case 'lb': return grams / 453.592;
    default:   return grams;
  }
}

function convertVolumeToMl(quantity: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'ml':   return quantity;
    case 'l':    return quantity * 1000;
    case 'cup':  return quantity * 240;
    case 'tbsp': return quantity * 15;
    case 'tsp':  return quantity * 5;
    case 'floz': return quantity * 29.5735;
    default:     return quantity;
  }
}

function convertMlToUnit(ml: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'ml':   return ml;
    case 'l':    return ml / 1000;
    case 'cup':  return ml / 240;
    case 'tbsp': return ml / 15;
    case 'tsp':  return ml / 5;
    case 'floz': return ml / 29.5735;
    default:     return ml;
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format a serving for display in the UI
 * 
 * @param serving - The default serving result
 * @returns Formatted string like "100 g", "1 slice", "250 ml"
 */
export function formatServingForDisplay(serving: DefaultServingResult): string {
  if (serving.quantity === 1 && serving.serving) {
    // Use just the serving name for named servings with quantity 1
    return serving.serving.serving_name;
  }
  
  return `${serving.quantity} ${serving.unit}`;
}

/**
 * Format nutrients for display (rounded appropriately)
 * 
 * @param nutrients - The computed nutrients
 * @returns Object with formatted string values
 */
export function formatNutrientsForDisplay(nutrients: FoodNutrients): {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
  saturatedFat: string;
  transFat: string;
} {
  const round = (value: number | null, decimals: number = 1): string => {
    if (value == null) return '-';
    return value.toFixed(decimals);
  };
  
  return {
    calories: Math.round(nutrients.calories_kcal).toString(),
    protein: round(nutrients.protein_g),
    carbs: round(nutrients.carbs_g),
    fat: round(nutrients.fat_g),
    fiber: round(nutrients.fiber_g),
    sugar: round(nutrients.sugar_g),
    sodium: round(nutrients.sodium_mg, 0),
    saturatedFat: round(nutrients.saturated_fat_g),
    transFat: round(nutrients.trans_fat_g),
  };
}

/**
 * Get the normalized serving value (weight_g or volume_ml) from a FoodServing
 * based on the food's canonical unit
 * 
 * @param serving - The FoodServing record
 * @param food - The FoodMaster record
 * @returns The serving size in grams or ml
 */
export function getServingNormalizedValue(serving: FoodServing, food: FoodMaster): number {
  const baseUnit = food.serving_unit.toLowerCase();
  
  if (isVolumeUnit(baseUnit)) {
    // Volume-based: use volume_ml
    return serving.volume_ml ?? 0;
  } else {
    // Weight-based: use weight_g
    return serving.weight_g ?? 0;
  }
}

