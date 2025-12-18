/**
 * Weight Safety Computation Module
 * 
 * Computes safe min/max weight ranges based on BMI guardrails, age, sex, and height.
 * All calculations use constants from weight-constants.ts as the single source of truth.
 * 
 * Per engineering guidelines section 3.5: Centralized constraints and validation
 */

import {
  MIN_BMI,
  MAX_BMI,
  SAFE_MIN_BUFFER_KG,
  DB_MIN_WEIGHT_LB,
  DB_MAX_WEIGHT_LB,
  kgToLb,
} from '@/lib/domain/weight-constants';

/**
 * Sex at birth type - accepts existing values from the codebase
 */
export type SexAtBirth = string;

/**
 * Get age in years from date of birth
 * @param dobISO - Date of birth in ISO format (YYYY-MM-DD)
 * @param today - Reference date (defaults to current date)
 * @returns Age in years as an integer
 */
export function getAgeYears(dobISO: string, today = new Date()): number {
  // Parse YYYY-MM-DD safely
  const [year, month, day] = dobISO.split('-').map(Number);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dobISO}. Expected YYYY-MM-DD`);
  }
  
  // Create date object (month is 0-indexed in JavaScript Date)
  const birthDate = new Date(year, month - 1, day);
  
  // Validate the date is valid
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    throw new Error(`Invalid date: ${dobISO}`);
  }
  
  // Compute integer age
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Normalize sex at birth to standard values
 * @param sexAtBirth - Sex at birth value from the codebase
 * @returns Normalized value: 'male', 'female', or 'unknown'
 */
export function normalizeSexAtBirth(sexAtBirth: SexAtBirth): 'male' | 'female' | 'unknown' {
  const normalized = sexAtBirth?.toLowerCase().trim();
  
  if (normalized === 'male') {
    return 'male';
  }
  
  if (normalized === 'female') {
    return 'female';
  }
  
  // Everything else -> unknown
  return 'unknown';
}

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert centimeters to meters
 * @param cm - Height in centimeters
 * @returns Height in meters
 */
function cmToMeters(cm: number): number {
  return cm / 100;
}

/**
 * Get minimum safe weight in pounds based on BMI guardrails
 * 
 * Computes the minimum safe weight by:
 * 1. Determining BMI floor based on sex and age (<65 vs >=65)
 * 2. Calculating minimum weight in kg: minBMI * (heightM^2)
 * 3. Adding safety buffer: minKg + SAFE_MIN_BUFFER_KG
 * 4. Converting to pounds
 * 5. Clamping to DB range
 * 
 * @param params - Parameters for calculation
 * @param params.heightCm - Height in centimeters
 * @param params.sexAtBirth - Sex at birth
 * @param params.dobISO - Date of birth in ISO format (YYYY-MM-DD)
 * @returns Minimum safe weight in pounds, clamped to DB range
 */
export function getMinSafeWeightLb(params: {
  heightCm: number;
  sexAtBirth: SexAtBirth;
  dobISO: string;
}): number {
  const { heightCm, sexAtBirth, dobISO } = params;
  
  // Normalize sex at birth
  const normalizedSex = normalizeSexAtBirth(sexAtBirth);
  
  // Get age
  const age = getAgeYears(dobISO);
  
  // Determine age bucket (<65 vs >=65)
  const ageBucket = age < 65 ? 'under65' : 'over65';
  
  // Get BMI floor by sex + age bucket
  const minBMI = MIN_BMI[normalizedSex][ageBucket];
  
  // Convert height to meters
  const heightM = cmToMeters(heightCm);
  
  // Calculate minimum weight in kg: minBMI * (heightM^2)
  const minKg = minBMI * (heightM * heightM);
  
  // Add safety buffer
  const minKgBuffered = minKg + SAFE_MIN_BUFFER_KG;
  
  // Convert to pounds
  const minSafeLb = kgToLb(minKgBuffered);
  
  // Clamp to DB range for sanity
  return clamp(minSafeLb, DB_MIN_WEIGHT_LB, DB_MAX_WEIGHT_LB);
}

/**
 * Get maximum safe weight in pounds based on BMI guardrails
 * 
 * Computes the maximum safe weight by:
 * 1. Determining BMI ceiling based on sex and age (<65 vs >=65)
 * 2. Calculating maximum weight in kg: maxBMI * (heightM^2)
 * 3. Converting to pounds
 * 4. Clamping to DB range
 * 
 * @param params - Parameters for calculation
 * @param params.heightCm - Height in centimeters
 * @param params.sexAtBirth - Sex at birth
 * @param params.dobISO - Date of birth in ISO format (YYYY-MM-DD)
 * @returns Maximum safe weight in pounds, clamped to DB range
 */
export function getMaxSafeWeightLb(params: {
  heightCm: number;
  sexAtBirth: SexAtBirth;
  dobISO: string;
}): number {
  const { heightCm, sexAtBirth, dobISO } = params;
  
  // Normalize sex at birth
  const normalizedSex = normalizeSexAtBirth(sexAtBirth);
  
  // Get age
  const age = getAgeYears(dobISO);
  
  // Determine age bucket (<65 vs >=65)
  const ageBucket = age < 65 ? 'under65' : 'over65';
  
  // Get BMI ceiling by sex + age bucket
  const maxBMI = MAX_BMI[normalizedSex][ageBucket];
  
  // Convert height to meters
  const heightM = cmToMeters(heightCm);
  
  // Calculate maximum weight in kg: maxBMI * (heightM^2)
  const maxKg = maxBMI * (heightM * heightM);
  
  // Convert to pounds
  const maxSafeLb = kgToLb(maxKg);
  
  // Clamp to DB range for sanity
  return clamp(maxSafeLb, DB_MIN_WEIGHT_LB, DB_MAX_WEIGHT_LB);
}

