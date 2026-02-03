import { BURNED } from '@/constants/constraints';
import { updateDailySumBurnedById } from '@/lib/services/burned/dailySumBurned';
import { deriveWearableSplit } from '@/lib/services/burned/deriveWearableSplit';
import { getOrCreateDailySumBurned } from '@/lib/services/burned/getOrCreateDailySumBurned';
import { toDateKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';

function toSafeInt(n: number): number {
  if (!Number.isFinite(n)) throw new Error('BURNED_INVALID_NUMBER');
  return Math.trunc(n);
}

function assertWholeNumberInRange(params: { value: number; min: number; max: number; errorCode: string }) {
  const { value, min, max, errorCode } = params;
  if (!Number.isFinite(value) || Math.trunc(value) !== value) throw new Error(errorCode);
  if (value < min || value > max) throw new Error(errorCode);
}

/**
 * Save burned calories in Wearable Calories mode.
 *
 * Contract:
 * - The caller provides an authoritative TOTAL (tdee_cal) value (Fitbit-like “total calories burned”).
 * - We derive a coherent split that satisfies DB invariants:
 *   - `tdee_cal = bmr_cal + active_cal`
 *   - `active_cal >= 0`
 * - We do NOT change system_* fields.
 *
 * Raw field semantics (Option 2):
 * - raw_tdee stores the wearable TOTAL calories burned baseline (Fitbit: caloriesOut).
 * - raw_burn stores the activity remainder baseline (raw_tdee - derived_bmr) BEFORE correction %.
 * - raw_burn_source reflects wearable totals provenance (fitbit).
 */
export async function saveWearableTotalBurned(params: {
  userId: string;
  dateInput: Date | string | number | null | undefined;
  /** Authoritative final total for the day (must satisfy max constraints). */
  tdee_cal: number;
}): Promise<DailySumBurned | null> {
  const { userId, dateInput } = params;
  if (!userId) return null;

  const entryDateKey = toDateKey(dateInput ?? undefined);
  const row = await getOrCreateDailySumBurned(userId, entryDateKey);
  if (!row) return null;

  const requestedFinalTdee = toSafeInt(params.tdee_cal);
  if (requestedFinalTdee < 0) throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');
  if (requestedFinalTdee > BURNED.TDEE_KCAL.MAX) throw new Error('BURNED_MAX_EXCEEDED');

  const pct = row.burn_reduction_pct_int ?? 0;
  assertWholeNumberInRange({ value: pct, min: 0, max: 50, errorCode: 'BURNED_REDUCTION_PCT_INVALID' });
  const factor = 1 - pct / 100;

  // 1) Derive BMR for this day (today is prorated by local-day progress).
  const split = deriveWearableSplit({
    entryDateKey,
    now: new Date(),
    systemBmrFullDay: row.system_bmr_cal,
    wearableTdeeTotal: requestedFinalTdee,
  });

  // 2) Treat requested tdee as the FINAL total the app should use (post-correction).
  const bmr = split.bmr;
  const desiredFinalActive = Math.max(0, requestedFinalTdee - bmr);

  // 3) Compute a raw remainder baseline so burn correction remains consistent.
  const rawBurnBaseline = factor > 0 ? desiredFinalActive / factor : 0;

  const finalActive = Math.round(rawBurnBaseline * factor);
  const finalTdee = Math.round(bmr + finalActive);

  if (finalActive < 0 || finalTdee < 0) throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');
  if (finalTdee > BURNED.TDEE_KCAL.MAX) throw new Error('BURNED_MAX_EXCEEDED');

  return updateDailySumBurnedById({
    userId,
    id: row.id,
    updates: {
      bmr_cal: bmr,
      active_cal: finalActive,
      tdee_cal: finalTdee,

      // Raw fields (see header comment).
      raw_tdee: bmr + rawBurnBaseline,
      raw_burn: rawBurnBaseline,
      raw_burn_source: 'fitbit',
      // Best-effort metadata; non-null keeps Option 2 invariant when pct=0.
      raw_last_synced_at: new Date().toISOString(),

      bmr_overridden: true,
      active_overridden: true,
      tdee_overridden: true,
      is_overridden: true,

      source: 'fitbit',
    },
  });
}

