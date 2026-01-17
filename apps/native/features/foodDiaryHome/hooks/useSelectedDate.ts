import { useEffect, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { clampDateKey, dateKeyToLocalStartOfDay, getMinAllowedDateKeyFromSignupAt } from "@/lib/foodDiary/date-guard";
import { getTodayKey, toDateKey } from "@/lib/foodDiary/dateKey";

export function useSelectedDate() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const todayKey = useMemo(() => getTodayKey(), []);
  const today = useMemo(() => dateKeyToLocalStartOfDay(todayKey), [todayKey]);

  const minDateKey = useMemo(() => {
    const signupAt = user?.created_at;
    if (!signupAt) return todayKey;
    return getMinAllowedDateKeyFromSignupAt(signupAt);
  }, [todayKey, user?.created_at]);

  const minDate = useMemo(() => dateKeyToLocalStartOfDay(minDateKey), [minDateKey]);

  const raw = params.date;
  const dateParam = Array.isArray(raw) ? raw[0] : (raw as string | undefined);

  const requestedDateKey = useMemo(() => {
    if (dateParam && typeof dateParam === "string") {
      return toDateKey(dateParam);
    }
    return todayKey;
  }, [dateParam, todayKey]);

  const selectedDateKey = useMemo(() => {
    return clampDateKey(requestedDateKey, minDateKey, todayKey);
  }, [minDateKey, requestedDateKey, todayKey]);

  useEffect(() => {
    if (!dateParam) return;
    if (selectedDateKey !== dateParam) {
      router.replace({ params: { ...params, date: selectedDateKey } } as any);
    }
  }, [dateParam, params, router, selectedDateKey]);

  const selectedDate = useMemo(
    () => dateKeyToLocalStartOfDay(selectedDateKey),
    [selectedDateKey]
  );

  const isToday = selectedDateKey === todayKey;
  const canGoBack = selectedDateKey > minDateKey;
  const canGoForward = selectedDateKey < todayKey;

  return {
    selectedDate,
    selectedDateKey,
    today,
    minDate,
    isToday,
    canGoBack,
    canGoForward,
  };
}
