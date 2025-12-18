/**
 * Goal Weight Rules and Suggestion Engine
 * 
 * Provides suggested target weights for placeholder/helper text.
 * MUST NEVER return a value that would fail the validator rules.
 * 
 * Computes feasible range as intersection of:
 * - DB bounds
 * - Safe bounds (BMI min/max)
 * - Goal validity bounds (same rule shape as validator)
 * 
 * Per engineering guidelines section 3.5: Centralized constraints and validation
 */

import {
  DB_MIN_WEIGHT_LB,
  DB_MAX_WEIGHT_LB,
  MIN_DELTA_LOSE_LB,
  MIN_DELTA_GAIN_LB,
  MAX_DELTA_LOSE_PCT,
  MAX_DELTA_GAIN_PCT,
  MAINTAIN_RECOMP_PCT,
  MAINTAIN_RECOMP_ABS_CAP_LB,
  WEIGHT_LOSS_SUGGESTION_PCT,
  WEIGHT_GAIN_SUGGESTION_PCT,
  WEIGHT_LOSS_SUGGESTION_MAX_LB,
  WEIGHT_GAIN_SUGGESTION_MAX_LB,
} from '@/lib/domain/weight-constants';
import {
  getMinSafeWeightLb,
  getMaxSafeWeightLb,
  type SexAtBirth,
} from '@/lib/onboarding/weight-safety';

export type GoalType = 'lose' | 'gain' | 'maintain' | 'recomp';

export type SuggestionResult =
  | {
      ok: true;
      suggestedLb: number;
      minAllowedLb: number;
      maxAllowedLb: number;
      wasClamped: boolean;
    }
  | {
      ok: false;
      code: 'NO_FEASIBLE_RANGE' | 'MISSING_INPUTS';
      messageKey: string;
      messageParams?: Record<string, any>;
      meta?: Record<string, any>;
    };

/**
 * Get the goal validity range in pounds
 * 
 * Computes the allowed weight range based on goal type and current weight,
 * using the same rules as the validator.
 * 
 * @param params - Parameters for range calculation
 * @param params.goalType - Type of goal (lose, gain, maintain, recomp)
 * @param params.currentWeightLb - Current weight in pounds
 * @returns Object with min/max weights in pounds, and optional delta for maintain/recomp
 */
export function getGoalValidityRangeLb(params: {
  goalType: GoalType;
  currentWeightLb: number;
}): { minLb: number; maxLb: number; deltaLb?: number } {
  const { goalType, currentWeightLb } = params;

  let minLb: number;
  let maxLb: number;
  let deltaLb: number | undefined;

  switch (goalType) {
    case 'lose': {
      // lose: minLb = currentWeightLb * (1 - MAX_DELTA_LOSE_PCT), maxLb = currentWeightLb - MIN_DELTA_LOSE_LB
      minLb = currentWeightLb * (1 - MAX_DELTA_LOSE_PCT);
      maxLb = currentWeightLb - MIN_DELTA_LOSE_LB;
      break;
    }

    case 'gain': {
      // gain: minLb = currentWeightLb + MIN_DELTA_GAIN_LB, maxLb = currentWeightLb * (1 + MAX_DELTA_GAIN_PCT)
      minLb = currentWeightLb + MIN_DELTA_GAIN_LB;
      maxLb = currentWeightLb * (1 + MAX_DELTA_GAIN_PCT);
      break;
    }

    case 'maintain':
    case 'recomp': {
      // maintain/recomp: delta = min(currentWeightLb * MAINTAIN_RECOMP_PCT, MAINTAIN_RECOMP_ABS_CAP_LB)
      // minLb = currentWeightLb - delta, maxLb = currentWeightLb + delta
      deltaLb = Math.min(currentWeightLb * MAINTAIN_RECOMP_PCT, MAINTAIN_RECOMP_ABS_CAP_LB);
      minLb = currentWeightLb - deltaLb;
      maxLb = currentWeightLb + deltaLb;
      break;
    }
  }

  // Clamp min/max by DB bounds
  minLb = Math.max(DB_MIN_WEIGHT_LB, Math.min(DB_MAX_WEIGHT_LB, minLb));
  maxLb = Math.max(DB_MIN_WEIGHT_LB, Math.min(DB_MAX_WEIGHT_LB, maxLb));

  return { minLb, maxLb, deltaLb };
}

