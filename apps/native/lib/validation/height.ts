import { PROFILES } from "@/constants/constraints";

export type HeightUnit = "cm" | "ft/in";

export function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function ftInToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return totalInches * 2.54;
}

export function cmToFtIn(cm: number): { feet: number; inches: number } | null {
  if (isNaN(cm) || cm <= 0) return null;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function convertHeightToCm(
  unit: HeightUnit,
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
  unit: HeightUnit,
  cmValue: string,
  ftValue: string,
  inValue: string
): { ok: boolean; cmValue?: number; errorKey?: string } {
  if (unit === "cm") {
    if (!cmValue.trim()) {
      return { ok: false, errorKey: "onboarding.height.error_height_required" };
    }
    const cm = parseFloat(cmValue);
    if (isNaN(cm)) {
      return { ok: false, errorKey: "onboarding.height.error_height_required" };
    }
    if (cm < PROFILES.HEIGHT_CM.MIN || cm > PROFILES.HEIGHT_CM.MAX) {
      return { ok: false, errorKey: "onboarding.height.error_height_invalid" };
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
  if (cmValueFromUnit < PROFILES.HEIGHT_CM.MIN || cmValueFromUnit > PROFILES.HEIGHT_CM.MAX) {
    return { ok: false, errorKey: "onboarding.height.error_height_invalid" };
  }

  return { ok: true, cmValue: cmValueFromUnit };
}
