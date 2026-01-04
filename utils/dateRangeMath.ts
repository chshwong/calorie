/**
 * Calendar-based date range helpers (local time).
 *
 * - Month subtraction uses calendar months with day-of-month clamping.
 * - Year subtraction uses calendar years with Feb 29 clamping.
 * - All returned Dates preserve local time components of the input (caller should normalize if needed).
 */

import { getLocalDateKey } from '@/utils/dateTime';

export function subtractMonthsClamped(date: Date, months: number): Date {
  const src = new Date(date);
  const srcYear = src.getFullYear();
  const srcMonth = src.getMonth(); // 0-based
  const srcDay = src.getDate();

  const totalMonths = srcYear * 12 + srcMonth - months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12;

  const lastDay = getLastDayOfMonth(targetYear, targetMonth);
  const clampedDay = Math.min(srcDay, lastDay);

  const out = new Date(src);
  out.setFullYear(targetYear, targetMonth, clampedDay);
  return out;
}

export function subtractYearsClamped(date: Date, years: number): Date {
  const src = new Date(date);
  const targetYear = src.getFullYear() - years;
  const targetMonth = src.getMonth();
  const srcDay = src.getDate();

  const lastDay = getLastDayOfMonth(targetYear, targetMonth);
  const clampedDay = Math.min(srcDay, lastDay);

  const out = new Date(src);
  out.setFullYear(targetYear, targetMonth, clampedDay);
  return out;
}

function getLastDayOfMonth(year: number, month0: number): number {
  // Day 0 of next month = last day of current month
  return new Date(year, month0 + 1, 0).getDate();
}

export type SparseLabelSpec =
  | { type: 'allDays' } // e.g. 7D
  | { type: 'weekly'; stepDays: number } // e.g. 1M
  | { type: 'monthly'; stepMonths: number }; // e.g. 3M/6M/1Y

/**
 * Build sparse label positions over an inclusive day-key array.
 *
 * Requirements:
 * - Always include start + end labels
 * - Cap to maxLabels (default 6)
 * - Return indices into `dayKeys` that should render a label; others are blank.
 */
export function pickSparseLabelIndices(dayKeys: string[], spec: SparseLabelSpec, maxLabels: number = 6): number[] {
  if (dayKeys.length === 0) return [];
  if (spec.type === 'allDays') {
    // Caller decides if it wants to exceed maxLabels for short ranges (e.g. 7D)
    return dayKeys.map((_, idx) => idx);
  }

  const startIdx = 0;
  const endIdx = dayKeys.length - 1;
  const picked = new Set<number>([startIdx, endIdx]);

  if (spec.type === 'weekly') {
    // Approximate weekly ticks by fixed day steps from start.
    for (let i = startIdx + spec.stepDays; i < endIdx; i += spec.stepDays) {
      picked.add(i);
    }
  } else if (spec.type === 'monthly') {
    // Monthly ticks: choose first occurrence of each month boundary in the range.
    // We implement this by scanning dayKeys and picking the first key whose day === 01.
    // Then downsample by stepMonths.
    const monthStartIndices: number[] = [];
    for (let i = 0; i < dayKeys.length; i++) {
      const key = dayKeys[i];
      if (key.endsWith('-01')) {
        monthStartIndices.push(i);
      }
    }

    // Always allow a month start only if it's not the very first day (already included) or very last (end included).
    const filtered = monthStartIndices.filter((i) => i !== startIdx && i !== endIdx);

    if (spec.stepMonths <= 1) {
      filtered.forEach((i) => picked.add(i));
    } else {
      // Keep every Nth month start.
      for (let j = 0; j < filtered.length; j += spec.stepMonths) {
        picked.add(filtered[j]);
      }
    }
  }

  // Enforce maxLabels (keeping start/end). If too many, downsample evenly from the middle candidates.
  const all = Array.from(picked).sort((a, b) => a - b);
  if (all.length <= maxLabels) return all;

  const keep = new Set<number>([startIdx, endIdx]);
  const middle = all.filter((i) => i !== startIdx && i !== endIdx);
  const slots = Math.max(0, maxLabels - 2);
  if (slots === 0) return [startIdx, endIdx];

  // Evenly sample `slots` items from middle (including endpoints of middle if possible).
  for (let k = 0; k < slots; k++) {
    const t = slots === 1 ? 0.5 : k / (slots - 1);
    const idx = Math.round(t * (middle.length - 1));
    keep.add(middle[Math.max(0, Math.min(middle.length - 1, idx))]);
  }

  return Array.from(keep).sort((a, b) => a - b);
}

/**
 * Build an inclusive array of local day keys between start and end.
 * Inputs are expected to already be local-midnight aligned (or at least in the same local timezone).
 */
export function buildDayKeysInclusive(start: Date, end: Date): string[] {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);

  const out: string[] = [];
  const days = Math.max(0, Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)));
  for (let i = 0; i <= days; i++) {
    const d = new Date(s);
    d.setDate(s.getDate() + i);
    out.push(getLocalDateKey(d));
  }
  return out;
}


