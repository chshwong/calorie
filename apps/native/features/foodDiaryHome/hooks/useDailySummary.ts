import { useMemo } from "react";

import { useDailyEntries } from "@/features/foodDiaryHome/hooks/useDailyEntries";
import { calculateDailyTotals, groupEntriesByMealType } from "@/lib/foodDiary/dailyTotals";
import type { DailyTotals, GroupedEntries } from "@/lib/foodDiary/types";

export function useDailySummary(dateKey: string) {
  const { data: entriesPayload, isLoading, isFetching, refetch } = useDailyEntries(dateKey);

  const { dailyTotals, groupedEntries } = useMemo(() => {
    const entries = entriesPayload?.entries ?? [];
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
