import { toDateKey } from '@/utils/dateKey';
import type { DailySumBurned, RawBurnSource } from '@/utils/types';
import { getOrCreateDailySumBurned } from '@/lib/services/burned/getOrCreateDailySumBurned';
import { updateDailySumBurnedById } from '@/lib/services/burned/dailySumBurned';
import { BURNED } from '@/constants/constraints';

export type BurnedTouchedFields = {
  bmr: boolean;
  active: boolean;
  tdee: boolean;
};

export type BurnedEditedValues = {
  bmr_cal: number;
  active_cal: number;
  tdee_cal: number;
};

export type BurnReductionEdits = {
  /**
   * Integer percent reduction (0..50) applied to raw_burn.
   */
  burn_reduction_pct_int: number;
  raw_burn: number | null;
  raw_tdee?: number | null;
  /**
   * Optional provenance override for raw_burn.
   * If omitted, service will choose a reasonable default.
   */
  raw_burn_source?: RawBurnSource | null;
};

function toSafeInt(n: number): number {
  // UI collects text; we validate in UI, but keep the DB layer defensive.
  if (!Number.isFinite(n)) {
    throw new Error('BURNED_INVALID_NUMBER');
  }
  return Math.trunc(n);
}

function assertWholeNumberInRange(params: { value: number; min: number; max: number; errorCode: string }) {
  const { value, min, max, errorCode } = params;
  if (!Number.isFinite(value) || Math.trunc(value) !== value) {
    throw new Error(errorCode);
  }
  if (value < min || value > max) {
    throw new Error(errorCode);
  }
}

