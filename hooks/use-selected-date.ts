import { useEffect, useMemo, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { showAppToast } from '@/components/ui/app-toast';
import i18n from '@/i18n';
import { clampDateKey, dateKeyToLocalStartOfDay, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { toDateKey, getTodayKey } from '@/utils/dateKey';

/**
 * Hook for managing selected date - always derived from URL params
 * Single source of truth: route param ?date=YYYY-MM-DD
 */
export function useSelectedDate() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const todayKey = useMemo(() => getTodayKey(), []);
  const today = useMemo(() => dateKeyToLocalStartOfDay(todayKey), [todayKey]);

  const minDateKey = useMemo(() => {
    // If user isn't available yet, fall back to today (safe default).
    const signupAt = user?.created_at;
    if (!signupAt) return todayKey;
    return getMinAllowedDateKeyFromSignupAt(signupAt);
  }, [todayKey, user?.created_at]);
  const minDate = useMemo(() => dateKeyToLocalStartOfDay(minDateKey), [minDateKey]);
  
  // Get date from params if available
  const raw = params.date;
  const dateParam = Array.isArray(raw) ? raw[0] : (raw as string | undefined);

  // Normalize requested date to a canonical key, or default to todayKey.
  const requestedDateKey = useMemo(() => {
    if (dateParam && typeof dateParam === 'string') {
      return toDateKey(dateParam);
    }
    return todayKey;
  }, [dateParam, todayKey]);

  const selectedDateKey = useMemo(() => {
    return clampDateKey(requestedDateKey, minDateKey, todayKey);
  }, [minDateKey, requestedDateKey, todayKey]);
  
  // Replace invalid/out-of-range URL param so the app state is consistent with the URL.
  // Also normalize non-canonical inputs (e.g., ISO timestamps) to YYYY-MM-DD.
  const didToastRef = useRef(false);
  useEffect(() => {
    // If param is absent, do not auto-write it—existing screens explicitly set it when needed.
    if (!dateParam) return;

    if (selectedDateKey !== dateParam) {
      router.replace({ params: { ...params, date: selectedDateKey } } as any);

      // One-time toast when user tried to land before signup.
      if (!didToastRef.current && requestedDateKey < minDateKey) {
        didToastRef.current = true;
        const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
        const display = minDate.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        showAppToast(i18n.t('date_guard.tracking_starts_on', { date: display }));
      }
    }
  }, [dateParam, minDate, minDateKey, params, requestedDateKey, router, selectedDateKey]);

  const selectedDate = useMemo(() => dateKeyToLocalStartOfDay(selectedDateKey), [selectedDateKey]);
  
  // Format selected date as YYYY-MM-DD using canonical dateKey utility
  const selectedDateString = useMemo(() => {
    return selectedDateKey;
  }, [selectedDateKey]);
  
  // Check if selected date is from current year
  const currentYear = today.getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  
  // Calculate if it's today or yesterday
  const isToday = selectedDate.getTime() === today.getTime();
  const yesterday = useMemo(() => {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return y;
  }, [today]);
  const isYesterday = selectedDate.getTime() === yesterday.getTime();

  const canGoBack = selectedDateKey > minDateKey;
  const canGoForward = selectedDateKey < todayKey;
  
  return {
    selectedDate,
    selectedDateString,
    isToday,
    isYesterday,
    today,
    isCurrentYear,
    minDate,
    minDateKey,
    todayKey,
    canGoBack,
    canGoForward,
  };
}
