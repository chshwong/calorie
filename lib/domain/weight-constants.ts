/**
 * Single Source of Truth for Weight-Related Constants
 * 
 * All weight-related constants, validation rules, and conversion factors
 * must be defined here to prevent duplication across the codebase.
 * 
 * Per engineering guidelines section 3.5: Centralized constraints and validation
 */

// ============================================================================
// DATABASE CONSTRAINTS
// ============================================================================

/**
 * Database-level weight constraints (pounds)
 * These match the database CHECK constraints exactly
 */
export const DB_MIN_WEIGHT_LB = 45;
export const DB_MAX_WEIGHT_LB = 880;

/**
 * Conversion factor: pounds per kilogram
 * Standard conversion factor used throughout the application
 */
export const LB_PER_KG = 2.2046226218;

// ============================================================================
// WEIGHT CHANGE SUGGESTION PERCENTAGES
// ============================================================================

/**
 * Suggested weight change percentages for goal recommendations
 */
export const WEIGHT_LOSS_SUGGESTION_PCT = 0.05; // 10%
export const WEIGHT_GAIN_SUGGESTION_PCT = 0.04; // 5%

/**
 * Maximum absolute weight change (in pounds) for suggestions
 * Caps the suggestion to prevent overly aggressive recommendations
 */
export const WEIGHT_LOSS_SUGGESTION_MAX_LB = 10;
export const WEIGHT_GAIN_SUGGESTION_MAX_LB = 10;

// ============================================================================
// GOAL WEIGHT VALIDATION RULES
// ============================================================================

/**
 * Minimum absolute weight change (in pounds) required for lose/gain goals
 */
export const MIN_DELTA_LOSE_LB = 1;
export const MIN_DELTA_GAIN_LB = 1;

/**
 * Maximum percentage weight change allowed for lose/gain goals
 * Prevents overly aggressive targets
 */
export const MAX_DELTA_LOSE_PCT = 0.50; // 35%
export const MAX_DELTA_GAIN_PCT = 0.35; // 35%

// ============================================================================
// MAINTAIN/RECOMP VALIDATION RULES
// ============================================================================

/**
 * Percentage and absolute cap for maintain/recomp goals
 * Maintain and recomp allow small weight variations
 */
export const MAINTAIN_RECOMP_PCT = 0.02; // 2%
export const MAINTAIN_RECOMP_ABS_CAP_LB = 5;

// ============================================================================
// SAFETY BUFFERS
// ============================================================================

/**
 * Safety buffer for minimum weight calculations (in kilograms)
 * Used to ensure suggestions stay above dangerous thresholds
 */
export const SAFE_MIN_BUFFER_KG = 2.0;

// ============================================================================
// BMI GUARDRAILS (for suggestion logic only)
// ============================================================================

/**
 * Conservative BMI floors and ceilings for suggestion guardrails
 * Used to prevent suggesting weights that would result in unhealthy BMI ranges
 * 
 * Note: These are conservative limits for suggestions only.
 * Actual validation may allow wider ranges.
 */
export const MIN_BMI = {
  male: { under65: 18.5, over65: 20.0 },
  female: { under65: 18.0, over65: 19.0 },
  unknown: { under65: 18.5, over65: 19.5 },
} as const;

export const MAX_BMI = {
  male: { under65: 40.0, over65: 38.0 },
  female: { under65: 40.0, over65: 38.0 },
  unknown: { under65: 40.0, over65: 38.0 },
} as const;

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert pounds to kilograms
 * @param lb - Weight in pounds
 * @returns Weight in kilograms
 */
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/**
 * Convert kilograms to pounds
 * @param kg - Weight in kilograms
 * @returns Weight in pounds
 */
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

