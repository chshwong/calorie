import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getUserConfig, type UserConfig } from "@/services/userConfig";
import {
  DEFAULT_CACHE_MAX_AGE_MS,
  getPersistentCache,
  hydratePersistentCache,
  setPersistentCache,
} from "@/lib/persistentCache";
import { useEffect } from "react";

export function userConfigQueryKey(userId: string | null) {
  return ["userConfig", userId] as const;
}

export function useUserConfig() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const cacheKey = userConfigCacheKey(userId);
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<UserConfig | null>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  useEffect(() => {
    if (!cacheKey || snapshot) return;
    void (async () => {
      const hydrated = await hydratePersistentCache<UserConfig | null>(
        cacheKey,
        DEFAULT_CACHE_MAX_AGE_MS
      );
      if (hydrated !== null) {
        queryClient.setQueryData(userConfigQueryKey(userId), hydrated);
      }
    })();
  }, [cacheKey, queryClient, snapshot, userId]);

  return useQuery({
    queryKey: userConfigQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("User not authenticated");
      const data = await getUserConfig(userId);
      if (cacheKey !== null) {
        await setPersistentCache(cacheKey, data);
      }
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 180 * 24 * 60 * 60 * 1000,
    retry: 2,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => {
      if (previousData !== undefined) return previousData;
      const cached = queryClient.getQueryData<UserConfig | null>(userConfigQueryKey(userId));
      if (cached !== undefined) return cached;
      return snapshot ?? undefined;
    },
  });
}

function userConfigCacheKey(userId: string | null): string | null {
  if (!userId) return null;
  return `userConfig:${userId}`;
}
