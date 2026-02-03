import { toDateKey } from '@/utils/dateKey';

const MINUTES_PER_DAY = 24 * 60;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Derive a (bmr, active, tdee) split from a wearable's TOTAL calories burned for the day.
 *
 * This is a pure function (no DB, no React) so it can be reused across UI + sync flows.
 *
 * Rules:
 * - For today, BMR is prorated based on time-progress through the local day.
 * - For past days, BMR uses the full-day system estimate.
 * - Clamp ensures `active >= 0` and `tdee = bmr + active` always holds.
 */
export function deriveWearableSplit(params: {
  /** YYYY-MM-DD in local-day semantics (same as `toDateKey()`) */
  entryDateKey: string;
  now: Date;
  /** Full-day system BMR estimate for that entry day */
  systemBmrFullDay: number;
  /** Wearable TOTAL calories burned for the day (Fitbit: summary.caloriesOut) */
  wearableTdeeTotal: number;
}): { bmr: number; active: number; tdee: number; progress: number } {
  const { entryDateKey, now } = params;

  const systemBmrFullDay = Number.isFinite(params.systemBmrFullDay) ? Math.round(params.systemBmrFullDay) : 0;
  const wearableTdeeTotal = Number.isFinite(params.wearableTdeeTotal) ? Math.round(params.wearableTdeeTotal) : 0;

  const isToday = entryDateKey === toDateKey(now);

  let progress = 1;
  if (isToday) {
    const start = new Date(now.getTime());
    start.setHours(0, 0, 0, 0);
    const minutesSinceMidnight = (now.getTime() - start.getTime()) / 60_000;
    progress = clamp01(minutesSinceMidnight / MINUTES_PER_DAY);
  }

  const bmrSoFar = Math.round(systemBmrFullDay * progress);
  const bmr = Math.min(bmrSoFar, wearableTdeeTotal);
  const active = Math.max(0, wearableTdeeTotal - bmr);
  const tdee = wearableTdeeTotal;

  return { bmr, active, tdee, progress };
}

