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

/**
 * Hook to fetch med logs for a specific date
 */
export function useMedLogsForDate(dateString: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<MedLog[]>({
    queryKey: ['medLogs', userId, dateString],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getMedLogsForDate(userId, dateString);
    },
    enabled: !!userId && !!dateString,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch med summary for recent days
 */
export function useMedSummaryForRecentDays(days: number = 7) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['medSummary', userId, days],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getMedSummaryForRecentDays(userId, days);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
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

