import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { toDateKey, getTodayKey } from '@/utils/dateKey';

/**
 * Hook for managing selected date - always derived from URL params
 * Single source of truth: route param ?date=YYYY-MM-DD
 */
export function useSelectedDate() {
  const params = useLocalSearchParams();
  
  // Get today's date for comparison
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  
  // Get date from params if available
  const raw = params.date;
  const dateParam = Array.isArray(raw) ? raw[0] : (raw as string | undefined);
  
  // Parse date from params or default to today
  const selectedDate = useMemo(() => {
    if (dateParam && typeof dateParam === 'string') {
      const parsed = new Date(dateParam + 'T00:00:00');
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    // Default to today if param is missing or invalid
    return new Date(today);
  }, [dateParam, today]);
  
  // Format selected date as YYYY-MM-DD using canonical dateKey utility
  const selectedDateString = useMemo(() => {
    return toDateKey(selectedDate);
  }, [selectedDate]);
  
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
  
  return {
    selectedDate,
    selectedDateString,
    isToday,
    isYesterday,
    today,
    isCurrentYear,
  };
}
