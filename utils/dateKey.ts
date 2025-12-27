/**
 * CANONICAL DATE KEY UTILITY
 * 
 * Single source of truth for converting any date input into a canonical
 * YYYY-MM-DD string (local date in user's timezone).
 * 
 * This ensures consistency across:
 * - React Query queryKeys
 * - persistentCache keys
 * - Service function parameters
 * 
 * Rules:
 * - Output is ALWAYS "YYYY-MM-DD" format
 * - Uses local date components (getFullYear, getMonth, getDate)
 * - Deterministic across localhost and Vercel
 * - Never uses toLocaleDateString() or Date.toString()
 */

/**
 * Convert any date input to canonical YYYY-MM-DD string
 * 
 * @param input - Date object, timestamp (ms), or string (YYYY-MM-DD or ISO)
 * @returns Canonical date key string in YYYY-MM-DD format
 */
export function toDateKey(input?: Date | string | number | null): string {
  // Handle null/undefined
  if (!input) {
    const d = new Date();
    return formatDateKey(d);
  }

  // If already a canonical date key string, return unchanged
  if (typeof input === 'string') {
    // Check if it's already YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    // Otherwise parse as ISO string or other format
    const d = new Date(input);
    if (isNaN(d.getTime())) {
      // Invalid date string, fallback to today
      return formatDateKey(new Date());
    }
    return formatDateKey(d);
  }

  // If it's a number (timestamp), convert to Date
  if (typeof input === 'number') {
    const d = new Date(input);
    if (isNaN(d.getTime())) {
      return formatDateKey(new Date());
    }
    return formatDateKey(d);
  }

  // If it's a Date object, format it
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      return formatDateKey(new Date());
    }
    return formatDateKey(input);
  }

  // Fallback to today
  return formatDateKey(new Date());
}

/**
 * Format a Date object to YYYY-MM-DD string using local date components
 * 
 * @param d - Date object
 * @returns YYYY-MM-DD string
 */
function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add or subtract days from a date key
 * 
 * @param dateKey - Date key in YYYY-MM-DD format
 * @param deltaDays - Number of days to add (positive) or subtract (negative)
 * @returns New date key in YYYY-MM-DD format
 */
export function addDays(dateKey: string, deltaDays: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return formatDateKey(d);
}

/**
 * Get today's date key
 */
export function getTodayKey(): string {
  return formatDateKey(new Date());
}

/**
 * Get yesterday's date key
 */
export function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateKey(d);
}