/**
 * Compute intersection of multiple ranges
 * @param ranges - Array of [min, max] ranges
 * @returns Intersection range [min, max] or null if no intersection
 */
function intersectRanges(ranges: Array<[number, number]>): [number, number] | null {
  if (ranges.length === 0) {
    return null;
  }

  let min = ranges[0][0];
  let max = ranges[0][1];

  for (let i = 1; i < ranges.length; i++) {
    const [rangeMin, rangeMax] = ranges[i];
    
    // Find intersection
    const newMin = Math.max(min, rangeMin);
    const newMax = Math.min(max, rangeMax);
    
    // If no intersection, return null
    if (newMin > newMax) {
      return null;
    }
    
    min = newMin;
    max = newMax;
  }

  return [min, max];
}

/**
 * Get suggested target weight in pounds
 * 
 * Computes a suggested target weight that respects:
 * - DB constraints
 * - Safe BMI bounds (if height/sex/dob provided)
 * - Goal validity bounds
 * 
 * @param params - Parameters for suggestion calculation
 * @param params.goalType - Type of goal (lose, gain, maintain, recomp)
 * @param params.currentWeightLb - Current weight in pounds
 * @param params.heightCm - Height in centimeters (required for lose/gain)
 * @param params.sexAtBirth - Sex at birth (required for lose/gain)
 * @param params.dobISO - Date of birth in ISO format (required for lose/gain)
 * @returns Suggestion result with suggested weight or error
 */
