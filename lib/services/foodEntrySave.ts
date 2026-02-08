import { createEntry } from '@/lib/services/calorieEntries';
import { invalidateDailySumConsumedRangesForDate } from '@/lib/services/consumed/invalidateDailySumConsumedRanges';
import type { CalorieEntry, DailyEntriesWithStatus } from '@/utils/types';
import type { QueryClient } from '@tanstack/react-query';

type FoodEditSaveEntryVars = {
  userId: string;
  previousDateKey?: string;
};

/**
 * Apply the exact same client-side cache updates and invalidations as food-edit's
 * saveEntryMutation.onSuccess (copied verbatim for consistency).
 */
export function applyFoodEditEntrySaveSuccessSideEffects(
  queryClient: QueryClient,
  saved: CalorieEntry,
  vars: FoodEditSaveEntryVars
) {
  // Update the cache immediately, then invalidate for server truth.
  // (engineering-guidelines.md §4.2)
  const savedKey = ['entries', vars.userId, saved.entry_date] as const;

  queryClient.setQueryData<DailyEntriesWithStatus>(savedKey, (prev) => {
    const list = prev?.entries ?? [];
    const idx = list.findIndex((e) => e.id === saved.id);
    if (idx >= 0) {
      const next = list.slice();
      next[idx] = saved;
      return { entries: next, log_status: prev?.log_status ?? null };
    }
    return { entries: [...list, saved], log_status: prev?.log_status ?? null };
  });

  if (vars.previousDateKey && vars.previousDateKey !== saved.entry_date) {
    const prevKey = ['entries', vars.userId, vars.previousDateKey] as const;
    queryClient.setQueryData<DailyEntriesWithStatus>(prevKey, (prev) => {
      const prevEntries = prev?.entries ?? [];
      return {
        entries: prevEntries.filter((e) => e.id !== saved.id),
        log_status: prev?.log_status ?? null,
      };
    });
  }

  queryClient.invalidateQueries({ queryKey: savedKey });
  invalidateDailySumConsumedRangesForDate(queryClient, vars.userId, saved.entry_date);

  if (vars.previousDateKey && vars.previousDateKey !== saved.entry_date) {
    queryClient.invalidateQueries({
      queryKey: ['entries', vars.userId, vars.previousDateKey],
    });
    invalidateDailySumConsumedRangesForDate(queryClient, vars.userId, vars.previousDateKey);
  }
}

/**
 * Create a calorie entry using the same create-entry flow as food-edit,
 * and apply food-edit's cache side-effects.
 */
export async function createEntryWithFoodEditSideEffects(
  queryClient: QueryClient,
  params: {
    userId: string;
    entryForCreate: Omit<CalorieEntry, 'id' | 'created_at' | 'updated_at'>;
  }
): Promise<CalorieEntry> {
  const created = await createEntry(params.entryForCreate);
  if (!created) throw new Error('Failed to create entry');

  applyFoodEditEntrySaveSuccessSideEffects(queryClient, created, { userId: params.userId });
  return created;
}

