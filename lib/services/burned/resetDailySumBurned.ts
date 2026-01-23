import { toDateKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';
import { getOrCreateDailySumBurned } from '@/lib/services/burned/getOrCreateDailySumBurned';
import { updateDailySumBurnedById } from '@/lib/services/burned/dailySumBurned';
import { BURNED } from '@/constants/constraints';

/**
 * Reset burned values back to system defaults (spec).
 */
export async function resetDailySumBurned(
  userId: string,
  dateInput: Date | string | number | null | undefined
): Promise<DailySumBurned | null> {
  if (!userId) return null;

  const entryDate = toDateKey(dateInput ?? undefined);
  const row = await getOrCreateDailySumBurned(userId, entryDate);
  if (!row) return null;

  if (
    row.system_bmr_cal > BURNED.TDEE_KCAL.MAX ||
    row.system_active_cal > BURNED.TDEE_KCAL.MAX ||
    row.system_tdee_cal > BURNED.TDEE_KCAL.MAX
  ) {
    console.error('System burned values exceed max kcal constraint', {
      entryDate,
      system_bmr_cal: row.system_bmr_cal,
      system_active_cal: row.system_active_cal,
      system_tdee_cal: row.system_tdee_cal,
    });
    throw new Error('BURNED_MAX_EXCEEDED');
  }

  return updateDailySumBurnedById({
    userId,
    id: row.id,
    updates: {
      bmr_cal: row.system_bmr_cal,
      active_cal: row.system_active_cal,
      tdee_cal: row.system_tdee_cal,

      // Option 2: reset restores RAW baseline + turns off reduction.
      burn_reduction_pct_int: 0,
      raw_burn: row.system_active_cal,
      raw_tdee: null,
      raw_burn_source: 'system',
      // Option 2 invariant: when pct=0 and raw_burn is present, raw_last_synced_at must be non-null.
      raw_last_synced_at: new Date().toISOString(),

      bmr_overridden: false,
      active_overridden: false,
      tdee_overridden: false,
      is_overridden: false,

      source: 'system',
    },
  });
}


