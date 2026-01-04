/**
 * React Query hooks for weight logs
 *
 * Mirrors the water log patterns with persistent caching and placeholder data.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchEarliestWeighInDate,
  fetchLatestBodyFatTimestamp,
  fetchLatestWeighInTimestamp,
  fetchWeightLogsRange,
  fetchWeightLogs366d,
  insertWeightLogRow,
  updateProfileBodyFat,
  updateProfileWeightLb,
  updateWeightLogRow,
  type WeightLogRow,
} from '@/lib/services/weightLogs';
import { refreshBurnedFromWeightChange } from '@/lib/services/burned/refreshDailySumBurned';
import { DEFAULT_CACHE_MAX_AGE_MS, getPersistentCache, setPersistentCache } from '@/lib/persistentCache';
import { useLocalDayKey } from './use-local-day-key';
import { getLocalDateKey } from '@/utils/dateTime';

type SaveWeightInput = {
  entryId?: string | null;
  weighedAt: Date;
  weightLb: number;
  bodyFatPercent?: number | null;
  note?: string | null;
  /** Optional previous timestamp (edit mode) to allow accurate refresh when the entry's timestamp changes. */
  previousWeighedAtISO?: string | null;
};

type WeightDay = {
  entryId: string | null;
  date: string;
  weightLb: number | null;
  bodyFatPercent: number | null;
  weighedAt?: string | null;
  carriedForward: boolean;
  hasEntry: boolean;
  entryCount: number;
};

export function useWeightLogsRange(startDate: Date, endDate: Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const startISO = startOfDayISO(startDate);
  const endISO = endOfDayISO(endDate);

  const cacheKey = weightLogsRangeCacheKey(userId, startISO, endISO);
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<WeightLogRow[]>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery<WeightLogRow[]>({
    queryKey: ['weightLogs', userId, startISO, endISO],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await fetchWeightLogsRange(userId, startISO, endISO);

      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      return data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previous) => {
      if (previous !== undefined) return previous;
      const cached = queryClient.getQueryData<WeightLogRow[]>([
        'weightLogs',
        userId,
        startISO,
        endISO,
      ]);
      if (cached !== undefined) return cached;
      return snapshot ?? undefined;
    },
  });
}

