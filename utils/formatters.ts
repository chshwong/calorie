/**
 * Formatter utilities for dates and meal types
 * 
 * Provides formatting functions for displaying dates and meal type labels.
 * These functions accept a translation function to support i18n.
 */

/**
 * Format a date string for display with i18n support
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @param t - Translation function from react-i18next
 * @returns Formatted date string (e.g., "Today", "Yesterday", "Jan 15", "Jan 15, 2024")
 */
export function formatDate(dateString: string, t: (key: string) => string): string {
  try {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    // Check if it's today
    if (dateOnly.getTime() === today.getTime()) {
      return t('mealtype_log.calendar.today');
    }
    
    // Check if it's yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateOnly.getTime() === yesterday.getTime()) {
      return t('mealtype_log.calendar.yesterday');
    }
    
    // Format as "MMM DD, YYYY" (e.g., "Jan 15, 2024") or "MMM DD" if current year
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthLabel = t(`mealtype_log.calendar.months.${monthKeys[date.getMonth()]}`);
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();
    if (dateYear === currentYear) {
      return `${monthLabel} ${date.getDate()}`;
    }
    return `${monthLabel} ${date.getDate()}, ${dateYear}`;
  } catch (error) {
    // Fallback to original string if parsing fails
    return dateString;
  }
}

/**
 * Get the display label for a meal type
 * 
 * @param type - Meal type key (breakfast, lunch, dinner, afternoon_snack)
 * @param t - Translation function from react-i18next
 * @returns Translated meal type label
 */
export function getMealTypeLabel(type: string, t: (key: string) => string): string {
  if (!type) return '';
  const labels: Record<string, string> = {
    'breakfast': t('mealtype_log.meal_types.breakfast'),
    'lunch': t('mealtype_log.meal_types.lunch'),
    'dinner': t('mealtype_log.meal_types.dinner'),
    'afternoon_snack': t('mealtype_log.meal_types.snack'),
  };
  return labels[type.toLowerCase()] || type;
}

/**
 * Get all meal type labels as a record
 * 
 * @param t - Translation function from react-i18next
 * @returns Record mapping meal type keys to translated labels
 */
export function getMealTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    'breakfast': t('mealtype_log.meal_types.breakfast'),
    'lunch': t('mealtype_log.meal_types.lunch'),
    'dinner': t('mealtype_log.meal_types.dinner'),
    'afternoon_snack': t('mealtype_log.meal_types.snack'),
  };
}

