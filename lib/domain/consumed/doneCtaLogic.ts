import { compareDateKeys } from '@/lib/date-guard';
import { addDays } from '@/utils/dateKey';

export type DoneCtaLabelKind = 'today' | 'yesterday' | 'day';

/**
 * Minimum allowed date key for a grace window (inclusive).
 * Example: graceDays=7 => today + previous 6 days => todayKey - 6.
 */
export function getGraceWindowMinKey(todayKey: string, graceDays: number): string {
  const days = Number.isFinite(graceDays) ? Math.max(1, Math.floor(graceDays)) : 1;
  return addDays(todayKey, -(days - 1));
}

export function isWithinGraceWindow(params: {
  selectedDateKey: string;
  todayKey: string;
  graceDays: number;
}): boolean {
  const { selectedDateKey, todayKey, graceDays } = params;
  const minKey = getGraceWindowMinKey(todayKey, graceDays);
  return compareDateKeys(selectedDateKey, minKey) >= 0 && compareDateKeys(selectedDateKey, todayKey) <= 0;
}

export function getUnknownLabelKind(params: {
  selectedDateKey: string;
  todayKey: string;
  yesterdayKey: string;
}): DoneCtaLabelKind {
  const { selectedDateKey, todayKey, yesterdayKey } = params;
  if (selectedDateKey === todayKey) return 'today';
  if (selectedDateKey === yesterdayKey) return 'yesterday';
  return 'day';
}

export type CompletionCalorieTier = 'zero' | 'low' | 'ok';

export function getCompletionTier(calories: number): CompletionCalorieTier {
  if (!Number.isFinite(calories) || calories <= 0) return 'zero';
  if (calories <= 499) return 'low';
  return 'ok';
}

/**
 * Whether the initial confirm modal should surface the "Mark as Fasted" option.
 * Spec:
 * - 0 => yes
 * - 1–499 => yes
 * - 500–999 => yes (but requires secondary confirm)
 * - >=1000 => no
 */
export function shouldShowFastedOptionInInitialConfirm(calories: number): boolean {
  if (!Number.isFinite(calories)) return true; // treat as 0
  return calories < 1000;
}

/**
 * Secondary confirm is required only when calories are in [500, 999].
 */
export function shouldRequireFastedSecondaryConfirm(calories: number): boolean {
  if (!Number.isFinite(calories)) return false;
  return calories >= 500 && calories < 1000;
}


