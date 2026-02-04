import { useMemo } from "react";

import { calculateDailyTotals, groupEntriesByMealType } from "@/lib/foodDiary/dailyTotals";
import type { DailyTotals, GroupedEntries } from "@/lib/foodDiary/types";
import { useDailyEntries } from "@/features/foodDiaryHome/hooks/useDailyEntries";

export function useDailySummary(dateKey: string) {
  const { data: entries = [], isLoading, isFetching, refetch } = useDailyEntries(dateKey);

  const { dailyTotals, groupedEntries } = useMemo(() => {
    const totals: DailyTotals = calculateDailyTotals(entries);
    const grouped: GroupedEntries = groupEntriesByMealType(entries);
    return { dailyTotals: totals, groupedEntries: grouped };
  }, [entries]);

  return {
    entries,
    dailyTotals,
    groupedEntries,
    isLoading,
    isFetching,
    refetch,
  };
}
