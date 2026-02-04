/**
 * Date guard helpers for canonical date keys (YYYY-MM-DD).
 */

import { toDateKey } from "@/lib/foodDiary/dateKey";

export type CompareResult = -1 | 0 | 1;

export function compareDateKeys(a: string, b: string): CompareResult {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function clampDateKey(dateKey: string, minKey: string, maxKey: string): string {
  if (compareDateKeys(dateKey, minKey) < 0) return minKey;
  if (compareDateKeys(dateKey, maxKey) > 0) return maxKey;
  return dateKey;
}

export function getMinAllowedDateKeyFromSignupAt(signupAtIso: string): string {
  return toDateKey(signupAtIso);
}

export function dateKeyToLocalStartOfDay(dateKey: string): Date {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}
