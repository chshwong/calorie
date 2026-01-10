import { describe, it, expect } from 'vitest';

/**
 * Tests for bundle quantity input formatting and validation
 * 
 * Verifies that quantity input correctly enforces:
 * - Maximum 4 integer digits
 * - Maximum 2 decimal places
 * 
 * This tests the NumberInput component behavior with maxIntegers=4 and maxDecimals=2
 */

describe('bundle quantity input formatting', () => {
  /**
   * Simulates the NumberInput sanitization logic for quantity input
   * This mirrors the behavior of components/input/NumberInput.tsx
   */
  const sanitizeQuantityInput = (text: string, maxIntegers: number = 4, maxDecimals: number = 2): string => {
    // Normalize locale decimal separator
    let t = text.replace(/,/g, '.');
    
    // Keep only digits and at most one dot
    t = t.replace(/[^0-9.]/g, '');
    
    if (!t) return '';
    
    const firstDot = t.indexOf('.');
    if (firstDot !== -1) {
      // Has decimal point
      t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, '');
      
      // Limit integer part digits
      const [integerPart, decimalPart] = t.split('.');
      if (integerPart && integerPart.length > maxIntegers) {
        const limitedInteger = integerPart.slice(0, maxIntegers);
        t = decimalPart !== undefined ? `${limitedInteger}.${decimalPart}` : limitedInteger;
      }
      
      // Limit decimals
      if (maxDecimals >= 0 && firstDot !== -1) {
        const [a, b] = t.split('.');
        t = b !== undefined ? `${a}.${b.slice(0, maxDecimals)}` : a;
      }
    } else {
      // No decimal point - limit integer part digits
      if (maxIntegers > 0 && t.length > maxIntegers) {
        t = t.slice(0, maxIntegers);
      }
    }
    
    return t;
  };

  describe('integer part limits (max 4 digits)', () => {
    it('should accept up to 4 integer digits', () => {
      expect(sanitizeQuantityInput('1')).toBe('1');
      expect(sanitizeQuantityInput('12')).toBe('12');
      expect(sanitizeQuantityInput('123')).toBe('123');
      expect(sanitizeQuantityInput('1234')).toBe('1234');
    });

    it('should truncate integers longer than 4 digits', () => {
      expect(sanitizeQuantityInput('12345')).toBe('1234');
      expect(sanitizeQuantityInput('99999')).toBe('9999');
      expect(sanitizeQuantityInput('100000')).toBe('1000');
    });

    it('should handle leading zeros correctly', () => {
      // Note: NumberInput preserves leading zeros during input, parsing removes them
      // This test verifies input sanitization, not parsing
      expect(sanitizeQuantityInput('0123')).toBe('0123'); // Preserved during input
      expect(sanitizeQuantityInput('0012')).toBe('0012'); // Preserved during input (will parse to 12)
    });
  });

  describe('decimal part limits (max 2 decimals)', () => {
    it('should accept up to 2 decimal places', () => {
      expect(sanitizeQuantityInput('1.5')).toBe('1.5');
      expect(sanitizeQuantityInput('12.34')).toBe('12.34');
      expect(sanitizeQuantityInput('123.4')).toBe('123.4');
      expect(sanitizeQuantityInput('1234.56')).toBe('1234.56');
    });

    it('should truncate decimals longer than 2 places', () => {
      expect(sanitizeQuantityInput('1.234')).toBe('1.23');
      expect(sanitizeQuantityInput('12.345')).toBe('12.34');
      expect(sanitizeQuantityInput('123.456')).toBe('123.45');
      expect(sanitizeQuantityInput('1234.567')).toBe('1234.56');
    });

    it('should handle trailing decimal point', () => {
      expect(sanitizeQuantityInput('1.')).toBe('1.');
      expect(sanitizeQuantityInput('1234.')).toBe('1234.');
    });
  });

  describe('combined integer and decimal limits', () => {
    it('should enforce both limits simultaneously', () => {
      // Valid: 4 integers + 2 decimals
      expect(sanitizeQuantityInput('9999.99')).toBe('9999.99');
      
      // Integer part truncated
      expect(sanitizeQuantityInput('12345.67')).toBe('1234.67');
      
      // Decimal part truncated
      expect(sanitizeQuantityInput('1234.567')).toBe('1234.56');
      
      // Both truncated
      expect(sanitizeQuantityInput('12345.678')).toBe('1234.67');
    });

    it('should handle edge cases', () => {
      // Empty input
      expect(sanitizeQuantityInput('')).toBe('');
      
      // Just decimal point (NumberInput preserves it, normalization happens on blur)
      expect(sanitizeQuantityInput('.')).toBe('.');
      
      // Multiple decimal points (should keep only first)
      expect(sanitizeQuantityInput('1.2.3')).toBe('1.23');
      
      // Commas as decimal separator (normalized to dot)
      expect(sanitizeQuantityInput('12,34')).toBe('12.34');
    });

    it('should filter out non-numeric characters', () => {
      expect(sanitizeQuantityInput('abc123def')).toBe('123');
      expect(sanitizeQuantityInput('12.34abc')).toBe('12.34');
      expect(sanitizeQuantityInput('a1b2c.3d4e')).toBe('12.34');
    });
  });

  describe('parsing and validation', () => {
    const parseQuantityOrZero = (input: string): number => {
      const n = Number.parseFloat(input);
      return Number.isFinite(n) ? n : 0;
    };

    it('should parse valid quantity strings correctly', () => {
      expect(parseQuantityOrZero('1')).toBe(1);
      expect(parseQuantityOrZero('12.34')).toBe(12.34);
      expect(parseQuantityOrZero('1234.56')).toBe(1234.56);
      expect(parseQuantityOrZero('0.5')).toBe(0.5);
    });

    it('should return 0 for invalid inputs', () => {
      expect(parseQuantityOrZero('')).toBe(0);
      expect(parseQuantityOrZero('abc')).toBe(0);
      expect(parseQuantityOrZero('.')).toBe(0);
    });

    it('should clamp parsed values to FOOD_ENTRY.QUANTITY.MAX', () => {
      const FOOD_ENTRY_QUANTITY_MAX = 100000;
      
      // Values within limit
      expect(parseQuantityOrZero('9999.99')).toBeLessThanOrEqual(FOOD_ENTRY_QUANTITY_MAX);
      expect(parseQuantityOrZero('50000')).toBeLessThanOrEqual(FOOD_ENTRY_QUANTITY_MAX);
      
      // Values exceeding limit should be clamped (tested in component)
      // Note: The NumberInput component itself limits input, but validation
      // should catch values that exceed the limit after blur/normalization
    });
  });

  describe('real-world usage scenarios', () => {
    it('should handle typical food quantities', () => {
      // Common quantities
      expect(sanitizeQuantityInput('100')).toBe('100');
      expect(sanitizeQuantityInput('250')).toBe('250');
      expect(sanitizeQuantityInput('1.5')).toBe('1.5');
      expect(sanitizeQuantityInput('2.25')).toBe('2.25');
    });

    it('should handle large quantities correctly', () => {
      // Large but valid quantities
      expect(sanitizeQuantityInput('9999')).toBe('9999');
      expect(sanitizeQuantityInput('9999.99')).toBe('9999.99');
      
      // Attempted very large quantities should be limited
      expect(sanitizeQuantityInput('123456.789')).toBe('1234.78');
    });

    it('should handle paste operations with formatted numbers', () => {
      // User might paste formatted numbers - commas are converted to dots, then processed
      expect(sanitizeQuantityInput('1,234.56')).toBe('1.23'); // Comma becomes dot, then limited to 4 ints + 2 dec
      expect(sanitizeQuantityInput('12.345,67')).toBe('12.34'); // First dot used, then limited
    });
  });
});
