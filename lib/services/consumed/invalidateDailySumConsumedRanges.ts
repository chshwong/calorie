import type { QueryClient } from '@tanstack/react-query';
import { compareDateKeys } from '@/lib/date-guard';

/**
 * Invalidate only the cached dailySumConsumedRange queries whose [startDate,endDate]
 * contains the given dateKey (YYYY-MM-DD).
 *
 * This enables dashboard caching without nuking all ranges.
 */
export function invalidateDailySumConsumedRangesForDate(
  queryClient: QueryClient,
  userId: string | undefined,
  dateKey: string
) {
  if (!userId || !dateKey) return;

  const queries = queryClient.getQueryCache().findAll({
    queryKey: ['dailySumConsumedRange', userId],
  });

  for (const q of queries) {
    const key = q.queryKey as unknown as [string, string, string, string];
    if (key.length < 4) continue;

    const start = key[2];
    const end = key[3];
    if (!start || !end) continue;

    if (compareDateKeys(dateKey, start) >= 0 && compareDateKeys(dateKey, end) <= 0) {
      queryClient.invalidateQueries({ queryKey: q.queryKey });
    }
  }
}

/**
 * Invalidate only the cached dailySumConsumedMealRange queries whose [startDate,endDate]
 * contains the given dateKey (YYYY-MM-DD).
 *
 * This enables dashboard caching without nuking all ranges.
 */
export function invalidateDailySumConsumedMealRangesForDate(
  queryClient: QueryClient,
  userId: string | undefined,
  dateKey: string
) {
  if (!userId || !dateKey) return;

  const queries = queryClient.getQueryCache().findAll({
    queryKey: ['dailySumConsumedMealRange', userId],
  });

  for (const q of queries) {
    const key = q.queryKey as unknown as [string, string, string, string];
    if (key.length < 4) continue;

    const start = key[2];
    const end = key[3];
    if (!start || !end) continue;

    if (compareDateKeys(dateKey, start) >= 0 && compareDateKeys(dateKey, end) <= 0) {
      queryClient.invalidateQueries({ queryKey: q.queryKey });
    }
  }
}


