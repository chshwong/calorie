import type { WeightLogRow } from '@/lib/services/weightLogs';

export type LatestWeightDisplay = {
  weighedAtISO: string | null;
  weightLb: number | null;
  bodyFatPercent: number | null;
};

/**
 * Get display data strictly from the latest weigh-in record.
 * - Weight comes from the latest record
 * - Body fat comes ONLY from the same latest record (no fallback to older)
 */
export function getLatestWeightDisplayFromLogs(rawLogs: WeightLogRow[]): LatestWeightDisplay {
  if (!rawLogs || rawLogs.length === 0) {
    return { weighedAtISO: null, weightLb: null, bodyFatPercent: null };
  }

  const latest = rawLogs.reduce((acc, cur) => {
    if (!acc) return cur;
    return new Date(cur.weighed_at).getTime() > new Date(acc.weighed_at).getTime() ? cur : acc;
  }, null as WeightLogRow | null);

  if (!latest) return { weighedAtISO: null, weightLb: null, bodyFatPercent: null };

  return {
    weighedAtISO: latest.weighed_at ?? null,
    weightLb: latest.weight_lb ?? null,
    bodyFatPercent: latest.body_fat_percent ?? null,
  };
}

