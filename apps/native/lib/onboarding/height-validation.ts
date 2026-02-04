import { PROFILES } from "@/constants/constraints";
import { ftInToCm } from "@/lib/validation/height";

export function validateHeightCm(
  heightCm: number | null,
  minCm: number = PROFILES.HEIGHT_CM.MIN,
  maxCm: number = PROFILES.HEIGHT_CM.MAX
): string | null {
  if (heightCm === null || isNaN(heightCm) || heightCm <= 0) {
    return "onboarding.height.error_height_required";
  }

  if (heightCm < minCm || heightCm > maxCm) {
    return "onboarding.height.error_height_invalid";
  }

  return null;
}

export function convertHeightToCm(
  unit: "cm" | "ft/in",
  cmValue?: string,
  ftValue?: string,
  inValue?: string
): number | null {
  if (unit === "cm") {
    const cm = cmValue ? parseFloat(cmValue) : NaN;
    return isNaN(cm) || cm <= 0 ? null : cm;
  }
  const ft = ftValue ? parseFloat(ftValue) : NaN;
  const inches = inValue ? parseFloat(inValue) : NaN;
  if (isNaN(ft) || isNaN(inches) || ft <= 0) {
    return null;
  }
  return ftInToCm(ft, inches);
}

export function validateHeightInputs(
  unit: "cm" | "ft/in",
  cmValue: string,
  ftValue: string,
  inValue: string
): { ok: boolean; cmValue?: number; errorKey?: string } {
  if (unit === "cm") {
    if (!cmValue.trim()) {
      return { ok: false, errorKey: "onboarding.height.error_height_required" };
    }
    const cm = parseFloat(cmValue);
    if (isNaN(cm) || cm <= 0) {
      return { ok: false, errorKey: "onboarding.height.error_height_required" };
    }
    const errorKey = validateHeightCm(cm);
    if (errorKey) {
      return { ok: false, errorKey };
    }
    return { ok: true, cmValue: cm };
  }

  if (!ftValue.trim() && !inValue.trim()) {
    return { ok: false, errorKey: "onboarding.height.error_height_required" };
  }

  const ft = parseFloat(ftValue);
  const inches = parseFloat(inValue);
  if (isNaN(ft) || isNaN(inches) || ft <= 0) {
    return { ok: false, errorKey: "onboarding.height.error_height_required" };
  }

  const cmValueFromUnit = ftInToCm(ft, inches);
  const errorKey = validateHeightCm(cmValueFromUnit);
  if (errorKey) {
    return { ok: false, errorKey };
  }

  return { ok: true, cmValue: cmValueFromUnit };
}
