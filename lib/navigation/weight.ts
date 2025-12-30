import type { Router } from 'expo-router';
import { getLocalDateString } from '@/utils/calculations';

/**
 * Open Weight Entry for today.
 * This matches the Big Circle Menu (Quick Add) -> "Enter Weight" behavior.
 */
export function openWeightEntryForToday(router: Router) {
  const todayString = getLocalDateString();
  router.replace({
    pathname: '/weight/entry',
    params: { date: todayString },
  });
}


