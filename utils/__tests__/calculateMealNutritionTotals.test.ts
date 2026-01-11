import { describe, it, expect } from 'vitest';
import { calculateMealNutritionTotals } from '../dailyTotals';
import type { CalorieEntry } from '../types';

describe('calculateMealNutritionTotals', () => {
  const createMockEntry = (overrides: Partial<CalorieEntry>): CalorieEntry => ({
    id: '1',
    user_id: 'user-1',
    entry_date: '2025-01-01',
    eaten_at: null,
    meal_type: 'breakfast',
    item_name: 'Test Food',
    food_id: null,
    serving_id: null,
    quantity: 1,
    unit: 'serving',
    calories_kcal: 100,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    fiber_g: 2,
    saturated_fat_g: 1,
    trans_fat_g: 0,
    sugar_g: 5,
    sodium_mg: 100,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  describe('basic calculations', () => {
    it('calculates totals for a single entry', () => {
      const entries = [createMockEntry({})];
      const result = calculateMealNutritionTotals(entries, null);

      expect(result.kcal).toBe(100);
      expect(result.protein_g).toBe(10);
      expect(result.carbs_g).toBe(20);
      expect(result.fat_g).toBe(5);
      expect(result.fiber_g).toBe(2);
      expect(result.saturated_fat_g).toBe(1);
      expect(result.trans_fat_g).toBe(0);
      expect(result.sugar_g).toBe(5);
      expect(result.sodium_mg).toBe(100);
    });

    it('sums multiple entries correctly', () => {
      const entries = [
        createMockEntry({ calories_kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5 }),
        createMockEntry({ calories_kcal: 200, protein_g: 15, carbs_g: 30, fat_g: 8 }),
        createMockEntry({ calories_kcal: 150, protein_g: 12, carbs_g: 25, fat_g: 6 }),
      ];
      const result = calculateMealNutritionTotals(entries, null);

      expect(result.kcal).toBe(450);
      expect(result.protein_g).toBe(37);
      expect(result.carbs_g).toBe(75);
      expect(result.fat_g).toBe(19);
    });

    it('rounds all values to whole numbers', () => {
      const entries = [
        createMockEntry({ 
          protein_g: 10.7, 
          carbs_g: 20.3, 
          fat_g: 5.6,
          fiber_g: 2.4,
          saturated_fat_g: 1.8,
          trans_fat_g: 0.3,
          sugar_g: 5.9,
          sodium_mg: 100.7,
        }),
      ];
      const result = calculateMealNutritionTotals(entries, null);

      expect(result.protein_g).toBe(11);
      expect(result.carbs_g).toBe(20);
      expect(result.fat_g).toBe(6);
      expect(result.fiber_g).toBe(2);
      expect(result.saturated_fat_g).toBe(2);
      expect(result.trans_fat_g).toBe(0);
      expect(result.sugar_g).toBe(6);
      expect(result.sodium_mg).toBe(101);
    });
  });

  describe('null handling', () => {
    it('handles null values by treating them as 0', () => {
      const entries = [
        createMockEntry({
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          fiber_g: null,
          saturated_fat_g: null,
          trans_fat_g: null,
          sugar_g: null,
          sodium_mg: null,
        }),
      ];
      const result = calculateMealNutritionTotals(entries, null);

      expect(result.protein_g).toBe(0);
      expect(result.carbs_g).toBe(0);
      expect(result.fat_g).toBe(0);
      expect(result.fiber_g).toBe(0);
      expect(result.saturated_fat_g).toBe(0);
      expect(result.trans_fat_g).toBe(0);
      expect(result.sugar_g).toBe(0);
      expect(result.sodium_mg).toBe(0);
    });

    it('handles mix of null and numeric values', () => {
      const entries = [
        createMockEntry({ protein_g: 10, carbs_g: null, fat_g: 5 }),
        createMockEntry({ protein_g: null, carbs_g: 20, fat_g: null }),
      ];
      const result = calculateMealNutritionTotals(entries, null);

      expect(result.protein_g).toBe(10);
      expect(result.carbs_g).toBe(20);
      expect(result.fat_g).toBe(5);
    });
  });

  describe('secondary nutrients', () => {
    it('sums saturated fat correctly', () => {
      const entries = [
        createMockEntry({ saturated_fat_g: 2 }),
        createMockEntry({ saturated_fat_g: 3 }),
        createMockEntry({ saturated_fat_g: 1.5 }),
      ];
      const result = calculateMealNutritionTotals(entries, null);
      expect(result.saturated_fat_g).toBe(7); // 2 + 3 + 1.5 = 6.5 → 7
    });

    it('sums trans fat correctly', () => {
      const entries = [
        createMockEntry({ trans_fat_g: 0.5 }),
        createMockEntry({ trans_fat_g: 0.3 }),
        createMockEntry({ trans_fat_g: 0.2 }),
      ];
      const result = calculateMealNutritionTotals(entries, null);
      expect(result.trans_fat_g).toBe(1); // 0.5 + 0.3 + 0.2 = 1.0
    });

    it('sums sugar correctly', () => {
      const entries = [
        createMockEntry({ sugar_g: 5 }),
        createMockEntry({ sugar_g: 10 }),
        createMockEntry({ sugar_g: 3 }),
      ];
      const result = calculateMealNutritionTotals(entries, null);
      expect(result.sugar_g).toBe(18);
    });

    it('sums sodium correctly', () => {
      const entries = [
        createMockEntry({ sodium_mg: 200 }),
        createMockEntry({ sodium_mg: 150 }),
        createMockEntry({ sodium_mg: 100 }),
      ];
      const result = calculateMealNutritionTotals(entries, null);
      expect(result.sodium_mg).toBe(450);
    });
  });

  describe('edge cases', () => {
    it('returns zeros for empty entries array', () => {
      const result = calculateMealNutritionTotals([], null);

      expect(result.kcal).toBe(0);
      expect(result.protein_g).toBe(0);
      expect(result.carbs_g).toBe(0);
      expect(result.fat_g).toBe(0);
      expect(result.fiber_g).toBe(0);
      expect(result.saturated_fat_g).toBe(0);
      expect(result.trans_fat_g).toBe(0);
      expect(result.sugar_g).toBe(0);
      expect(result.sodium_mg).toBe(0);
    });

    it('handles very large values', () => {
      const entries = [
        createMockEntry({
          calories_kcal: 5000,
          protein_g: 500,
          carbs_g: 1000,
          fat_g: 200,
        }),
      ];
      const result = calculateMealNutritionTotals(entries, null);

      expect(result.kcal).toBe(5000);
      expect(result.protein_g).toBe(500);
      expect(result.carbs_g).toBe(1000);
      expect(result.fat_g).toBe(200);
    });

    it('handles decimal values that round correctly', () => {
      const entries = [
        createMockEntry({ protein_g: 10.4 }), // rounds down to 10
        createMockEntry({ protein_g: 10.6 }), // rounds up to 11
      ];
      const result = calculateMealNutritionTotals(entries, null);
      expect(result.protein_g).toBe(21); // 10.4 + 10.6 = 21.0 → 21
    });
  });

  describe('mealMeta parameter', () => {
    it('accepts null mealMeta without error', () => {
      const entries = [createMockEntry({})];
      const result = calculateMealNutritionTotals(entries, null);
      expect(result).toBeDefined();
    });

    it('accepts mealMeta object without error (currently unused)', () => {
      const entries = [createMockEntry({})];
      const mealMeta = { someProperty: 'value' };
      const result = calculateMealNutritionTotals(entries, mealMeta);
      expect(result).toBeDefined();
      // mealMeta is currently unused but function accepts it for future use
    });
  });
});
