/**
 * SHARED TYPE DEFINITIONS
 * 
 * Central type definitions for all core entities.
 * Per engineering guidelines section 7, these types must be shared
 * across web and future mobile implementations.
 * 
 * DO NOT import React or any platform-specific modules here.
 */

// ============================================================================
// CALORIE ENTRY TYPES
// ============================================================================

/**
 * Represents a single calorie entry in the database.
 * Maps to the 'calorie_entries' table.
 */
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
  sugar_g: number | null;
  sodium_mg: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Daily nutrition totals calculated from calorie entries
 */
export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  saturatedFat: number;
  sugar: number;
  sodium: number;
}

/**
 * Meal type identifiers used throughout the app
 */
export type MealType = 'breakfast' | 'lunch' | 'afternoon_snack' | 'dinner' | 'late_night';

/**
 * Ordered list of meal types for display consistency
 */
export const MEAL_TYPE_ORDER: MealType[] = [
  'breakfast',
  'lunch',
  'afternoon_snack',
  'dinner',
  'late_night',
];

/**
 * Entries grouped by meal type with calculated totals
 */
export interface MealGroup {
  entries: CalorieEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
}

/**
 * All meal groups for a day, indexed by meal type
 */
export type GroupedEntries = Record<MealType, MealGroup>;

// ============================================================================
// BMI TYPES
// ============================================================================

/**
 * BMI category with associated styling color
 */
export interface BMICategory {
  label: string;
  /** i18n key for the label */
  labelKey: string;
  color: string;
}

// ============================================================================
// DATE/TIME TYPES
// ============================================================================

/**
 * Date display information for the home screen
 */
export interface DateDisplayInfo {
  isToday: boolean;
  isYesterday: boolean;
  isCurrentYear: boolean;
  /** Formatted date string for display */
  displayDate: string;
  /** YYYY-MM-DD format for SQL queries */
  dateString: string;
}

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

/**
 * Gender options for caloric calculations
 */
export type Gender = 'male' | 'female' | 'not_telling';

/**
 * User profile from the profiles table
 */
export interface UserProfile {
  user_id: string;
  first_name: string;
  date_of_birth: string;
  gender: Gender;
  height_cm: number;
  weight_lb: number;
  is_active: boolean;
  is_admin: boolean;
  onboarding_complete: boolean;
  language_preference?: string;
  weight_unit_preference?: 'lbs' | 'kg';
  height_unit_preference?: 'cm' | 'ft';
  created_at: string;
  updated_at: string;
}

