/**
 * Validation utilities for user input
 * 
 * Per engineering guidelines: Pure TypeScript functions in shared domain layer
 * No React/browser/UI imports allowed
 */

// constants/constraints.ts is where lives all the constraints constants that his file refers to.
// to change ranges or other constraints, refer to constants/constraints

import { PROFILES, DERIVED, POLICY, BURNED } from '@/constants/constraints';

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type AnnouncementValidationResult = {
  valid: boolean;
  errorKey?: string;
};

export type SupportCaseValidationResult = {
  valid: boolean;
  errorKey?: string;
};

export type BurnedTdeeValidationResult = {
  valid: boolean;
  errorKey?: string;
  shouldWarn: boolean;
};

/**
 * Validates a candidate "Burned Today" total (TDEE) in kcal.
 *
 * Rules:
 * - Must be a finite integer
 * - Must be within [MIN, MAX]
 * - shouldWarn when >= WARNING_KCAL (non-blocking)
 *
 * Note: UI may allow empty while editing; callers should only invoke this
 * for values they intend to persist.
 */
export function validateBurnedTdeeKcal(rawValue: number): BurnedTdeeValidationResult {
  if (!Number.isFinite(rawValue)) {
    return { valid: false, errorKey: 'burned.errors.invalid_number', shouldWarn: false };
  }

  const value = Math.trunc(rawValue);
  if (value < BURNED.TDEE_KCAL.MIN) {
    return { valid: false, errorKey: 'burned.errors.invalid_number', shouldWarn: false };
  }

  if (value > BURNED.TDEE_KCAL.MAX) {
    return { valid: false, errorKey: 'burned.errors.max_kcal', shouldWarn: false };
  }

  return {
    valid: true,
    shouldWarn: value >= BURNED.WARNING_KCAL,
  };
}

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
  if (!value) return { valid: false, error: 'Please enter a name.' };

  const chars = Array.from(value);
  let letterCount = 0;
  for (const ch of chars) {
    if (/\p{L}/u.test(ch)) letterCount += 1;
  }

  if (letterCount < 2) {
    return { valid: false, error: 'Name must contain at least 2 letters.' };
  }

  return { valid: true };
}

/** AvoID format: [color]-[personality]-[animal]-[1-99] (e.g. blue-happy-avocado-42) */
const AVOID_REGEX = /^[a-z]+-[a-z]+-[a-z]+-([1-9][0-9]?)$/;

/**
 * Validates AvoID format.
 * Rules: trim, lowercase, match [color]-[personality]-[animal]-[1-99]
 */
export function validateAvoId(rawValue: string): ValidationResult {
  const value = rawValue.trim().toLowerCase();
  if (!value) return { valid: false, error: 'friends.invalid_avoid' };
  if (!AVOID_REGEX.test(value)) return { valid: false, error: 'friends.invalid_avoid' };
  return { valid: true };
}

/**
 * Validates email format (basic).
 */
export function validateEmailFormat(rawValue: string): ValidationResult {
  const value = rawValue.trim().toLowerCase();
  if (!value) return { valid: false, error: 'validation.invalid_email' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) return { valid: false, error: 'validation.invalid_email' };
  return { valid: true };
}

/**
 * Validates announcement draft inputs.
 * Rules:
 * - English title/body must be non-empty when saving or publishing
 * - link_path must be empty or start with '/'
 */
export function validateAnnouncementDraft(params: {
  titleEn: string;
  bodyEn: string;
  linkPath?: string;
}): AnnouncementValidationResult {
  const title = params.titleEn.trim();
  const body = params.bodyEn.trim();
  const linkPath = params.linkPath?.trim() ?? '';

  if (!title || !body) {
    return { valid: false, errorKey: 'settings.admin.validation_required_en' };
  }

  if (linkPath && !linkPath.startsWith('/')) {
    return { valid: false, errorKey: 'settings.admin.validation_link_path' };
  }

  return { valid: true };
}

/**
 * Validates support case submission (MVP).
 * Rules:
 * - Message must be non-empty after trimming
 */
export function validateSupportCaseSubmission(params: { message: string }): SupportCaseValidationResult {
  const message = params.message.trim();
  if (!message) return { valid: false, errorKey: 'support.errors.message_required' };
  return { valid: true };
}

/**
 * Checks if an error message is related to name validation
 * Used by UI components to determine if name field should show error styling
 * Per engineering guidelines: Business logic must live in validation utils, not components
 */
export function isNameValidationError(error: string | null): boolean {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('name') ||
    lowerError.includes('emoji') ||
    lowerError.includes('different name')
  );
}