function toSafeNumberOrNull(n: number | null | undefined): number | null {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Persist burned edits using authoritative edit rules from the spec.
 * All database writes MUST go through this service.
 */
export async function saveDailySumBurned(params: {
  userId: string;
  dateInput: Date | string | number | null | undefined;
  touched: BurnedTouchedFields;
  values: BurnedEditedValues;
  reduction?: BurnReductionEdits;
}): Promise<DailySumBurned | null> {
  const { userId, dateInput, touched, values, reduction } = params;
  if (!userId) return null;

  const entryDate = toDateKey(dateInput ?? undefined);
  const row = await getOrCreateDailySumBurned(userId, entryDate);
  if (!row) return null;

  const nextBmrInput = toSafeInt(values.bmr_cal);
  const nextActiveInput = toSafeInt(values.active_cal);
  const nextTdeeInput = toSafeInt(values.tdee_cal);

  const nextPct = reduction?.burn_reduction_pct_int ?? row.burn_reduction_pct_int ?? 0;
  assertWholeNumberInRange({ value: nextPct, min: 0, max: 50, errorCode: 'BURNED_REDUCTION_PCT_INVALID' });

  const rawBurnFromReduction = toSafeNumberOrNull(reduction?.raw_burn ?? null);

  const currentRawBurn =
    typeof row.raw_burn === 'number'
      ? row.raw_burn
      : typeof row.active_cal === 'number'
        ? row.active_cal
        : typeof row.system_active_cal === 'number'
          ? row.system_active_cal
          : 0;

  const currentRawSource = row.raw_burn_source ?? 'legacy_backfill';

  const nextBmrCal = touched.bmr ? nextBmrInput : row.bmr_cal;
  if (nextBmrCal < 0) throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');

  // Determine next raw burn from intent:
  // - advanced raw edit (BurnReductionModal testing): reduction.raw_burn wins
  // - manual edit activity: raw_burn = active input (valid only when pct=0 in UI)
  // - manual edit tdee: raw_burn = tdee - bmr (valid only when pct=0 in UI)
  let nextRawBurn = currentRawBurn;
  let nextRawSource = currentRawSource;
  let nextRawLastSyncedAt: string | null | undefined = row.raw_last_synced_at ?? null;

  const rawEdited = rawBurnFromReduction !== null;
  const manualEdited = touched.active || touched.tdee;

  if (rawEdited) {
    nextRawBurn = rawBurnFromReduction as number;
    nextRawSource = reduction?.raw_burn_source ?? 'manual';
    nextRawLastSyncedAt = null;
  } else if (touched.tdee) {
    const solved = nextTdeeInput - nextBmrCal;
    if (solved < 0) throw new Error('BURNED_TDEE_BELOW_BMR');
    nextRawBurn = solved;
    nextRawSource = 'manual';
    nextRawLastSyncedAt = null;
  } else if (touched.active) {
    nextRawBurn = nextActiveInput;
    nextRawSource = 'manual';
    nextRawLastSyncedAt = null;
  }

  if (!Number.isFinite(nextRawBurn)) throw new Error('BURNED_INVALID_NUMBER');
  if (nextRawBurn < 0) throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');

  // Compatibility: older DB invariants required raw_last_synced_at to be non-null when pct=0 and raw_burn is present.
  // Option 2 treats raw_last_synced_at as best-effort metadata, so it's safe to populate when missing.
  if (nextPct === 0 && (nextRawLastSyncedAt === null || nextRawLastSyncedAt === undefined)) {
    nextRawLastSyncedAt = new Date().toISOString();
  }

  const nextFinalActive = Math.round(nextRawBurn * (1 - nextPct / 100));
  const nextFinalTdee = Math.round(nextBmrCal + nextFinalActive);

  if (nextFinalActive < 0 || nextFinalTdee < 0) throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');
  if (nextFinalTdee > BURNED.TDEE_KCAL.MAX) throw new Error('BURNED_MAX_EXCEEDED');

  const bmrOverridden = touched.bmr ? true : row.bmr_overridden;
  const activeOverridden = nextRawSource !== 'system' || nextPct > 0 || nextRawBurn !== row.system_active_cal;
  const tdeeOverridden = bmrOverridden || activeOverridden;
  const isOverridden = Boolean(bmrOverridden || activeOverridden || tdeeOverridden);

  return updateDailySumBurnedById({
    userId,
    id: row.id,
    updates: {
      bmr_cal: nextBmrCal,
      active_cal: nextFinalActive,
      tdee_cal: nextFinalTdee,

      burn_reduction_pct_int: nextPct,
      raw_burn: nextRawBurn,
      raw_tdee: null,
      raw_burn_source: nextRawSource,
      raw_last_synced_at: nextRawLastSyncedAt ?? null,

      bmr_overridden: bmrOverridden,
      active_overridden: activeOverridden,
      tdee_overridden: tdeeOverridden,
      is_overridden: isOverridden,

      // Do not change 'source' (base provenance preserved).
    },
  });
}

/**
 * Recompute and persist finals from the already-persisted raw_burn and burn_reduction_pct_int.
 * Intended for Sync flows where the server has already updated raw fields (e.g. Fitbit).
 */
export async function applyRawToFinals(params: {
  userId: string;
  dateInput: Date | string | number | null | undefined;
}): Promise<DailySumBurned | null> {
  const { userId, dateInput } = params;
  if (!userId) return null;

  const entryDate = toDateKey(dateInput ?? undefined);
  const row = await getOrCreateDailySumBurned(userId, entryDate);
  if (!row) return null;

  const pct = row.burn_reduction_pct_int ?? 0;
  assertWholeNumberInRange({ value: pct, min: 0, max: 50, errorCode: 'BURNED_REDUCTION_PCT_INVALID' });

  const raw =
    typeof row.raw_burn === 'number'
      ? row.raw_burn
      : typeof row.active_cal === 'number'
        ? row.active_cal
        : typeof row.system_active_cal === 'number'
          ? row.system_active_cal
          : 0;

  if (!Number.isFinite(raw) || raw < 0) throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');

  const nextFinalActive = Math.round(raw * (1 - pct / 100));
  const nextFinalTdee = Math.round(row.bmr_cal + nextFinalActive);

  if (nextFinalActive < 0 || nextFinalTdee < 0) throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');
  if (nextFinalTdee > BURNED.TDEE_KCAL.MAX) throw new Error('BURNED_MAX_EXCEEDED');

  const rawSource = row.raw_burn_source ?? 'legacy_backfill';
  const activeOverridden = rawSource !== 'system' || pct > 0 || raw !== row.system_active_cal;
  const tdeeOverridden = Boolean(row.bmr_overridden) || activeOverridden;
  const isOverridden = Boolean(row.bmr_overridden || activeOverridden || tdeeOverridden);

  return updateDailySumBurnedById({
    userId,
    id: row.id,
    updates: {
      active_cal: nextFinalActive,
      tdee_cal: nextFinalTdee,
      active_overridden: activeOverridden,
      tdee_overridden: tdeeOverridden,
      is_overridden: isOverridden,
    },
  });
}
