/**
 * Derive daily_latest_weight structure from raw weight_log rows.
 *
 * This module provides a pure function that transforms raw weight_log entries
 * into a daily structure where each day has exactly one weight entry (the latest
 * weigh-in for that local day).
 */

import { getLocalDateKey } from '@/utils/dateTime';
import type { WeightLogRow } from '@/lib/services/weightLogs';

export type DailyLatestWeightRow = {
  date_key: string; // YYYY-MM-DD local
  weighed_at: string; // ISO timestamp of the latest weigh-in that day
  weight_lb: number | null; // original stored value
  id: string; // weight_log.id (source of truth reference)
  body_fat_percent: number | null; // for list views
};

/**
 * Derive daily latest weight from raw logs.
 *
 * Algorithm: Single pass O(n)
 * - Iterate logs in ascending weighed_at order (assumed pre-sorted from DB)
 * - For each log, compute local date key
 * - Store in map; later logs overwrite earlier ones for same day key
 * - Convert map to array and sort by date_key ascending
 *
 * @param rawLogs - WeightLogRow[] already sorted ascending by weighed_at
 * @returns DailyLatestWeightRow[] sorted by date_key ascending
 */
export function deriveDailyLatestWeight(rawLogs: WeightLogRow[]): DailyLatestWeightRow[] {
  // Map from date_key to the latest WeightLogRow for that day
  const latestByDate = new Map<string, WeightLogRow>();

  // Single pass: later logs overwrite earlier ones for same day
  for (const log of rawLogs) {
    const dateKey = getLocalDateKey(new Date(log.weighed_at));
    latestByDate.set(dateKey, log);
  }

  // Convert map to array and sort by date_key
  const result: DailyLatestWeightRow[] = Array.from(latestByDate.entries())
    .map(([date_key, log]) => ({
      date_key,
      weighed_at: log.weighed_at,
      weight_lb: log.weight_lb ?? null,
      id: log.id,
      body_fat_percent: log.body_fat_percent ?? null,
    }))
    .sort((a, b) => a.date_key.localeCompare(b.date_key));

  return result;
}

