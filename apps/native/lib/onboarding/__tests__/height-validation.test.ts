import { describe, it, expect } from 'vitest';
import { validateHeightCm, convertHeightToCm, validateHeightInputs } from '../height-validation';
import { PROFILES } from '@/constants/constraints';

const MIN_CM = PROFILES.HEIGHT_CM.MIN; // 50
const MAX_CM = PROFILES.HEIGHT_CM.MAX; // 260

describe('height-validation (onboarding)', () => {
  describe('validateHeightCm', () => {
    it('should accept valid cm values within allowed range', () => {
      expect(validateHeightCm(168)).toBeNull();
      expect(validateHeightCm(152.4)).toBeNull();
      expect(validateHeightCm(182.88)).toBeNull();
    });

    it('should accept minimum valid cm value', () => {
      expect(validateHeightCm(MIN_CM)).toBeNull();
    });

    it('should accept maximum valid cm value', () => {
      expect(validateHeightCm(MAX_CM)).toBeNull();
    });

    it('should reject null', () => {
      expect(validateHeightCm(null)).toBe('onboarding.height.error_height_required');
    });

    it('should reject NaN', () => {
      expect(validateHeightCm(NaN)).toBe('onboarding.height.error_height_required');
    });

    it('should reject zero', () => {
      expect(validateHeightCm(0)).toBe('onboarding.height.error_height_required');
    });

    it('should reject negative values', () => {
      expect(validateHeightCm(-10)).toBe('onboarding.height.error_height_required');
    });

    it('should reject values below minimum', () => {
      expect(validateHeightCm(MIN_CM - 1)).toBe('onboarding.height.error_height_invalid');
    });

    it('should reject values above maximum', () => {
      expect(validateHeightCm(MAX_CM + 1)).toBe('onboarding.height.error_height_invalid');
    });
  });

  describe('convertHeightToCm', () => {
    it('should convert cm string to number', () => {
      expect(convertHeightToCm('cm', '168')).toBe(168);
      expect(convertHeightToCm('cm', '152.4')).toBe(152.4);
    });

    it('should convert ft/in strings to cm', () => {
      const result = convertHeightToCm('ft/in', undefined, '5', '6');
      expect(result).toBeCloseTo(167.64, 2);
    });

    it('should return null for invalid cm string', () => {
      expect(convertHeightToCm('cm', '')).toBeNull();
      expect(convertHeightToCm('cm', 'abc')).toBeNull();
      expect(convertHeightToCm('cm', '0')).toBeNull();
      expect(convertHeightToCm('cm', '-10')).toBeNull();
    });

    it('should return null for invalid ft/in strings', () => {
      expect(convertHeightToCm('ft/in', undefined, '', '')).toBeNull();
      expect(convertHeightToCm('ft/in', undefined, 'abc', '6')).toBeNull();
      expect(convertHeightToCm('ft/in', undefined, '5', 'abc')).toBeNull();
      expect(convertHeightToCm('ft/in', undefined, '0', '6')).toBeNull();
    });
  });

  describe('validateHeightInputs', () => {
    it('should validate cm input correctly', () => {
      const result = validateHeightInputs('cm', '168', '', '');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBe(168);
    });

    it('should validate ft/in input correctly', () => {
      const result = validateHeightInputs('ft/in', '', '5', '6');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeCloseTo(167.64, 2);
    });

    it('should reject invalid cm input', () => {
      const result = validateHeightInputs('cm', '', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject invalid ft/in input', () => {
      const result = validateHeightInputs('ft/in', '', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });
  });
});
