/**
 * Centralized, local-time-safe date/time helpers.
 *
 * Rules:
 * - UI/business logic uses LOCAL time only.
 * - DB storage uses UTC ISO strings (timestamptz).
 * - Day bucketing is based on local day keys (YYYY-MM-DD via local getters).
 */

export function getLocalNow(): Date {
  return new Date();
}

export function getLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDbTimestampToLocalDate(ts: string): Date {
  return new Date(ts);
}

export function toDbTimestampIso(d: Date): string {
  return d.toISOString();
}

export function formatLocalTime(d: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return d.toLocaleTimeString([], { ...defaultOpts, ...options });
}

/**
 * Combine a local date key (YYYY-MM-DD) with hour/minute into a Date in local time.
 */
export function combineLocalDateAndTime(dateKey: string, time: { h: number; m: number }): Date {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const date = new Date();
  date.setFullYear(year, month, day);
  date.setHours(time.h, time.m, 0, 0);
  return date;
}

export function getLocalStartOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function getLocalEndOfDayExclusive(d: Date): Date {
  const next = getLocalStartOfDay(d);
  next.setDate(next.getDate() + 1);
  return next;
}

export function getLocalDayRangeIso(d: Date): { startIso: string; endIso: string } {
  const startIso = toDbTimestampIso(getLocalStartOfDay(d));
  const endIso = toDbTimestampIso(getLocalEndOfDayExclusive(d));
  return { startIso, endIso };
}

export function getYesterdayKey(): string {
  const d = getLocalStartOfDay(new Date());
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
}

export function getTodayKey(): string {
  return getLocalDateKey(new Date());
}

