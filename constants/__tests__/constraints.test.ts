import { describe, it, expect } from 'vitest';
import { BUNDLES, FOOD_ENTRY, RANGES, TEXT_LIMITS } from '../constraints';

/**
 * Tests for constants/constraints.ts
 * 
 * Verifies that all validation limits are properly centralized and match
 * the expected values used throughout the application.
 * 
 * Engineering Guidelines Compliance:
 * - Rule 7: All numeric limits must come from constants/constraints.ts
 * - No hardcoded values should exist in components
 */

describe('constants/constraints.ts', () => {
  describe('BUNDLES', () => {
    it('should have COUNT.MAX of 20', () => {
      expect(BUNDLES.COUNT.MAX).toBe(20);
    });

    it('should have ITEMS.MIN of 2', () => {
      expect(BUNDLES.ITEMS.MIN).toBe(2);
    });

    it('should export BUNDLES constant', () => {
      expect(BUNDLES).toBeDefined();
      expect(BUNDLES.COUNT).toBeDefined();
      expect(BUNDLES.ITEMS).toBeDefined();
    });
  });

  describe('FOOD_ENTRY', () => {
    it('should have QUANTITY.MAX of 100000', () => {
      expect(FOOD_ENTRY.QUANTITY.MAX).toBe(100000);
    });

    it('should have QUANTITY.MIN_EXCLUSIVE of 0', () => {
      expect(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE).toBe(0);
    });

    it('should have MACRO_G.MAX of 9999.99', () => {
      expect(FOOD_ENTRY.MACRO_G.MAX).toBe(9999.99);
    });

    it('should have MACRO_G.MIN of 0', () => {
      expect(FOOD_ENTRY.MACRO_G.MIN).toBe(0);
    });
  });

  describe('RANGES', () => {
    it('should have CALORIES_KCAL.MAX of 5000', () => {
      expect(RANGES.CALORIES_KCAL.MAX).toBe(5000);
    });

    it('should have CALORIES_KCAL.MIN of 0', () => {
      expect(RANGES.CALORIES_KCAL.MIN).toBe(0);
    });
  });

  describe('TEXT_LIMITS', () => {
    it('should have BUNDLES_NAME.MAX_LEN of 40', () => {
      expect(TEXT_LIMITS.BUNDLES_NAME.MAX_LEN).toBe(40);
    });

    it('should have BUNDLES_NAME.MIN_LEN of 1', () => {
      expect(TEXT_LIMITS.BUNDLES_NAME.MIN_LEN).toBe(1);
    });
  });

  describe('Constraint consistency', () => {
    it('should have FOOD_ENTRY.QUANTITY.MAX equal to expected value used in bundle validation', () => {
      // Bundle items use FOOD_ENTRY.QUANTITY.MAX for quantity validation
      expect(FOOD_ENTRY.QUANTITY.MAX).toBe(100000);
    });

    it('should have RANGES.CALORIES_KCAL.MAX equal to bundle calorie limit', () => {
      // Bundle summary validation uses RANGES.CALORIES_KCAL.MAX (5000)
      expect(RANGES.CALORIES_KCAL.MAX).toBe(5000);
    });

    it('should have BUNDLES.ITEMS.MIN equal to minimum bundle items required', () => {
      // Bundle validation requires at least BUNDLES.ITEMS.MIN items
      expect(BUNDLES.ITEMS.MIN).toBe(2);
    });

    it('should have BUNDLES.COUNT.MAX equal to maximum bundles per user', () => {
      // Bundle creation is limited to BUNDLES.COUNT.MAX per user
      expect(BUNDLES.COUNT.MAX).toBe(20);
    });
  });
});
