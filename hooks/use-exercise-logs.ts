/**
 * React Query hooks for fetching exercise logs
 * 
 * Query keys:
 * - ['exerciseLogs', userId, date]
 * - ['exerciseSummary', userId, days]
 * - ['recentFrequentExercises', userId, days]
 * 
 * staleTime: 60s, gcTime: 5min
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getExerciseLogsForDate,
  getExerciseSummaryForRecentDays,
  getRecentFrequentExercises,
  getRecentAndFrequentExercises,
  createExerciseLog,
  updateExerciseLog,
  deleteExerciseLog,
  type ExerciseLog,
} from '@/lib/services/exerciseLogs';

/**
 * Hook to fetch exercise logs for a specific date
 */
export function useExerciseLogsForDate(dateString: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<ExerciseLog[]>({
    queryKey: ['exerciseLogs', userId, dateString],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getExerciseLogsForDate(userId, dateString);
    },
    enabled: !!userId && !!dateString,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch exercise summary for recent days
 */
export function useExerciseSummaryForRecentDays(days: number = 7) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['exerciseSummary', userId, days],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getExerciseSummaryForRecentDays(userId, days);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch recent and frequent exercises for Quick Add
 * Returns combined list: frequent (top 8) + recent (top 8, excluding frequent), max 10 total
 */
export function useRecentAndFrequentExercises(days: number = 60) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['recentAndFrequentExercises', userId, days],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getRecentAndFrequentExercises(userId, days);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * @deprecated Use useRecentAndFrequentExercises instead
 * Kept for backwards compatibility
 */
export function useRecentFrequentExercises(days: number = 60) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['recentFrequentExercises', userId, days],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getRecentFrequentExercises(userId, days);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create an exercise log entry
 */
export function useCreateExerciseLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (entry: Omit<ExerciseLog, 'id' | 'created_at'>) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return createExerciseLog({ ...entry, user_id: userId });
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate and refetch relevant queries
        queryClient.invalidateQueries({ queryKey: ['exerciseLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['exerciseSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentFrequentExercises', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentExercises', userId] });
      }
    },
  });
}

/**
 * Hook to update an exercise log entry
 */
export function useUpdateExerciseLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: ({ logId, updates }: { logId: string; updates: Partial<Pick<ExerciseLog, 'name' | 'minutes' | 'date' | 'notes'>> }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return updateExerciseLog(logId, updates);
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate and refetch relevant queries
        queryClient.invalidateQueries({ queryKey: ['exerciseLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['exerciseSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentFrequentExercises', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentExercises', userId] });
      }
    },
  });
}

/**
 * Hook to delete an exercise log entry
 */
export function useDeleteExerciseLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (logId: string) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return deleteExerciseLog(logId);
    },
    onSuccess: () => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['exerciseLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['exerciseSummary', userId] });
      queryClient.invalidateQueries({ queryKey: ['recentFrequentExercises', userId] });
    },
  });
}

