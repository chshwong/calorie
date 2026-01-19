import { useMemo } from "react";

import { useDailyEntries } from "@/features/foodDiaryHome/hooks/useDailyEntries";
import { toDateKey } from "@/lib/foodDiary/dateKey";
import type { MealType } from "@/lib/foodDiary/types";

export function useMealEntries(entryDate: string | Date, mealType: MealType) {
  const dateKey = toDateKey(entryDate);
  const query = useDailyEntries(dateKey);

  const entries = useMemo(
    () => (query.data ?? []).filter((entry) => entry.meal_type === mealType),
    [mealType, query.data]
  );

  return {
    entries,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
