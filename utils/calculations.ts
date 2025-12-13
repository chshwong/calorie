import { getLocalDateKey } from './dateTime';

/**
 * TIMEZONE HANDLING STRATEGY:
 * 
 * Database Storage: Always UTC
 * - All datetime values (eaten_at, created_at, updated_at) are stored in UTC
 * - entry_date is stored as YYYY-MM-DD (date-only, no timezone)
 * 
 * UI Display: Always User's Local Timezone
 * - Dates/times from database are converted from UTC to user's local timezone for display
 * - entry_date uses user's local date (not UTC date) to match what user sees
 * 
 * Functions:
 * - getLocalDateString(): Gets current date in user's local timezone (for entry_date)
 * - getCurrentDateTimeUTC(): Gets current datetime in UTC (for database storage)
 * - formatUTCDateTime(): Converts UTC datetime to local timezone for display
 * - formatUTCDate(): Converts UTC datetime to local date string for display
 */

export const ageFromDob = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / (365.25 * 24 * 3600 * 1000));

/**
 * Converts an age (in years) to an approximate date of birth (YYYY-MM-DD).
 * Uses the current date minus the age, assuming birthday has passed this year.
 * @param age - Age in years (must be valid number between 13 and 150)
 * @returns Date of birth string in YYYY-MM-DD format, or null if invalid
 */
export const dobFromAge = (age: number): string | null => {
  if (isNaN(age) || age < 13 || age > 150) {
    return null;
  }
  
  const today = new Date();
  const birthYear = today.getFullYear() - age;
  // Use middle of the year as approximation (June 1st)
  const month = String(6).padStart(2, '0');
  const day = String(1).padStart(2, '0');
  
  return `${birthYear}-${month}-${day}`;
};

export const bmi = (height_cm: number, weight_lb: number) =>
  703 * weight_lb / Math.pow(height_cm / 2.54, 2);

/**
 * Get current date in user's local timezone as YYYY-MM-DD
 * This ensures the date matches what the user sees on their device
 */
export const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get current date and time in UTC for database storage
 * Always stores in UTC regardless of user's timezone
 */
export const getCurrentDateTimeUTC = (): string => {
  return new Date().toISOString();
};

/**
 * Convert UTC datetime string to user's local timezone for display
 * @param utcDateTime - UTC datetime string from database (ISO format)
 * @returns Date object in user's local timezone
 */
export const utcToLocal = (utcDateTime: string | null): Date | null => {
  if (!utcDateTime) return null;
  return new Date(utcDateTime);
};

/**
 * Format UTC datetime for display in user's local timezone
 * @param utcDateTime - UTC datetime string from database (ISO format)
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date/time string in user's local timezone
 */
export const formatUTCDateTime = (
  utcDateTime: string | null,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!utcDateTime) return '';
  const localDate = utcToLocal(utcDateTime);
  if (!localDate) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  
  return localDate.toLocaleString('en-US', { ...defaultOptions, ...options });
};

/**
 * Format UTC date for display in user's local timezone (date only)
 * @param utcDateTime - UTC datetime string from database (ISO format)
 * @returns Date string in user's local timezone (YYYY-MM-DD)
 */
export const formatUTCDate = (utcDateTime: string | null): string => {
  if (!utcDateTime) return '';
  const localDate = utcToLocal(utcDateTime);
  if (!localDate) return '';
  
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get array of date strings for the last N days including today
 * @param today - Date object representing today
 * @param days - Number of days to include (default: 7)
 * @returns Array of date strings in YYYY-MM-DD format, ordered oldest to newest
 */
export const getLastNDays = (today: Date, days: number = 7): string[] => {
  const dateStrings: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dateStrings.push(getLocalDateKey(date));
  }
  return dateStrings;
};

/**
 * Add or subtract days from a date
 * @param date - Date object to modify
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New Date object with days added/subtracted
 */
export const addDays = (date: Date, days: number): Date => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

