import type { CalorieEntry, DailySumBurned } from '@/utils/types';
import { calculateDailyTotals } from '@/utils/dailyTotals';
import { canComputeNetCalories, calculateNetCalories } from '@/lib/domain/burned/netCalories';

export type WeekDayOverview = {
  date: string; // YYYY-MM-DD
  hasFoodEntries: boolean;
  eatenCalories: number | null;
  burnedTdeeCal: number | null;
  burnedEstimated: boolean;
  netCalories: number | null;
};

export function buildWeekOverview(params: {
  dateKeys: string[];
  entriesByDate: Map<string, CalorieEntry[]>;
  burnedByDate: Map<string, DailySumBurned>;
  systemTdeeCal: number | null;
}): WeekDayOverview[] {
  return params.dateKeys.map((dateKey) => {
    const entries = params.entriesByDate.get(dateKey) ?? [];
    const hasFoodEntries = entries.length > 0;

    const eatenCalories = hasFoodEntries ? calculateDailyTotals(entries).calories : null;

    const burnedRow = params.burnedByDate.get(dateKey) ?? null;
    const burnedTdeeCal = burnedRow?.tdee_cal ?? params.systemTdeeCal;
    const burnedEstimated = !burnedRow;

    const netCalories =
      burnedTdeeCal !== null && eatenCalories !== null && canComputeNetCalories(hasFoodEntries)
        ? calculateNetCalories({ burnedTdeeCal, eatenCalories })
        : null;

    return {
      date: dateKey,
      hasFoodEntries,
      eatenCalories,
      burnedTdeeCal,
      burnedEstimated,
      netCalories,
    };
  });
}


