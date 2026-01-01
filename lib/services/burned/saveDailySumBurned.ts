import { toDateKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';
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

function toSafeInt(n: number): number {
  // UI collects text; we validate in UI, but keep the DB layer defensive.
  if (!Number.isFinite(n)) {
    throw new Error('BURNED_INVALID_NUMBER');
  }
  return Math.trunc(n);
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
}): Promise<DailySumBurned | null> {
  const { userId, dateInput, touched, values } = params;
  if (!userId) return null;

  const entryDate = toDateKey(dateInput ?? undefined);
  const row = await getOrCreateDailySumBurned(userId, entryDate);
  if (!row) return null;

  const nextBmr = toSafeInt(values.bmr_cal);
  const nextActive = toSafeInt(values.active_cal);
  const nextTdee = toSafeInt(values.tdee_cal);

  // USER EDITS TDEE DIRECTLY
  if (touched.tdee) {
    const systemBmr = row.system_bmr_cal;
    const derivedActive = nextTdee - systemBmr;
    if (derivedActive < 0) {
      throw new Error('BURNED_TDEE_BELOW_BMR');
    }
    const derivedTdee = nextTdee;
    if (derivedTdee > BURNED.TDEE_KCAL.MAX) {
      throw new Error('BURNED_MAX_EXCEEDED');
    }

    return updateDailySumBurnedById({
      userId,
      id: row.id,
      updates: {
        bmr_cal: systemBmr,
        bmr_overridden: false,
        active_cal: derivedActive,
        active_overridden: true,
        tdee_cal: derivedTdee,
        tdee_overridden: true,
        is_overridden: true,
        // Do not change source (base provenance preserved).
      },
    });
  }

  // USER EDITS BMR OR ACTIVE (or both)
  const bmrCal = touched.bmr ? nextBmr : row.bmr_cal;
  const activeCal = touched.active ? nextActive : row.active_cal;
  if (bmrCal < 0 || activeCal < 0) {
    throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');
  }
  const tdeeCal = bmrCal + activeCal;
  if (tdeeCal < 0) {
    throw new Error('BURNED_NEGATIVE_NOT_ALLOWED');
  }
  if (tdeeCal > BURNED.TDEE_KCAL.MAX) {
    throw new Error('BURNED_MAX_EXCEEDED');
  }

  const bmrOverridden = touched.bmr ? true : row.bmr_overridden;
  const activeOverridden = touched.active ? true : row.active_overridden;

  const isOverridden = bmrOverridden || activeOverridden;

  return updateDailySumBurnedById({
    userId,
    id: row.id,
    updates: {
      bmr_cal: bmrCal,
      active_cal: activeCal,
      tdee_cal: tdeeCal,
      bmr_overridden: bmrOverridden,
      active_overridden: activeOverridden,
      // tdee is derived when editing bmr/active
      tdee_overridden: false,
      is_overridden: isOverridden,
      // Do not change source (base provenance preserved).
    },
  });
}