/**
 * Format a date for display in a user-friendly format
 * Shows "Today" or "Yesterday" for recent dates, otherwise formatted date
 * @param date - Date object to format
 * @param today - Date object representing today (for comparison)
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatDateForDisplay = (
  date: Date,
  today: Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const todayDate = new Date(today);
  todayDate.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateToFormat = new Date(date);
  dateToFormat.setHours(0, 0, 0, 0);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  
  const formattedDate = dateToFormat.toLocaleDateString('en-US', {
    ...defaultOptions,
    ...(dateToFormat.getTime() === todayDate.getTime() || dateToFormat.getTime() === yesterday.getTime() 
      ? {} 
      : { weekday: 'short' }),
    ...options,
  });
  
  if (dateToFormat.getTime() === todayDate.getTime()) {
    return formattedDate; // "Today" will be prepended by caller if needed
  } else if (dateToFormat.getTime() === yesterday.getTime()) {
    return formattedDate; // "Yesterday" will be prepended by caller if needed
  }
  return formattedDate;
};

/**
 * Get date string in YYYY-MM-DD format from a Date object
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export const getDateString = (date: Date): string => {
  return getLocalDateKey(date);
};

/**
 * Determine meal type based on current time in user's local timezone
 * Meal type logic:
 * - 4:00 AM to 11:30 AM: Breakfast
 * - 11:31 AM to 2:00 PM: Lunch
 * - 2:00 PM to 5:00 PM: Snack
 * - 5:01 PM to 9:30 PM: Dinner
 * - Anywhere else: Late Night
 */
export const getMealTypeFromCurrentTime = (): string => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // Convert time to minutes since midnight for easier comparison
  const timeInMinutes = hours * 60 + minutes;
  
  // 4:00 AM = 4 * 60 = 240 minutes
  // 11:30 AM = 11 * 60 + 30 = 690 minutes
  // 2:00 PM = 14 * 60 = 840 minutes
  // 5:00 PM = 17 * 60 = 1020 minutes
  // 9:30 PM = 21 * 60 + 30 = 1290 minutes
  
  if (timeInMinutes >= 240 && timeInMinutes <= 690) {
    // 4:00 AM to 11:30 AM
    return 'breakfast';
  } else if (timeInMinutes >= 691 && timeInMinutes <= 840) {
    // 11:31 AM to 2:00 PM
    return 'lunch';
  } else if (timeInMinutes >= 841 && timeInMinutes <= 1020) {
    // 2:00 PM to 5:00 PM
    return 'afternoon_snack';
  } else if (timeInMinutes >= 1021 && timeInMinutes <= 1290) {
    // 5:01 PM to 9:30 PM
    return 'dinner';
  } else {
    // Before 4:00 AM or after 9:30 PM
    return 'late_night';
  }
};

/**
 * ACTIVITY LEVEL AND CALORIE CALCULATIONS
 * These functions are in the domain layer (no React/browser dependencies)
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';

/**
 * Maps activity level enum to activity factor (used for TDEE calculation)
 */
export const getActivityFactor = (activityLevel: ActivityLevel): number => {
  const factors: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725,
    very_high: 1.9,
  };
  return factors[activityLevel];
};

/**
 * Calculate Basal Metabolic Rate (BMR) using the Mifflin-St Jeor equation
 * @param weightKg - Weight in kilograms
 * @param heightCm - Height in centimeters
 * @param age - Age in years
 * @param sex - 'male' or 'female'
 * @returns BMR in kcal/day
 */
export const calculateBMR = (
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female'
): number => {
  // Mifflin-St Jeor equation:
  // BMR (men) = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) + 5
  // BMR (women) = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) - 161
  
  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? baseBMR + 5 : baseBMR - 161;
};

/**
 * Calculate Total Daily Energy Expenditure (TDEE) from BMR and activity level
 * @param bmr - Basal Metabolic Rate in kcal/day
 * @param activityLevel - Activity level enum
 * @returns TDEE in kcal/day
 */
export const calculateTDEE = (bmr: number, activityLevel: ActivityLevel): number => {
  const activityFactor = getActivityFactor(activityLevel);
  return bmr * activityFactor;
};

