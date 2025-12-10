/**
 * DOMAIN UTILITIES - Daily Totals & Meal Grouping
 * 
 * Pure functions for calculating daily nutrition totals and grouping
 * entries by meal type. Per engineering guidelines section 7:
 * - Domain logic lives in plain TS modules
 * - No React/browser/UI imports allowed
 * - Must be platform-agnostic for future React Native support
 */

import type {
  CalorieEntry,
  DailyTotals,
  MealGroup,
  GroupedEntries,
  MealType,
} from './types';
import { MEAL_TYPE_ORDER } from './types';

/**
 * Calculate daily nutrition totals from an array of calorie entries
 * 
 * @param entries - Array of calorie entries for the day
 * @param metaByMealType - Optional lookup map of mealtype_meta by meal type
 * @returns DailyTotals with all nutrient sums rounded to whole numbers
 */
export function calculateDailyTotals(entries: CalorieEntry[], metaByMealType?: { [mealType: string]: any }): DailyTotals {
  const totals = {
    calories: Math.round(
      entries.reduce((sum, entry) => sum + entry.calories_kcal, 0)
    ),
    protein: Math.round(
      entries.reduce((sum, entry) => sum + (entry.protein_g || 0), 0)
    ),
    carbs: Math.round(
      entries.reduce((sum, entry) => sum + (entry.carbs_g || 0), 0)
    ),
    fat: Math.round(
      entries.reduce((sum, entry) => sum + (entry.fat_g || 0), 0)
    ),
    fiber: Math.round(
      entries.reduce((sum, entry) => sum + (entry.fiber_g || 0), 0)
    ),
    saturatedFat: Math.round(
      entries.reduce((sum, entry) => sum + (entry.saturated_fat_g || 0), 0)
    ),
    transFat: Math.round(
      entries.reduce((sum, entry) => sum + (entry.trans_fat_g || 0), 0)
    ),
    sugar: Math.round(
      entries.reduce((sum, entry) => sum + (entry.sugar_g || 0), 0)
    ),
    sodium: Math.round(
      entries.reduce((sum, entry) => sum + (entry.sodium_mg || 0), 0)
    ),
  };

  // Round totals
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    fiber: Math.round(totals.fiber),
    saturatedFat: Math.round(totals.saturatedFat),
    transFat: Math.round(totals.transFat),
    sugar: totals.sugar,
    sodium: Math.round(totals.sodium),
  };
}

/**
 * Create an empty meal group structure
 */
function createEmptyMealGroup(): MealGroup {
  return {
    entries: [],
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    totalSugar: 0,
  };
}

/**
 * Initialize empty grouped entries for all meal types
 */
export function createEmptyGroupedEntries(): GroupedEntries {
  return MEAL_TYPE_ORDER.reduce((acc, mealType) => {
    acc[mealType] = createEmptyMealGroup();
    return acc;
  }, {} as GroupedEntries);
}

/**
 * Normalize a meal type string to a valid MealType
 * Unknown meal types are mapped to 'late_night'
 */
export function normalizeMealType(mealType: string | null | undefined): MealType {
  if (!mealType) {
    return 'late_night';
  }
  
  const normalized = mealType.toLowerCase() as MealType;
  
  if (MEAL_TYPE_ORDER.includes(normalized)) {
    return normalized;
  }
  
  return 'late_night';
}

/**
 * Group calorie entries by meal type and calculate totals for each group
 * 
 * @param entries - Array of calorie entries
 * @param metaByMealType - Optional lookup map of mealtype_meta by meal type
 * @returns GroupedEntries with entries organized by meal type
 */
export function groupEntriesByMealType(entries: CalorieEntry[], metaByMealType?: { [mealType: string]: any }): GroupedEntries {
  const grouped = createEmptyGroupedEntries();

  for (const entry of entries) {
    const mealType = normalizeMealType(entry.meal_type);
    const group = grouped[mealType];
    
    group.entries.push(entry);
    group.totalCalories += entry.calories_kcal;
    group.totalProtein += entry.protein_g || 0;
    group.totalCarbs += entry.carbs_g || 0;
    group.totalFat += entry.fat_g || 0;
    group.totalFiber += entry.fiber_g || 0;
    group.totalSugar += entry.sugar_g || 0;
  }


  return grouped;
}

/**
 * Calculate nutrition totals for a single meal type
 * 
 * @param mealEntries - Array of calorie entries for the meal
 * @param mealMeta - Optional mealtype_meta object for the meal (currently unused, kept for future use)
 * @returns Object with all nutrient totals
 */
export function calculateMealNutritionTotals(
  mealEntries: CalorieEntry[],
  mealMeta: any | null
): {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  saturated_fat_g: number;
  trans_fat_g: number;
  sugar_g: number;
  sodium_mg: number;
} {
  // Sum nutrients from entries
  const totals = mealEntries.reduce(
    (acc, entry) => {
      acc.kcal += entry.calories_kcal ?? 0;
      acc.protein_g += entry.protein_g ?? 0;
      acc.carbs_g += entry.carbs_g ?? 0;
      acc.fat_g += entry.fat_g ?? 0;
      acc.fiber_g += entry.fiber_g ?? 0;
      acc.saturated_fat_g += entry.saturated_fat_g ?? 0;
      acc.trans_fat_g += entry.trans_fat_g ?? 0;
      acc.sugar_g += entry.sugar_g ?? 0;
      acc.sodium_mg += entry.sodium_mg ?? 0;
      return acc;
    },
    {
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      saturated_fat_g: 0,
      trans_fat_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    }
  );


  // Round values
  return {
    kcal: Math.round(totals.kcal),
    protein_g: Math.round(totals.protein_g),
    carbs_g: Math.round(totals.carbs_g),
    fat_g: Math.round(totals.fat_g),
    fiber_g: Math.round(totals.fiber_g),
    saturated_fat_g: Math.round(totals.saturated_fat_g),
    trans_fat_g: Math.round(totals.trans_fat_g),
    sugar_g: Math.round(totals.sugar_g),
    sodium_mg: Math.round(totals.sodium_mg),
  };
}

/**
 * Format entries for display as a consolidated string
 * e.g., "1 x g Tofu, 2 x servings Apple"
 */
export function formatEntriesForDisplay(entries: CalorieEntry[]): string {
  return entries
    .map((entry) => {
      const quantity =
        Math.round(entry.quantity) === entry.quantity
          ? entry.quantity.toString()
          : entry.quantity.toFixed(1);
      return `${quantity} x ${entry.unit} ${entry.item_name}`;
    })
    .join(', ');
}

