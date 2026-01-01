/**
 * DATE GUARD (signup min-date)
 *
 * Centralized helpers for enforcing an allowed local-date range.
 *
 * Canonical date representation across the app is a "dateKey" string: YYYY-MM-DD,
 * representing the user's local day (device timezone).
 */

import { toDateKey } from '@/utils/dateKey';

export type CompareResult = -1 | 0 | 1;

/**
 * Lexicographically compare canonical date keys (YYYY-MM-DD).
 * Works because the format is big-endian and zero-padded.
 */
export function compareDateKeys(a: string, b: string): CompareResult {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isDateKeyAllowed(dateKey: string, minKey: string, maxKey: string): boolean {
  return compareDateKeys(dateKey, minKey) >= 0 && compareDateKeys(dateKey, maxKey) <= 0;
}

export function clampDateKey(dateKey: string, minKey: string, maxKey: string): string {
  if (compareDateKeys(dateKey, minKey) < 0) return minKey;
  if (compareDateKeys(dateKey, maxKey) > 0) return maxKey;
  return dateKey;
}

/**
 * Convert a signup timestamp (ISO string) into the user's *local* signup day dateKey.
 * This intentionally uses the device's current timezone (per product decision).
 */
export function getMinAllowedDateKeyFromSignupAt(signupAtIso: string): string {
  // `toDateKey()` uses local date components and accepts ISO strings.
  return toDateKey(signupAtIso);
}

export function dateKeyToLocalStartOfDay(dateKey: string): Date {
  const d = new Date(dateKey + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  return d;
}


