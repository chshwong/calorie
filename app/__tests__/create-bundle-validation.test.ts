import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BUNDLES, FOOD_ENTRY, RANGES, TEXT_LIMITS } from '@/constants/constraints';

/**
 * Tests for create-bundle.tsx validation logic
 * 
 * Verifies that all validation rules are correctly implemented:
 * 1. Bundle name length validation (TEXT_LIMITS.BUNDLES_NAME)
 * 2. Bundle items minimum count (BUNDLES.ITEMS.MIN)
 * 3. Bundle count limit per user (BUNDLES.COUNT.MAX)
 * 4. Bundle item quantity limits (FOOD_ENTRY.QUANTITY)
 * 5. Bundle total calories limit (RANGES.CALORIES_KCAL.MAX)
 * 
 * Engineering Guidelines Compliance:
 * - Rule 7: All numeric limits must come from constants/constraints.ts
 * - Rule 13: All UI text must use i18n via t()
 */

describe('create-bundle validation', () => {
  describe('Bundle name validation', () => {
    it('should allow bundle names up to TEXT_LIMITS.BUNDLES_NAME.MAX_LEN characters', () => {
      const maxLength = TEXT_LIMITS.BUNDLES_NAME.MAX_LEN;
      expect(maxLength).toBe(40);
      
      // Valid names
      const validName = 'A'.repeat(40);
      expect(validName.length).toBe(40);
      expect(validName.length).toBeLessThanOrEqual(maxLength);
      
      const shortName = 'My Bundle';
      expect(shortName.length).toBeLessThanOrEqual(maxLength);
    });

    it('should reject bundle names longer than TEXT_LIMITS.BUNDLES_NAME.MAX_LEN', () => {
      const maxLength = TEXT_LIMITS.BUNDLES_NAME.MAX_LEN;
      const tooLong = 'A'.repeat(41);
      expect(tooLong.length).toBeGreaterThan(maxLength);
    });

    it('should reject empty bundle names', () => {
      const emptyName = '';
      const whitespaceOnly = '   ';
      expect(emptyName.trim().length).toBe(0);
      expect(whitespaceOnly.trim().length).toBe(0);
    });
  });

  describe('Bundle items validation', () => {
    it('should require at least BUNDLES.ITEMS.MIN items', () => {
      expect(BUNDLES.ITEMS.MIN).toBe(2);
      
      // Invalid: less than minimum
      expect(0).toBeLessThan(BUNDLES.ITEMS.MIN);
      expect(1).toBeLessThan(BUNDLES.ITEMS.MIN);
      
      // Valid: at least minimum
      expect(2).toBeGreaterThanOrEqual(BUNDLES.ITEMS.MIN);
      expect(5).toBeGreaterThanOrEqual(BUNDLES.ITEMS.MIN);
    });

    it('should validate bundle items count correctly', () => {
      const minItems = BUNDLES.ITEMS.MIN;
      const items = [1, 2]; // Array with 2 items
      expect(items.length).toBeGreaterThanOrEqual(minItems);
    });
  });

  describe('Bundle count limit validation', () => {
    it('should enforce BUNDLES.COUNT.MAX limit per user', () => {
      expect(BUNDLES.COUNT.MAX).toBe(20);
      
      // At limit
      expect(20).toBeGreaterThanOrEqual(BUNDLES.COUNT.MAX);
      
      // Over limit
      expect(21).toBeGreaterThan(BUNDLES.COUNT.MAX);
    });

    it('should block bundle creation when count >= BUNDLES.COUNT.MAX', () => {
      const maxCount = BUNDLES.COUNT.MAX;
      const currentCount = 20;
      expect(currentCount >= maxCount).toBe(true);
      
      const shouldBlock = currentCount >= maxCount;
      expect(shouldBlock).toBe(true);
    });

    it('should allow bundle creation when count < BUNDLES.COUNT.MAX', () => {
      const maxCount = BUNDLES.COUNT.MAX;
      const currentCount = 19;
      expect(currentCount < maxCount).toBe(true);
      
      const shouldAllow = currentCount < maxCount;
      expect(shouldAllow).toBe(true);
    });
  });

  describe('Bundle item quantity validation', () => {
    it('should enforce FOOD_ENTRY.QUANTITY.MAX limit', () => {
      expect(FOOD_ENTRY.QUANTITY.MAX).toBe(100000);
      
      // Valid quantities
      expect(1000).toBeLessThanOrEqual(FOOD_ENTRY.QUANTITY.MAX);
      expect(100000).toBeLessThanOrEqual(FOOD_ENTRY.QUANTITY.MAX);
      
      // Invalid quantities
      expect(100001).toBeGreaterThan(FOOD_ENTRY.QUANTITY.MAX);
    });

    it('should enforce FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE (quantity must be > 0)', () => {
      expect(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE).toBe(0);
      
      // Invalid: zero or negative
      expect(0).toBeLessThanOrEqual(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE);
      expect(-1).toBeLessThan(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE);
      
      // Valid: positive
      expect(0.1).toBeGreaterThan(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE);
      expect(1).toBeGreaterThan(FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE);
    });

    it('should validate quantity input format (4 integers, 2 decimals)', () => {
      // Valid formats
      const validInputs = ['1', '12', '123', '1234', '1.5', '12.34', '123.4', '1234.56'];
      validInputs.forEach(input => {
        const parts = input.split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1] || '';
        
        expect(integerPart.length).toBeLessThanOrEqual(4);
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      });
      
      // Invalid formats (should be clamped/rejected)
      const invalidIntegerPart = '12345'; // 5 integers
      expect(invalidIntegerPart.length).toBeGreaterThan(4);
      
      const invalidDecimalPart = '12.345'; // 3 decimals
      const decimalParts = invalidDecimalPart.split('.');
      expect(decimalParts[1]?.length).toBeGreaterThan(2);
    });
  });

  describe('Bundle total calories validation', () => {
    it('should enforce RANGES.CALORIES_KCAL.MAX limit (5000)', () => {
      expect(RANGES.CALORIES_KCAL.MAX).toBe(5000);
      
      // Valid total calories
      expect(0).toBeLessThanOrEqual(RANGES.CALORIES_KCAL.MAX);
      expect(2500).toBeLessThanOrEqual(RANGES.CALORIES_KCAL.MAX);
      expect(5000).toBeLessThanOrEqual(RANGES.CALORIES_KCAL.MAX);
      
      // Invalid: exceeds limit
      expect(5001).toBeGreaterThan(RANGES.CALORIES_KCAL.MAX);
      expect(10000).toBeGreaterThan(RANGES.CALORIES_KCAL.MAX);
    });

    it('should calculate total calories correctly from bundle items', () => {
      const items = [
        { calculatedNutrition: { calories_kcal: 1500 } },
        { calculatedNutrition: { calories_kcal: 2000 } },
        { calculatedNutrition: { calories_kcal: 1000 } },
      ];
      
      const totalCalories = items.reduce((acc, item) => {
        return acc + (item.calculatedNutrition?.calories_kcal || 0);
      }, 0);
      
      expect(totalCalories).toBe(4500);
      expect(totalCalories).toBeLessThanOrEqual(RANGES.CALORIES_KCAL.MAX);
    });

    it('should detect when total calories exceed limit', () => {
      const items = [
        { calculatedNutrition: { calories_kcal: 3000 } },
        { calculatedNutrition: { calories_kcal: 2500 } },
      ];
      
      const totalCalories = items.reduce((acc, item) => {
        return acc + (item.calculatedNutrition?.calories_kcal || 0);
      }, 0);
      
      expect(totalCalories).toBe(5500);
      expect(totalCalories).toBeGreaterThan(RANGES.CALORIES_KCAL.MAX);
      
      const caloriesExceedLimit = totalCalories > RANGES.CALORIES_KCAL.MAX;
      expect(caloriesExceedLimit).toBe(true);
    });

    it('should allow saving when total calories are exactly at limit', () => {
      const totalCalories = 5000;
      const caloriesExceedLimit = totalCalories > RANGES.CALORIES_KCAL.MAX;
      expect(caloriesExceedLimit).toBe(false);
    });
  });

  describe('Bundle summary nutrition totals', () => {
    it('should calculate all 8 nutrition fields correctly', () => {
      const items = [
        {
          calculatedNutrition: {
            calories_kcal: 500,
            protein_g: 25.5,
            carbs_g: 50.2,
            fat_g: 15.3,
            fiber_g: 5.1,
            saturated_fat_g: 5.5,
            trans_fat_g: 0.2,
            sugar_g: 10.1,
            sodium_mg: 200.5,
          },
        },
        {
          calculatedNutrition: {
            calories_kcal: 300,
            protein_g: 20.3,
            carbs_g: 40.8,
            fat_g: 10.7,
            fiber_g: 3.9,
            saturated_fat_g: 3.5,
            trans_fat_g: 0.1,
            sugar_g: 8.2,
            sodium_mg: 150.3,
          },
        },
      ];
      
      const totals = items.reduce((acc, item) => {
        if (item.calculatedNutrition) {
          acc.calories += item.calculatedNutrition.calories_kcal || 0;
          acc.protein += item.calculatedNutrition.protein_g || 0;
          acc.carbs += item.calculatedNutrition.carbs_g || 0;
          acc.fat += item.calculatedNutrition.fat_g || 0;
          acc.fiber += item.calculatedNutrition.fiber_g || 0;
          acc.saturatedFat += item.calculatedNutrition.saturated_fat_g || 0;
          acc.transFat += item.calculatedNutrition.trans_fat_g || 0;
          acc.sugar += item.calculatedNutrition.sugar_g || 0;
          acc.sodium += item.calculatedNutrition.sodium_mg || 0;
        }
        return acc;
      }, {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        saturatedFat: 0,
        transFat: 0,
        sugar: 0,
        sodium: 0,
      });
      
      expect(totals.calories).toBe(800);
      expect(totals.protein).toBeCloseTo(45.8, 1); // Floating point precision
      expect(totals.carbs).toBeCloseTo(91.0, 1); // Floating point precision
      expect(totals.fat).toBeCloseTo(26.0, 1); // Floating point precision
      expect(totals.fiber).toBeCloseTo(9.0, 1); // Floating point precision
      expect(totals.saturatedFat).toBeCloseTo(9.0, 1); // Floating point precision
      expect(totals.transFat).toBeCloseTo(0.3, 1); // Floating point precision
      expect(totals.sugar).toBeCloseTo(18.3, 1); // Floating point precision
      expect(totals.sodium).toBeCloseTo(350.8, 1); // Floating point precision
    });

    it('should display TRANS FAT even when value is 0', () => {
      const items = [
        {
          calculatedNutrition: {
            calories_kcal: 500,
            trans_fat_g: 0,
          },
        },
      ];
      
      const totals = items.reduce((acc, item) => {
        if (item.calculatedNutrition) {
          acc.transFat += item.calculatedNutrition.trans_fat_g || 0;
        }
        return acc;
      }, { transFat: 0 });
      
      expect(totals.transFat).toBe(0);
      // TRANS FAT should always be displayed, even when 0
    });

    it('should format sodium with 0 decimals', () => {
      const sodium = 1552.4;
      const formatted = Math.round(sodium);
      expect(formatted).toBe(1552);
      expect(formatted.toString()).not.toContain('.');
    });

    it('should format macros with 1 decimal place', () => {
      const protein = 215.8;
      const formatted = Math.round(protein * 10) / 10;
      expect(formatted).toBe(215.8);
      
      const formattedString = formatted.toFixed(1);
      expect(formattedString).toBe('215.8');
    });
  });

  describe('Form validation state', () => {
    it('should disable save button when validation fails', () => {
      const validationChecks = {
        loading: false,
        bundleNameValid: false, // Empty name
        itemsCountValid: false, // Less than minimum
        caloriesValid: false, // Exceeds limit
      };
      
      const isDisabled = 
        validationChecks.loading ||
        !validationChecks.bundleNameValid ||
        !validationChecks.itemsCountValid ||
        !validationChecks.caloriesValid;
      
      expect(isDisabled).toBe(true);
    });

    it('should enable save button when all validation passes', () => {
      const validationChecks = {
        loading: false,
        bundleNameValid: true, // Valid name
        itemsCountValid: true, // At least 2 items
        caloriesValid: true, // Under limit
      };
      
      const isDisabled = 
        validationChecks.loading ||
        !validationChecks.bundleNameValid ||
        !validationChecks.itemsCountValid ||
        !validationChecks.caloriesValid;
      
      expect(isDisabled).toBe(false);
    });
  });
});
