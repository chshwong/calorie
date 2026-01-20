/**
 * Unit tests for AI Custom Food Parser
 *
 * Tests cover:
 * - Required fields parsing
 * - Serving unit validation
 * - Optional nutrient warnings
 */

import { describe, it, expect } from 'vitest';
import { parseAICustomFoodReply } from '../aiCustomFoodParser';

describe('parseAICustomFoodReply', () => {
  it('parses valid nutrition label payload', () => {
    const text = `FOOD_NAME: Chocolate Bar
BRAND: SnackCo
SERVING_SIZE: 50
SERVING_UNIT: g
TOTAL_KCAL: 250
Protein_G: 3.5
Total_Carb_G: 30.2
Total_Fat_G: 12.1
FIBRE_G: 2
Saturated_Fat_G: 7.5
Trans_Fat_G: 0
Total_Sugar_G: 25.0
SODIUM_MG: 120`;

    const result = parseAICustomFoodReply(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.foodName).toBe('Chocolate Bar');
      expect(result.data.brand).toBe('SnackCo');
      expect(result.data.servingSize).toBe(50);
      expect(result.data.servingUnit).toBe('g');
      expect(result.data.totalKcal).toBe(250);
      expect(result.data.proteinG).toBe(3.5);
      expect(result.data.carbsG).toBe(30.2);
      expect(result.data.fatG).toBe(12.1);
      expect(result.data.fibreG).toBe(2);
      expect(result.data.saturatedFatG).toBe(7.5);
      expect(result.data.totalSugarG).toBe(25.0);
      expect(result.data.sodiumMg).toBe(120);
    }
  });

  it('allows blank FOOD_NAME only when option enabled', () => {
    const text = `FOOD_NAME:
SERVING_SIZE: 100
SERVING_UNIT: g
TOTAL_KCAL: 180`;

    const strictResult = parseAICustomFoodReply(text);
    expect(strictResult.ok).toBe(false);

    const relaxedResult = parseAICustomFoodReply(text, { allowBlankFoodName: true });
    expect(relaxedResult.ok).toBe(true);
    if (relaxedResult.ok) {
      expect(relaxedResult.data.foodName).toBe('');
    }
  });

  it('errors on unknown serving unit', () => {
    const text = `FOOD_NAME: Yogurt
SERVING_SIZE: 150
SERVING_UNIT: bowl
TOTAL_KCAL: 120`;

    const result = parseAICustomFoodReply(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'SERVING_UNIT')).toBe(true);
    }
  });

  it('errors when required fields are missing', () => {
    const text = `FOOD_NAME: Granola Bar
SERVING_UNIT: g
TOTAL_KCAL: 180`;

    const result = parseAICustomFoodReply(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'SERVING_SIZE')).toBe(true);
    }
  });

  it('warns and ignores out-of-range optional fields', () => {
    const text = `FOOD_NAME: Protein Shake
SERVING_SIZE: 250
SERVING_UNIT: ml
TOTAL_KCAL: 220
Protein_G: 99999`;

    const result = parseAICustomFoodReply(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proteinG).toBeUndefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});
