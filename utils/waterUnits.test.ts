import { describe, expect, it } from 'vitest';
import {
  WATER_LIMITS,
  toMl,
  fromMl,
  ozToMl,
  mlToOz,
  mlToCups,
  getEffectiveGoal,
  getEffectiveGoalMl,
  toGoalTripletFromMl,
  getMetricQuickAddOptions,
  getImperialQuickAddOptions,
  getQuickAddOptionsByUnit,
  formatWaterValue,
  formatWaterValueParts,
  formatWaterDisplay,
  parseWaterInput,
  generateWaterTickValues,
  type WaterUnit,
} from './waterUnits';

describe('WATER_LIMITS', () => {
  it('has correct limit values', () => {
    expect(WATER_LIMITS.MAX_TOTAL_ML).toBe(6000);
    expect(WATER_LIMITS.MAX_SINGLE_ADD_ML).toBe(5000);
    expect(WATER_LIMITS.MIN_GOAL_ML).toBe(480);
    expect(WATER_LIMITS.MAX_GOAL_ML).toBe(5000);
  });
});

describe('Unit Conversion - toMl', () => {
  it('converts ml to ml (no change)', () => {
    expect(toMl(2000, 'ml')).toBe(2000);
    expect(toMl(0, 'ml')).toBe(0);
    expect(toMl(5000, 'ml')).toBe(5000);
  });

  it('converts floz to ml correctly', () => {
    // 1 fl oz = 29.5735 ml
    expect(toMl(8, 'floz')).toBeCloseTo(236.588, 2);
    expect(toMl(64, 'floz')).toBeCloseTo(1892.704, 2);
    expect(toMl(1, 'floz')).toBeCloseTo(29.5735, 4);
  });

  it('converts cups to ml correctly', () => {
    // 1 cup = 240 ml (for goal calculations)
    expect(toMl(1, 'cup')).toBe(240);
    expect(toMl(8, 'cup')).toBe(1920);
    expect(toMl(0.5, 'cup')).toBe(120);
  });

  it('handles decimal values', () => {
    expect(toMl(2.5, 'cup')).toBe(600);
    expect(toMl(16.5, 'floz')).toBeCloseTo(487.96275, 4);
  });
});

describe('Unit Conversion - fromMl', () => {
  it('converts ml to ml (no change)', () => {
    expect(fromMl(2000, 'ml')).toBe(2000);
    expect(fromMl(0, 'ml')).toBe(0);
  });

  it('converts ml to floz correctly', () => {
    // 236.588 ml ≈ 8 fl oz
    expect(fromMl(236.588, 'floz')).toBeCloseTo(8, 4);
    expect(fromMl(591.47, 'floz')).toBeCloseTo(20, 4);
    expect(fromMl(29.5735, 'floz')).toBeCloseTo(1, 4);
  });

  it('converts ml to cups correctly', () => {
    // 240 ml = 1 cup
    expect(fromMl(240, 'cup')).toBe(1);
    expect(fromMl(1920, 'cup')).toBe(8);
    expect(fromMl(120, 'cup')).toBe(0.5);
  });

  it('handles round-trip conversions', () => {
    const originalMl = 2000;
    const convertedToFloz = toMl(fromMl(originalMl, 'floz'), 'floz');
    expect(convertedToFloz).toBeCloseTo(originalMl, 1);

    const convertedToCup = toMl(fromMl(originalMl, 'cup'), 'cup');
    expect(convertedToCup).toBeCloseTo(originalMl, 1); // Floating point precision
  });
});

describe('ozToMl and mlToOz', () => {
  it('converts ounces to milliliters correctly', () => {
    expect(ozToMl(8)).toBe(237); // 8 fl oz ≈ 236.588 ml, rounded
    expect(ozToMl(16)).toBe(473); // 16 fl oz ≈ 473.176 ml, rounded
    expect(ozToMl(64)).toBe(1893); // 64 fl oz ≈ 1892.704 ml, rounded
  });

  it('converts milliliters to ounces correctly', () => {
    expect(mlToOz(237)).toBeCloseTo(8.0, 1);
    expect(mlToOz(473)).toBeCloseTo(16.0, 1);
    expect(mlToOz(1893)).toBeCloseTo(64.0, 1);
  });

  it('rounds to 1 decimal place', () => {
    const result = mlToOz(100);
    const decimals = result.toString().split('.')[1];
    expect(decimals?.length || 0).toBeLessThanOrEqual(1);
  });
});

