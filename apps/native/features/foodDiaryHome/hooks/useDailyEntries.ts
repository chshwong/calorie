import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { toDateKey } from "@/lib/foodDiary/dateKey";
import type { CalorieEntry, DailyEntriesWithStatus } from "@/lib/foodDiary/types";
import {
    getPersistentCache,
    hydratePersistentCache,
    setPersistentCache,
} from "@/lib/persistentCache";
import { getEntriesForDate } from "@/services/calorieEntries";

const DAILY_ENTRIES_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000;

export function useDailyEntries(entryDate: string | Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const dateKey = toDateKey(entryDate);
  const cacheKey = entriesCacheKey(userId, dateKey);

  const snapshot =
    cacheKey !== null
      ? getPersistentCache<DailyEntriesWithStatus | CalorieEntry[]>(cacheKey, DAILY_ENTRIES_MAX_AGE_MS)
      : null;

  const normalizeEntriesPayload = (
    value: DailyEntriesWithStatus | CalorieEntry[] | null | undefined
  ): DailyEntriesWithStatus | undefined => {
    if (!value) return value ?? undefined;
    if (Array.isArray(value)) return { entries: value, log_status: null };
    return value;
  };

  useEffect(() => {
    if (!cacheKey || snapshot) return;
    void (async () => {
      const hydrated = await hydratePersistentCache<DailyEntriesWithStatus>(
        cacheKey,
        DAILY_ENTRIES_MAX_AGE_MS
      );
      if (hydrated) {
        queryClient.setQueryData(["entries", userId, dateKey], normalizeEntriesPayload(hydrated));
      }
    })();
  }, [cacheKey, dateKey, queryClient, snapshot, userId]);

  return useQuery<DailyEntriesWithStatus>({
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
      const cached = queryClient.getQueryData<DailyEntriesWithStatus | CalorieEntry[]>(["entries", userId, dateKey]);
      const normalizedCached = normalizeEntriesPayload(cached);
      if (normalizedCached !== undefined) return normalizedCached;
      return normalizeEntriesPayload(snapshot) ?? undefined;
    },
  });
}

function entriesCacheKey(userId: string | undefined, date: string) {
  if (!userId) return null;
  return `dailyEntries:${userId}:${date}`;
}
