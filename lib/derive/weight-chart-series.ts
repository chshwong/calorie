import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import type { DailyLatestWeightRow } from '@/lib/derive/daily-latest-weight';

export type WeightUnit = 'kg' | 'lbs';

/**
 * Build a fixed-window series for the weight trend chart.
 * - Missing days are NaN (no dot, no value)
 * - No carry-forward and no interpolation
 */
export function buildWeightSeriesForDayKeys(args: {
  dayKeys: string[];
  dailyMap: Map<string, DailyLatestWeightRow>;
  unit: WeightUnit;
}): number[] {
  const { dayKeys, dailyMap, unit } = args;
  return dayKeys.map((key) => {
    const row = dailyMap.get(key);
    const wLb = row?.weight_lb ?? null;
    if (wLb === null || wLb === undefined) return NaN;
    const v = unit === 'kg' ? roundTo1(lbToKg(wLb)) : roundTo1(wLb);
    return Number.isFinite(v) ? v : NaN;
  });
}

