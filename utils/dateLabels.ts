import { getLocalDateKey } from './dateTime';

/**
 * Format a date with Home-style relative labeling.
 * - Today -> "Today, Sat, Dec 13" (weekday omitted when yesterday/today in home logic)
 * - Yesterday -> "Yesterday, Sat, Dec 13"
 * - Else -> "Sat, Dec 13" (adds year if not current year)
 */
export function formatRelativeDateLabel(date: Date, todayInput?: Date): string {
  const today = todayInput ? new Date(todayInput) : new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const currentYear = today.getFullYear();
  const targetYear = target.getFullYear();
  const isCurrentYear = currentYear === targetYear;

  const isToday = getLocalDateKey(target) === getLocalDateKey(today);
  const isYesterday = getLocalDateKey(target) === getLocalDateKey(yesterday);

  const options: Intl.DateTimeFormatOptions = {
    ...(isToday || isYesterday ? {} : { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  };
  const formatted = target.toLocaleDateString('en-US', options);

  if (isToday) return `Today, ${formatted}`;
  if (isYesterday) return `Yesterday, ${formatted}`;
  return formatted;
}

/**
 * Safely add days in local time (avoids DST issues by operating on date components).
 */
export function addDaysLocal(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

