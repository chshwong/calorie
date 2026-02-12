import { BURNED } from '@/constants/constraints';
import { computeSystemBurnedDefaults } from '@/lib/domain/burned/systemBurnedDefaults';
import { getUserConfig } from '@/lib/services/userConfig';
import {
    fetchLatestWeighInAtOrBefore,
    fetchNextWeighInAfter,
    fetchWeightLogsRange,
    type WeightLogRow,
} from '@/lib/services/weightLogs';
import { addDays, getTodayKey, toDateKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';
import { getDailySumBurnedByDate, getDailySumBurnedForRange, updateDailySumBurnedById } from './dailySumBurned';

/**
 * Refresh daily_sum_burned for a bounded window after a weight history change.
 *
 * Rules:
 * - Never inserts rows (updates existing rows only).
 * - Always updates system_* fields for affected days.
 * - If row.is_overridden === true: never change authoritative bmr/active/tdee fields.
 * - If row.is_overridden === false: keep row purely-system (authoritative mirrors system_* and flags false).
 */
export async function refreshBurnedFromWeightChange(params: {
  userId: string;
  changedAtISO?: string | null;
}): Promise<{ updated: number; startDate: string; endDate: string } | null> {
  const { userId, changedAtISO } = params;
  if (!userId) return null;

  const todayKey = getTodayKey();
  const lookbackDays = BURNED.REFRESH_LOOKBACK_DAYS;
  const minKey = addDays(todayKey, -(lookbackDays - 1));

  // Conservative fallback: if we don't know the changed timestamp, refresh the whole window.
  const changeKey = changedAtISO ? toDateKey(changedAtISO) : null;
  const startKey = changeKey ? maxKey(changeKey, minKey) : minKey;

  let endKey = todayKey;
  if (changedAtISO) {
    const nextISO = await fetchNextWeighInAfter(userId, changedAtISO);
    if (nextISO) {
      // Change affects days up to the day before the next weigh-in.
      const dayBeforeNext = addDays(toDateKey(nextISO), -1);
      endKey = minKeyFn(dayBeforeNext, todayKey);
    }
  }

  if (endKey < startKey) {
    return { updated: 0, startDate: startKey, endDate: endKey };
  }

  const userConfig = await getUserConfig(userId);
  if (!userConfig) return null;

  const fallbackWeightLb = typeof userConfig.weight_lb === 'number' ? userConfig.weight_lb : null;

  const weights = await buildEffectiveWeightMap({
    userId,
    startKey,
    endKey,
    fallbackWeightLb,
  });

  const rows = await getDailySumBurnedForRange(userId, startKey, endKey);
  if (!rows || rows.length === 0) {
    return { updated: 0, startDate: startKey, endDate: endKey };
  }

  let updated = 0;

  // Update sequentially to keep network usage predictable (max 21 days).
  for (const row of rows) {
    const effectiveWeight = weights.get(row.entry_date) ?? fallbackWeightLb;

    const defaults = computeSystemBurnedDefaults({
      gender: userConfig.gender,
      date_of_birth: userConfig.date_of_birth,
      height_cm: userConfig.height_cm,
      weight_lb: effectiveWeight,
      activity_level: userConfig.activity_level,
    });

    if (!defaults) {
      // If inputs are missing, skip rather than throwing from a background refresh.
      continue;
    }

    const systemUnchanged =
      row.system_bmr_cal === defaults.system_bmr_cal &&
      row.system_active_cal === defaults.system_active_cal &&
      row.system_tdee_cal === defaults.system_tdee_cal;

    const isOverridden = Boolean(row.is_overridden);

    // If this is an overridden row and system values are unchanged, skip.
    if (isOverridden && systemUnchanged) {
      continue;
    }

    // For non-overridden rows, we also keep authoritative equal to system.
    if (!isOverridden) {
      const authUnchanged =
        row.bmr_cal === defaults.system_bmr_cal &&
        row.active_cal === defaults.system_active_cal &&
        row.tdee_cal === defaults.system_tdee_cal &&
        row.bmr_overridden === false &&
        row.active_overridden === false &&
        row.tdee_overridden === false &&
        row.is_overridden === false;

      if (systemUnchanged && authUnchanged) {
        continue;
      }
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<DailySumBurned> = {
      system_bmr_cal: defaults.system_bmr_cal,
      system_active_cal: defaults.system_active_cal,
      system_tdee_cal: defaults.system_tdee_cal,
    };

    // Option 2 invariant: every row must have raw_burn and raw_burn_source NOT NULL.
    // Always send them on every update so the constraint cannot fail (avoids partial-update/legacy nulls).
    const safeRawBurn = row.raw_burn ?? row.active_cal ?? row.system_active_cal ?? 0;
    const safeRawSource = row.raw_burn_source ?? 'legacy_backfill';

    if (!isOverridden) {
      updates.bmr_cal = defaults.system_bmr_cal;
      updates.active_cal = defaults.system_active_cal;
      updates.tdee_cal = defaults.system_tdee_cal;
      // Option 2: keep RAW baseline consistent for purely-system rows.
      updates.burn_reduction_pct_int = 0;
      updates.raw_burn = defaults.system_active_cal;
      updates.raw_tdee = null;
      updates.raw_burn_source = 'system';
      // Compatibility with both legacy 3-state and Option 2 invariants:
      // when pct=0 and raw_burn is present, legacy schemas require non-null synced_at.
      updates.raw_last_synced_at = row.raw_last_synced_at ?? nowIso;
      updates.bmr_overridden = false;
      updates.active_overridden = false;
      updates.tdee_overridden = false;
      updates.is_overridden = false;
    } else {
      updates.raw_burn = safeRawBurn;
      updates.raw_burn_source = safeRawSource;
      // Keep legacy invariant valid for overridden rows when pct=0 and RAW is present.
      if ((row.burn_reduction_pct_int ?? 0) === 0) {
        updates.raw_last_synced_at = row.raw_last_synced_at ?? nowIso;
      }
    }

    const res = await updateDailySumBurnedById({
      userId,
      id: row.id,
      updates,
    });

    if (res) updated += 1;
  }

  return { updated, startDate: startKey, endDate: endKey };
}

/**
 * Refresh TODAY's burned row after profile input changes (height/activity/gender/dob).
 * Never creates the row; if it doesn't exist, no-op.
 */
export async function refreshBurnedTodayFromProfileChange(userId: string): Promise<DailySumBurned | null> {
  if (!userId) return null;
  const todayKey = getTodayKey();

  const existing = await getDailySumBurnedByDate(userId, todayKey);
  if (!existing) return null;

  const userConfig = await getUserConfig(userId);
  if (!userConfig) return null;

  const fallbackWeightLb = typeof userConfig.weight_lb === 'number' ? userConfig.weight_lb : null;
  const effectiveWeight = await getEffectiveWeightForDay(userId, todayKey, fallbackWeightLb);

  const defaults = computeSystemBurnedDefaults({
    gender: userConfig.gender,
    date_of_birth: userConfig.date_of_birth,
    height_cm: userConfig.height_cm,
    weight_lb: effectiveWeight,
    activity_level: userConfig.activity_level,
  });

  if (!defaults) return null;

  const isOverridden = Boolean(existing.is_overridden);
  const nowIso = new Date().toISOString();
  const updates: Partial<DailySumBurned> = {
    system_bmr_cal: defaults.system_bmr_cal,
    system_active_cal: defaults.system_active_cal,
    system_tdee_cal: defaults.system_tdee_cal,
  };

  // Option 2 invariant: every row must have raw_burn and raw_burn_source NOT NULL; always send them.
  const safeRawBurn = existing.raw_burn ?? existing.active_cal ?? existing.system_active_cal ?? 0;
  const safeRawSource = existing.raw_burn_source ?? 'legacy_backfill';

  if (!isOverridden) {
    updates.bmr_cal = defaults.system_bmr_cal;
    updates.active_cal = defaults.system_active_cal;
    updates.tdee_cal = defaults.system_tdee_cal;
    // Option 2: keep RAW baseline consistent for purely-system rows.
    updates.burn_reduction_pct_int = 0;
    updates.raw_burn = defaults.system_active_cal;
    updates.raw_tdee = null;
    updates.raw_burn_source = 'system';
    // Compatibility with both legacy 3-state and Option 2 invariants.
    updates.raw_last_synced_at = existing.raw_last_synced_at ?? nowIso;
    updates.bmr_overridden = false;
    updates.active_overridden = false;
    updates.tdee_overridden = false;
    updates.is_overridden = false;
  } else {
    updates.raw_burn = safeRawBurn;
    updates.raw_burn_source = safeRawSource;
    if ((existing.burn_reduction_pct_int ?? 0) === 0) {
      updates.raw_last_synced_at = existing.raw_last_synced_at ?? nowIso;
    }
  }

  return (
    (await updateDailySumBurnedById({
      userId,
      id: existing.id,
      updates,
    })) ?? null
  );
}

async function getEffectiveWeightForDay(
  userId: string,
  dateKey: string,
  fallbackWeightLb: number | null
): Promise<number | null> {
  const endISO = endOfLocalDayISO(dateKey);
  const row = await fetchLatestWeighInAtOrBefore(userId, endISO);
  if (typeof row?.weight_lb === 'number') return row.weight_lb;
  return fallbackWeightLb;
}

async function buildEffectiveWeightMap(params: {
  userId: string;
  startKey: string;
  endKey: string;
  fallbackWeightLb: number | null;
}): Promise<Map<string, number | null>> {
  const { userId, startKey, endKey, fallbackWeightLb } = params;

  const startLocal = startOfLocalDay(startKey);
  const endLocal = endOfLocalDay(endKey);
  const startISO = startLocal.toISOString();
  const endISO = endLocal.toISOString();

  const [logs, prior] = await Promise.all([
    fetchWeightLogsRange(userId, startISO, endISO),
    // Carry-forward seed: latest weigh-in strictly before the window.
    fetchLatestWeighInAtOrBefore(userId, new Date(startLocal.getTime() - 1).toISOString()),
  ]);

  let currentWeight: number | null =
    typeof prior?.weight_lb === 'number' ? prior.weight_lb : fallbackWeightLb;

  const out = new Map<string, number | null>();
  const idxRef = { i: 0 };

  // Iterate at most lookbackDays (bounded).
  const maxDays = BURNED.REFRESH_LOOKBACK_DAYS + 2;
  let dKey = startKey;
  for (let n = 0; n < maxDays && dKey <= endKey; n++) {
    const endMs = endOfLocalDay(dKey).getTime();
    currentWeight = consumeLogsUpTo(logs, idxRef, endMs, currentWeight);
    out.set(dKey, currentWeight);
    dKey = addDays(dKey, 1);
  }

  return out;
}

function consumeLogsUpTo(
  logs: WeightLogRow[],
  idxRef: { i: number },
  endMs: number,
  currentWeight: number | null
): number | null {
  while (idxRef.i < logs.length) {
    const log = logs[idxRef.i]!;
    const ms = new Date(log.weighed_at).getTime();
    if (!Number.isFinite(ms) || ms > endMs) break;
    currentWeight = typeof log.weight_lb === 'number' ? log.weight_lb : currentWeight;
    idxRef.i += 1;
  }
  return currentWeight;
}

function startOfLocalDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function endOfLocalDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
}

function endOfLocalDayISO(dateKey: string): string {
  return endOfLocalDay(dateKey).toISOString();
}

function maxKey(a: string, b: string): string {
  return a > b ? a : b;
}

function minKeyFn(a: string, b: string): string {
  return a < b ? a : b;
}