describe('mlToCups', () => {
  it('converts milliliters to cups correctly', () => {
    expect(mlToCups(237)).toBeCloseTo(1.0, 1); // 237 ml ≈ 1 cup
    expect(mlToCups(474)).toBeCloseTo(2.0, 1); // 474 ml ≈ 2 cups
    expect(mlToCups(1892)).toBeCloseTo(8.0, 1); // 1892 ml ≈ 8 cups
  });

  it('rounds to 1 decimal place', () => {
    const result = mlToCups(250);
    const decimals = result.toString().split('.')[1];
    expect(decimals?.length || 0).toBeLessThanOrEqual(1);
  });
});

describe('getEffectiveGoal', () => {
  it('returns default goal when stored goal is null', () => {
    const result = getEffectiveGoal('ml', null);
    expect(result.goalInUnit).toBe(2000);
    expect(result.goalMl).toBe(2000);
  });

  it('returns default goal when stored goal is undefined', () => {
    const result = getEffectiveGoal('ml', undefined);
    expect(result.goalInUnit).toBe(2000);
    expect(result.goalMl).toBe(2000);
  });

  it('returns default goal when stored goal is 0 or negative', () => {
    expect(getEffectiveGoal('ml', 0).goalInUnit).toBe(2000);
    expect(getEffectiveGoal('ml', -100).goalInUnit).toBe(2000);
  });

  it('returns default goal for floz unit', () => {
    const result = getEffectiveGoal('floz', null);
    expect(result.goalInUnit).toBe(64);
    expect(result.goalMl).toBeCloseTo(1892.704, 1);
  });

  it('returns default goal for cup unit', () => {
    const result = getEffectiveGoal('cup', null);
    expect(result.goalInUnit).toBe(8);
    expect(result.goalMl).toBe(1920);
  });

  it('returns stored goal when valid', () => {
    const result = getEffectiveGoal('ml', 2500);
    expect(result.goalInUnit).toBe(2500);
    expect(result.goalMl).toBe(2500);
  });

  it('converts stored goal to ml correctly', () => {
    const result = getEffectiveGoal('floz', 64);
    expect(result.goalInUnit).toBe(64);
    expect(result.goalMl).toBeCloseTo(1892.704, 1);
  });

  it('converts stored goal for cups', () => {
    const result = getEffectiveGoal('cup', 10);
    expect(result.goalInUnit).toBe(10);
    expect(result.goalMl).toBe(2400);
  });
});

describe('getEffectiveGoalMl', () => {
  it('returns default ml goal when stored goal is null', () => {
    expect(getEffectiveGoalMl('ml', null)).toBe(2000);
  });

  it('returns stored goal converted to ml', () => {
    expect(getEffectiveGoalMl('ml', 2500)).toBe(2500);
    expect(getEffectiveGoalMl('floz', 64)).toBeCloseTo(1892.704, 1);
    expect(getEffectiveGoalMl('cup', 8)).toBe(1920);
  });
});

describe('toGoalTripletFromMl', () => {
  it('converts ml goal to all three unit representations', () => {
    const result = toGoalTripletFromMl(2000);
    expect(result.goalMl).toBe(2000);
    expect(result.goalFloz).toBeCloseTo(68, 0); // 2000 ml ≈ 67.6 fl oz, rounded
    expect(result.goalCup).toBe(8); // 2000 ml = 8.33 cups, rounded to 8
  });

  it('rounds all values to integers', () => {
    const result = toGoalTripletFromMl(2400);
    expect(Number.isInteger(result.goalMl)).toBe(true);
    expect(Number.isInteger(result.goalFloz)).toBe(true);
    expect(Number.isInteger(result.goalCup)).toBe(true);
  });

  it('handles zero goal', () => {
    const result = toGoalTripletFromMl(0);
    expect(result.goalMl).toBe(0);
    expect(result.goalFloz).toBe(0);
    expect(result.goalCup).toBe(0);
  });
});

