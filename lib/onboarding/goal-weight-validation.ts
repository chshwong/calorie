/**
 * Goal Weight Validation Module
 * 
 * Provides validation logic for goal weight inputs based on goal type (lose, gain, maintain, recomp).
 * Handles unit conversions and provides detailed error messages.
 */

import { DERIVED, PROFILES } from '@/constants/constraints';
import {
  MAINTAIN_RECOMP_ABS_CAP_LB,
  MAINTAIN_RECOMP_PCT,
  MAX_DELTA_GAIN_PCT,
  MAX_DELTA_LOSE_PCT,
  MIN_DELTA_GAIN_LB,
  MIN_DELTA_LOSE_LB,
  kgToLb,
  lbToKg,
} from '@/lib/domain/weight-constants';

export type GoalType = 'lose' | 'gain' | 'maintain' | 'recomp';
export type WeightUnit = 'lbs' | 'kg';

// Weight constraints from constraints.ts (single source of truth)
const MIN_WEIGHT_LB = PROFILES.WEIGHT_LB.MIN;
const MAX_WEIGHT_LB = PROFILES.WEIGHT_LB.MAX;
const MIN_WEIGHT_KG = DERIVED.WEIGHT_KG.MIN;
const MAX_WEIGHT_KG = DERIVED.WEIGHT_KG.MAX;

/**
 * Round to 1 decimal place
 */
function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Get the allowed weight range for a goal type
 * @param params - Parameters for range calculation
 * @returns Object with min/max/recommended weights in lb, and optional delta for maintain/recomp
 */
export function getGoalWeightRange(params: {
  currentWeightLb: number;
  goalType: GoalType;
}): { minLb: number; maxLb: number; recommendedLb: number | null; deltaLb?: number } {
  const { currentWeightLb, goalType } = params;

  switch (goalType) {
    case 'lose': {
      const allowedMax = currentWeightLb - MIN_DELTA_LOSE_LB;
      const allowedMin = Math.max(MIN_WEIGHT_LB, currentWeightLb * (1 - MAX_DELTA_LOSE_PCT));
      const recommendedLb = currentWeightLb - MIN_DELTA_LOSE_LB;
      const safeRecommend =
        allowedMin <= allowedMax &&
        recommendedLb >= allowedMin &&
        recommendedLb <= allowedMax &&
        recommendedLb >= MIN_WEIGHT_LB &&
        recommendedLb <= MAX_WEIGHT_LB;
      return {
        minLb: allowedMin,
        maxLb: allowedMax,
        recommendedLb: safeRecommend ? recommendedLb : null,
      };
    }

    case 'gain': {
      const allowedMin = currentWeightLb + MIN_DELTA_GAIN_LB;
      const allowedMax = Math.min(MAX_WEIGHT_LB, currentWeightLb * (1 + MAX_DELTA_GAIN_PCT));
      const recommendedLb = currentWeightLb + MIN_DELTA_GAIN_LB;
      const safeRecommend =
        allowedMin <= allowedMax &&
        recommendedLb >= allowedMin &&
        recommendedLb <= allowedMax &&
        recommendedLb >= MIN_WEIGHT_LB &&
        recommendedLb <= MAX_WEIGHT_LB;
      return {
        minLb: allowedMin,
        maxLb: allowedMax,
        recommendedLb: safeRecommend ? recommendedLb : null,
      };
    }

    case 'maintain': {
      const deltaByPct = currentWeightLb * MAINTAIN_RECOMP_PCT;
      const delta = Math.min(deltaByPct, MAINTAIN_RECOMP_ABS_CAP_LB);
      const allowedMin = currentWeightLb - delta;
      const allowedMax = currentWeightLb + delta;
      return {
        minLb: allowedMin,
        maxLb: allowedMax,
        recommendedLb: currentWeightLb, // Default to current weight
        deltaLb: delta,
      };
    }

    case 'recomp': {
      const deltaByPct = currentWeightLb * MAINTAIN_RECOMP_PCT;
      const delta = Math.min(deltaByPct, MAINTAIN_RECOMP_ABS_CAP_LB);
      const allowedMin = currentWeightLb - delta;
      const allowedMax = currentWeightLb + delta;
      return {
        minLb: allowedMin,
        maxLb: allowedMax,
        recommendedLb: currentWeightLb, // Default to current weight
        deltaLb: delta,
      };
    }

    default:
      // Fallback: allow any valid weight
      return {
        minLb: MIN_WEIGHT_LB,
        maxLb: MAX_WEIGHT_LB,
        recommendedLb: currentWeightLb,
      };
  }
}

