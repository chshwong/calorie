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

