import { describe, it, expect } from 'vitest';

/**
 * Tests for MealTotals component sugar field fallback logic
 * 
 * This tests the logic that handles both `total_sugar_g` and `sugar_g` field names
 * which is critical for displaying sugar values correctly in the totals.
 */

describe('MealTotals sugar field fallback logic', () => {
  // Mock the component's internal logic for sugar calculation
  // Using any here is necessary because mealTotals may have total_sugar_g as an optional field
  // that's not in the TypeScript type definition yet (part of migration from sugar_g to total_sugar_g)
  const calculateSugar = (mealTotals: any): number => {
    // Using any cast here is required to access total_sugar_g which may exist at runtime
    // but isn't yet in the type definition (Guideline 17: any must be justified with comments)
    return (mealTotals as any).total_sugar_g ?? mealTotals.sugar_g ?? 0;
  };

  describe('sugar field fallback', () => {
    it('prefers total_sugar_g when both fields exist', () => {
      const mealTotals = {
        total_sugar_g: 15,
        sugar_g: 10,
      };
      expect(calculateSugar(mealTotals)).toBe(15);
    });

    it('falls back to sugar_g when total_sugar_g is missing', () => {
      const mealTotals = {
        sugar_g: 10,
      };
      expect(calculateSugar(mealTotals)).toBe(10);
    });

    it('falls back to 0 when both fields are missing', () => {
      const mealTotals = {};
      expect(calculateSugar(mealTotals)).toBe(0);
    });

    it('handles null total_sugar_g and uses sugar_g', () => {
      const mealTotals = {
        total_sugar_g: null,
        sugar_g: 10,
      };
      expect(calculateSugar(mealTotals)).toBe(10);
    });

    it('handles null sugar_g and uses total_sugar_g', () => {
      const mealTotals = {
        total_sugar_g: 15,
        sugar_g: null,
      };
      expect(calculateSugar(mealTotals)).toBe(15);
    });

    it('handles both fields as null and returns 0', () => {
      const mealTotals = {
        total_sugar_g: null,
        sugar_g: null,
      };
      expect(calculateSugar(mealTotals)).toBe(0);
    });

    it('handles zero values correctly', () => {
      const mealTotals = {
        total_sugar_g: 0,
        sugar_g: 5,
      };
      expect(calculateSugar(mealTotals)).toBe(0); // 0 is a valid value, so it's used
    });

    it('handles undefined total_sugar_g (field not present)', () => {
      const mealTotals = {
        sugar_g: 10,
        // total_sugar_g is not defined
      };
      expect(calculateSugar(mealTotals)).toBe(10);
    });
  });

  describe('real-world scenarios', () => {
    it('handles AI quick log entries with total_sugar_g', () => {
      // AI entries might use total_sugar_g field name
      const mealTotals = {
        kcal: 500,
        protein_g: 20,
        carbs_g: 50,
        fat_g: 15,
        total_sugar_g: 25, // AI uses this field name
        sugar_g: undefined,
      };
      expect(calculateSugar(mealTotals)).toBe(25);
    });

    it('handles legacy entries with only sugar_g', () => {
      // Older entries might only have sugar_g
      const mealTotals = {
        kcal: 500,
        protein_g: 20,
        carbs_g: 50,
        fat_g: 15,
        sugar_g: 20, // Legacy field name
        // total_sugar_g is not present
      };
      expect(calculateSugar(mealTotals)).toBe(20);
    });

    it('handles entries with no sugar data', () => {
      const mealTotals = {
        kcal: 500,
        protein_g: 20,
        carbs_g: 50,
        fat_g: 15,
        // No sugar fields at all
      };
      expect(calculateSugar(mealTotals)).toBe(0);
    });
  });
});
