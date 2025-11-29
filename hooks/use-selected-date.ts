import { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';

/**
 * Hook for managing selected date state and formatting
 * Reusable across Food Log and Exercise screens
 */
export function useSelectedDate() {
  const params = useLocalSearchParams();
  
  // Get today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get date from params if available (when navigating from other screens)
  const dateParam = params.date;
  const initialDate = dateParam && typeof dateParam === 'string' 
    ? new Date(dateParam + 'T00:00:00') 
    : new Date(today);
  
  // State for selected date (defaults to today or date from params)
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  
  // Update selected date when params change (e.g., navigation from another screen)
  useEffect(() => {
    if (dateParam && typeof dateParam === 'string') {
      const newDate = new Date(dateParam + 'T00:00:00');
      setSelectedDate(newDate);
    }
  }, [dateParam]);
  
  // Calendar view month (for date picker navigation)
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    return new Date(selectedDate);
  });
  
  // Check if selected date is from current year
  const currentYear = today.getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  
  // Calculate if it's today or yesterday
  const isToday = selectedDate.getTime() === today.getTime();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = selectedDate.getTime() === yesterday.getTime();
  
  // Format selected date for display (short form)
  // Exclude weekday for today/yesterday to save space
  // Include year only if date is from previous year
  const dateOptions: Intl.DateTimeFormatOptions = { 
    ...(isToday || isYesterday ? {} : { weekday: 'short' }),
    month: 'short', 
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' })
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  
  // Format display date with appropriate prefix (short form)
  const getDisplayDate = (t: (key: string) => string) => {
    if (isToday) {
      return `${t('common.today')}, ${formattedDate}`;
    } else if (isYesterday) {
      return `${t('common.yesterday')}, ${formattedDate}`;
    }
    return formattedDate;
  };
  
  // Format selected date as YYYY-MM-DD for SQL query (in user's local timezone)
  // Use useMemo to ensure it updates when selectedDate changes
  const selectedDateString = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);
  
  // Navigation functions
  const goBackOneDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };
  
  const goForwardOneDay = () => {
    if (!isToday) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      setSelectedDate(newDate);
    }
  };
  
  const goToToday = () => {
    setSelectedDate(new Date(today));
  };
  
  return {
    selectedDate,
    setSelectedDate,
    selectedDateString,
    isToday,
    isYesterday,
    today,
    getDisplayDate,
    goBackOneDay,
    goForwardOneDay,
    goToToday,
    calendarViewMonth,
    setCalendarViewMonth,
  };
}

