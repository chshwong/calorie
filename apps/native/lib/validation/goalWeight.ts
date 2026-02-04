import { DERIVED, PROFILES } from "@/constants/constraints";
import {
  kgToLb,
  lbToKg,
  MAINTAIN_RECOMP_ABS_CAP_LB,
  MAINTAIN_RECOMP_PCT,
  MAX_DELTA_GAIN_PCT,
  MAX_DELTA_LOSE_PCT,
  MIN_DELTA_GAIN_LB,
  MIN_DELTA_LOSE_LB,
} from "@/lib/domain/weight-constants";

export type GoalType = "lose" | "gain" | "maintain" | "recomp";
export type WeightUnit = "kg" | "lb";

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function validateGoalWeight(params: {
  currentWeightLb: number;
  goalType: GoalType;
  weightUnit: WeightUnit;
  targetInput: number;
}): { ok: true; targetLb: number } | { ok: false; i18nKey: string; i18nParams?: Record<string, any> } {
  const { currentWeightLb, goalType, weightUnit, targetInput } = params;

  if (isNaN(targetInput) || !isFinite(targetInput)) {
    return { ok: false, i18nKey: "onboarding.goal_weight.goal_weight_error_invalid_number" };
  }

  const targetLb = weightUnit === "kg" ? kgToLb(targetInput) : targetInput;

  if (targetLb < PROFILES.WEIGHT_LB.MIN || targetLb > PROFILES.WEIGHT_LB.MAX) {
    if (weightUnit === "kg") {
      return {
        ok: false,
        i18nKey: "onboarding.goal_weight.goal_weight_error_range_kg",
        i18nParams: { minKg: roundTo1(DERIVED.WEIGHT_KG.MIN), maxKg: roundTo1(DERIVED.WEIGHT_KG.MAX) },
      };
    }
    return {
      ok: false,
      i18nKey: "onboarding.goal_weight.goal_weight_error_range_lb",
      i18nParams: { minLb: PROFILES.WEIGHT_LB.MIN, maxLb: PROFILES.WEIGHT_LB.MAX },
    };
  }

  switch (goalType) {
    case "lose": {
      const allowedMax = currentWeightLb - MIN_DELTA_LOSE_LB;
      const allowedMin = Math.max(PROFILES.WEIGHT_LB.MIN, currentWeightLb * (1 - MAX_DELTA_LOSE_PCT));

      if (targetLb >= currentWeightLb) {
        return { ok: false, i18nKey: "onboarding.goal_weight.goal_weight_error_lose_not_lower" };
      }
      if (targetLb > allowedMax) {
        return { ok: false, i18nKey: "onboarding.goal_weight.goal_weight_error_lose_min_delta" };
      }
      if (targetLb < allowedMin) {
        return { ok: false, i18nKey: "onboarding.goal_weight.goal_weight_error_lose_too_aggressive" };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }
    case "gain": {
      const allowedMin = currentWeightLb + MIN_DELTA_GAIN_LB;
      const allowedMax = Math.min(PROFILES.WEIGHT_LB.MAX, currentWeightLb * (1 + MAX_DELTA_GAIN_PCT));

      if (targetLb <= currentWeightLb) {
        return { ok: false, i18nKey: "onboarding.goal_weight.goal_weight_error_gain_not_higher" };
      }
      if (targetLb < allowedMin) {
        return {
          ok: false,
          i18nKey: "onboarding.goal_weight.goal_weight_error_gain_min_delta",
          i18nParams: { minDelta: MIN_DELTA_GAIN_LB },
        };
      }
      if (targetLb > allowedMax) {
        const milestoneLb = currentWeightLb * (1 + MAX_DELTA_GAIN_PCT);
        const milestoneValue = weightUnit === "kg" ? roundTo1(lbToKg(milestoneLb)) : roundTo1(milestoneLb);
        const unitLabel = weightUnit === "kg" ? "kg" : "lb";
        return {
          ok: false,
          i18nKey: "onboarding.goal_weight.goal_weight_error_gain_too_aggressive",
          i18nParams: { milestone: milestoneValue, unit: unitLabel },
        };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }
    case "maintain": {
      const deltaByPct = currentWeightLb * MAINTAIN_RECOMP_PCT;
      const delta = Math.min(deltaByPct, MAINTAIN_RECOMP_ABS_CAP_LB);
      const allowedMin = currentWeightLb - delta;
      const allowedMax = currentWeightLb + delta;

      if (targetLb < allowedMin || targetLb > allowedMax) {
        const deltaDisplay = weightUnit === "kg" ? roundTo1(lbToKg(delta)) : roundTo1(delta);
        return {
          ok: false,
          i18nKey:
            weightUnit === "kg"
              ? "onboarding.goal_weight.goal_weight_error_maintain_range_kg"
              : "onboarding.goal_weight.goal_weight_error_maintain_range_lb",
          i18nParams: { delta: deltaDisplay },
        };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }
    case "recomp": {
      const deltaByPct = currentWeightLb * MAINTAIN_RECOMP_PCT;
      const delta = Math.min(deltaByPct, MAINTAIN_RECOMP_ABS_CAP_LB);
      const allowedMin = currentWeightLb - delta;
      const allowedMax = currentWeightLb + delta;

      if (targetLb < allowedMin || targetLb > allowedMax) {
        const deltaDisplay = weightUnit === "kg" ? roundTo1(lbToKg(delta)) : roundTo1(delta);
        return {
          ok: false,
          i18nKey:
            weightUnit === "kg"
              ? "onboarding.goal_weight.goal_weight_error_recomp_range_kg"
              : "onboarding.goal_weight.goal_weight_error_recomp_range_lb",
          i18nParams: { delta: deltaDisplay },
        };
      }

      return { ok: true, targetLb: roundTo1(targetLb) };
    }
    default:
      return { ok: true, targetLb: roundTo1(targetLb) };
  }
}
