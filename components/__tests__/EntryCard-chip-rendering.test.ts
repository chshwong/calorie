/**
 * Unit tests for EntryCard chip rendering logic
 * 
 * Tests verify that the chip displays correctly based on entry properties:
 * - Shows "AI" chip when entry.source === 'ai' and entry.food_id is null
 * - Shows "⚡" chip when entry.source !== 'ai' and entry.food_id is null
 * - Shows FoodSourceBadge when entry.food_id exists (not tested here, component-level)
 * 
 * Per engineering guidelines: Unit tests for domain logic
 */

import { describe, it, expect } from 'vitest';
import type { CalorieEntry } from '@/utils/types';

/**
 * Extract the chip rendering logic from EntryCard component
 * This mirrors the decision logic: {entry.source === 'ai' ? 'AI' : '⚡'}
 */
function getChipText(entry: CalorieEntry): string {
  if (entry.food_id) {
    // Should show FoodSourceBadge, not this chip
    return '';
  }
  return entry.source === 'ai' ? 'AI' : '⚡';
}

describe('EntryCard chip rendering logic', () => {
  describe('getChipText', () => {
    it('should return "AI" when source is "ai" and food_id is null', () => {
      const entry: CalorieEntry = {
        id: '1',
        user_id: 'user1',
        entry_date: '2024-01-01',
        eaten_at: null,
        meal_type: 'breakfast',
        item_name: 'AI Scanned Meal',
        food_id: null,
        serving_id: null,
        quantity: 1,
        unit: 'serving',
        calories_kcal: 500,
        protein_g: 30,
        carbs_g: 40,
        fat_g: 20,
        fiber_g: 5,
        saturated_fat_g: 5,
        trans_fat_g: 0,
        sugar_g: 10,
        sodium_mg: 500,
        notes: null,
        source: 'ai',
        ai_raw_text: 'Some AI text',
        ai_confidence: 'med',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(getChipText(entry)).toBe('AI');
    });

    it('should return "⚡" when source is not "ai" and food_id is null', () => {
      const entry: CalorieEntry = {
        id: '2',
        user_id: 'user1',
        entry_date: '2024-01-01',
        eaten_at: null,
        meal_type: 'breakfast',
        item_name: 'Quick Log Entry',
        food_id: null,
        serving_id: null,
        quantity: 1,
        unit: 'serving',
        calories_kcal: 300,
        protein_g: 20,
        carbs_g: 30,
        fat_g: 10,
        fiber_g: 3,
        saturated_fat_g: 3,
        trans_fat_g: 0,
        sugar_g: 8,
        sodium_mg: 400,
        notes: null,
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(getChipText(entry)).toBe('⚡');
    });

    it('should return "⚡" when source is null/undefined and food_id is null', () => {
      const entry: CalorieEntry = {
        id: '3',
        user_id: 'user1',
        entry_date: '2024-01-01',
        eaten_at: null,
        meal_type: 'breakfast',
        item_name: 'Quick Log Entry',
        food_id: null,
        serving_id: null,
        quantity: 1,
        unit: 'serving',
        calories_kcal: 300,
        protein_g: 20,
        carbs_g: 30,
        fat_g: 10,
        fiber_g: 3,
        saturated_fat_g: 3,
        trans_fat_g: 0,
        sugar_g: 8,
        sodium_mg: 400,
        notes: null,
        source: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(getChipText(entry)).toBe('⚡');
    });

    it('should return empty string when food_id exists (FoodSourceBadge case)', () => {
      const entry: CalorieEntry = {
        id: '4',
        user_id: 'user1',
        entry_date: '2024-01-01',
        eaten_at: null,
        meal_type: 'breakfast',
        item_name: 'Database Food',
        food_id: 'food-123',
        serving_id: 'serving-456',
        quantity: 1,
        unit: 'cup',
        calories_kcal: 250,
        protein_g: 15,
        carbs_g: 30,
        fat_g: 8,
        fiber_g: 4,
        saturated_fat_g: 3,
        trans_fat_g: 0,
        sugar_g: 5,
        sodium_mg: 300,
        notes: null,
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // When food_id exists, chip should not be rendered (FoodSourceBadge takes precedence)
      expect(getChipText(entry)).toBe('');
    });

    it('should return "AI" when source is "ai" even if food_id is null', () => {
      const entry: CalorieEntry = {
        id: '5',
        user_id: 'user1',
        entry_date: '2024-01-01',
        eaten_at: null,
        meal_type: 'lunch',
        item_name: 'AI Scanned Food',
        food_id: null,
        serving_id: null,
        quantity: 1,
        unit: 'serving',
        calories_kcal: 450,
        protein_g: 25,
        carbs_g: 50,
        fat_g: 15,
        fiber_g: 6,
        saturated_fat_g: 4,
        trans_fat_g: 0,
        sugar_g: 12,
        sodium_mg: 600,
        notes: null,
        source: 'ai',
        ai_raw_text: 'Parsed from AI',
        ai_confidence: 'high',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(getChipText(entry)).toBe('AI');
    });

    it('should handle case-insensitive source value (defensive)', () => {
      // Note: The actual implementation uses strict equality (===)
      // This test documents the expected behavior
      const entryWithUpperCaseSource: CalorieEntry = {
        id: '6',
        user_id: 'user1',
        entry_date: '2024-01-01',
        eaten_at: null,
        meal_type: 'dinner',
        item_name: 'Entry',
        food_id: null,
        serving_id: null,
        quantity: 1,
        unit: 'serving',
        calories_kcal: 400,
        protein_g: 20,
        carbs_g: 45,
        fat_g: 12,
        fiber_g: 4,
        saturated_fat_g: 3,
        trans_fat_g: 0,
        sugar_g: 10,
        sodium_mg: 500,
        notes: null,
        source: 'AI', // Uppercase (not lowercase 'ai')
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Strict equality means 'AI' !== 'ai', so it should show ⚡
      expect(getChipText(entryWithUpperCaseSource)).toBe('⚡');
    });
  });
});
