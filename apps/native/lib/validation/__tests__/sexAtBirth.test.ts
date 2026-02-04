import { describe, it, expect } from 'vitest';
import { isValidSexAtBirth, validateSexAtBirth, type SexAtBirth } from '../sexAtBirth';

describe('sexAtBirth validation', () => {
  describe('isValidSexAtBirth', () => {
    it('should accept "male"', () => {
      expect(isValidSexAtBirth('male')).toBe(true);
    });

    it('should accept "female"', () => {
      expect(isValidSexAtBirth('female')).toBe(true);
    });

    it('should reject null', () => {
      expect(isValidSexAtBirth(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidSexAtBirth(undefined)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidSexAtBirth('')).toBe(false);
    });

    it('should reject single character "m"', () => {
      expect(isValidSexAtBirth('m')).toBe(false);
    });

    it('should reject single character "f"', () => {
      expect(isValidSexAtBirth('f')).toBe(false);
    });

    it('should reject "other"', () => {
      expect(isValidSexAtBirth('other')).toBe(false);
    });

    it('should reject "unknown"', () => {
      expect(isValidSexAtBirth('unknown')).toBe(false);
    });

    it('should reject number', () => {
      expect(isValidSexAtBirth(123)).toBe(false);
    });

    it('should reject object', () => {
      expect(isValidSexAtBirth({})).toBe(false);
    });

    it('should reject "not_telling"', () => {
      expect(isValidSexAtBirth('not_telling')).toBe(false);
    });
  });

  describe('validateSexAtBirth', () => {
    it('should accept "male" and return ok with value', () => {
      const result = validateSexAtBirth('male');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('male');
      }
    });

    it('should accept "female" and return ok with value', () => {
      const result = validateSexAtBirth('female');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('female');
      }
    });

    it('should reject null with required error key', () => {
      const result = validateSexAtBirth(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorKey).toBe('onboarding.sexAtBirth.required');
      }
    });

    it('should reject undefined with required error key', () => {
      const result = validateSexAtBirth(undefined);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorKey).toBe('onboarding.sexAtBirth.required');
      }
    });

    it('should reject empty string with required error key', () => {
      const result = validateSexAtBirth('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorKey).toBe('onboarding.sexAtBirth.required');
      }
    });

    it('should reject invalid values with select error key', () => {
      const invalidValues = ['m', 'f', 'other', 'unknown', 'not_telling', 123, {}];
      
      for (const value of invalidValues) {
        const result = validateSexAtBirth(value);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorKey).toBe('onboarding.sex.error_select_sex');
        }
      }
    });
  });
});
