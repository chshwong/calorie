import type { DailyLogStatus, DailySumConsumed } from '@/utils/types';

export function buildOptimisticDailySumConsumedRow(params: {
  userId: string;
  entryDate: string;
  status: DailyLogStatus;
  nowIso: string;
  previous?: DailySumConsumed | null;
}): DailySumConsumed {
  const { userId, entryDate, status, nowIso, previous } = params;

  return {
    user_id: userId,
    entry_date: entryDate,

    calories: previous?.calories ?? 0,
    protein_g: previous?.protein_g ?? 0,
    carbs_g: previous?.carbs_g ?? 0,
    fat_g: previous?.fat_g ?? 0,
    fibre_g: previous?.fibre_g ?? 0,
    sugar_g: previous?.sugar_g ?? 0,
    saturated_fat_g: previous?.saturated_fat_g ?? 0,
    trans_fat_g: previous?.trans_fat_g ?? 0,
    sodium_mg: previous?.sodium_mg ?? 0,

    log_status: status,

    created_at: previous?.created_at ?? nowIso,
    touched_at: nowIso,
    status_updated_at: nowIso,
    completed_at: status === 'completed' ? nowIso : null,
    last_recomputed_at: previous?.last_recomputed_at ?? null,
    updated_at: nowIso,
  };
}


