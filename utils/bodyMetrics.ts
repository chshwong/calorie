/**
 * DOMAIN UTILITIES - Body Metrics Calculations
 * 
 * Pure functions for body metrics calculations and conversions.
 * Per engineering guidelines section 7:
 * - Domain logic lives in plain TS modules
 * - No React/browser/UI imports allowed
 */

/**
 * Convert kilograms to pounds
 * @param kg - Weight in kilograms
 * @returns Weight in pounds
 */
export function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

/**
 * Convert pounds to kilograms
 * @param lbs - Weight in pounds
 * @returns Weight in kilograms
 */
export function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
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