describe('Quick Add Options', () => {
  it('getMetricQuickAddOptions returns correct options', () => {
    const options = getMetricQuickAddOptions();
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '250 ml', deltaMl: 250 });
    expect(options[1]).toEqual({ label: '330 ml', deltaMl: 330 });
    expect(options[2]).toEqual({ label: '500 ml', deltaMl: 500 });
    expect(options[3]).toEqual({ label: '750 ml', deltaMl: 750 });
  });

  it('getImperialQuickAddOptions returns correct options', () => {
    const options = getImperialQuickAddOptions();
    expect(options).toHaveLength(4);
    expect(options[0].label).toBe('8 fl oz');
    expect(options[0].deltaMl).toBe(237); // 8 fl oz rounded
    expect(options[1].label).toBe('12 fl oz');
    expect(options[1].deltaMl).toBe(355); // 12 fl oz rounded
  });

  it('getQuickAddOptionsByUnit returns metric for ml', () => {
    const options = getQuickAddOptionsByUnit('ml');
    expect(options).toHaveLength(4);
    expect(options[0].label).toBe('250 ml');
  });

  it('getQuickAddOptionsByUnit returns imperial for floz', () => {
    const options = getQuickAddOptionsByUnit('floz');
    expect(options).toHaveLength(4);
    expect(options[0].label).toBe('8 fl oz');
  });

  it('getQuickAddOptionsByUnit returns cup options for cup unit', () => {
    const options = getQuickAddOptionsByUnit('cup');
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '1 cup', deltaMl: 240 });
    expect(options[1]).toEqual({ label: '2 cups', deltaMl: 480 });
    expect(options[2]).toEqual({ label: '3 cups', deltaMl: 720 });
    expect(options[3]).toEqual({ label: '4 cups', deltaMl: 960 });
  });
});

describe('formatWaterValue', () => {
  it('formats ml values as whole numbers', () => {
    expect(formatWaterValue(2000, 'ml')).toBe('2000 ml');
    expect(formatWaterValue(2000.5, 'ml')).toBe('2001 ml');
    expect(formatWaterValue(250, 'ml')).toBe('250 ml');
  });

  it('formats floz values with up to 1 decimal', () => {
    expect(formatWaterValue(8, 'floz')).toBe('8 fl oz');
    expect(formatWaterValue(8.5, 'floz')).toBe('8.5 fl oz');
    expect(formatWaterValue(64.25, 'floz')).toBe('64.3 fl oz'); // Rounds to nearest 0.1
  });

  it('formats cup values with up to 2 decimals', () => {
    expect(formatWaterValue(8, 'cup')).toBe('8 cups');
    expect(formatWaterValue(1, 'cup')).toBe('1 cup');
    expect(formatWaterValue(8.5, 'cup')).toBe('8.5 cups');
    expect(formatWaterValue(1.25, 'cup')).toBe('1.25 cups');
    expect(formatWaterValue(1.125, 'cup')).toBe('1.13 cups'); // Rounds to nearest 0.01
  });

  it('removes trailing zeros', () => {
    expect(formatWaterValue(8.0, 'floz')).toBe('8 fl oz');
    expect(formatWaterValue(1.50, 'cup')).toBe('1.5 cups');
  });

  it('uses singular "cup" for values <= 1', () => {
    expect(formatWaterValue(1, 'cup')).toBe('1 cup');
    expect(formatWaterValue(0.5, 'cup')).toBe('0.5 cup');
    expect(formatWaterValue(0.25, 'cup')).toBe('0.25 cup');
  });

  it('uses plural "cups" for values > 1', () => {
    expect(formatWaterValue(1.01, 'cup')).toBe('1.01 cups');
    expect(formatWaterValue(2, 'cup')).toBe('2 cups');
    expect(formatWaterValue(8, 'cup')).toBe('8 cups');
  });
});