/**
 * Calculate the weekly weight change rate based on daily calorie difference
 * @param dailyCalorieDiff - Daily calorie deficit (negative) or surplus (positive) in kcal
 * @returns Weekly weight change in kg (negative for loss, positive for gain)
 */
export const calculateWeeklyWeightChange = (dailyCalorieDiff: number): number => {
  // ~7700 kcal = 1 kg of body weight
  const weeklyCalorieDiff = dailyCalorieDiff * 7;
  return weeklyCalorieDiff / 7700;
};

/**
 * Calculate required daily calorie difference to achieve goal weight in given timeframe
 * @param currentWeightKg - Current weight in kg
 * @param goalWeightKg - Goal weight in kg
 * @param weeksToGoal - Number of weeks to reach goal
 * @returns Daily calorie difference needed (negative for deficit, positive for surplus) in kcal
 */
export const calculateRequiredDailyCalorieDiff = (
  currentWeightKg: number,
  goalWeightKg: number,
  weeksToGoal: number
): number => {
  if (weeksToGoal <= 0) {
    return 0; // No timeline means maintenance
  }
  
  const weightDifferenceKg = goalWeightKg - currentWeightKg;
  const totalCalorieDiff = weightDifferenceKg * 7700; // 7700 kcal per kg
  return totalCalorieDiff / (weeksToGoal * 7); // Daily difference
};

/**
 * Safety limits for calorie intake
 */
export const MIN_SAFE_CALORIES_MALE = 1500;
export const MIN_SAFE_CALORIES_FEMALE = 1200;
export const MAX_DAILY_DEFICIT = 750; // kcal/day
export const MAX_DAILY_SURPLUS = 500; // kcal/day

/**
 * Calculate safe daily calorie target based on TDEE and goal
 * Applies safety limits and adjusts if necessary
 * @param tdee - Total Daily Energy Expenditure in kcal/day
 * @param dailyCalorieDiff - Desired daily calorie difference (can be adjusted)
 * @param sex - 'male' or 'female' (for minimum calorie threshold)
 * @returns Object with safe calorie target, adjusted daily diff, and warning message if adjusted
 */
export const calculateSafeCalorieTarget = (
  tdee: number,
  dailyCalorieDiff: number,
  sex: 'male' | 'female'
): {
  targetCalories: number;
  adjustedDailyDiff: number;
  adjustedWeeks: number | null;
  warningMessage: string | null;
} => {
  const minSafeCalories = sex === 'male' ? MIN_SAFE_CALORIES_MALE : MIN_SAFE_CALORIES_FEMALE;
  
  // Apply maximum deficit/surplus limits
  let adjustedDiff = dailyCalorieDiff;
  if (dailyCalorieDiff < 0 && Math.abs(dailyCalorieDiff) > MAX_DAILY_DEFICIT) {
    adjustedDiff = -MAX_DAILY_DEFICIT;
  } else if (dailyCalorieDiff > 0 && dailyCalorieDiff > MAX_DAILY_SURPLUS) {
    adjustedDiff = MAX_DAILY_SURPLUS;
  }
  
  // Calculate target calories
  let targetCalories = tdee + adjustedDiff;
  
  // Ensure minimum safe calories
  if (targetCalories < minSafeCalories) {
    targetCalories = minSafeCalories;
    adjustedDiff = targetCalories - tdee;
  }
  
  // Calculate adjusted timeline if we had to change the deficit/surplus
  let adjustedWeeks: number | null = null;
  let warningMessage: string | null = null;
  
  if (adjustedDiff !== dailyCalorieDiff || targetCalories === minSafeCalories) {
    // We adjusted the pace - calculate what the new timeline would be
    // This is informational only, the user's chosen timeline stays the same
    warningMessage = 'To keep things safe and sustainable, we\'ve adjusted your pace slightly. You\'ll still be working steadily toward your goal.';
  }
  
  return {
    targetCalories: Math.round(targetCalories),
    adjustedDailyDiff: adjustedDiff,
    adjustedWeeks,
    warningMessage,
  };
};

