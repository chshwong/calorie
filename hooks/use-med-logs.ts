/**
 * React Query hooks for fetching med logs
 * 
 * Query keys:
 * - ['medLogs', userId, date]
 * - ['medSummary', userId, days]
 * - ['recentAndFrequentMeds', userId, days]
 * 
 * staleTime: 60s, gcTime: 5min
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMedLogsForDate,
  getMedSummaryForRecentDays,
  getRecentAndFrequentMeds,
  createMedLog,
  updateMedLog,
  deleteMedLog,
  type MedLog,
} from '@/lib/services/medLogs';
import { getPersistentCache, setPersistentCache, DEFAULT_CACHE_MAX_AGE_MS } from '@/lib/persistentCache';
import { toDateKey } from '@/utils/dateKey';


/**
 * Hook to fetch med logs for a specific date
 */
export function useMedLogsForDate(dateString: string | Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Normalize to canonical date key
  const dateKey = toDateKey(dateString);

  const cacheKey = medLogsCacheKey(userId, dateKey);

  // Persistent snapshot (survives full reloads)
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<MedLog[]>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery<MedLog[]>({
    queryKey: ['medLogs', userId, dateKey],
    // DB call + write-through to persistent cache
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await getMedLogsForDate(userId, dateKey);

      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      return data;
    },
    enabled: !!userId && !!dateKey,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes

    // Priority: previousData → in-memory cache → persistent snapshot
    placeholderData: (previousData) => {
      if (previousData !== undefined) {
        return previousData;
      }

      const cachedData = queryClient.getQueryData<MedLog[]>([
        'medLogs',
        userId,
        dateKey,
      ]);
      if (cachedData !== undefined) {
        return cachedData;
      }

      return snapshot ?? undefined;
    },
  });
}


/**
 * Hook to fetch med summary for recent days from daily_sum_meds table
 * Uses persistent cache with 180 days TTL
 */
export function useMedSummaryForRecentDays(days: number = 7) {
  const { user } = useAuth();
  const userId = user?.id;
  const userCreatedAt = user?.created_at;
  const queryClient = useQueryClient();

  const cacheKey = medSummaryCacheKey(userId, days);

  // 180 days persistent cache
  const CACHE_TTL_180_DAYS_MS = 180 * 24 * 60 * 60 * 1000;
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<any>(cacheKey, CACHE_TTL_180_DAYS_MS)
      : null;

  return useQuery({
    queryKey: ['medSummary', userId, days],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await getMedSummaryForRecentDays(userId, days, userCreatedAt);

      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      return data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => {
      if (previousData !== undefined) {
        return previousData;
      }

      const cachedData = queryClient.getQueryData([
        'medSummary',
        userId,
        days,
      ]);
      if (cachedData !== undefined) {
        return cachedData;
      }

      return snapshot ?? undefined;
    },
  });
}


/**
 * Hook to fetch recent and frequent meds for Quick Add
 * Returns combined list: frequent (top 8) + recent (top 8, excluding frequent), max 10 total
 */
export function useMedRecentAndFrequent(days: number = 60) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['recentAndFrequentMeds', userId, days],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getRecentAndFrequentMeds(userId, days);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

function medLogsCacheKey(userId: string | undefined, date: string) {
  if (!userId) return null;
  return `medLogs:${userId}:${date}`;
}

function medSummaryCacheKey(userId: string | undefined, days: number) {
  if (!userId) return null;
  return `medSummary:${userId}:${days}`;
}

function recentAndFrequentMedsCacheKey(userId: string | undefined, days: number) {
  if (!userId) return null;
  return `recentAndFrequentMeds:${userId}:${days}`;
}


/**
 * Hook to create a med log entry
 */
export function useCreateMedLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (entry: Omit<MedLog, 'id' | 'created_at'>) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return createMedLog({ ...entry, user_id: userId });
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate and refetch relevant queries
        queryClient.invalidateQueries({ queryKey: ['medLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['medSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentMeds', userId] });
      }
    },
  });
}

/**
 * Hook to update a med log entry
 */
export function useUpdateMedLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: ({ logId, updates }: { logId: string; updates: Partial<Pick<MedLog, 'name' | 'type' | 'dose_amount' | 'dose_unit' | 'date' | 'notes'>> }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return updateMedLog(logId, updates);
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate and refetch relevant queries
        queryClient.invalidateQueries({ queryKey: ['medLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['medSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentMeds', userId] });
      }
    },
  });
}

/**
 * Hook to delete a med log entry
 */
export function useDeleteMedLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (logId: string) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return deleteMedLog(logId);
    },
    onSuccess: () => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['medLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['medSummary', userId] });
      queryClient.invalidateQueries({ queryKey: ['recentAndFrequentMeds', userId] });
    },
  });
}

