import { useEffect, useMemo, useState } from 'react';
import { getLocalDateKey } from '@/utils/dateTime';

/**
 * Returns the current local day key and updates at the next local midnight.
 * Uses a scheduled timeout (with a small buffer) to avoid freezing "Today".
 */
export function useLocalDayKey() {
  const [dayKey, setDayKey] = useState(() => getLocalDateKey(new Date()));

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const scheduleNext = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 2, 0); // 2s buffer past midnight local
      const ms = tomorrow.getTime() - now.getTime();
      timer = setTimeout(() => {
        setDayKey(getLocalDateKey(new Date()));
        scheduleNext();
      }, ms);
    };

    scheduleNext();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const todayDate = useMemo(() => new Date(), [dayKey]);

  return { dayKey, todayDate };
}

