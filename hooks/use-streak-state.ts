/**
 * React Query hook for streak state (Login + Food streaks)
 * 
 * Reads from existing streak_state table.
 * 
 * Query key: ['streakState', userId]
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getStreakState, type StreakState } from '@/lib/services/streakStateService';
import { getTodayKey, getYesterdayKey } from '@/utils/dateKey';

export type StreakInfo = {
  currentDays: number;
  bestDays: number;
  status: 'active' | 'broken';
  lastDayKey: string | null;
};

export function useStreakState() {
  const { user } = useAuth();

  const { data: streakState, isLoading, error } = useQuery({
    queryKey: ['streakState', user?.id],
    queryFn: async (): Promise<StreakState | null> => {
      if (!user?.id) {
        return null;
      }
      return getStreakState();
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  // Helper to determine streak status
  const getStreakStatus = (lastDayKey: string | null, currentDays: number): 'active' | 'broken' => {
    if (currentDays === 0) return 'broken';
    // Active if last_day_key is today or yesterday (not broken yet)
    if (lastDayKey === todayKey || lastDayKey === yesterdayKey) {
      return 'active';
    }
    return 'broken';
  };

  // Login streak info
  const loginStreak: StreakInfo | null = streakState
    ? {
        currentDays: streakState.login_current_days,
        bestDays: streakState.login_pr_days,
        status: getStreakStatus(streakState.login_current_end_date, streakState.login_current_days),
        lastDayKey: streakState.login_current_end_date,
      }
    : null;

  // Food streak info
  const foodStreak: StreakInfo | null = streakState
    ? {
        currentDays: streakState.food_current_days,
        bestDays: streakState.food_pr_days,
        status: getStreakStatus(streakState.food_current_end_date, streakState.food_current_days),
        lastDayKey: streakState.food_current_end_date,
      }
    : null;

  return {
    loginStreak,
    foodStreak,
    isLoading,
    error: error as Error | null,
  };
}

