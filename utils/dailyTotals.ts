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

  // Add Quick Log values from mealtype_meta
  if (metaByMealType) {
    Object.values(metaByMealType).forEach((meta: any) => {
      totals.calories += meta.quick_kcal ?? 0;
      totals.protein += meta.quick_protein_g ?? 0;
      totals.carbs += meta.quick_carbs_g ?? 0;
      totals.fat += meta.quick_fat_g ?? 0;
      totals.fiber += meta.quick_fiber_g ?? 0;
      totals.sugar += meta.quick_sugar_g ?? 0;
      totals.sodium += meta.quick_sodium_mg ?? 0;
    });
  }

  // Round totals after adding Quick Log values
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    fiber: Math.round(totals.fiber),
    saturatedFat: totals.saturatedFat,
    transFat: totals.transFat,
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

  // Add Quick Log values from mealtype_meta
  if (metaByMealType) {
    Object.entries(metaByMealType).forEach(([mealType, meta]: [string, any]) => {
      if (!meta) return;

      const normalizedMealType = normalizeMealType(mealType);
      const group = grouped[normalizedMealType];
      
      group.totalCalories += meta.quick_kcal ?? 0;
      group.totalProtein += meta.quick_protein_g ?? 0;
      group.totalCarbs += meta.quick_carbs_g ?? 0;
      group.totalFat += meta.quick_fat_g ?? 0;
      group.totalFiber += meta.quick_fiber_g ?? 0;
      group.totalSugar += meta.quick_sugar_g ?? 0;
    });
  }

  return grouped;
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

