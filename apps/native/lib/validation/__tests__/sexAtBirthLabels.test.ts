import { describe, it, expect } from 'vitest';
import { sexAtBirthToLabel, labelToSexAtBirth } from '../sexAtBirthLabels';

describe('sexAtBirthLabels', () => {
  describe('sexAtBirthToLabel', () => {
    it('should map "male" to "Male"', () => {
      expect(sexAtBirthToLabel('male')).toBe('Male');
    });

    it('should map "female" to "Female"', () => {
      expect(sexAtBirthToLabel('female')).toBe('Female');
    });
  });

  describe('labelToSexAtBirth', () => {
    it('should map "Male" to "male"', () => {
      expect(labelToSexAtBirth('Male')).toBe('male');
    });

    it('should map "male" to "male"', () => {
      expect(labelToSexAtBirth('male')).toBe('male');
    });

    it('should map "Female" to "female"', () => {
      expect(labelToSexAtBirth('Female')).toBe('female');
    });

    it('should map "female" to "female"', () => {
      expect(labelToSexAtBirth('female')).toBe('female');
    });

    it('should handle trimmed labels', () => {
      expect(labelToSexAtBirth('  Male  ')).toBe('male');
      expect(labelToSexAtBirth('  Female  ')).toBe('female');
    });

    it('should return null for invalid labels', () => {
      expect(labelToSexAtBirth('invalid')).toBeNull();
      expect(labelToSexAtBirth('')).toBeNull();
      expect(labelToSexAtBirth('other')).toBeNull();
      expect(labelToSexAtBirth('unknown')).toBeNull();
    });
  });
});
