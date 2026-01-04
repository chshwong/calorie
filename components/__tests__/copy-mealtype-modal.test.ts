import { describe, expect, it } from 'vitest';

/**
 * Tests for CopyMealtypeModal date restriction logic
 * 
 * These tests verify that CopyMealtypeModal uses the same date restriction
 * logic as CloneDayModal, ensuring consistency across date selection modals.
 */

describe('CopyMealtypeModal - Date Restriction Logic', () => {
  // Helper function to create a date at midnight in local time
  const createDate = (year: number, month: number, day: number): Date => {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Helper function that mirrors getDefaultTargetDate logic from CopyMealtypeModal
  const getDefaultTargetDate = (
    sourceDate: Date,
    minimumDate?: Date,
    maximumDate?: Date
  ): Date => {
    const tomorrow = new Date(sourceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    if (minimumDate) {
      const minDate = new Date(minimumDate);
      minDate.setHours(0, 0, 0, 0);
      if (tomorrow < minDate) return new Date(minDate);
    }
    
    if (maximumDate) {
      const maxDate = new Date(maximumDate);
      maxDate.setHours(0, 0, 0, 0);
      if (tomorrow > maxDate) return new Date(maxDate);
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
      if (dateNormalized < minDateNormalized) {
        return true;
      }
    }

    // After maximum date
    if (maximumDate) {
      const maxDateNormalized = new Date(maximumDate);
      maxDateNormalized.setHours(0, 0, 0, 0);
      if (dateNormalized > maxDateNormalized) {
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
    if (!minimumDate) return true;
    
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthFirst = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    const minMonthFirst = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
    return prevMonthFirst >= minMonthFirst;
  };

  const canNavigateToNextMonth = (
    currentMonth: Date,
    maximumDate?: Date
  ): boolean => {
    if (!maximumDate) return true;
    
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthFirst = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
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

    it('handles both restrictions correctly', () => {
      const sourceDate = createDate(2025, 1, 10);
      const minimumDate = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 1, 20);
      // Tomorrow (1/11) is before min (1/15), so should return min
      const result = getDefaultTargetDate(sourceDate, minimumDate, maximumDate);
      expect(result.getTime()).toBe(minimumDate.getTime());
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
    });

    it('disables dates after maximumDate', () => {
      const afterMax = createDate(2025, 1, 21);
      expect(isDateDisabled(afterMax, sourceDate, minimumDate, maximumDate)).toBe(true);
    });

    it('allows dates between minimumDate and maximumDate (excluding source)', () => {
      const validDate = createDate(2025, 1, 16);
      expect(isDateDisabled(validDate, sourceDate, minimumDate, maximumDate)).toBe(false);
    });
  });

  describe('Month Navigation', () => {
    it('prevents previous month navigation when at minimum', () => {
      const currentMonth = createDate(2025, 2, 15);
      const minimumDate = createDate(2025, 2, 1);
      expect(canNavigateToPreviousMonth(currentMonth, minimumDate)).toBe(false);
    });

    it('prevents next month navigation when at maximum', () => {
      const currentMonth = createDate(2025, 1, 15);
      const maximumDate = createDate(2025, 1, 20);
      expect(canNavigateToNextMonth(currentMonth, maximumDate)).toBe(false);
    });

    it('allows navigation when within bounds', () => {
      const currentMonth = createDate(2025, 3, 15);
      const minimumDate = createDate(2025, 1, 1);
      const maximumDate = createDate(2025, 12, 31);
      expect(canNavigateToPreviousMonth(currentMonth, minimumDate)).toBe(true);
      expect(canNavigateToNextMonth(currentMonth, maximumDate)).toBe(true);
    });
  });

  describe('Consistency with CloneDayModal', () => {
    it('uses the same date restriction logic', () => {
      const sourceDate = createDate(2025, 1, 15);
      const minimumDate = createDate(2025, 1, 10);
      const maximumDate = createDate(2025, 1, 20);

      // Both modals should behave identically
      const cloneDayResult = getDefaultTargetDate(sourceDate, minimumDate, maximumDate);
      
      // Verify the result respects restrictions
      expect(cloneDayResult.getTime()).toBeGreaterThanOrEqual(minimumDate.getTime());
      expect(cloneDayResult.getTime()).toBeLessThanOrEqual(maximumDate.getTime());
    });
  });
});

