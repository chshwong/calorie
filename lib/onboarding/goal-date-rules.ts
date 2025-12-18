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

/**
 * Compute target date from pace for weight loss
 * 
 * @param deltaLb - Weight difference in pounds (current - target, must be > 0)
 * @param paceLbPerWeek - Weight loss pace in pounds per week
 * @param today - Today's date
 * @returns Computed target date
 */
export function computeTargetDateFromPace(
  deltaLb: number,
  paceLbPerWeek: number,
  today: Date
): Date {
  if (deltaLb <= 0 || paceLbPerWeek <= 0) {
    return today;
  }
  
  const weeks = Math.ceil(deltaLb / paceLbPerWeek);
  const days = weeks * 7;
  
  // Clone the input date and ensure it's at noon (to avoid DST issues)
  const targetDate = new Date(today);
  targetDate.setHours(12, 0, 0, 0);
  targetDate.setDate(targetDate.getDate() + days);
  
  return targetDate;
}

/**
 * Compute implied weight loss pace from a target date
 * 
 * @param deltaLb - Weight difference in pounds (current - target, must be > 0)
 * @param targetDate - Target date
 * @param today - Today's date
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
  
  const diffMs = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return Infinity; // Invalid date (past or today)
  }
  
  const weeksToDate = Math.max(1, Math.ceil(diffDays / 7));
  const impliedLbPerWeek = deltaLb / weeksToDate;
  
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

