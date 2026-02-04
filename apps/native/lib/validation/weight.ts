import { DERIVED, PROFILES } from "@/constants/constraints";
import { kgToLb, lbToKg } from "@/lib/domain/weight-constants";
import { filterNumericInput } from "@/lib/validation/inputFilters";

export type WeightUnit = "kg" | "lb";

export function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundTo3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function limitToOneDecimal(text: string): string {
  const filtered = filterNumericInput(text);
  const parts = filtered.split(".");
  if (parts.length <= 1) return filtered;
  return `${parts[0]}.${parts[1].slice(0, 1)}`;
}

export function limitWeightInput(text: string): string {
  const oneDecimal = limitToOneDecimal(text);
  const [intPart, decPart] = oneDecimal.split(".");
  const limitedInt = intPart.slice(0, 3);
  return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
}

export function limitBodyFatInput(text: string): string {
  const oneDecimal = limitToOneDecimal(text);
  const [intPart, decPart] = oneDecimal.split(".");
  const limitedInt = intPart.slice(0, 2);
  return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
}

export function validateWeightKg(value: number | null): string | null {
  if (value === null || isNaN(value) || value <= 0) {
    return "onboarding.current_weight.error_weight_required";
  }
  if (value < DERIVED.WEIGHT_KG.MIN || value > DERIVED.WEIGHT_KG.MAX) {
    return "onboarding.current_weight.error_weight_invalid";
  }
  return null;
}

export function validateWeightLb(value: number | null): string | null {
  if (value === null || isNaN(value) || value <= 0) {
    return "onboarding.current_weight.error_weight_required";
  }
  if (value < PROFILES.WEIGHT_LB.MIN || value > PROFILES.WEIGHT_LB.MAX) {
    return "onboarding.current_weight.error_weight_invalid";
  }
  return null;
}

export function validateBodyFatPercent(value: number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (isNaN(value)) {
    return "onboarding.current_weight.error_body_fat_invalid";
  }
  if (value <= PROFILES.BODY_FAT_PERCENT.MIN_EXCLUSIVE || value > PROFILES.BODY_FAT_PERCENT.MAX) {
    return "onboarding.current_weight.error_body_fat_invalid";
  }
  return null;
}

export function convertWeightToKg(
  unit: WeightUnit,
  kgValue?: string,
  lbValue?: string
): number | null {
  if (unit === "kg") {
    const kg = kgValue ? parseFloat(kgValue) : NaN;
    return isNaN(kg) || kg <= 0 ? null : kg;
  }
  const lb = lbValue ? parseFloat(lbValue) : NaN;
  if (isNaN(lb) || lb <= 0) {
    return null;
  }
  return lbToKg(lb);
}

export { kgToLb, lbToKg };
