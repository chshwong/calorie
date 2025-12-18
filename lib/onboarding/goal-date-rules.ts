/**
 * Goal Date Rules and Calculations
 * 
 * Provides date calculations and warning logic for goal timelines.
 * Per engineering guidelines section 3.5: Centralized constraints and validation
 */

export const LOSS_PACES_LB_PER_WEEK = {
  easy: 0.5,
  decent: 1.0,
  aggressive: 1.5,
} as const;

export const MAX_SELECTABLE_LOSS_LB_PER_WEEK = 6.0;

/**
 * Compute target date from pace for weight loss
 * 
 * @param deltaLb - Weight difference in pounds (current - target, must be > 0)
 * @param paceLbPerWeek - Weight loss pace in pounds per week
 * @param today - Today's date (should be at local noon)
 * @returns Computed target date (at local noon)
 */
export function computeTargetDateFromPace(
  deltaLb: number,
  paceLbPerWeek: number,
  today: Date
): Date {
  if (deltaLb <= 0 || paceLbPerWeek <= 0) {
    return today;
  }
  
  // Calculate days directly using day-based approach
  // Formula: days = ceil(deltaLb * 7 / paceLbPerWeek)
  // This gives more accurate dates that match the pace more closely
  const days = Math.ceil((deltaLb * 7) / paceLbPerWeek);
  
  // Use addDaysLocal helper to ensure proper DST handling
  const todayAtNoon = new Date(today);
  todayAtNoon.setHours(12, 0, 0, 0);
  return addDaysLocal(todayAtNoon, days);
}

/**
 * Add days to a date at local noon (to avoid DST issues)
 * 
 * @param date - Base date
 * @param days - Number of days to add
 * @returns New date with days added (at local noon)
 */
function addDaysLocal(date: Date, days: number): Date {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Compute minimum selectable date for weight loss goal based on max pace
 * 
 * Disables dates that would imply faster than MAX_SELECTABLE_LOSS_LB_PER_WEEK loss.
 * Ensures minimum is at least tomorrow (to disable today and past dates).
 * 
 * @param params - Parameters for computation
 * @param params.currentWeightLb - Current weight in pounds
 * @param params.targetWeightLb - Target weight in pounds
 * @param params.today - Today's date (should be at local noon)
 * @returns Minimum selectable date (at local noon)
 */
export function computeMinSelectableDateForLoss(params: {
  currentWeightLb: number;
  targetWeightLb: number;
  today: Date;
}): Date {
  const { currentWeightLb, targetWeightLb, today } = params;
  
  // Ensure today is at noon
  const todayAtNoon = new Date(today);
  todayAtNoon.setHours(12, 0, 0, 0);
  
  const deltaLb = currentWeightLb - targetWeightLb;
  
  // Fallback: if delta is invalid, return tomorrow
  if (deltaLb <= 0) {
    return addDaysLocal(todayAtNoon, 1);
  }
  
  // Calculate minimum days based on max pace (day-based calculation)
  // Formula: minDiffDays = ceil(deltaLb * 7 / MAX_SELECTABLE_LOSS_LB_PER_WEEK)
  // This ensures the earliest selectable date implies ~6.0 lb/week (or slightly under due to ceil)
  const minDiffDays = Math.ceil((deltaLb * 7) / MAX_SELECTABLE_LOSS_LB_PER_WEEK);
  
  const minSelectableDate = addDaysLocal(todayAtNoon, minDiffDays);
  
  // Ensure it's at least tomorrow (to disable today and past dates)
  const tomorrow = addDaysLocal(todayAtNoon, 1);
  return minSelectableDate > tomorrow ? minSelectableDate : tomorrow;
}

/**
 * Compute implied weight loss pace from a target date
 * 
 * Calculates pace smoothly day-by-day (not in weekly steps).
 * Assumes today and targetDate are already set to local NOON (12:00) by date-only helpers.
 * 
 * @param deltaLb - Weight difference in pounds (current - target, must be > 0)
 * @param targetDate - Target date (at local noon)
 * @param today - Today's date (at local noon)
 * @returns Implied weight loss pace in pounds per week
 */
export function computeImpliedLbPerWeek(
  deltaLb: number,
  targetDate: Date,
  today: Date
): number {
  if (deltaLb <= 0) {
    return 0;
  }
  
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffMs = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / MS_PER_DAY);
  
  if (diffDays <= 0) {
    return Infinity; // Invalid date (past or today)
  }
  
  // Calculate pace smoothly: deltaLb * 7 / diffDays
  // This gives smooth day-by-day changes instead of weekly jumps
  const impliedLbPerWeek = (deltaLb * 7) / diffDays;
  
  return impliedLbPerWeek;
}

/**
 * Get warning message key for custom date based on implied pace
 * 
 * @param impliedLbPerWeek - Implied weight loss pace in pounds per week
 * @returns Warning message key or null if no warning needed
 */
export function getLossCustomDateWarningKey(impliedLbPerWeek: number): string | null {
  if (impliedLbPerWeek <= 1.6) {
    return null;
  }
  
  if (impliedLbPerWeek > 1.6 && impliedLbPerWeek <= 2.0) {
    return 'onboarding.goal_date.warn_ambitious';
  }
  
  if (impliedLbPerWeek > 2.0 && impliedLbPerWeek <= 2.5) {
    return 'onboarding.goal_date.warn_very_aggressive';
  }
  
  if (impliedLbPerWeek > 2.5 && impliedLbPerWeek < 3.0) {
    return 'onboarding.goal_date.warn_extreme';
  }
  
  if (impliedLbPerWeek >= 3.0 && impliedLbPerWeek <= 4.0) {
    return 'onboarding.goal_date.warn_medical';
  }
  
  if (impliedLbPerWeek > 4.0) {
    return 'onboarding.goal_date.warn_unrealistic';
  }
  
  return null;
}

