import { useEffect, useMemo, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { showAppToast } from '@/components/ui/app-toast';
import i18n from '@/i18n';
import { clampDateKey, dateKeyToLocalStartOfDay, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { getTodayKey, toDateKey } from '@/utils/dateKey';

type Options = {
  /** Route param key to read (e.g. "date" or "entryDate"). */
  paramKey: string;
  /** Whether to show a one-time toast when a user lands on a date < minDate. */
  toastOnPreMin?: boolean;
};

/**
 * Clamp a date-like route param to the allowed range [signupDay, today].
 *
 * - If the param is missing, we do NOT write it back; we just default the returned key.
 * - If the param is present but invalid/out-of-range/non-canonical, we `router.replace` it.
 */
export function useClampedDateParam({ paramKey, toastOnPreMin = true }: Options) {
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

  const raw = (params as any)?.[paramKey] as unknown;
  const paramValue = Array.isArray(raw) ? raw[0] : (raw as string | undefined);

  const requestedDateKey = useMemo(() => {
    if (paramValue && typeof paramValue === 'string') return toDateKey(paramValue);
    return todayKey;
  }, [paramValue, todayKey]);

  const clampedDateKey = useMemo(() => {
    return clampDateKey(requestedDateKey, minDateKey, todayKey);
  }, [minDateKey, requestedDateKey, todayKey]);

  const wasBeforeMin = requestedDateKey < minDateKey;
  const wasAfterMax = requestedDateKey > todayKey;
  const wasClamped = clampedDateKey !== requestedDateKey;

  const didToastRef = useRef(false);
  useEffect(() => {
    if (!paramValue) return;
    if (clampedDateKey !== paramValue) {
      router.replace({ params: { ...params, [paramKey]: clampedDateKey } } as any);

      if (toastOnPreMin && wasBeforeMin && !didToastRef.current) {
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
  }, [clampedDateKey, minDate, paramKey, paramValue, params, router, toastOnPreMin, wasBeforeMin]);

  return {
    dateKey: clampedDateKey,
    minDateKey,
    todayKey,
    minDate,
    today,
    wasClamped,
    wasBeforeMin,
    wasAfterMax,
  };
}