/**
 * Validate goal weight input
 * @param params - Validation parameters
 * @returns Validation result with either success (ok: true) or error (ok: false with i18n key and optional params)
 */
export function validateGoalWeight(params: {
  currentWeightLb: number;
  goalType: GoalType;
  weightUnit: WeightUnit;
  targetInput: number;
}): { ok: true; targetLb: number } | { ok: false; i18nKey: string; i18nParams?: Record<string, any> } {
  const { currentWeightLb, goalType, weightUnit, targetInput } = params;

  // Global validation: must be a number
  if (isNaN(targetInput) || !isFinite(targetInput)) {
    return { ok: false, i18nKey: 'onboarding.goal_weight.goal_weight_error_invalid_number' };
  }

  // Convert target to lb for comparison (single source of truth)
  const targetLb = weightUnit === 'kg' ? kgToLb(targetInput) : targetInput;

  // Global validation: DB constraints
  if (targetLb < MIN_WEIGHT_LB || targetLb > MAX_WEIGHT_LB) {
    if (weightUnit === 'kg') {
      return {
        ok: false,
        i18nKey: 'onboarding.goal_weight.goal_weight_error_range_kg',
        i18nParams: { minKg: roundTo1(MIN_WEIGHT_KG), maxKg: roundTo1(MAX_WEIGHT_KG) },
      };
    } else {
      return {
        ok: false,
        i18nKey: 'onboarding.goal_weight.goal_weight_error_range_lb',
        i18nParams: { minLb: MIN_WEIGHT_LB, maxLb: MAX_WEIGHT_LB },
      };
    }
  }

  // Goal-specific validation
  switch (goalType) {
    case 'lose': {
      // Rule: target must be strictly less than current by at least MIN_DELTA_LOSE_LB
      // IMPORTANT: Check order matters - validate logical violation first, then range constraints
      const allowedMax = currentWeightLb - MIN_DELTA_LOSE_LB;
      const allowedMin = Math.max(MIN_WEIGHT_LB, currentWeightLb * (1 - MAX_DELTA_LOSE_PCT));

      // FIRST: Check if target is equal to or above current weight (logical violation)
      if (targetLb >= currentWeightLb) {
        return {
          ok: false,
          i18nKey: 'onboarding.goal_weight.goal_weight_error_lose_not_lower',
        };
      }

      // SECOND: Check if target is not low enough (minimum delta violation)
      if (targetLb > allowedMax) {
        return {
          ok: false,
          i18nKey: 'onboarding.goal_weight.goal_weight_error_lose_min_delta',
        };
      }

      // THIRD: Check if target is too aggressive (maximum delta violation)
      if (targetLb < allowedMin) {
        return {
          ok: false,
          i18nKey: 'onboarding.goal_weight.goal_weight_error_lose_too_aggressive',
        };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }

    case 'gain': {
      // Rule: target must be strictly greater than current by at least MIN_DELTA_GAIN_LB
      const allowedMin = currentWeightLb + MIN_DELTA_GAIN_LB;
      const allowedMax = Math.min(MAX_WEIGHT_LB, currentWeightLb * (1 + MAX_DELTA_GAIN_PCT));

      // FIRST: Check if target is equal to or below current weight (logical violation)
      if (targetLb <= currentWeightLb) {
        return {
          ok: false,
          i18nKey: 'onboarding.goal_weight.goal_weight_error_gain_not_higher',
        };
      }

      // SECOND: Check if target is not high enough (minimum delta violation)
      if (targetLb < allowedMin) {
        return {
          ok: false,
          i18nKey: 'onboarding.goal_weight.goal_weight_error_gain_min_delta',
          i18nParams: { minDelta: MIN_DELTA_GAIN_LB },
        };
      }

      // THIRD: Check if target is too aggressive (maximum delta violation)
      if (targetLb > allowedMax) {
        // Calculate milestone: currentWeight * (1 + MAX_DELTA_GAIN_PCT)
        const milestoneLb = currentWeightLb * (1 + MAX_DELTA_GAIN_PCT);
        const milestoneValue = weightUnit === 'kg' ? roundTo1(lbToKg(milestoneLb)) : roundTo1(milestoneLb);
        const unitLabel = weightUnit === 'kg' ? 'kg' : 'lb';
        
        return {
          ok: false,
          i18nKey: 'onboarding.goal_weight.goal_weight_error_gain_too_aggressive',
          i18nParams: {
            milestone: milestoneValue,
            unit: unitLabel,
          },
        };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }

    case 'maintain': {
      // Rule: target should be approximately current weight
      const deltaByPct = currentWeightLb * MAINTAIN_RECOMP_PCT;
      const delta = Math.min(deltaByPct, MAINTAIN_RECOMP_ABS_CAP_LB);
      const allowedMin = currentWeightLb - delta;
      const allowedMax = currentWeightLb + delta;

      if (targetLb < allowedMin || targetLb > allowedMax) {
        const deltaDisplay = weightUnit === 'kg' ? roundTo1(lbToKg(delta)) : roundTo1(delta);
        return {
          ok: false,
          i18nKey: weightUnit === 'kg' 
            ? 'onboarding.goal_weight.goal_weight_error_maintain_range_kg'
            : 'onboarding.goal_weight.goal_weight_error_maintain_range_lb',
          i18nParams: { delta: deltaDisplay },
        };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }

    case 'recomp': {
      // Rule: same as maintain but with recomp wording
      const deltaByPct = currentWeightLb * MAINTAIN_RECOMP_PCT;
      const delta = Math.min(deltaByPct, MAINTAIN_RECOMP_ABS_CAP_LB);
      const allowedMin = currentWeightLb - delta;
      const allowedMax = currentWeightLb + delta;

      if (targetLb < allowedMin || targetLb > allowedMax) {
        const deltaDisplay = weightUnit === 'kg' ? roundTo1(lbToKg(delta)) : roundTo1(delta);
        return {
          ok: false,
          i18nKey: weightUnit === 'kg'
            ? 'onboarding.goal_weight.goal_weight_error_recomp_range_kg'
            : 'onboarding.goal_weight.goal_weight_error_recomp_range_lb',
          i18nParams: { delta: deltaDisplay },
        };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }

    default:
      // Fallback: just check DB constraints (already done above)
      return { ok: true, targetLb: roundTo1(targetLb) };
  }
}

/**
 * Get formatted range display for UI helper text
 * @param params - Parameters for range calculation
 * @param weightUnit - Display unit
 * @returns Formatted string showing allowed range
 */
export function getGoalWeightRangeDisplay(params: {
  currentWeightLb: number;
  goalType: GoalType;
  weightUnit: WeightUnit;
}): string {
  const { currentWeightLb, goalType, weightUnit } = params;
  const range = getGoalWeightRange({ currentWeightLb, goalType });

  if (weightUnit === 'kg') {
    const minKg = roundTo1(lbToKg(range.minLb));
    const maxKg = roundTo1(lbToKg(range.maxLb));
    return `${minKg} - ${maxKg} kg`;
  } else {
    return `${roundTo1(range.minLb)} - ${roundTo1(range.maxLb)} lbs`;
  }
}

/**
 * Get recommended target weight in the specified unit
 * @param params - Parameters for recommendation
 * @returns Recommended target weight in the specified unit, or null if no valid recommendation
 */
export function getRecommendedTargetWeight(params: {
  currentWeightLb: number;
  goalType: GoalType;
  weightUnit: WeightUnit;
}): number | null {
  const { currentWeightLb, goalType, weightUnit } = params;
  const range = getGoalWeightRange({ currentWeightLb, goalType });
  const recommendedLb = range.recommendedLb;

  if (recommendedLb === null) {
    return null;
  }

  if (weightUnit === 'kg') {
    return roundTo1(lbToKg(recommendedLb));
  } else {
    return roundTo1(recommendedLb);
  }
}

