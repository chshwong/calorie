import { describe, it, expect } from 'vitest';
import { filterNumericInput } from '../inputFilters';

describe('inputFilters', () => {
  describe('filterNumericInput', () => {
    it('should remove non-numeric characters', () => {
      expect(filterNumericInput('abc123def')).toBe('123');
    });

    it('should allow decimal point', () => {
      expect(filterNumericInput('12.34')).toBe('12.34');
    });

    it('should allow only one decimal point', () => {
      expect(filterNumericInput('12.34.56')).toBe('12.3456');
    });

    it('should remove all non-numeric except first decimal', () => {
      expect(filterNumericInput('12.34.56abc')).toBe('12.3456');
    });

    it('should handle empty string', () => {
      expect(filterNumericInput('')).toBe('');
    });

    it('should handle only letters', () => {
      expect(filterNumericInput('abc')).toBe('');
    });

    it('should handle only numbers', () => {
      expect(filterNumericInput('123')).toBe('123');
    });
  });
});