/**
 * Fetch last 366 days of weight logs with persistent cache hydration.
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_HUNDRED_SIXTY_SIX_DAYS_MS = 366 * ONE_DAY_MS;

export function useWeightLogs366d() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const cacheKey = userId ? `weightLogs366d:${userId}` : null;
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<WeightLogRow[]>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery<WeightLogRow[]>({
    queryKey: ['weightLogs366d', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const data = await fetchWeightLogs366d(userId);
      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }
      return data;
    },
    enabled: !!userId,
    staleTime: Infinity, // Rely on explicit invalidation
    gcTime: THREE_HUNDRED_SIXTY_SIX_DAYS_MS,
    placeholderData: (previous) => {
      if (previous !== undefined) return previous;
      const cached = queryClient.getQueryData<WeightLogRow[]>(['weightLogs366d', userId]);
      if (cached !== undefined) return cached;
      return snapshot ?? undefined;
    },
  });
}

export function getLatestWeightEntry(entries: WeightLogRow[]): WeightLogRow | null {
  if (!entries || entries.length === 0) return null;
  return entries.reduce((latest, current) => {
    if (!latest) return current;
    return new Date(current.weighed_at).getTime() > new Date(latest.weighed_at).getTime()
      ? current
      : latest;
  }, null as WeightLogRow | null);
}

export function getLatestBodyFatEntry(entries: WeightLogRow[]): WeightLogRow | null {
  const withBodyFat = entries.filter((e) => e.body_fat_percent !== null && e.body_fat_percent !== undefined);
  if (withBodyFat.length === 0) return null;
  return withBodyFat.reduce((latest, current) => {
    if (!latest) return current;
    return new Date(current.weighed_at).getTime() > new Date(latest.weighed_at).getTime()
      ? current
      : latest;
  }, null as WeightLogRow | null);
}

export function useWeightHomeData(rangeDays: number = 7, rangeEndDate?: Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const { dayKey } = useLocalDayKey();

  const today = useMemo(() => {
    const d = rangeEndDate ? new Date(rangeEndDate) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayKey, rangeEndDate]);

  const fetchWindowDays = Math.max(rangeDays, 14);
  const startDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - (fetchWindowDays - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today, fetchWindowDays]);

  const endDate = useMemo(() => {
    const d = new Date(today);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [today]);

  const rangeQuery = useWeightLogsRange(startDate, endDate);

  const earliestQuery = useQuery({
    queryKey: ['weightLogs', userId, 'earliest'],
    enabled: !!userId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return fetchEarliestWeighInDate(userId);
    },
  });

  const days: WeightDay[] = useMemo(() => {
    const logs = rangeQuery.data ?? [];
    const earliestISO = earliestQuery.data;
    const firstEntryDate = earliestISO ? toDateKeyLocal(new Date(earliestISO)) : null;

    // Count entries per local day (for multi-entry indicator + day view)
    const countByDate = new Map<string, number>();
    logs.forEach((log) => {
      const key = toDateKeyLocal(new Date(log.weighed_at));
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    });

    // Map latest entry per day
    const latestByDate = new Map<string, WeightLogRow>();
    logs.forEach((log) => {
      const key = toDateKeyLocal(new Date(log.weighed_at));
      const existing = latestByDate.get(key);
      if (!existing || new Date(log.weighed_at).getTime() > new Date(existing.weighed_at).getTime()) {
        latestByDate.set(key, log);
      }
    });

    // Build date list ascending to compute carry-forward correctly
    const allDateKeys: string[] = [];
    for (let i = 0; i < fetchWindowDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      allDateKeys.push(toDateKeyLocal(d));
    }

    let lastKnownWeight: number | null = null;
    const timeline: WeightDay[] = allDateKeys.map((dateKey) => {
      const entry = latestByDate.get(dateKey);
      const hasEntry = !!entry;
      const weightFromEntry = entry?.weight_lb ?? null;
      const bodyFatFromEntry = entry?.body_fat_percent ?? null;
      const entryId = entry?.id ?? null;
      const entryCount = countByDate.get(dateKey) ?? 0;

      if (hasEntry && weightFromEntry !== null) {
        lastKnownWeight = weightFromEntry;
      }

      const shouldCarryForward =
        !hasEntry &&
        lastKnownWeight !== null &&
        firstEntryDate !== null &&
        dateKey >= firstEntryDate;

      return {
        date: dateKey,
        entryId,
        weightLb: hasEntry ? weightFromEntry : shouldCarryForward ? lastKnownWeight : null,
        bodyFatPercent: hasEntry ? bodyFatFromEntry : null,
        weighedAt: entry?.weighed_at ?? null,
        carriedForward: shouldCarryForward && !hasEntry,
        hasEntry,
        entryCount,
      };
    });

    const windowDays = timeline.slice(-rangeDays).reverse(); // Today first

    // Hide days before the first-ever weigh-in day (module start day).
    // Example: if firstEntryDate is Dec 29, do not show Dec 28/27 “No data yet” rows.
    if (firstEntryDate) {
      return windowDays.filter((d) => d.date >= firstEntryDate);
    }

    return windowDays;
  }, [rangeQuery.data, earliestQuery.data, fetchWindowDays, rangeDays, startDate]);

  return {
    days,
    isLoading: rangeQuery.isLoading || earliestQuery.isLoading,
    isFetching: rangeQuery.isFetching || earliestQuery.isFetching,
    error: rangeQuery.error || earliestQuery.error,
    refetch: () => Promise.all([rangeQuery.refetch(), earliestQuery.refetch()]),
  };
}

export function useSaveWeightEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWeightInput) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const isUpdate = Boolean(input.entryId);

      const saved = isUpdate
        ? await updateWeightLogRow({
            id: input.entryId!,
            weighedAt: input.weighedAt,
            weightLb: input.weightLb,
            bodyFatPercent: input.bodyFatPercent ?? undefined,
            note: input.note ?? null,
          })
        : await insertWeightLogRow({
            userId: user.id,
            weighedAt: input.weighedAt,
            weightLb: input.weightLb,
            bodyFatPercent: input.bodyFatPercent ?? undefined,
            note: input.note ?? null,
          });

      const savedMs = new Date(saved.weighed_at).getTime();

      const [latestWeightAt, latestBodyFatAt] = await Promise.all([
        fetchLatestWeighInTimestamp(user.id),
        input.bodyFatPercent !== null && input.bodyFatPercent !== undefined
          ? fetchLatestBodyFatTimestamp(user.id)
          : Promise.resolve(null),
      ]);

      if (latestWeightAt && savedMs >= new Date(latestWeightAt).getTime()) {
        await updateProfileWeightLb(user.id, input.weightLb);
      }

      if (
        input.bodyFatPercent !== null &&
        input.bodyFatPercent !== undefined &&
        latestBodyFatAt &&
        savedMs >= new Date(latestBodyFatAt).getTime()
      ) {
        await updateProfileBodyFat(user.id, input.bodyFatPercent);
      }

      return saved;
    },
    onSuccess: async (saved, variables) => {
      // Refresh burned cache based on weight history changes (best-effort; never block the save).
      try {
        if (user?.id) {
          const prevISO = variables?.previousWeighedAtISO ?? null;
          const nextISO = saved?.weighed_at ?? null;

          if (prevISO && nextISO && prevISO !== nextISO) {
            // If an edit moved the weigh-in timestamp, refresh from both the old and new anchors.
            await refreshBurnedFromWeightChange({ userId: user.id, changedAtISO: prevISO });
            await refreshBurnedFromWeightChange({ userId: user.id, changedAtISO: nextISO });
          } else if (nextISO) {
            await refreshBurnedFromWeightChange({ userId: user.id, changedAtISO: nextISO });
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error refreshing daily_sum_burned after weight save', e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
      queryClient.invalidateQueries({ queryKey: ['weightLogs366d', user.id] });
      queryClient.invalidateQueries({ queryKey: ['userConfig'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] }); // Backward compatibility

      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['dailySumBurned', user.id] });
        queryClient.invalidateQueries({ queryKey: ['dailySumBurnedRange', user.id] });
      }
    },
  });
}

function startOfDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function toDateKeyLocal(date: Date): string {
  // Use local date components to avoid UTC day shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weightLogsRangeCacheKey(userId: string | undefined, startISO: string, endISO: string) {
  if (!userId) return null;
  return `weightLogs:${userId}:${startISO}:${endISO}`;
}


