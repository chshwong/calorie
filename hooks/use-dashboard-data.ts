/**
 * Aggregated hooks for Dashboard screen
 * 
 * These hooks provide summarized data for dashboard visualization
 * without fetching full detail lists.
 * 
 * Query keys:
 * - ['dailyFoodSummary', userId, date]
 * - ['weeklyFoodCalories', userId, endDate, days]
 * - ['dailyExerciseSummary', userId, date]
 * - ['weeklyExerciseMinutes', userId, endDate, days]
 * - ['dailyMedSummary', userId, date]
 * - ['weeklyMedPresence', userId, endDate, days]
 * - ['streakSummary', userId]
 * - ['streakHeatmap', userId, endDate, weeks]
 * 
 * staleTime: 60s, gcTime: 5min
 */

import { useAuth } from '@/contexts/AuthContext';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { useDailySumBurnedRange } from '@/hooks/use-daily-sum-burned-range';
import { useExerciseLogsForDate, useExerciseSummaryForRecentDays } from '@/hooks/use-exercise-logs';
import { useMedLogsForDate, useMedSummaryForRecentDays } from '@/hooks/use-med-logs';
import { useUserConfig } from '@/hooks/use-user-config';
import { compareDateKeys, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { getEntriesForDateRange } from '@/lib/services/calorieEntries';
import { getCalorieZone, type GoalType } from '@/lib/utils/calorie-zone';
import { calculateDailyTotals } from '@/utils/dailyTotals';
import { addDays } from '@/utils/dateKey';
import { useQuery } from '@tanstack/react-query';

function buildDateKeysInclusive(startKey: string, endKey: string, maxDays: number): string[] {
  const keys: string[] = [];
  if (compareDateKeys(startKey, endKey) > 0) return keys;
  let cur = startKey;
  for (let i = 0; i < maxDays; i++) {
    if (compareDateKeys(cur, endKey) > 0) break;
    keys.push(cur);
    cur = addDays(cur, 1);
  }
  return keys;
}

/**
 * Daily food summary with macros and goals
 */
export function useDailyFoodSummary(dateString: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: entriesPayload, isLoading, isFetching } = useDailyEntries(dateString);
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility

  const entries = entriesPayload?.entries ?? [];
  const totals = calculateDailyTotals(entries);
  
  // Get goals from profile (matching index.tsx - using onboarding target columns)
  const caloriesGoal = Number(profile?.daily_calorie_target ?? 0);
  const proteinGoal = Number(profile?.protein_g_min ?? 0);
  const carbsGoal = Number(profile?.carbs_g_max ?? 0);
  const fatGoal = Number(profile?.max_fats_goal_g ?? 0);
  const fiberGoal = Number(profile?.fiber_g_min ?? 0);

  return {
    caloriesTotal: totals.calories,
    caloriesGoal,
    proteinG: totals.protein,
    proteinGoalG: proteinGoal,
    carbsG: totals.carbs,
    carbsGoalG: carbsGoal,
    fatG: totals.fat,
    fatGoalG: fatGoal,
    fiberG: totals.fiber,
    fiberGoalG: fiberGoal,
    sugarG: totals.sugar,
    entries,
    logStatus: entriesPayload?.log_status ?? null,
    isLoading,
    isFetching,
  };
}

/**
 * Weekly calories in vs out for chart
 * Combines calories consumed and calories burned with zone determination
 */