export function getSuggestedTargetWeightLb(params: {
  goalType: GoalType;
  currentWeightLb: number;
  heightCm: number | null;
  sexAtBirth: string | null;
  dobISO: string | null;
}): SuggestionResult {
  const { goalType, currentWeightLb, heightCm, sexAtBirth, dobISO } = params;

  // Get validity range (validator-shaped)
  const validityRange = getGoalValidityRangeLb({ goalType, currentWeightLb });
  const validityMinLb = validityRange.minLb;
  const validityMaxLb = validityRange.maxLb;

  // Maintain/Recomp: suggest current weight
  if (goalType === 'maintain' || goalType === 'recomp') {
    return {
      ok: true,
      suggestedLb: currentWeightLb,
      minAllowedLb: validityMinLb,
      maxAllowedLb: validityMaxLb,
      wasClamped: false,
    };
  }

  // Lose/Gain require height, sex, dob for safety bounds
  if (heightCm === null || sexAtBirth === null || dobISO === null) {
    return {
      ok: false,
      code: 'MISSING_INPUTS',
      messageKey: 'onboarding.goal_weight.suggestion_unavailable',
    };
  }

  // Safe BMI bounds
  const minSafeLb = getMinSafeWeightLb({
    heightCm,
    sexAtBirth: sexAtBirth as SexAtBirth,
    dobISO,
  });
  const maxSafeLb = getMaxSafeWeightLb({
    heightCm,
    sexAtBirth: sexAtBirth as SexAtBirth,
    dobISO,
  });

  const dbRange: [number, number] = [DB_MIN_WEIGHT_LB, DB_MAX_WEIGHT_LB];
  const validityRangeTuple: [number, number] = [validityMinLb, validityMaxLb];

  // Goal-specific interpretation of "safe" bounds:
  // - LOSE: maxSafe is advisory (do not block loss suggestions above it), minSafe is a hard floor
  // - GAIN: minSafe is advisory (do not block gain suggestions below it), maxSafe is a hard ceiling
  const safeRange: [number, number] =
    goalType === 'gain'
      ? [DB_MIN_WEIGHT_LB, maxSafeLb]
      : [minSafeLb, DB_MAX_WEIGHT_LB];

  // Compute base suggestion and a HARD "suggestion-cap range" that must not be violated
  let baseSuggestion: number;
  let suggestionCapRange: [number, number];

  if (goalType === 'lose') {
    const lossLbRaw = currentWeightLb * WEIGHT_LOSS_SUGGESTION_PCT;
    const lossLbCap = Math.min(lossLbRaw, WEIGHT_LOSS_SUGGESTION_MAX_LB);

    if (lossLbCap < MIN_DELTA_LOSE_LB) {
      return {
        ok: false,
        code: 'NO_FEASIBLE_RANGE',
        messageKey: 'onboarding.goal_weight.suggestion_unavailable',
        meta: {
          reason: 'LOSS_CAP_BELOW_MIN_DELTA',
          currentWeightLb,
          lossLbCap,
          minDeltaLoseLb: MIN_DELTA_LOSE_LB,
        },
      };
    }

    baseSuggestion = currentWeightLb - lossLbCap;

    // Must stay within: [current - lossCap, current - MIN_DELTA]
    suggestionCapRange = [
      currentWeightLb - lossLbCap,
      currentWeightLb - MIN_DELTA_LOSE_LB,
    ];
  } else {
    const gainLbRaw = currentWeightLb * WEIGHT_GAIN_SUGGESTION_PCT;
    const gainLbCap = Math.min(gainLbRaw, WEIGHT_GAIN_SUGGESTION_MAX_LB);

    if (gainLbCap < MIN_DELTA_GAIN_LB) {
      return {
        ok: false,
        code: 'NO_FEASIBLE_RANGE',
        messageKey: 'onboarding.goal_weight.suggestion_unavailable',
        meta: {
          reason: 'GAIN_CAP_BELOW_MIN_DELTA',
          currentWeightLb,
          gainLbCap,
          minDeltaGainLb: MIN_DELTA_GAIN_LB,
        },
      };
    }

    baseSuggestion = currentWeightLb + gainLbCap;

    // Must stay within: [current + MIN_DELTA, current + gainCap]
    suggestionCapRange = [
      currentWeightLb + MIN_DELTA_GAIN_LB,
      currentWeightLb + gainLbCap,
    ];
  }

  // Feasible range is intersection of constraints.
  // - For LOSE: we do not include maxSafeLb (advisory), only enforce minSafe floor.
  // - For GAIN: we do not include minSafeLb (advisory), only enforce maxSafe ceiling.
  const feasibleRange = intersectRanges([
    dbRange,
    safeRange,
    validityRangeTuple,
    suggestionCapRange,
  ]);

  if (feasibleRange === null) {
    return {
      ok: false,
      code: 'NO_FEASIBLE_RANGE',
      messageKey: 'onboarding.goal_weight.suggestion_unavailable',
      meta: {
        currentWeightLb,
        minSafeLb,
        maxSafeLb,
        validityRange: { minLb: validityMinLb, maxLb: validityMaxLb },
        suggestionCapRange,
        safeRangeUsed: safeRange,
      },
    };
  }

  const [feasibleMinLb, feasibleMaxLb] = feasibleRange;

  // Clamp base suggestion into feasible intersection (guaranteed to never violate caps)
  const suggestedLb = Math.max(feasibleMinLb, Math.min(feasibleMaxLb, baseSuggestion));
  const wasClamped = suggestedLb !== baseSuggestion;

  const result: SuggestionResult = {
    ok: true,
    suggestedLb,
    minAllowedLb: feasibleMinLb,
    maxAllowedLb: feasibleMaxLb,
    wasClamped,
  };

  // Advisory metadata:
  // - Gain: if still below minSafe after suggested gain
  if (goalType === 'gain' && suggestedLb < minSafeLb) {
    result.meta = {
      ...(result.meta || {}),
      advisory: 'SUGGESTION_BELOW_MIN_SAFE',
      minSafeLb,
    };
  }

  // - Lose: if still above maxSafe even after suggested loss (advisory only)
  if (goalType === 'lose' && suggestedLb > maxSafeLb) {
    result.meta = {
      ...(result.meta || {}),
      advisory: 'SUGGESTION_ABOVE_MAX_SAFE',
      maxSafeLb,
    };
  }

  return result;
}
