/**
 * Validation utilities for user input
 * 
 * Per engineering guidelines: Pure TypeScript functions in shared domain layer
 * No React/browser/UI imports allowed
 */

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates preferred name with visible rules only:
 * - Must not be empty after trimming
 * - Must contain at least 2 letters
 * 
 * Note: Other rules (max length, invalid characters, emojis) are enforced silently
 * in the UI via onChangeText filtering.
 */
export function validatePreferredName(rawValue: string): ValidationResult {
  const value = rawValue.trim();
  if (!value) return { valid: false, error: "Please enter a name." };
  const chars = Array.from(value);
  let letterCount = 0;
  for (const ch of chars) {
    if (/\p{L}/u.test(ch)) letterCount += 1;
  }
  if (letterCount < 2) return { valid: false, error: "Name must contain at least 2 letters." };
  return { valid: true };
}

/**
 * Validates date of birth in YYYY-MM-DD format
 * @param dob - Date of birth string in YYYY-MM-DD format
 * @param minAge - Minimum age in years (default: 18)
 * @param maxAge - Maximum age in years (default: 100)
 * @returns Error message key or null if valid
 */
export function validateDateOfBirth(dob: string, minAge: number = 18, maxAge: number = 100): string | null {
  if (!dob || dob.trim().length === 0) {
    return 'onboarding.name_age.error_dob_required';
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dob)) {
    return 'onboarding.name_age.error_dob_format';
  }
  
  const dobDate = new Date(dob + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (dobDate > today) {
    return 'onboarding.name_age.error_dob_future';
  }
  
  const age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000));
  
  if (age < minAge) {
    return 'onboarding.name_age.error_age_minimum';
  }
  
  if (age > maxAge) {
    return 'onboarding.name_age.error_age_maximum';
  }
  
  return null;
}

/**
 * Validates height in centimeters
 * @param heightCm - Height in centimeters
 * @param minCm - Minimum height in cm (default: 120)
 * @param maxCm - Maximum height in cm (default: 230)
 * @returns Error message key or null if valid
 */
export function validateHeightCm(heightCm: number | null, minCm: number = 120, maxCm: number = 230): string | null {
  if (heightCm === null || isNaN(heightCm) || heightCm <= 0) {
    return 'onboarding.height.error_height_required';
  }
  
  if (heightCm < minCm || heightCm > maxCm) {
    return 'onboarding.height.error_height_invalid';
  }
  
  return null;
}

/**
 * Validates activity level
 * @param activityLevel - Activity level string
 * @returns Error message key or null if valid
 */
export function validateActivityLevel(activityLevel: string | null): string | null {
  const validLevels = ['sedentary', 'light', 'moderate', 'high', 'very_high'];
  if (!activityLevel || !validLevels.includes(activityLevel)) {
    return 'onboarding.activity.error_select_activity';
  }
  return null;
}

/**
 * Validates weight in kilograms
 * @param weightKg - Weight in kilograms
 * @param minKg - Minimum weight in kg (default: 35)
 * @param maxKg - Maximum weight in kg (default: 250)
 * @returns Error message key or null if valid
 */
export function validateWeightKg(weightKg: number | null, minKg: number = 35, maxKg: number = 250): string | null {
  if (weightKg === null || isNaN(weightKg) || weightKg <= 0) {
    return 'onboarding.current_weight.error_weight_required';
  }
  
  if (weightKg < minKg || weightKg > maxKg) {
    return 'onboarding.current_weight.error_weight_invalid';
  }
  
  return null;
}

/**
 * Validates goal weight based on goal type and current weight
 * @param goalWeightKg - Goal weight in kilograms
 * @param currentWeightKg - Current weight in kilograms
 * @param goalType - Goal type: 'lose', 'gain', 'maintain', 'recomp'
 * @param minKg - Minimum weight in kg (default: 35)
 * @param maxKg - Maximum weight in kg (default: 250)
 * @returns Error message key or null if valid
 */
export function validateGoalWeight(
  goalWeightKg: number | null,
  currentWeightKg: number | null,
  goalType: string | null,
  minKg: number = 35,
  maxKg: number = 250
): string | null {
  if (goalWeightKg === null || isNaN(goalWeightKg) || goalWeightKg <= 0) {
    return 'onboarding.goal_weight.error_weight_required';
  }
  
  if (goalWeightKg < minKg || goalWeightKg > maxKg) {
    return 'onboarding.goal_weight.error_weight_invalid';
  }
  
  if (currentWeightKg === null || isNaN(currentWeightKg) || currentWeightKg <= 0) {
    // Can't validate goal relative to current if current is invalid
    return null;
  }
  
  // Validate based on goal type
  if (goalType === 'lose') {
    // Goal weight must be lower than current weight (allow 0.5 kg tolerance for rounding)
    if (goalWeightKg >= currentWeightKg - 0.5) {
      return 'onboarding.goal_weight.error_lose_too_high';
    }
  } else if (goalType === 'gain') {
    // Goal weight must be higher than current weight (allow 0.5 kg tolerance for rounding)
    if (goalWeightKg <= currentWeightKg + 0.5) {
      return 'onboarding.goal_weight.error_gain_too_low';
    }
  } else if (goalType === 'maintain' || goalType === 'recomp') {
    // Goal weight should be close to current weight (within 5 kg)
    const difference = Math.abs(goalWeightKg - currentWeightKg);
    if (difference > 5) {
      return 'onboarding.goal_weight.error_maintain_too_different';
    }
  }
  
  return null;
}

/**
 * Validates timeline option
 * @param timelineOption - Timeline option string
 * @param customTargetDate - Custom target date if timeline is 'custom_date'
 * @returns Error message key or null if valid
 */
export function validateTimeline(timelineOption: string | null, customTargetDate: string | null = null): string | null {
  const validOptions = ['3_months', '6_months', '12_months', 'no_deadline', 'custom_date'];
  if (!timelineOption || !validOptions.includes(timelineOption)) {
    return 'onboarding.timeline.error_select_timeline';
  }
  
  if (timelineOption === 'custom_date' && !customTargetDate) {
    return 'onboarding.timeline.error_select_timeline';
  }
  
  return null;
}

/**
 * Validates sex/gender selection
 * @param sex - Sex value ('male' or 'female')
 * @returns Error message key or null if valid
 */
export function validateSex(sex: string | null): string | null {
  if (!sex || (sex !== 'male' && sex !== 'female')) {
    return 'onboarding.sex.error_select_sex';
  }
  return null;
}

/**
 * Validates goal type selection
 * @param goal - Goal type string
 * @returns Error message key or null if valid
 */
export function validateGoal(goal: string | null): string | null {
  if (!goal || goal.trim().length === 0) {
    return 'onboarding.goal.error_select_goal';
  }
  return null;
}

