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

  // Get validity range
  const validityRange = getGoalValidityRangeLb({ goalType, currentWeightLb });
  const validityMinLb = validityRange.minLb;
  const validityMaxLb = validityRange.maxLb;

  // For maintain/recomp: return current weight
  if (goalType === 'maintain' || goalType === 'recomp') {
    return {
      ok: true,
      suggestedLb: currentWeightLb,
      minAllowedLb: validityMinLb,
      maxAllowedLb: validityMaxLb,
      wasClamped: false,
    };
  }

  // For lose/gain: require height, sex, and dob
  if (heightCm === null || sexAtBirth === null || dobISO === null) {
    return {
      ok: false,
      code: 'MISSING_INPUTS',
      messageKey: 'onboarding.goal_weight.suggestion_unavailable',
    };
  }

  // Compute safe range from BMI guardrails
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

  // DB range
  const dbRange: [number, number] = [DB_MIN_WEIGHT_LB, DB_MAX_WEIGHT_LB];
  
  // Safe range
  const safeRange: [number, number] = [minSafeLb, maxSafeLb];
  
  // Validity range
  const validityRangeTuple: [number, number] = [validityMinLb, validityMaxLb];

  // Compute feasible range as intersection
  const feasibleRange = intersectRanges([dbRange, safeRange, validityRangeTuple]);

  // If no feasible range, return error
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
        feasibleRange: null,
      },
    };
  }

  const [feasibleMinLb, feasibleMaxLb] = feasibleRange;

  // Compute base suggestion
  let baseSuggestion: number;
  if (goalType === 'lose') {
    baseSuggestion = currentWeightLb * (1 - WEIGHT_LOSS_SUGGESTION_PCT);
  } else {
    // gain
    baseSuggestion = currentWeightLb * (1 + WEIGHT_GAIN_SUGGESTION_PCT);
  }

  // Clamp base suggestion into feasible range
  let suggestedLb = Math.max(feasibleMinLb, Math.min(feasibleMaxLb, baseSuggestion));
  const wasClamped = baseSuggestion !== suggestedLb;

  // Additional guards to ensure logical consistency
  if (goalType === 'lose' && suggestedLb > currentWeightLb) {
    suggestedLb = currentWeightLb;
  }
  if (goalType === 'gain' && suggestedLb < currentWeightLb) {
    suggestedLb = currentWeightLb;
  }

  return {
    ok: true,
    suggestedLb,
    minAllowedLb: feasibleMinLb,
    maxAllowedLb: feasibleMaxLb,
    wasClamped,
  };
}

