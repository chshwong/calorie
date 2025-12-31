import { toDateKey, getTodayKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';
import { getUserConfig } from '@/lib/services/userConfig';
import { computeSystemBurnedDefaults } from '@/lib/domain/burned/systemBurnedDefaults';
import { getDailySumBurnedByDate, insertDailySumBurned } from '@/lib/services/burned/dailySumBurned';

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

  const defaults = computeSystemBurnedDefaults({
    gender: userConfig.gender,
    date_of_birth: userConfig.date_of_birth,
    height_cm: userConfig.height_cm,
    weight_lb: userConfig.weight_lb,
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