export function useWeeklyCalInVsOut(
  endDateString: string,
  days: number = 7,
  goalType: GoalType
) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: userConfig } = useUserConfig();
  const profile = userConfig;

  // Calculate date range
  const endDate = new Date(endDateString + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const startDateString = (() => {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : startDateString;
  const clampedStartDateString =
    compareDateKeys(startDateString, minDateKey) < 0 ? minDateKey : startDateString;

  // Fetch calories in (consumed)
  const { data: entries = [], isLoading: isLoadingIn } = useQuery({
    queryKey: ['entriesRange', userId, clampedStartDateString, endDateString],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getEntriesForDateRange(userId, clampedStartDateString, endDateString);
    },
    enabled: !!userId && !!clampedStartDateString && !!endDateString,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch calories out (burned)
  const { data: burnedData = [], isLoading: isLoadingOut } = useDailySumBurnedRange({
    startDate: clampedStartDateString,
    endDate: endDateString,
  });

  const caloriesGoal = Number(profile?.daily_calorie_target ?? 0);

  // Group entries by date and calculate totals
  const entriesByDate = new Map<string, typeof entries>();
  entries.forEach(entry => {
    const date = entry.entry_date;
    if (!entriesByDate.has(date)) {
      entriesByDate.set(date, []);
    }
    entriesByDate.get(date)!.push(entry);
  });

  // Create map of burned calories by date
  // Use tdee_cal (Total Daily Energy Expenditure) as the calories out value
  const burnedByDate = new Map<string, number>();
  burnedData.forEach(burned => {
    const date = burned.entry_date;
    burnedByDate.set(date, Number(burned.tdee_cal ?? 0));
  });

  // Generate all dates in range
  const dates = buildDateKeysInclusive(clampedStartDateString, endDateString, days);

  const weeklyData = dates.map(date => {
    const dateEntries = entriesByDate.get(date) || [];
    const totals = calculateDailyTotals(dateEntries);
    const caloriesIn = totals.calories;
    const caloriesOut = burnedByDate.get(date) ?? 0;
    const zone = getCalorieZone(caloriesIn, caloriesGoal, goalType);

    return {
      date,
      caloriesIn,
      caloriesOut,
      zone,
      caloriesGoal,
    };
  });

  return {
    data: weeklyData,
    isLoading: isLoadingIn || isLoadingOut,
  };
}

/**
 * Weekly food calories for chart
 */
export function useWeeklyFoodCalories(endDateString: string, days: number = 7) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility

  // Calculate date range
  const endDate = new Date(endDateString + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  
  const startDateString = (() => {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : startDateString;
  const clampedStartDateString =
    compareDateKeys(startDateString, minDateKey) < 0 ? minDateKey : startDateString;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entriesRange', userId, clampedStartDateString, endDateString],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getEntriesForDateRange(userId, clampedStartDateString, endDateString);
    },
    enabled: !!userId && !!clampedStartDateString && !!endDateString,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const caloriesGoal = Number(profile?.daily_calorie_target ?? 0);

  // Group entries by date and calculate totals
  const entriesByDate = new Map<string, typeof entries>();
  entries.forEach(entry => {
    const date = entry.entry_date;
    if (!entriesByDate.has(date)) {
      entriesByDate.set(date, []);
    }
    entriesByDate.get(date)!.push(entry);
  });

  // Generate all dates in range (never synthesize pre-signup days)
  const dates = buildDateKeysInclusive(clampedStartDateString, endDateString, days);

  const weeklyData = dates.map(date => {
    const dateEntries = entriesByDate.get(date) || [];
    const totals = calculateDailyTotals(dateEntries);
    return {
      date,
      caloriesTotal: totals.calories,
      caloriesGoal,
    };
  });

  return {
    data: weeklyData,
    isLoading,
  };
}

/**
 * Daily exercise summary
 */
export function useDailyExerciseSummary(dateString: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: logs = [] } = useExerciseLogsForDate(dateString);

  const totalMinutes = logs.reduce((sum, log) => sum + (log.minutes || 0), 0);
  const activityCount = logs.length;

  // Get main activity labels (top 2 by minutes or by count)
  const activityMap = new Map<string, number>();
  logs.forEach(log => {
    const count = activityMap.get(log.name) || 0;
    activityMap.set(log.name, count + 1);
  });

  const mainLabels = Array.from(activityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  return {
    totalMinutes,
    activityCount,
    mainLabels,
  };
}

/**
 * Weekly exercise minutes for chart
 */
export function useWeeklyExerciseMinutes(endDateString: string, days: number = 7) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: summary = [] } = useExerciseSummaryForRecentDays(days);

  // Filter to last 7 days ending at endDate
  const endDate = new Date(endDateString + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = (() => {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : startKey;
  const clampedStartKey = compareDateKeys(startKey, minDateKey) < 0 ? minDateKey : startKey;
  const startDateClamped = new Date(clampedStartKey + 'T00:00:00');

  const weeklyData = summary
    .filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= startDateClamped && itemDate <= endDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      date: item.date,
      totalMinutes: item.total_minutes,
    }));

  // Fill in missing dates with 0
  const allDates = buildDateKeysInclusive(clampedStartKey, endDateString, days);

  const filledData = allDates.map(date => {
    const existing = weeklyData.find(d => d.date === date);
    return existing || { date, totalMinutes: 0 };
  });

  return {
    data: filledData,
    isLoading: false,
  };
}

/**
 * Daily med summary
 */
export function useDailyMedSummary(dateString: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: logs = [] } = useMedLogsForDate(dateString);

  const totalItems = logs.length;
  const medCount = logs.filter(log => log.type === 'med').length;
  const suppCount = logs.filter(log => log.type === 'supp').length;
  const lastItem = logs.length > 0 ? logs[logs.length - 1] : null;
  const lastItemName = lastItem?.name || null;
  const lastItemDose = lastItem && lastItem.dose_amount !== null && lastItem.dose_unit
    ? `${lastItem.dose_amount} ${lastItem.dose_unit}`
    : null;

  return {
    totalItems,
    medCount,
    suppCount,
    lastItemName,
    lastItemDose,
  };
}

/**
 * Weekly med presence for adherence chart
 */
export function useWeeklyMedPresence(endDateString: string, days: number = 7) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: summary = [] } = useMedSummaryForRecentDays(days);

  // Filter to last 7 days ending at endDate
  const endDate = new Date(endDateString + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = (() => {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : startKey;
  const clampedStartKey = compareDateKeys(startKey, minDateKey) < 0 ? minDateKey : startKey;
  const startDateClamped = new Date(clampedStartKey + 'T00:00:00');

  const weeklyData = summary
    .filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= startDateClamped && itemDate <= endDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      date: item.date,
      hasAnyBoolean: item.item_count > 0,
    }));

  // Fill in missing dates with false
  const allDates = buildDateKeysInclusive(clampedStartKey, endDateString, days);

  const filledData = allDates.map(date => {
    const existing = weeklyData.find(d => d.date === date);
    return existing || { date, hasAnyBoolean: false };
  });

  return {
    data: filledData,
    isLoading: false,
  };
}

/**
 * Streak summary (simplified - can be enhanced later)
 */
export function useStreakSummary() {
  const { user } = useAuth();
  const userId = user?.id;

  // For now, return placeholder data
  // TODO: Implement actual streak calculation from food/exercise/med logs
  return {
    logStreakDays: 0,
    bestStreakDays: 0,
    nextTargetDays: 0,
  };
}

/**
 * Streak heatmap (simplified - can be enhanced later)
 */
export function useStreakHeatmap(endDateString: string, weeks: number = 5) {
  const { user } = useAuth();
  const userId = user?.id;

  // For now, return placeholder data
  // TODO: Implement actual heatmap calculation
  const data: Array<{ date: string; score: number }> = [];
  const endDate = new Date(endDateString + 'T00:00:00');
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : endDateString;
  
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (weeks - 1 - w) * 7 - (6 - d));
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      data.push({
        // Do not show/navigate pre-signup days
        date: compareDateKeys(dateKey, minDateKey) < 0 ? '' : dateKey,
        score: 0,
      });
    }
  }

  return {
    data,
    isLoading: false,
  };
}

