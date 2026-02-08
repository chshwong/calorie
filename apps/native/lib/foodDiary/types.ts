export interface CalorieEntry {
  id: string;
  user_id: string;
  entry_date: string;
  eaten_at: string | null;
  meal_type: string;
  item_name: string;
  food_id?: string | null;
  serving_id?: string | null;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  notes: string | null;
  source?: string | null;
  ai_raw_text?: string | null;
  ai_confidence?: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyLogStatus = "unknown" | "completed" | "fasted" | "reopened";

export interface DailyEntriesWithStatus {
  entries: CalorieEntry[];
  log_status: DailyLogStatus | null;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  saturatedFat: number;
  transFat: number;
  sugar: number;
  sodium: number;
}

export type MealType = "breakfast" | "lunch" | "afternoon_snack" | "dinner";

export const MEAL_TYPE_ORDER: MealType[] = [
  "breakfast",
  "lunch",
  "afternoon_snack",
  "dinner",
];

export interface MealGroup {
  entries: CalorieEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
}

export type GroupedEntries = Record<MealType, MealGroup>;