/**
 * Validates date of birth in YYYY-MM-DD format
 * @param dob - Date of birth string in YYYY-MM-DD format
 * @param minAge - Minimum age in years (default: 13)
 * @param maxAge - Maximum age in years (default: 120)
 * @returns Error message key or null if valid
 */
export function validateDateOfBirth(
  dob: string,
  minAge: number = POLICY.DOB.MIN_AGE_YEARS,
  maxAge: number = POLICY.DOB.MAX_AGE_YEARS
): string | null {
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
 * @param minCm - Minimum height in cm (default: 50)
 * @param maxCm - Maximum height in cm (default: 260)
 * @returns Error message key or null if valid
 */
export function validateHeightCm(
  heightCm: number | null,
  minCm: number = PROFILES.HEIGHT_CM.MIN,
  maxCm: number = PROFILES.HEIGHT_CM.MAX
): string | null {
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
 * @param minKg - Minimum weight in kg (default: derived from profiles.weight_lb)
 * @param maxKg - Maximum weight in kg (default: derived from profiles.weight_lb)
 * @returns Error message key or null if valid
 */
export function validateWeightKg(
  weightKg: number | null,
  minKg: number = DERIVED.WEIGHT_KG.MIN,
  maxKg: number = DERIVED.WEIGHT_KG.MAX
): string | null {
  if (weightKg === null || isNaN(weightKg) || weightKg <= 0) {
    return 'onboarding.current_weight.error_weight_required';
  }

  if (weightKg < minKg || weightKg > maxKg) {
    return 'onboarding.current_weight.error_weight_invalid';
  }

  return null;
}

/**
 * Validates body fat percentage (optional field)
 * @param bodyFatPercent - Body fat percentage value (null/undefined means skip)
 * @param minExclusivePercent - Exclusive lower bound (default from constraints)
 * @param maxPercent - Inclusive upper bound (default from constraints)
 * @returns A human-readable error message or null if valid/absent
 */
export function validateBodyFatPercent(
  bodyFatPercent: number | null | undefined,
  minExclusivePercent: number = PROFILES.BODY_FAT_PERCENT.MIN_EXCLUSIVE,
  maxPercent: number = PROFILES.BODY_FAT_PERCENT.MAX
): string | null {
  if (bodyFatPercent === null || bodyFatPercent === undefined) {
    return null; // Optional field: empty is allowed
  }

  if (isNaN(bodyFatPercent)) {
    return 'Body fat percentage must be a number.';
  }

  if (bodyFatPercent <= minExclusivePercent || bodyFatPercent > maxPercent) {
    return `Body fat percentage must be greater than ${minExclusivePercent} and at most ${maxPercent}.`;
  }

  return null;
}

/**
 * Validates goal weight based on goal type and current weight
 * @param goalWeightKg - Goal weight in kilograms
 * @param currentWeightKg - Current weight in kilograms
 * @param goalType - Goal type: 'lose', 'gain', 'maintain', 'recomp'
 * @param minKg - Minimum weight in kg (default: derived from profiles.weight_lb)
 * @param maxKg - Maximum weight in kg (default: derived from profiles.weight_lb)
 * @returns Error message key or null if valid
 */
export function validateGoalWeight(
  goalWeightKg: number | null,
  currentWeightKg: number | null,
  goalType: string | null,
  minKg: number = DERIVED.WEIGHT_KG.MIN,
  maxKg: number = DERIVED.WEIGHT_KG.MAX
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

  // Validate goal weight based on goal type
  if (goalType === 'lose') {
    if (goalWeightKg >= currentWeightKg) {
      return 'onboarding.goal_weight.error_lose_not_lower';
    }
  } else if (goalType === 'gain') {
    if (goalWeightKg <= currentWeightKg) {
      return 'onboarding.goal_weight.error_gain_not_higher';
    }
  } else if (goalType === 'maintain' || goalType === 'recomp') {
    // For maintain/recomp, goal weight should be close to current (within 5%)
    const tolerance = currentWeightKg * 0.05;
    if (Math.abs(goalWeightKg - currentWeightKg) > tolerance) {
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
export function validateTimeline(
  timelineOption: string | null,
  customTargetDate: string | null = null
): string | null {
  const validOptions = ['3_months', '6_months', '12_months', 'no_deadline', 'custom_date'];
  if (!timelineOption || !validOptions.includes(timelineOption)) {
    return 'onboarding.timeline.error_select_timeline';
  }

  if (timelineOption === 'custom_date') {
    if (!customTargetDate) {
      return 'onboarding.timeline.error_custom_date_required';
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(customTargetDate)) {
      return 'onboarding.timeline.error_custom_date_format';
    }

    const targetDate = new Date(customTargetDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate <= today) {
      return 'onboarding.timeline.error_custom_date_future';
    }
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

