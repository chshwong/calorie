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

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { useExerciseLogsForDate } from '@/hooks/use-exercise-logs';
import { useMedLogsForDate } from '@/hooks/use-med-logs';
import { useExerciseSummaryForRecentDays } from '@/hooks/use-exercise-logs';
import { useMedSummaryForRecentDays } from '@/hooks/use-med-logs';
import { calculateDailyTotals } from '@/utils/dailyTotals';
import { useUserConfig } from '@/hooks/use-user-config';
import { getEntriesForDateRange } from '@/lib/services/calorieEntries';

/**
 * Daily food summary with macros and goals
 */
export function useDailyFoodSummary(dateString: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: entries = [] } = useDailyEntries(dateString);
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility

  const totals = calculateDailyTotals(entries);
  
  // Get goals from profile (use upper goal if available, otherwise single goal, otherwise defaults)
  const caloriesGoal = profile?.daily_calorie_goal_upper 
    || profile?.daily_calorie_goal 
    || 2000;
  const proteinGoal = profile?.daily_protein_goal_g || 130;
  const carbsGoal = profile?.max_carbs_goal_g || 220;
  const fatGoal = profile?.max_fats_goal_g || 65;
  const fiberGoal = profile?.fibre_target_g || 25;

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

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entriesRange', userId, startDateString, endDateString],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getEntriesForDateRange(userId, startDateString, endDateString);
    },
    enabled: !!userId && !!startDateString && !!endDateString,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const caloriesGoal = profile?.daily_calorie_goal_upper 
    || profile?.daily_calorie_goal 
    || 2000;

  // Group entries by date and calculate totals
  const entriesByDate = new Map<string, typeof entries>();
  entries.forEach(entry => {
    const date = entry.entry_date;
    if (!entriesByDate.has(date)) {
      entriesByDate.set(date, []);
    }
    entriesByDate.get(date)!.push(entry);
  });

  // Generate all dates in range
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

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

  const weeklyData = summary
    .filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= startDate && itemDate <= endDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      date: item.date,
      totalMinutes: item.total_minutes,
    }));

  // Fill in missing dates with 0
  const allDates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    allDates.push(`${year}-${month}-${day}`);
  }

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

  const weeklyData = summary
    .filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= startDate && itemDate <= endDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      date: item.date,
      hasAnyBoolean: item.item_count > 0,
    }));

  // Fill in missing dates with false
  const allDates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    allDates.push(`${year}-${month}-${day}`);
  }

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
  
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (weeks - 1 - w) * 7 - (6 - d));
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      data.push({
        date: `${year}-${month}-${day}`,
        score: 0,
      });
    }
  }

  return {
    data,
    isLoading: false,
  };
}

