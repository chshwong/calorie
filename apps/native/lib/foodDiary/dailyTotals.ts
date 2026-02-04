import type {
  CalorieEntry,
  DailyTotals,
  GroupedEntries,
  MealGroup,
  MealType,
} from "@/lib/foodDiary/types";
import { MEAL_TYPE_ORDER } from "@/lib/foodDiary/types";

export function calculateDailyTotals(entries: CalorieEntry[]): DailyTotals {
  const totals = {
    calories: Math.round(entries.reduce((sum, entry) => sum + entry.calories_kcal, 0)),
    protein: Math.round(entries.reduce((sum, entry) => sum + (entry.protein_g || 0), 0)),
    carbs: Math.round(entries.reduce((sum, entry) => sum + (entry.carbs_g || 0), 0)),
    fat: Math.round(entries.reduce((sum, entry) => sum + (entry.fat_g || 0), 0)),
    fiber: Math.round(entries.reduce((sum, entry) => sum + (entry.fiber_g || 0), 0)),
    saturatedFat: Math.round(
      entries.reduce((sum, entry) => sum + (entry.saturated_fat_g || 0), 0)
    ),
    transFat: Math.round(entries.reduce((sum, entry) => sum + (entry.trans_fat_g || 0), 0)),
    sugar: Math.round(entries.reduce((sum, entry) => sum + (entry.sugar_g || 0), 0)),
    sodium: Math.round(entries.reduce((sum, entry) => sum + (entry.sodium_mg || 0), 0)),
  };

  return totals;
}

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

export function createEmptyGroupedEntries(): GroupedEntries {
  return MEAL_TYPE_ORDER.reduce((acc, mealType) => {
    acc[mealType] = createEmptyMealGroup();
    return acc;
  }, {} as GroupedEntries);
}

export function normalizeMealType(mealType: string | null | undefined): MealType {
  if (!mealType) {
    return "dinner";
  }
  const normalized = mealType.toLowerCase() as MealType;
  if (MEAL_TYPE_ORDER.includes(normalized)) {
    return normalized;
  }
  return "dinner";
}

export function groupEntriesByMealType(entries: CalorieEntry[]): GroupedEntries {
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

