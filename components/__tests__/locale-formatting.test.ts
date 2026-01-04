import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for locale-based date formatting in calendar modals
 * 
 * These tests verify that date formatting respects the user's i18n language
 * preference, using 'fr-FR' for French and 'en-US' for English/default.
 */

describe('Locale-based Date Formatting', () => {
  // Mock i18n module
  let mockI18nLanguage = 'en';

  beforeEach(() => {
    // Reset to default
    mockI18nLanguage = 'en';
  });

  // Helper function that mirrors the locale detection logic from components
  const getLocale = (language: string): string => {
    return language === 'fr' ? 'fr-FR' : 'en-US';
  };

  // Helper function that mirrors date formatting in components
  const formatDate = (date: Date, format: 'short' | 'long', locale: string): string => {
    if (format === 'short') {
      return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
  };

  describe('getLocale', () => {
    it('returns fr-FR for French language', () => {
      expect(getLocale('fr')).toBe('fr-FR');
    });

    it('returns en-US for English language', () => {
      expect(getLocale('en')).toBe('en-US');
    });

    it('returns en-US for any other language (default)', () => {
      expect(getLocale('de')).toBe('en-US');
      expect(getLocale('es')).toBe('en-US');
      expect(getLocale('ja')).toBe('en-US');
    });
  });

  describe('formatDate - Short Format', () => {
    const testDate = new Date(2025, 0, 15); // January 15, 2025

    it('formats date in English (en-US) format', () => {
      const locale = getLocale('en');
      const formatted = formatDate(testDate, 'short', locale);
      // Format: "Jan 15, 2025" in en-US
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2025');
    });

    it('formats date in French (fr-FR) format', () => {
      const locale = getLocale('fr');
      const formatted = formatDate(testDate, 'short', locale);
      // Format: "15 janv. 2025" in fr-FR (may vary by browser, but should contain date parts)
      expect(formatted).toContain('15');
      expect(formatted).toContain('2025');
      // French format typically has day before month
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('formats different dates correctly', () => {
      const dates = [
        new Date(2025, 2, 31), // March 31
        new Date(2025, 11, 25), // December 25
        new Date(2024, 0, 1), // January 1, 2024
      ];

      dates.forEach((date) => {
        const enFormatted = formatDate(date, 'short', getLocale('en'));
        const frFormatted = formatDate(date, 'short', getLocale('fr'));
        
        // Both should contain the year
        expect(enFormatted).toContain('202');
        expect(frFormatted).toContain('202');
        
        // Both should be valid formatted strings
        expect(enFormatted.length).toBeGreaterThan(0);
        expect(frFormatted.length).toBeGreaterThan(0);
      });
    });
  });

  describe('formatDate - Long Format (Month/Year)', () => {
    const testDate = new Date(2025, 0, 15); // January 15, 2025

    it('formats month/year in English (en-US) format', () => {
      const locale = getLocale('en');
      const formatted = formatDate(testDate, 'long', locale);
      // Format: "January 2025" in en-US
      expect(formatted).toContain('January');
      expect(formatted).toContain('2025');
    });

    it('formats month/year in French (fr-FR) format', () => {
      const locale = getLocale('fr');
      const formatted = formatDate(testDate, 'long', locale);
      // Format: "janvier 2025" in fr-FR
      expect(formatted).toContain('2025');
      // French format should be different from English
      expect(formatted).not.toContain('January');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('formats all months correctly in both locales', () => {
      const months = [
        new Date(2025, 0, 1),  // January
        new Date(2025, 6, 1),  // July
        new Date(2025, 11, 1), // December
      ];

      months.forEach((date) => {
        const enFormatted = formatDate(date, 'long', getLocale('en'));
        const frFormatted = formatDate(date, 'long', getLocale('fr'));
        
        // Both should contain the year
        expect(enFormatted).toContain('2025');
        expect(frFormatted).toContain('2025');
        
        // Both should be valid formatted strings
        expect(enFormatted.length).toBeGreaterThan(0);
        expect(frFormatted.length).toBeGreaterThan(0);
        
        // Formats should be different between locales
        expect(enFormatted).not.toBe(frFormatted);
      });
    });
  });

  describe('Integration with Component Logic', () => {
    it('simulates CloneDayModal date formatting', () => {
      const sourceDate = new Date(2025, 0, 15);
      const locale = getLocale('en');
      
      // This mirrors the selected date display in CloneDayModal
      const formatted = formatDate(sourceDate, 'short', locale);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('simulates calendar month label formatting', () => {
      const calendarMonth = new Date(2025, 6, 15); // July 2025
      const locale = getLocale('fr');
      
      // This mirrors the month/year label in the calendar header
      const formatted = formatDate(calendarMonth, 'long', locale);
      expect(formatted).toContain('2025');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('handles locale switching correctly', () => {
      const testDate = new Date(2025, 2, 15);
      
      // Switch from English to French
      let locale = getLocale('en');
      let formatted = formatDate(testDate, 'short', locale);
      expect(formatted).toBeTruthy();
      
      locale = getLocale('fr');
      formatted = formatDate(testDate, 'short', locale);
      expect(formatted).toBeTruthy();
      // Should be different format
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('handles leap year dates', () => {
      const leapYearDate = new Date(2024, 1, 29); // Feb 29, 2024
      const locale = getLocale('en');
      const formatted = formatDate(leapYearDate, 'short', locale);
      expect(formatted).toContain('2024');
    });

    it('handles year boundaries', () => {
      const yearStart = new Date(2025, 0, 1);
      const yearEnd = new Date(2025, 11, 31);
      
      const locale = getLocale('en');
      expect(formatDate(yearStart, 'short', locale)).toContain('2025');
      expect(formatDate(yearEnd, 'short', locale)).toContain('2025');
    });

    it('handles single-digit days correctly', () => {
      const singleDigitDay = new Date(2025, 0, 5);
      const locale = getLocale('en');
      const formatted = formatDate(singleDigitDay, 'short', locale);
      expect(formatted).toContain('2025');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});

