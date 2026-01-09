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
  trans_fat_g: number | null;
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
  transFat: number;
  sugar: number;
  sodium: number;
}

/**
 * Meal type identifiers used throughout the app
 */
export type MealType = 'breakfast' | 'lunch' | 'afternoon_snack' | 'dinner';

/**
 * Ordered list of meal types for display consistency
 */
export const MEAL_TYPE_ORDER: MealType[] = [
  'breakfast',
  'lunch',
  'afternoon_snack',
  'dinner',
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
  totalSugar: number;
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
  /**
   * Semantic tone for UI (colors should come from theme tokens, not hardcoded hex values).
   * - info: underweight
   * - success: normal
   * - warning: overweight
   * - error: obese
   */
  tone: 'info' | 'success' | 'warning' | 'error';
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
// BURNED CALORIES TYPES
// ============================================================================

/**
 * Daily burned calories cache (lazy materialized).
 * Maps to the 'daily_sum_burned' table.
 *
 * entry_date is a local calendar day key aligned with food logs (YYYY-MM-DD).
 */
export interface DailySumBurned {
  id: string;
  user_id: string;
  entry_date: string;
  updated_at: string;

  // Authoritative values used by UI
  bmr_cal: number;
  active_cal: number;
  tdee_cal: number;

  // System-calculated defaults (for reset and reproducibility)
  system_bmr_cal: number;
  system_active_cal: number;
  system_tdee_cal: number;

  // Override tracking
  bmr_overridden: boolean;
  active_overridden: boolean;
  tdee_overridden: boolean;
  is_overridden: boolean;

  // Provenance
  source: string;

  // Optional future-proofing fields
  vendor_external_id: string | null;
  vendor_payload_hash: string | null;
  synced_at: string | null;
}

// ============================================================================
// CONSUMED CALORIES TYPES
// ============================================================================

/**
 * Explicit day-level log status for food logging.
 *
 * NOTE: This is user intent and must never be inferred from totals.
 */
export type DailyLogStatus = 'unknown' | 'completed' | 'fasted' | 'reopened';

/**
 * Durable daily fact row for consumed totals + explicit day state.
 * Maps to the 'daily_sum_consumed' table.
 *
 * Row existence = user touched/interacted with that day.
 * Missing row = missed day (no interaction).
 */
export interface DailySumConsumed {
  user_id: string;
  entry_date: string;

  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  sugar_g: number;
  saturated_fat_g: number;
  trans_fat_g: number;
  sodium_mg: number;

  log_status: DailyLogStatus;

  created_at: string;
  touched_at: string;
  status_updated_at: string | null;
  completed_at: string | null;
  last_recomputed_at: string | null;
  updated_at: string;
}

/**
 * Per-meal daily fact row for consumed totals.
 * Maps to the 'daily_sum_consumed_meal' table.
 *
 * Row existence = meal has entries for that day.
 * Missing row = meal has no entries (or was deleted).
 * This is purely derived data maintained by the recompute pipeline.
 */
export interface DailySumConsumedMealRow {
  user_id: string;
  entry_date: string;
  meal_type: MealType;

  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  sugar_g: number;
  saturated_fat_g: number;
  trans_fat_g: number;
  sodium_mg: number;

  created_at: string;
  last_recomputed_at: string | null;
  updated_at: string;
}

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

/**
 * Gender options for caloric calculations
 */
export type Gender = 'male' | 'female' | 'not_telling';

/**
 * Focus module types for user preferences
 */
export type FocusModule = 'Food' | 'Exercise' | 'Med' | 'Water';

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
  body_fat_percent?: number | null;
  is_active: boolean;
  is_admin: boolean;
  onboarding_complete: boolean;
  language_preference?: string;
  weight_unit_preference?: 'lbs' | 'kg';
  height_unit_preference?: 'cm' | 'ft';
  water_unit_preference?: 'metric' | 'imperial';
  focus_module_1: FocusModule;
  focus_module_2: FocusModule;
  focus_module_3: FocusModule;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EXTERNAL FOOD CACHE TYPES
// ============================================================================

/**
 * Cached external food data from OpenFoodFacts or other sources.
 * Maps to the 'external_food_cache' table.
 * 
 * IMPORTANT: All nutrition values are per 100g/ml.
 */
export interface ExternalFoodCache {
  id: string;
  /** Normalized 13-digit EAN-13 barcode */
  barcode: string;
  /** Source identifier, e.g., 'openfoodfacts' */
  source: string;
  /** Original ID from source (e.g., OFF "code") */
  source_food_id: string | null;
  /** Product name */
  product_name: string | null;
  /** Brand name */
  brand: string | null;
  /** Energy in kcal per 100g/ml */
  energy_kcal_100g: number | null;
  /** Protein in grams per 100g/ml */
  protein_100g: number | null;
  /** Carbohydrates in grams per 100g/ml */
  carbs_100g: number | null;
  /** Fat in grams per 100g/ml */
  fat_100g: number | null;
  /** Saturated fat in grams per 100g/ml */
  saturated_fat_100g: number | null;
  /** Trans fat in grams per 100g/ml */
  trans_fat_100g: number | null;
  /** Sugars in grams per 100g/ml */
  sugars_100g: number | null;
  /** Fiber in grams per 100g/ml */
  fiber_100g: number | null;
  /** Sodium in grams per 100g/ml (OFF uses grams, not mg) */
  sodium_100g: number | null;
  /** Raw serving size text from source, e.g., "250 ml" */
  serving_size: string | null;
  created_at: string;
  updated_at: string;
  /** Last time we fetched from the external API */
  last_fetched_at: string | null;
  /** Number of times this barcode has been scanned */
  times_scanned: number;
  /** If promoted to food_master, the ID of that row */
  promoted_food_master_id: string | null;
  /** Whether this cached food entry has been verified by an admin */
  is_verified: boolean;
}

/**
 * Source types for barcode lookups
 */
export type BarcodeLookupSource = 'food_master' | 'external_food_cache' | 'openfoodfacts' | 'none';

