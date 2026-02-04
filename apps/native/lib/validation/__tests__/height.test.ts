import { describe, it, expect } from 'vitest';
import { ftInToCm, cmToFtIn, roundTo1, convertHeightToCm, validateHeightInputs } from '../height';
import { PROFILES } from '@/constants/constraints';

const MIN_CM = PROFILES.HEIGHT_CM.MIN; // 50
const MAX_CM = PROFILES.HEIGHT_CM.MAX; // 260

describe('height validation', () => {
  describe('ftInToCm', () => {
    it('should convert 5 feet 6 inches to cm', () => {
      // 5 ft 6 in = 66 inches = 66 * 2.54 = 167.64 cm
      const result = ftInToCm(5, 6);
      expect(result).toBeCloseTo(167.64, 2);
    });

    it('should convert 6 feet 0 inches to cm', () => {
      // 6 ft 0 in = 72 inches = 72 * 2.54 = 182.88 cm
      const result = ftInToCm(6, 0);
      expect(result).toBeCloseTo(182.88, 2);
    });

    it('should convert 4 feet 2 inches to cm', () => {
      // 4 ft 2 in = 50 inches = 50 * 2.54 = 127 cm
      const result = ftInToCm(4, 2);
      expect(result).toBeCloseTo(127, 2);
    });

    it('should convert 5 feet 0 inches to cm', () => {
      // 5 ft 0 in = 60 inches = 60 * 2.54 = 152.4 cm
      const result = ftInToCm(5, 0);
      expect(result).toBeCloseTo(152.4, 2);
    });

    it('should handle decimal inches', () => {
      // 5 ft 6.5 in = 66.5 inches = 66.5 * 2.54 = 168.91 cm
      const result = ftInToCm(5, 6.5);
      expect(result).toBeCloseTo(168.91, 2);
    });
  });

  describe('cmToFtIn', () => {
    it('should convert 168 cm to feet and inches', () => {
      // 168 cm = 168 / 2.54 = 66.14 inches = 5 ft 6 in (rounded)
      const result = cmToFtIn(168);
      expect(result).not.toBeNull();
      expect(result?.feet).toBe(5);
      expect(result?.inches).toBe(6);
    });

    it('should convert 152.4 cm to feet and inches', () => {
      // 152.4 cm = 152.4 / 2.54 = 60 inches = 5 ft 0 in
      const result = cmToFtIn(152.4);
      expect(result).not.toBeNull();
      expect(result?.feet).toBe(5);
      expect(result?.inches).toBe(0);
    });

    it('should convert 182.88 cm to feet and inches', () => {
      // 182.88 cm = 182.88 / 2.54 = 72 inches = 6 ft 0 in
      const result = cmToFtIn(182.88);
      expect(result).not.toBeNull();
      expect(result?.feet).toBe(6);
      expect(result?.inches).toBe(0);
    });

    it('should convert 167.64 cm to feet and inches (round-trip test)', () => {
      // 167.64 cm should convert back to approximately 5 ft 6 in
      const result = cmToFtIn(167.64);
      expect(result).not.toBeNull();
      expect(result?.feet).toBe(5);
      // Allow for rounding: 167.64 / 2.54 = 66.0 inches = 5 ft 6 in
      expect(result?.inches).toBe(6);
    });

    it('should return null for invalid input (NaN)', () => {
      expect(cmToFtIn(NaN)).toBeNull();
    });

    it('should return null for zero', () => {
      expect(cmToFtIn(0)).toBeNull();
    });

    it('should return null for negative values', () => {
      expect(cmToFtIn(-10)).toBeNull();
    });

    it('should handle edge case near minimum (50 cm)', () => {
      const result = cmToFtIn(50);
      expect(result).not.toBeNull();
      // 50 cm = 50 / 2.54 = 19.69 inches = 1 ft 8 in (rounded)
      expect(result?.feet).toBe(1);
      expect(result?.inches).toBeGreaterThanOrEqual(7);
      expect(result?.inches).toBeLessThanOrEqual(8);
    });

    it('should handle edge case near maximum (260 cm)', () => {
      const result = cmToFtIn(260);
      expect(result).not.toBeNull();
      // 260 cm = 260 / 2.54 = 102.36 inches = 8 ft 6 in (rounded)
      expect(result?.feet).toBe(8);
      expect(result?.inches).toBeGreaterThanOrEqual(5);
      expect(result?.inches).toBeLessThanOrEqual(7);
    });
  });

  describe('roundTo1', () => {
    it('should round to 1 decimal place', () => {
      expect(roundTo1(123.456)).toBe(123.5);
      expect(roundTo1(123.444)).toBe(123.4);
    });

    it('should round up correctly', () => {
      expect(roundTo1(123.45)).toBe(123.5);
    });

    it('should round down correctly', () => {
      expect(roundTo1(123.44)).toBe(123.4);
    });

    it('should handle integers', () => {
      expect(roundTo1(123)).toBe(123);
    });

    it('should handle already rounded values', () => {
      expect(roundTo1(123.5)).toBe(123.5);
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
      expect(convertHeightToCm('ft/in', undefined, '-5', '6')).toBeNull();
    });

    it('should handle whitespace in cm string', () => {
      expect(convertHeightToCm('cm', ' 168 ')).toBe(168);
      expect(convertHeightToCm('cm', '168 ')).toBe(168);
    });

    it('should handle whitespace in ft/in strings', () => {
      const result = convertHeightToCm('ft/in', undefined, ' 5 ', ' 6 ');
      expect(result).toBeCloseTo(167.64, 2);
    });
  });

  describe('validateHeightInputs - CM mode', () => {
    it('should accept valid cm values within allowed range', () => {
      const result = validateHeightInputs('cm', '168', '', '');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBe(168);
      expect(result.errorKey).toBeUndefined();
    });

    it('should accept minimum valid cm value', () => {
      const result = validateHeightInputs('cm', MIN_CM.toString(), '', '');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBe(MIN_CM);
    });

    it('should accept maximum valid cm value', () => {
      const result = validateHeightInputs('cm', MAX_CM.toString(), '', '');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBe(MAX_CM);
    });

    it('should reject empty cm value', () => {
      const result = validateHeightInputs('cm', '', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject whitespace-only cm value', () => {
      const result = validateHeightInputs('cm', '   ', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject non-numeric cm string', () => {
      const result = validateHeightInputs('cm', 'abc', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject cm value below minimum', () => {
      const result = validateHeightInputs('cm', (MIN_CM - 1).toString(), '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_invalid');
    });

    it('should reject cm value above maximum', () => {
      const result = validateHeightInputs('cm', (MAX_CM + 1).toString(), '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_invalid');
    });

    it('should reject zero cm value', () => {
      const result = validateHeightInputs('cm', '0', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_invalid');
    });

    it('should reject negative cm value', () => {
      const result = validateHeightInputs('cm', '-10', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_invalid');
    });

    it('should trim whitespace from cm value', () => {
      const result = validateHeightInputs('cm', ' 168 ', '', '');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBe(168);
    });
  });

  describe('validateHeightInputs - FT/IN mode', () => {
    it('should accept valid ft/in combination within allowed range', () => {
      // 5 ft 6 in = 167.64 cm (within range)
      const result = validateHeightInputs('ft/in', '', '5', '6');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeCloseTo(167.64, 2);
    });

    it('should accept minimum valid ft/in combination', () => {
      // 50 cm = 1 ft 8 in (approximately)
      const result = validateHeightInputs('ft/in', '', '1', '8');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeGreaterThanOrEqual(MIN_CM);
    });

    it('should accept maximum valid ft/in combination', () => {
      // 260 cm = 8 ft 6 in (approximately)
      const result = validateHeightInputs('ft/in', '', '8', '6');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeLessThanOrEqual(MAX_CM);
    });

    it('should reject empty ft and in values', () => {
      const result = validateHeightInputs('ft/in', '', '', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject when ft is empty', () => {
      const result = validateHeightInputs('ft/in', '', '', '6');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject when in is empty', () => {
      const result = validateHeightInputs('ft/in', '', '5', '');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject non-numeric ft value', () => {
      const result = validateHeightInputs('ft/in', '', 'abc', '6');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject non-numeric in value', () => {
      const result = validateHeightInputs('ft/in', '', '5', 'abc');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject zero feet', () => {
      const result = validateHeightInputs('ft/in', '', '0', '6');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject negative feet', () => {
      const result = validateHeightInputs('ft/in', '', '-5', '6');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_required');
    });

    it('should reject ft/in combination that results in cm below minimum', () => {
      // 1 ft 0 in = 30.48 cm (below 50 cm minimum)
      const result = validateHeightInputs('ft/in', '', '1', '0');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_invalid');
    });

    it('should reject ft/in combination that results in cm above maximum', () => {
      // 9 ft 0 in = 274.32 cm (above 260 cm maximum)
      const result = validateHeightInputs('ft/in', '', '9', '0');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.height.error_height_invalid');
    });

    it('should handle inches >= 12 (converts correctly but validates result)', () => {
      // 5 ft 12 in = 6 ft 0 in = 182.88 cm (within range)
      const result = validateHeightInputs('ft/in', '', '5', '12');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeCloseTo(182.88, 2);
    });

    it('should handle negative inches (validates resulting cm, not inches directly)', () => {
      // 5 ft -1 in = 59 inches = 149.86 cm (within range, so passes validation)
      // Note: Current implementation validates the resulting cm value, not the inches range
      const result = validateHeightInputs('ft/in', '', '5', '-1');
      // This passes because the resulting cm (149.86) is within valid range
      // If the resulting cm was invalid, it would be rejected
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeCloseTo(149.86, 2);
    });

    it('should trim whitespace from ft/in values', () => {
      const result = validateHeightInputs('ft/in', '', ' 5 ', ' 6 ');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeCloseTo(167.64, 2);
    });
  });

  describe('round-trip conversion stability', () => {
    it('should maintain precision when converting cm → ft/in → cm', () => {
      const originalCm = 168;
      const ftIn = cmToFtIn(originalCm);
      expect(ftIn).not.toBeNull();
      
      if (ftIn) {
        const convertedCm = ftInToCm(ftIn.feet, ftIn.inches);
        // Allow for rounding tolerance (±1 cm is reasonable for this conversion)
        expect(Math.abs(convertedCm - originalCm)).toBeLessThanOrEqual(2);
      }
    });

    it('should maintain precision for 152.4 cm (exact 5 ft)', () => {
      const originalCm = 152.4;
      const ftIn = cmToFtIn(originalCm);
      expect(ftIn).not.toBeNull();
      
      if (ftIn) {
        const convertedCm = ftInToCm(ftIn.feet, ftIn.inches);
        expect(Math.abs(convertedCm - originalCm)).toBeLessThanOrEqual(1);
      }
    });

    it('should maintain precision for 182.88 cm (exact 6 ft)', () => {
      const originalCm = 182.88;
      const ftIn = cmToFtIn(originalCm);
      expect(ftIn).not.toBeNull();
      
      if (ftIn) {
        const convertedCm = ftInToCm(ftIn.feet, ftIn.inches);
        expect(Math.abs(convertedCm - originalCm)).toBeLessThanOrEqual(1);
      }
    });

    it('should maintain precision for edge case near minimum', () => {
      const originalCm = 50;
      const ftIn = cmToFtIn(originalCm);
      expect(ftIn).not.toBeNull();
      
      if (ftIn) {
        const convertedCm = ftInToCm(ftIn.feet, ftIn.inches);
        expect(Math.abs(convertedCm - originalCm)).toBeLessThanOrEqual(2);
      }
    });

    it('should maintain precision for edge case near maximum', () => {
      const originalCm = 260;
      const ftIn = cmToFtIn(originalCm);
      expect(ftIn).not.toBeNull();
      
      if (ftIn) {
        const convertedCm = ftInToCm(ftIn.feet, ftIn.inches);
        expect(Math.abs(convertedCm - originalCm)).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('payload contract (canonical cm value)', () => {
    it('should always return cm value in result when valid (cm mode)', () => {
      const result = validateHeightInputs('cm', '168', '', '');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBe(168);
    });

    it('should always return cm value in result when valid (ft/in mode)', () => {
      const result = validateHeightInputs('ft/in', '', '5', '6');
      expect(result.ok).toBe(true);
      expect(result.cmValue).toBeCloseTo(167.64, 2);
    });

    it('should not return cm value when invalid', () => {
      const result = validateHeightInputs('cm', '', '', '');
      expect(result.ok).toBe(false);
      expect(result.cmValue).toBeUndefined();
    });
  });

  describe('submit gate helper logic', () => {
    it('cannot submit when cm input is missing', () => {
      const result = validateHeightInputs('cm', '', '', '');
      expect(result.ok).toBe(false);
    });

    it('cannot submit when cm input is invalid', () => {
      const result = validateHeightInputs('cm', 'abc', '', '');
      expect(result.ok).toBe(false);
    });

    it('can submit when cm input is valid', () => {
      const result = validateHeightInputs('cm', '168', '', '');
      expect(result.ok).toBe(true);
    });

    it('cannot submit when ft/in inputs are missing', () => {
      const result = validateHeightInputs('ft/in', '', '', '');
      expect(result.ok).toBe(false);
    });

    it('cannot submit when ft/in inputs are invalid', () => {
      const result = validateHeightInputs('ft/in', '', 'abc', '6');
      expect(result.ok).toBe(false);
    });

    it('can submit when ft/in inputs are valid', () => {
      const result = validateHeightInputs('ft/in', '', '5', '6');
      expect(result.ok).toBe(true);
    });
  });
});
