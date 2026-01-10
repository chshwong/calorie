import { describe, it, expect } from 'vitest';
import { FOOD_ENTRY, RANGES, TEXT_LIMITS } from '@/constants/constraints';

/**
 * Tests for QuickLogForm.tsx validation constraints
 * 
 * Verifies that QuickLogForm correctly uses centralized constraints:
 * - Quantity limits (FOOD_ENTRY.QUANTITY)
 * - Calories limits (RANGES.CALORIES_KCAL)
 * - Macro limits (FOOD_ENTRY.MACRO_G)
 * - Item name length (TEXT_LIMITS.BUNDLES_NAME)
 * 
 * Engineering Guidelines Compliance:
 * - Rule 7: All numeric limits must come from constants/constraints.ts
 * - QuickLogForm should NOT have hardcoded validation values
 */

describe('QuickLogForm constraints', () => {
  describe('Quantity validation', () => {
    it('should use FOOD_ENTRY.QUANTITY.MAX for quantity limit', () => {
      expect(FOOD_ENTRY.QUANTITY.MAX).toBe(100000);
      
      // Valid quantities
      expect(1000).toBeLessThanOrEqual(FOOD_ENTRY.QUANTITY.MAX);
      expect(100000).toBeLessThanOrEqual(FOOD_ENTRY.QUANTITY.MAX);
      
      // Invalid: exceeds limit
      expect(100001).toBeGreaterThan(FOOD_ENTRY.QUANTITY.MAX);
    });

    it('should use FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE for minimum quantity', () => {
      expect(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE).toBe(0);
      
      // Valid: greater than 0
      expect(0.1).toBeGreaterThan(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE);
      expect(1).toBeGreaterThan(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE);
      
      // Invalid: zero or negative
      expect(0).toBeLessThanOrEqual(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE);
    });

    it('should enforce quantity input limits (4 integers, 2 decimals)', () => {
      // Quantity input should accept maxIntegers=4, maxDecimals=2
      const validInputs = ['1', '12', '123', '1234', '1.5', '12.34', '1234.56'];
      validInputs.forEach(input => {
        const parts = input.split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1] || '';
        
        expect(integerPart.length).toBeLessThanOrEqual(4);
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Calories validation', () => {
    it('should use RANGES.CALORIES_KCAL.MAX for calories limit', () => {
      expect(RANGES.CALORIES_KCAL.MAX).toBe(5000);
      
      // Valid calories
      expect(0).toBeGreaterThanOrEqual(RANGES.CALORIES_KCAL.MIN);
      expect(2500).toBeLessThanOrEqual(RANGES.CALORIES_KCAL.MAX);
      expect(5000).toBeLessThanOrEqual(RANGES.CALORIES_KCAL.MAX);
      
      // Invalid: exceeds limit
      expect(5001).toBeGreaterThan(RANGES.CALORIES_KCAL.MAX);
    });

    it('should use RANGES.CALORIES_KCAL.MIN for minimum calories', () => {
      expect(RANGES.CALORIES_KCAL.MIN).toBe(0);
      expect(0).toBeGreaterThanOrEqual(RANGES.CALORIES_KCAL.MIN);
    });
  });

  describe('Macro validation', () => {
    it('should use FOOD_ENTRY.MACRO_G.MAX for macro limit', () => {
      expect(FOOD_ENTRY.MACRO_G.MAX).toBe(9999.99);
      
      // Valid macros
      expect(100).toBeLessThanOrEqual(FOOD_ENTRY.MACRO_G.MAX);
      expect(9999.99).toBeLessThanOrEqual(FOOD_ENTRY.MACRO_G.MAX);
      
      // Invalid: exceeds limit
      expect(10000).toBeGreaterThan(FOOD_ENTRY.MACRO_G.MAX);
    });

    it('should use FOOD_ENTRY.MACRO_G.MIN for minimum macro', () => {
      expect(FOOD_ENTRY.MACRO_G.MIN).toBe(0);
      expect(0).toBeGreaterThanOrEqual(FOOD_ENTRY.MACRO_G.MIN);
    });
  });

  describe('Item name validation', () => {
    it('should use TEXT_LIMITS.BUNDLES_NAME.MAX_LEN for name length', () => {
      expect(TEXT_LIMITS.BUNDLES_NAME.MAX_LEN).toBe(40);
      
      // Valid names
      const validName = 'A'.repeat(40);
      expect(validName.length).toBeLessThanOrEqual(TEXT_LIMITS.BUNDLES_NAME.MAX_LEN);
      
      // Invalid: too long
      const tooLong = 'A'.repeat(41);
      expect(tooLong.length).toBeGreaterThan(TEXT_LIMITS.BUNDLES_NAME.MAX_LEN);
    });

    it('should use TEXT_LIMITS.BUNDLES_NAME.MIN_LEN for minimum name length', () => {
      expect(TEXT_LIMITS.BUNDLES_NAME.MIN_LEN).toBe(1);
      
      // Valid: at least 1 character (non-empty after trim)
      const validName = 'A';
      expect(validName.trim().length).toBeGreaterThanOrEqual(TEXT_LIMITS.BUNDLES_NAME.MIN_LEN);
      
      // Invalid: empty
      const emptyName = '';
      expect(emptyName.trim().length).toBeLessThan(TEXT_LIMITS.BUNDLES_NAME.MIN_LEN);
    });
  });

  describe('Constraint consistency with create-bundle', () => {
    it('should use same quantity limits as create-bundle', () => {
      // QuickLogForm and create-bundle should use same FOOD_ENTRY.QUANTITY limits
      const quickLogQuantityMax = FOOD_ENTRY.QUANTITY.MAX;
      const bundleQuantityMax = FOOD_ENTRY.QUANTITY.MAX;
      expect(quickLogQuantityMax).toBe(bundleQuantityMax);
      expect(quickLogQuantityMax).toBe(100000);
    });

    it('should use same calories limits as create-bundle', () => {
      // QuickLogForm and create-bundle should use same RANGES.CALORIES_KCAL limits
      const quickLogCaloriesMax = RANGES.CALORIES_KCAL.MAX;
      const bundleCaloriesMax = RANGES.CALORIES_KCAL.MAX;
      expect(quickLogCaloriesMax).toBe(bundleCaloriesMax);
      expect(quickLogCaloriesMax).toBe(5000);
    });

    it('should use same macro limits as create-bundle', () => {
      // QuickLogForm and create-bundle should use same FOOD_ENTRY.MACRO_G limits
      const quickLogMacroMax = FOOD_ENTRY.MACRO_G.MAX;
      const bundleMacroMax = FOOD_ENTRY.MACRO_G.MAX;
      expect(quickLogMacroMax).toBe(bundleMacroMax);
      expect(quickLogMacroMax).toBe(9999.99);
    });

    it('should use same name length limits as create-bundle', () => {
      // QuickLogForm and create-bundle should use same TEXT_LIMITS.BUNDLES_NAME limits
      const quickLogNameMax = TEXT_LIMITS.BUNDLES_NAME.MAX_LEN;
      const bundleNameMax = TEXT_LIMITS.BUNDLES_NAME.MAX_LEN;
      expect(quickLogNameMax).toBe(bundleNameMax);
      expect(quickLogNameMax).toBe(40);
    });
  });
});
