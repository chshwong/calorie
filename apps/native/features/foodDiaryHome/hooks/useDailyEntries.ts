import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { getEntriesForDate } from "@/services/calorieEntries";
import type { CalorieEntry } from "@/lib/foodDiary/types";
import { toDateKey } from "@/lib/foodDiary/dateKey";
import {
  getPersistentCache,
  hydratePersistentCache,
  setPersistentCache,
} from "@/lib/persistentCache";

const DAILY_ENTRIES_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000;

export function useDailyEntries(entryDate: string | Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const dateKey = toDateKey(entryDate);
  const cacheKey = entriesCacheKey(userId, dateKey);

  const snapshot =
    cacheKey !== null
      ? getPersistentCache<CalorieEntry[]>(cacheKey, DAILY_ENTRIES_MAX_AGE_MS)
      : null;

  useEffect(() => {
    if (!cacheKey || snapshot) return;
    void (async () => {
      const hydrated = await hydratePersistentCache<CalorieEntry[]>(
        cacheKey,
        DAILY_ENTRIES_MAX_AGE_MS
      );
      if (hydrated) {
        queryClient.setQueryData(["entries", userId, dateKey], hydrated);
      }
    })();
  }, [cacheKey, dateKey, queryClient, snapshot, userId]);

  return useQuery<CalorieEntry[]>({
    queryKey: ["entries", userId, dateKey],
    enabled: !!userId && !!dateKey,
    queryFn: async () => {
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const data = await getEntriesForDate(userId, dateKey);
      if (cacheKey !== null) {
        await setPersistentCache(cacheKey, data);
      }
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => {
      if (previousData !== undefined) return previousData;
      const cached = queryClient.getQueryData<CalorieEntry[]>(["entries", userId, dateKey]);
      if (cached !== undefined) return cached;
      return snapshot ?? undefined;
    },
  });
}

function entriesCacheKey(userId: string | undefined, date: string) {
  if (!userId) return null;
  return `dailyEntries:${userId}:${date}`;
}
