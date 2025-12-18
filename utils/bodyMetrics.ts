/**
 * DOMAIN UTILITIES - Body Metrics Calculations
 * 
 * Pure functions for body metrics calculations and conversions.
 * Per engineering guidelines section 7:
 * - Domain logic lives in plain TS modules
 * - No React/browser/UI imports allowed
 */

import { kgToLb, lbToKg } from '@/lib/domain/weight-constants';

/**
 * Round helpers
 * Use simple decimal rounding to avoid floating point drift in UI
 */
export function roundTo1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function roundTo2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function roundTo3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

// Re-export weight conversion functions from weight-constants.ts for backward compatibility
export { kgToLb, lbToKg };

// Back-compat aliases used by existing code
export const kgToLbs = kgToLb;
export const lbsToKg = lbToKg;

// Lightweight inline roundtrip checks to ensure UI-level stability at 1 decimal
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const roundTripValues = [70, 82.5, 100];
  roundTripValues.forEach((value) => {
    const displayKg = roundTo1(lbToKg(roundTo3(kgToLb(value))));
    const expected = roundTo1(value);
    console.assert(
      displayKg === expected,
      `kg->lb->kg roundtrip mismatch: input ${value}kg, got ${displayKg}kg`
    );
  });

  const bfValues = [12.3, 18.7, 24.95];
  bfValues.forEach((value) => {
    const stored = roundTo2(value);
    const display = roundTo1(stored);
    const expected = roundTo1(value);
    console.assert(
      display === expected,
      `body fat round mismatch: input ${value}%, stored ${stored}%, display ${display}%`
    );
  });
}

/**
 * Convert centimeters to meters
 * @param cm - Height in centimeters
 * @returns Height in meters
 */
export function cmToMeters(cm: number): number {
  return cm / 100;
}

/**
 * Convert feet and inches to centimeters
 * @param feet - Height in feet
 * @param inches - Height in inches
 * @returns Height in centimeters
 */
export function ftInToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return totalInches * 2.54;
}

/**
 * Convert centimeters to feet and inches
 * @param cm - Height in centimeters
 * @returns Object with feet and inches, or null if invalid
 */
export function cmToFtIn(cm: number): { feet: number; inches: number } | null {
  if (isNaN(cm) || cm <= 0) return null;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

/**
 * Convert centimeters to inches
 * @param cm - Height in centimeters
 * @returns Height in inches
 */
export function cmToInches(cm: number): number {
  return cm / 2.54;
}

/**
 * Convert inches to centimeters
 * @param inches - Height in inches
 * @returns Height in centimeters
 */
export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

/**
 * Converts height from form inputs to centimeters
 * Handles both cm and ft/in inputs
 * @param unit - Unit type: 'cm' or 'ft/in'
 * @param cmValue - Height in cm as string (for 'cm' unit)
 * @param ftValue - Height in feet as string (for 'ft/in' unit)
 * @param inValue - Height in inches as string (for 'ft/in' unit)
 * @returns Height in centimeters, or null if invalid
 */
export function convertHeightToCm(
  unit: 'cm' | 'ft/in',
  cmValue?: string,
  ftValue?: string,
  inValue?: string
): number | null {
  if (unit === 'cm') {
    const cm = cmValue ? parseFloat(cmValue) : NaN;
    return isNaN(cm) || cm <= 0 ? null : cm;
  } else {
    const ft = ftValue ? parseFloat(ftValue) : NaN;
    const inches = inValue ? parseFloat(inValue) : NaN;
    if (isNaN(ft) || isNaN(inches) || ft <= 0) {
      return null;
    }
    return ftInToCm(ft, inches);
  }
}

/**
 * Converts weight from form inputs to kilograms
 * Handles both kg and lbs inputs
 * @param unit - Unit type: 'kg' or 'lbs'
 * @param kgValue - Weight in kg as string (for 'kg' unit)
 * @param lbsValue - Weight in lbs as string (for 'lbs' unit)
 * @returns Weight in kilograms, or null if invalid
 */
export function convertWeightToKg(
  unit: 'kg' | 'lbs',
  kgValue?: string,
  lbsValue?: string
): number | null {
  if (unit === 'kg') {
    const kg = kgValue ? parseFloat(kgValue) : NaN;
    return isNaN(kg) || kg <= 0 ? null : kg;
  } else {
    const lbs = lbsValue ? parseFloat(lbsValue) : NaN;
    if (isNaN(lbs) || lbs <= 0) {
      return null;
    }
    return lbsToKg(lbs);
  }
}

/**
 * Calculate BMI from weight (kg) and height (cm)
 * Uses metric formula: BMI = weight(kg) / height(m)²
 * 
 * @param weightKg - Weight in kilograms
 * @param heightCm - Height in centimeters
 * @returns BMI value rounded to 1 decimal place, or null if inputs are invalid
 */
export function calculateBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg === null || heightCm === null || weightKg <= 0 || heightCm <= 0) {
    return null;
  }
  
  const heightM = cmToMeters(heightCm);
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10; // Round to 1 decimal place
}

/**
 * BMI classification ranges
 */
export type BMIClassification = 'underweight' | 'normal' | 'overweight' | 'obese';

/**
 * Get BMI classification based on BMI value
 * 
 * @param bmi - BMI value
 * @returns BMI classification string key for i18n
 */
export function getBmiClassification(bmi: number | null): BMIClassification | null {
  if (bmi === null) {
    return null;
  }
  
  if (bmi < 18.5) {
    return 'underweight';
  } else if (bmi < 25) {
    return 'normal';
  } else if (bmi < 30) {
    return 'overweight';
  } else {
    return 'obese';
  }
}

/**
 * Get BMI classification i18n key
 * 
 * @param classification - BMI classification
 * @returns i18n key for the classification label
 */
export function getBmiClassificationKey(classification: BMIClassification | null): string {
  if (!classification) {
    return 'dashboard.body.bmi.no_data';
  }
  
  switch (classification) {
    case 'underweight':
      return 'dashboard.body.bmi.classification.underweight';
    case 'normal':
      return 'dashboard.body.bmi.classification.normal';
    case 'overweight':
      return 'dashboard.body.bmi.classification.overweight';
    case 'obese':
      return 'dashboard.body.bmi.classification.obese';
  }
}

