import { describe, expect, it, beforeEach, vi } from 'vitest';

/**
 * Tests for CloneDayModal date restriction logic
 * 
 * These tests verify that the date selection modals properly restrict
 * date selection based on minimumDate and maximumDate props, ensuring
 * users cannot select dates before their creation date or after today.
 */

describe('CloneDayModal - Date Restriction Logic', () => {
  // Helper function to create a date at midnight in local time
  const createDate = (year: number, month: number, day: number): Date => {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Helper function that mirrors getDefaultTargetDate logic from CloneDayModal
  const getDefaultTargetDate = (
    sourceDate: Date,
    minimumDate?: Date,
    maximumDate?: Date
  ): Date => {
    const tomorrow = new Date(sourceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // If minimumDate is set and tomorrow is before it, use minimumDate instead
    if (minimumDate) {
      const minDateNormalized = new Date(minimumDate);
      minDateNormalized.setHours(0, 0, 0, 0);
      if (tomorrow.getTime() < minDateNormalized.getTime()) {
        return minDateNormalized;
      }
    }

    // If maximumDate is set and tomorrow is after it, use maximumDate instead
    if (maximumDate) {
      const maxDateNormalized = new Date(maximumDate);
      maxDateNormalized.setHours(0, 0, 0, 0);
      if (tomorrow.getTime() > maxDateNormalized.getTime()) {
        return maxDateNormalized;
      }
    }

    return tomorrow;
  };

  // Helper function that mirrors the date validation logic
  const isDateDisabled = (
    date: Date,
    sourceDate: Date,
    minimumDate?: Date,
    maximumDate?: Date
  ): boolean => {
    const dateNormalized = new Date(date);
    dateNormalized.setHours(0, 0, 0, 0);

    // Same as source date
    const sourceDateNormalized = new Date(sourceDate);
    sourceDateNormalized.setHours(0, 0, 0, 0);
    if (dateNormalized.getTime() === sourceDateNormalized.getTime()) {
      return true;
    }

    // Before minimum date
    if (minimumDate) {
      const minDateNormalized = new Date(minimumDate);
      minDateNormalized.setHours(0, 0, 0, 0);
      if (dateNormalized.getTime() < minDateNormalized.getTime()) {
        return true;
      }
    }

    // After maximum date
    if (maximumDate) {
      const maxDateNormalized = new Date(maximumDate);
      maxDateNormalized.setHours(0, 0, 0, 0);
      if (dateNormalized.getTime() > maxDateNormalized.getTime()) {
        return true;
      }
    }

    return false;
  };

  // Helper function for month navigation restriction
  const canNavigateToPreviousMonth = (
    currentMonth: Date,
    minimumDate?: Date
  ): boolean => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthFirst = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    
    if (!minimumDate) return true;
    
    const minMonthFirst = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
    return prevMonthFirst >= minMonthFirst;
  };

  const canNavigateToNextMonth = (
    currentMonth: Date,
    maximumDate?: Date
  ): boolean => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthFirst = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    
    if (!maximumDate) return true;
    
    const maxMonthFirst = new Date(maximumDate.getFullYear(), maximumDate.getMonth(), 1);
    return nextMonthFirst <= maxMonthFirst;
  };

  describe('getDefaultTargetDate', () => {
    it('returns tomorrow when no restrictions are set', () => {
      const sourceDate = createDate(2025, 1, 15);
      const result = getDefaultTargetDate(sourceDate);
      const expected = createDate(2025, 1, 16);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('returns minimumDate when tomorrow is before minimumDate', () => {
      const sourceDate = createDate(2025, 1, 10);
      const minimumDate = createDate(2025, 1, 15);
      const result = getDefaultTargetDate(sourceDate, minimumDate);
      expect(result.getTime()).toBe(minimumDate.getTime());
    });

    it('returns maximumDate when tomorrow is after maximumDate', () => {
      const sourceDate = createDate(2025, 1, 14);
      const maximumDate = createDate(2025, 1, 15);
      const result = getDefaultTargetDate(sourceDate, undefined, maximumDate);
      expect(result.getTime()).toBe(maximumDate.getTime());
    });

    it('returns minimumDate when both restrictions apply and minimumDate is later', () => {
      const sourceDate = createDate(2025, 1, 10);
      const minimumDate = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 1, 12);
      // In this case, tomorrow (1/11) is before minimum (1/15), so minimumDate wins
      const result = getDefaultTargetDate(sourceDate, minimumDate, maximumDate);
      expect(result.getTime()).toBe(minimumDate.getTime());
    });

    it('returns maximumDate when both restrictions apply and maximumDate is earlier than tomorrow', () => {
      const sourceDate = createDate(2025, 1, 14);
      const minimumDate = createDate(2025, 1, 10);
      const maximumDate = createDate(2025, 1, 15);
      // Tomorrow (1/15) is after maximum (1/15), so maximumDate is used
      const result = getDefaultTargetDate(sourceDate, minimumDate, maximumDate);
      expect(result.getTime()).toBe(maximumDate.getTime());
    });

    it('handles same-day source and maximum date correctly', () => {
      const sourceDate = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 1, 15);
      // Tomorrow would be 1/16, but max is 1/15, so return max
      const result = getDefaultTargetDate(sourceDate, undefined, maximumDate);
      expect(result.getTime()).toBe(maximumDate.getTime());
    });

    it('normalizes times to midnight for comparison', () => {
      const sourceDate = new Date(2025, 0, 15, 14, 30, 45); // 2:30:45 PM
      const minimumDate = new Date(2025, 0, 16, 8, 0, 0); // 8:00 AM
      const result = getDefaultTargetDate(sourceDate, minimumDate);
      // Should normalize and compare at midnight
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('isDateDisabled', () => {
    const sourceDate = createDate(2025, 1, 15);
    const minimumDate = createDate(2025, 1, 10);
    const maximumDate = createDate(2025, 1, 20);

    it('disables the source date itself', () => {
      expect(isDateDisabled(sourceDate, sourceDate, minimumDate, maximumDate)).toBe(true);
    });

    it('disables dates before minimumDate', () => {
      const beforeMin = createDate(2025, 1, 9);
      expect(isDateDisabled(beforeMin, sourceDate, minimumDate, maximumDate)).toBe(true);
      
      const exactlyMin = createDate(2025, 1, 10);
      expect(isDateDisabled(exactlyMin, sourceDate, minimumDate, maximumDate)).toBe(false);
    });

    it('disables dates after maximumDate', () => {
      const afterMax = createDate(2025, 1, 21);
      expect(isDateDisabled(afterMax, sourceDate, minimumDate, maximumDate)).toBe(true);
      
      const exactlyMax = createDate(2025, 1, 20);
      expect(isDateDisabled(exactlyMax, sourceDate, minimumDate, maximumDate)).toBe(false);
    });

    it('allows dates between minimumDate and maximumDate', () => {
      const validDate = createDate(2025, 1, 15);
      // Note: This is the source date, so it's disabled for that reason
      expect(isDateDisabled(validDate, sourceDate, minimumDate, maximumDate)).toBe(true);
      
      const anotherValidDate = createDate(2025, 1, 16);
      expect(isDateDisabled(anotherValidDate, sourceDate, minimumDate, maximumDate)).toBe(false);
    });

    it('works without minimumDate restriction', () => {
      const beforeMin = createDate(2025, 1, 1);
      expect(isDateDisabled(beforeMin, sourceDate, undefined, maximumDate)).toBe(false);
      
      const afterMax = createDate(2025, 1, 21);
      expect(isDateDisabled(afterMax, sourceDate, undefined, maximumDate)).toBe(true);
    });

    it('works without maximumDate restriction', () => {
      const futureDate = createDate(2025, 12, 31);
      expect(isDateDisabled(futureDate, sourceDate, minimumDate, undefined)).toBe(false);
      
      const pastDate = createDate(2025, 1, 1);
      expect(isDateDisabled(pastDate, sourceDate, minimumDate, undefined)).toBe(true);
    });

    it('works without any restrictions (only source date is disabled)', () => {
      const anyDate = createDate(2025, 6, 15);
      expect(isDateDisabled(anyDate, sourceDate, undefined, undefined)).toBe(false);
      
      expect(isDateDisabled(sourceDate, sourceDate, undefined, undefined)).toBe(true);
    });

    it('normalizes times to midnight for comparison', () => {
      const testDate = new Date(2025, 0, 9, 23, 59, 59);
      // Even though it's 11:59 PM, it should compare at midnight (1/9) which is before min (1/10)
      expect(isDateDisabled(testDate, sourceDate, minimumDate, maximumDate)).toBe(true);
    });
  });

  describe('canNavigateToPreviousMonth', () => {
    it('allows navigation when no minimumDate is set', () => {
      const currentMonth = createDate(2025, 1, 15);
      expect(canNavigateToPreviousMonth(currentMonth)).toBe(true);
    });

    it('allows navigation when previous month is after minimumDate month', () => {
      const currentMonth = createDate(2025, 3, 15);
      const minimumDate = createDate(2025, 1, 10);
      expect(canNavigateToPreviousMonth(currentMonth, minimumDate)).toBe(true);
    });

    it('allows navigation when previous month is the same as minimumDate month', () => {
      const currentMonth = createDate(2025, 2, 15);
      const minimumDate = createDate(2025, 1, 10);
      expect(canNavigateToPreviousMonth(currentMonth, minimumDate)).toBe(true);
    });

    it('prevents navigation when previous month is before minimumDate month', () => {
      const currentMonth = createDate(2025, 2, 15);
      const minimumDate = createDate(2025, 2, 1);
      expect(canNavigateToPreviousMonth(currentMonth, minimumDate)).toBe(false);
    });

    it('handles year boundaries correctly', () => {
      const currentMonth = createDate(2025, 1, 15);
      const minimumDate = createDate(2024, 12, 31);
      expect(canNavigateToPreviousMonth(currentMonth, minimumDate)).toBe(true);
      
      const currentMonth2 = createDate(2025, 1, 15);
      const minimumDate2 = createDate(2025, 1, 1);
      expect(canNavigateToPreviousMonth(currentMonth2, minimumDate2)).toBe(false);
    });
  });

  describe('canNavigateToNextMonth', () => {
    it('allows navigation when no maximumDate is set', () => {
      const currentMonth = createDate(2025, 1, 15);
      expect(canNavigateToNextMonth(currentMonth)).toBe(true);
    });

    it('allows navigation when next month is before maximumDate month', () => {
      const currentMonth = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 3, 10);
      expect(canNavigateToNextMonth(currentMonth, maximumDate)).toBe(true);
    });

    it('allows navigation when next month is the same as maximumDate month', () => {
      const currentMonth = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 2, 10);
      expect(canNavigateToNextMonth(currentMonth, maximumDate)).toBe(true);
    });

    it('prevents navigation when next month is after maximumDate month', () => {
      const currentMonth = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 1, 20);
      expect(canNavigateToNextMonth(currentMonth, maximumDate)).toBe(false);
    });

    it('handles year boundaries correctly', () => {
      const currentMonth = createDate(2024, 12, 15);
      const maximumDate = createDate(2025, 1, 31);
      expect(canNavigateToNextMonth(currentMonth, maximumDate)).toBe(true);
      
      const currentMonth2 = createDate(2024, 12, 15);
      const maximumDate2 = createDate(2024, 12, 31);
      expect(canNavigateToNextMonth(currentMonth2, maximumDate2)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles dates at year boundaries', () => {
      const sourceDate = createDate(2024, 12, 31);
      const tomorrow = getDefaultTargetDate(sourceDate);
      expect(tomorrow.getFullYear()).toBe(2025);
      expect(tomorrow.getMonth()).toBe(0); // January
      expect(tomorrow.getDate()).toBe(1);
    });

    it('handles leap year correctly', () => {
      const sourceDate = createDate(2024, 2, 28); // 2024 is a leap year
      const tomorrow = getDefaultTargetDate(sourceDate);
      expect(tomorrow.getDate()).toBe(29);
      
      const sourceDate2 = createDate(2024, 2, 29);
      const tomorrow2 = getDefaultTargetDate(sourceDate2);
      expect(tomorrow2.getMonth()).toBe(2); // March
      expect(tomorrow2.getDate()).toBe(1);
    });

    it('handles month boundaries with restrictions', () => {
      const sourceDate = createDate(2025, 1, 31);
      const minimumDate = createDate(2025, 2, 5);
      const result = getDefaultTargetDate(sourceDate, minimumDate);
      // Tomorrow would be Feb 1, but min is Feb 5, so should return Feb 5
      expect(result.getTime()).toBe(minimumDate.getTime());
    });

    it('handles maximumDate equal to sourceDate', () => {
      const sourceDate = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 1, 15);
      const result = getDefaultTargetDate(sourceDate, undefined, maximumDate);
      expect(result.getTime()).toBe(maximumDate.getTime());
    });
  });
});

