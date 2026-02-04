import { PROFILES } from "@/constants/constraints";
import { lbToKg, roundTo1 } from "@/lib/domain/conversions";
import { APP_MAX_CURRENT_WEIGHT_LB, APP_MIN_CURRENT_WEIGHT_LB } from "@/lib/domain/weight-constants";

export function validateWeightKg(
  weightKg: number | null,
  minKg: number = roundTo1(lbToKg(APP_MIN_CURRENT_WEIGHT_LB)),
  maxKg: number = roundTo1(lbToKg(APP_MAX_CURRENT_WEIGHT_LB))
): string | null {
  if (weightKg === null || isNaN(weightKg) || weightKg <= 0) {
    return "onboarding.current_weight.error_weight_required";
  }

  if (weightKg < minKg || weightKg > maxKg) {
    return "onboarding.current_weight.error_weight_invalid";
  }

  return null;
}

export function validateBodyFatPercent(
  bodyFatPercent: number | null | undefined,
  minExclusivePercent: number = PROFILES.BODY_FAT_PERCENT.MIN_EXCLUSIVE,
  maxPercent: number = PROFILES.BODY_FAT_PERCENT.MAX
): string | null {
  if (bodyFatPercent === null || bodyFatPercent === undefined) {
    return null;
  }

  if (isNaN(bodyFatPercent)) {
    return "onboarding.current_weight.error_body_fat_invalid";
  }

  if (bodyFatPercent <= minExclusivePercent || bodyFatPercent > maxPercent) {
    return "onboarding.current_weight.error_body_fat_invalid";
  }

  return null;
}