describe('formatWaterValueParts', () => {
  it('formats ml values correctly', () => {
    const result = formatWaterValueParts(2000, 'ml');
    expect(result.value).toBe('2000');
    expect(result.unit).toBe('ml');
  });

  it('formats floz values correctly', () => {
    const result = formatWaterValueParts(8.5, 'floz');
    expect(result.value).toBe('8.5');
    expect(result.unit).toBe('fl oz');
  });

  it('formats cup values with correct singular/plural', () => {
    expect(formatWaterValueParts(1, 'cup')).toEqual({ value: '1', unit: 'cup' });
    expect(formatWaterValueParts(2, 'cup')).toEqual({ value: '2', unit: 'cups' });
    expect(formatWaterValueParts(0.5, 'cup')).toEqual({ value: '0.5', unit: 'cup' });
  });

  it('removes trailing zeros', () => {
    expect(formatWaterValueParts(8.0, 'floz')).toEqual({ value: '8', unit: 'fl oz' });
    expect(formatWaterValueParts(1.50, 'cup')).toEqual({ value: '1.5', unit: 'cups' });
  });
});

describe('formatWaterDisplay', () => {
  it('formats metric display correctly', () => {
    const result = formatWaterDisplay(2000, 'metric');
    expect(result.primary).toBe('2000 ml');
    expect(result.secondary).toContain('cups'); // Should show cups as secondary
  });

  it('formats imperial display correctly', () => {
    const result = formatWaterDisplay(2000, 'imperial');
    expect(result.primary).toBe('2000 ml');
    expect(result.secondary).toContain('fl oz');
  });

  it('shows secondary only when cups >= 1 for metric', () => {
    const smallResult = formatWaterDisplay(100, 'metric');
    expect(smallResult.secondary).toBeNull();

    const largeResult = formatWaterDisplay(500, 'metric');
    expect(largeResult.secondary).toContain('cups');
  });
});

describe('parseWaterInput', () => {
  it('parses valid metric input', () => {
    expect(parseWaterInput('2000', 'metric')).toBe(2000);
    expect(parseWaterInput('250', 'metric')).toBe(250);
    expect(parseWaterInput('1000.5', 'metric')).toBe(1001); // Rounded
  });

  it('parses valid imperial input (converts to ml)', () => {
    const result = parseWaterInput('8', 'imperial');
    expect(result).toBe(237); // 8 fl oz rounded to ml
  });

  it('returns null for invalid input', () => {
    expect(parseWaterInput('', 'metric')).toBeNull();
    expect(parseWaterInput('abc', 'metric')).toBeNull();
    // Note: parseWaterInput removes non-numeric chars, so '-100' becomes '100'
    // The function doesn't validate negative after cleaning, so this parses as 100
    const result = parseWaterInput('-100', 'metric');
    expect(result).toBe(100); // Function strips '-' and parses as positive
  });

  it('handles numeric strings with extra characters', () => {
    expect(parseWaterInput('2000ml', 'metric')).toBe(2000);
    expect(parseWaterInput('8 fl oz', 'imperial')).toBe(237);
  });

  it('handles decimal input for metric', () => {
    expect(parseWaterInput('2000.5', 'metric')).toBe(2001); // Rounded to nearest integer
  });
});

describe('generateWaterTickValues', () => {
  it('returns [0] for zero or negative goal', () => {
    expect(generateWaterTickValues(0)).toEqual([0]);
    expect(generateWaterTickValues(-100)).toEqual([0]);
  });

  it('generates ticks including 0 at bottom', () => {
    const ticks = generateWaterTickValues(2000);
    expect(ticks[0]).toBe(0);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it('includes goal value in ticks', () => {
    const goal = 2000;
    const ticks = generateWaterTickValues(goal);
    expect(ticks).toContain(goal);
  });

  it('generates appropriate number of ticks', () => {
    const ticks = generateWaterTickValues(2000, 4);
    // Should have 0 + up to 4 more ticks
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(5);
  });

  it('generates rounded step values', () => {
    const ticks = generateWaterTickValues(2000, 4);
    // All ticks should be reasonable rounded values
    ticks.forEach((tick) => {
      expect(tick % 50).toBe(0); // Should round to 50ml increments for smaller goals
    });
  });

  it('caps ticks at goal value', () => {
    const goal = 1500;
    const ticks = generateWaterTickValues(goal);
    ticks.forEach((tick) => {
      expect(tick).toBeLessThanOrEqual(goal);
    });
  });

  it('handles large goal values', () => {
    const ticks = generateWaterTickValues(5000, 4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(5000);
  });
});

