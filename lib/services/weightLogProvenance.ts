/**
 * Service-layer helpers for weight_log provenance behavior.
 *
 * Kept free of Supabase / React Native imports so it can be unit-tested in Node.
 */

import { roundTo1, roundTo2, roundTo3 } from '@/utils/bodyMetrics';

export type WeightLogUserChanged = {
  userChanged: boolean;
  weightChanged: boolean;
  bodyFatChanged: boolean;
  timeChanged: boolean;
};

export type WeightLogEditableSnapshot = {
  weighed_at: string;
  weight_lb: number;
  body_fat_percent: number | null;
  source: string | null;
  external_id: string | null;
};

/**
 * Determine whether the user actually changed editable fields.
 * Uses UI-level rounding (1 decimal) to avoid float noise.
 */
export function computeWeightLogUserChanged(input: {
  oldRow: Pick<WeightLogEditableSnapshot, 'weight_lb' | 'body_fat_percent' | 'weighed_at'>;
  newWeightLb: number;
  newBodyFatPercent: number | null;
  newWeighedAtISO: string;
}): WeightLogUserChanged {
  const oldWeight = roundTo1(input.oldRow.weight_lb);
  const newWeight = roundTo1(input.newWeightLb);
  const weightChanged = newWeight !== oldWeight;

  const oldBf =
    input.oldRow.body_fat_percent === null || input.oldRow.body_fat_percent === undefined
      ? null
      : roundTo1(input.oldRow.body_fat_percent);
  const newBf =
    input.newBodyFatPercent === null || input.newBodyFatPercent === undefined
      ? null
      : roundTo1(input.newBodyFatPercent);
  const bodyFatChanged = newBf !== oldBf;

  const oldMs = new Date(input.oldRow.weighed_at).getTime();
  const newMs = new Date(input.newWeighedAtISO).getTime();
  const timeChanged = oldMs !== newMs;

  return {
    userChanged: weightChanged || bodyFatChanged || timeChanged,
    weightChanged,
    bodyFatChanged,
    timeChanged,
  };
}

export function buildWeightLogUpdatePayload(input: {
  oldRow: Pick<
    WeightLogEditableSnapshot,
    'source' | 'external_id' | 'weighed_at' | 'weight_lb' | 'body_fat_percent'
  >;
  weighedAtISO: string;
  weightLb: number;
  bodyFatPercent: number | null;
  note: string | null;
}): { shouldUpdateRow: boolean; userChanged: WeightLogUserChanged; payload: Record<string, unknown> } {
  const userChanged = computeWeightLogUserChanged({
    oldRow: {
      weighed_at: input.oldRow.weighed_at,
      weight_lb: input.oldRow.weight_lb,
      body_fat_percent: input.oldRow.body_fat_percent,
    },
    newWeightLb: input.weightLb,
    newBodyFatPercent: input.bodyFatPercent,
    newWeighedAtISO: input.weighedAtISO,
  });

  // Always include editable fields (and note) when we do update.
  const payload: Record<string, unknown> = {
    weighed_at: input.weighedAtISO,
    weight_lb: roundTo3(input.weightLb),
    body_fat_percent: input.bodyFatPercent !== null ? roundTo2(input.bodyFatPercent) : null,
    note: input.note ?? null,
  };

  // If a Fitbit-sourced entry is actually edited, clear Fitbit provenance so sync won’t overwrite it.
  if (input.oldRow.source === 'fitbit' && userChanged.userChanged) {
    payload.source = 'manual';
    payload.external_id = null;
  }

  return { shouldUpdateRow: userChanged.userChanged, userChanged, payload };
}

