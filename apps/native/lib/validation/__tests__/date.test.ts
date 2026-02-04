import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateDob, parseDob, formatDob, getAgeFromDob, getDobMinDate, getDobMaxDate } from '../../dates/dobRules';
import { DEFAULT_DOB_DATE } from '../date';

describe('date validation', () => {
  beforeEach(() => {
    // Set fake time to 2026-01-15T12:00:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validateDob', () => {
    it('should accept valid DOB and calculate correct age', () => {
      // Born in 2000, should be 26 years old in 2026
      const result = validateDob('2000-01-15');
      expect(result.ok).toBe(true);
      expect(result.errorKey).toBeUndefined();
    });

    it('should reject future date', () => {
      const result = validateDob('2027-01-15');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_dob_future');
    });

    it('should accept DOB exactly 13 years before today', () => {
      // 2026-01-15 - 13 years = 2013-01-15
      const result = validateDob('2013-01-15');
      expect(result.ok).toBe(true);
    });

    it('should reject DOB 1 day younger than 13 years', () => {
      // 2026-01-15 - 13 years + 1 day = 2013-01-16
      const result = validateDob('2013-01-16');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_age_minimum');
    });

    it('should reject empty string', () => {
      const result = validateDob('');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_dob_required');
    });

    it('should reject whitespace-only string', () => {
      const result = validateDob('   ');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_dob_required');
    });

    it('should reject invalid format', () => {
      const result = validateDob('01/15/2000');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_dob_format');
    });

    it('should reject DOB that makes age > 120', () => {
      // 2026 - 121 = 1905
      const result = validateDob('1905-01-15');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_age_maximum');
    });

    it('should handle leap year date (Feb 29)', () => {
      const result = validateDob('2000-02-29');
      expect(result.ok).toBe(true);
    });
  });

  describe('parseDob', () => {
    it('should parse valid ISO date string', () => {
      const result = parseDob('2000-01-15');
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2000);
      expect(result?.getMonth()).toBe(0); // January is 0
      expect(result?.getDate()).toBe(15);
    });

    it('should return null for invalid format', () => {
      expect(parseDob('01/15/2000')).toBeNull();
      expect(parseDob('invalid')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseDob('')).toBeNull();
    });
  });

  describe('formatDob', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date(2000, 0, 15); // January 15, 2000
      expect(formatDob(date)).toBe('2000-01-15');
    });

    it('should pad month and day with zeros', () => {
      const date = new Date(2000, 0, 5); // January 5, 2000
      expect(formatDob(date)).toBe('2000-01-05');
    });
  });

  describe('getAgeFromDob', () => {
    it('should calculate correct age', () => {
      // Born in 2000, should be 26 in 2026
      const age = getAgeFromDob('2000-01-15');
      expect(age).toBe(26);
    });

    it('should return null for invalid DOB', () => {
      expect(getAgeFromDob('invalid')).toBeNull();
    });
  });

  describe('DEFAULT_DOB_DATE', () => {
    it('should equal 1983-06-04', () => {
      expect(DEFAULT_DOB_DATE.getFullYear()).toBe(1983);
      expect(DEFAULT_DOB_DATE.getMonth()).toBe(5); // June is 5
      expect(DEFAULT_DOB_DATE.getDate()).toBe(4);
    });
  });

  describe('getDobMinDate and getDobMaxDate', () => {
    it('should return correct min date (120 years ago)', () => {
      const minDate = getDobMinDate();
      const expectedYear = new Date().getFullYear() - 120;
      expect(minDate.getFullYear()).toBe(expectedYear);
    });

    it('should return correct max date (13 years ago)', () => {
      const maxDate = getDobMaxDate();
      const expectedYear = new Date().getFullYear() - 13;
      expect(maxDate.getFullYear()).toBe(expectedYear);
    });
  });
});
