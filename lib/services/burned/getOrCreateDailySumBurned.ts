import { toDateKey, getTodayKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';
import { getUserConfig } from '@/lib/services/userConfig';
import { computeSystemBurnedDefaults } from '@/lib/domain/burned/systemBurnedDefaults';
import { getDailySumBurnedByDate, insertDailySumBurned } from '@/lib/services/burned/dailySumBurned';
import { fetchLatestWeighInAtOrBefore } from '@/lib/services/weightLogs';

/**
 * CANONICAL SERVICE FUNCTION (SPEC)
 *
 * daily_sum_burned is a lazy local-day cache.
 * This function is the only allowed place to create default burned rows.
 *
 * NOTE: entry_date is derived using the SAME canonical date key utility as food logs: toDateKey().
 */
export async function getOrCreateDailySumBurned(
  userId: string,
  dateInput: Date | string | number | null | undefined
): Promise<DailySumBurned | null> {
  if (!userId) return null;

  // 1) Normalize input to entry_date using the exact same logic as food logs.
  const entryDate = toDateKey(dateInput ?? undefined);

  // No creation for future dates.
  // Comparing YYYY-MM-DD strings is safe lexicographically.
  const todayKey = getTodayKey();
  if (entryDate > todayKey) {
    return null;
  }

  // 2) Query existing row
  const existing = await getDailySumBurnedByDate(userId, entryDate);
  if (existing) return existing;

  // 3) Compute system defaults using existing onboarding/profile calculation logic.
  const userConfig = await getUserConfig(userId);
  if (!userConfig) {
    throw new Error('BURNED_DEFAULTS_PROFILE_MISSING');
  }

  // Use historical weight if available: latest weigh-in at/before the local end-of-day for entryDate.
  const endOfDayISO = endOfLocalDayISO(entryDate);
  const weightLog = await fetchLatestWeighInAtOrBefore(userId, endOfDayISO);
  const effectiveWeightLb =
    typeof weightLog?.weight_lb === 'number' ? weightLog.weight_lb : userConfig.weight_lb;

  const defaults = computeSystemBurnedDefaults({
    gender: userConfig.gender,
    date_of_birth: userConfig.date_of_birth,
    height_cm: userConfig.height_cm,
    weight_lb: effectiveWeightLb,
    activity_level: userConfig.activity_level,
  });

  if (!defaults) {
    throw new Error('BURNED_DEFAULTS_INPUT_MISSING');
  }

  // 4) Insert new row (lazy creation)
  const inserted = await insertDailySumBurned({
    user_id: userId,
    entry_date: entryDate,

    bmr_cal: defaults.system_bmr_cal,
    active_cal: defaults.system_active_cal,
    tdee_cal: defaults.system_tdee_cal,

    // Option 2: RAW is always populated. Default raw is the system activity burn baseline.
    burn_reduction_pct_int: 0,
    raw_burn: defaults.system_active_cal,
    raw_tdee: null,
    raw_burn_source: 'system',
    // Option 2 invariant: when pct=0 and raw_burn is present, raw_last_synced_at must be non-null.
    raw_last_synced_at: new Date().toISOString(),

    system_bmr_cal: defaults.system_bmr_cal,
    system_active_cal: defaults.system_active_cal,
    system_tdee_cal: defaults.system_tdee_cal,

    bmr_overridden: false,
    active_overridden: false,
    tdee_overridden: false,
    is_overridden: false,

    source: 'system',

    vendor_external_id: null,
    vendor_payload_hash: null,
    synced_at: null,
  });

  if (!inserted) {
    // Possible race (unique constraint). Try one more read.
    const retry = await getDailySumBurnedByDate(userId, entryDate);
    if (retry) return retry;
    return null;
  }

  // 5) Return the row
  return inserted;
}

function endOfLocalDayISO(dateKey: string): string {
  // dateKey is YYYY-MM-DD (local calendar day). Build a local Date and convert to ISO for DB comparisons.
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
  return dt.toISOString();
}


