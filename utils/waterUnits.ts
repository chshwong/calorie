/**
 * Water Unit Conversion Utilities
 * 
 * All water amounts are stored in ml in the database.
 * This module provides conversion helpers for display and user input.
 */

// Conversion constants
const ML_PER_FL_OZ = 29.5735; // 1 US fluid ounce = 29.5735 ml
const ML_PER_CUP = 240; // 1 US cup = 240 ml (standard for goal calculations)
const ML_PER_CUP_DISPLAY = 236.588; // 1 US cup = 236.588 ml (8 fl oz) for display conversions

/**
 * Convert fluid ounces to milliliters
 */
export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_FL_OZ);
}

/**
 * Convert milliliters to fluid ounces
 */
export function mlToOz(ml: number): number {
  return Math.round((ml / ML_PER_FL_OZ) * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert milliliters to cups (US) - for display
 */
export function mlToCups(ml: number): number {
  return Math.round((ml / ML_PER_CUP_DISPLAY) * 10) / 10; // Round to 1 decimal place
}

/**
 * Water unit type
 */
export type WaterUnit = 'ml' | 'floz' | 'cup';

/**
 * Water validation limits (in ml - canonical unit)
 * These constants define the business rules for water tracking
 */
export const WATER_LIMITS = {
  MAX_TOTAL_ML: 6000,      // Maximum total daily water intake
  MAX_SINGLE_ADD_ML: 5000, // Maximum amount that can be added in a single operation
  MIN_GOAL_ML: 480,        // Minimum water goal
  MAX_GOAL_ML: 5000,        // Maximum water goal
} as const;

/**
 * Convert value from any unit to milliliters (canonical)
 * Preserves full precision for storage (no rounding)
 */
export function toMl(value: number, unit: WaterUnit): number {
  switch (unit) {
    case 'ml':
      return value; // No conversion needed, preserve precision
    case 'floz':
      return value * ML_PER_FL_OZ; // Preserve full precision
    case 'cup':
      return value * ML_PER_CUP; // Preserve full precision
    default:
      return value;
  }
}

/**
 * Convert milliliters to target unit
 * Preserves full precision for storage (no rounding)
 */
export function fromMl(ml: number, targetUnit: WaterUnit): number {
  switch (targetUnit) {
    case 'ml':
      return ml; // No conversion needed, preserve precision
    case 'floz':
      return ml / ML_PER_FL_OZ; // Preserve full precision
    case 'cup':
      return ml / ML_PER_CUP; // Preserve full precision
    default:
      return ml;
  }
}

/**
 * Default water goals by unit (used when no goal is stored)
 * These are fallback values - NOT written to database unless user explicitly sets a goal
 */
const DEFAULT_GOALS: Record<WaterUnit, number> = {
  ml: 2000,
  floz: 64,
  cup: 8,
};

/**
 * Get the effective goal (with fallback to defaults)
 * Returns both the displayed goal in the active unit and the canonical ml goal
 * 
 * @param waterUnit - The active water unit ('ml', 'floz', or 'cup')
 * @param storedGoalInUnit - The stored goal value in the active unit (can be null/undefined)
 * @returns Object with goalInUnit (displayed value) and goalMl (canonical ml value)
 */
export function getEffectiveGoal(
  waterUnit: WaterUnit,
  storedGoalInUnit: number | null | undefined
): { goalInUnit: number; goalMl: number } {
  // If no stored goal, use unit-specific default
  if (storedGoalInUnit === null || storedGoalInUnit === undefined || storedGoalInUnit <= 0) {
    const defaultGoalInUnit = DEFAULT_GOALS[waterUnit];
    const defaultGoalMl = toMl(defaultGoalInUnit, waterUnit);
    return {
      goalInUnit: defaultGoalInUnit,
      goalMl: defaultGoalMl,
    };
  }
  
  // Convert stored goal to ml for canonical value
  const goalMl = toMl(storedGoalInUnit, waterUnit);
  return {
    goalInUnit: storedGoalInUnit,
    goalMl,
  };
}

/**
 * Get the effective goal in ml only (canonical value with fallback)
 * 
 * @param waterUnit - The active water unit
 * @param storedGoalInUnit - The stored goal value in the active unit (can be null/undefined)
 * @returns The goal in ml (canonical)
 */
export function getEffectiveGoalMl(
  waterUnit: WaterUnit,
  storedGoalInUnit: number | null | undefined
): number {
  return getEffectiveGoal(waterUnit, storedGoalInUnit).goalMl;
}

/**
 * Convert goal triplet from canonical ml value
 * Returns all three unit representations as integers
 */
export function toGoalTripletFromMl(goalMl: number): {
  goalMl: number;
  goalFloz: number;
  goalCup: number;
} {
  return {
    goalMl: Math.round(goalMl),
    goalFloz: Math.round(goalMl / ML_PER_FL_OZ),
    goalCup: Math.round(goalMl / ML_PER_CUP),
  };
}

/**
 * Quick-add button options based on unit preference
 */
export type QuickAddOption = {
  label: string;
  deltaMl: number;
};

/**
 * Get quick-add button options for metric system (Europe/NA friendly)
 * Returns buttons with labels in ml
 */
export function getMetricQuickAddOptions(): QuickAddOption[] {
  return [
    { label: '250 ml', deltaMl: 250 }, // Typical glass
    { label: '330 ml', deltaMl: 330 }, // Can / small bottle
    { label: '500 ml', deltaMl: 500 }, // Standard bottle
    { label: '750 ml', deltaMl: 750 }, // Big bottle
  ];
}

/**
 * Get quick-add button options for imperial system (North America)
 * Returns buttons with labels in fl oz, but deltaMl is in ml
 */
export function getImperialQuickAddOptions(): QuickAddOption[] {
  return [
    { label: '8 fl oz', deltaMl: ozToMl(8) },   // ≈ 240 ml
    { label: '12 fl oz', deltaMl: ozToMl(12) }, // ≈ 355 ml
    { label: '16 fl oz', deltaMl: ozToMl(16) }, // ≈ 473 ml
    { label: '20 fl oz', deltaMl: ozToMl(20) }, // ≈ 591 ml
  ];
}

/**
 * Get quick-add options based on user preference (legacy - for backward compatibility)
 */
export function getQuickAddOptions(preference: 'metric' | 'imperial'): QuickAddOption[] {
  return preference === 'metric' 
    ? getMetricQuickAddOptions() 
    : getImperialQuickAddOptions();
}

/**
 * Get quick-add options based on water unit
 */
export function getQuickAddOptionsByUnit(unit: WaterUnit): QuickAddOption[] {
  switch (unit) {
    case 'ml':
      return getMetricQuickAddOptions();
    case 'floz':
      return getImperialQuickAddOptions();
    case 'cup':
      // Cups-based quick-add options
      return [
        { label: '1 cup', deltaMl: toMl(1, 'cup') },
        { label: '2 cups', deltaMl: toMl(2, 'cup') },
        { label: '3 cups', deltaMl: toMl(3, 'cup') },
        { label: '4 cups', deltaMl: toMl(4, 'cup') },
      ];
    default:
      return getMetricQuickAddOptions();
  }
}

/**
 * Format water value for display with unit-specific decimal places
 * ML: 0 decimals (whole numbers)
 * floz: 1 decimal max
 * cups: 2 decimals max
 * Removes trailing zeros
 */
export function formatWaterValueForDisplay(value: number, unit: WaterUnit): string {
  let displayValue: number;
  let formattedValue: string;
  
  switch (unit) {
    case 'ml':
      // Round to whole number (0 decimals)
      displayValue = Math.round(value);
      formattedValue = displayValue.toString();
      return `${formattedValue} ml`;
    case 'floz':
      // Round to 1 decimal max
      displayValue = Math.round(value * 10) / 10;
      formattedValue = displayValue % 1 === 0 
        ? displayValue.toString() 
        : displayValue.toFixed(1).replace(/\.?0+$/, '');
      return `${formattedValue} fl oz`;
    case 'cup':
      // Round to 2 decimals max
      displayValue = Math.round(value * 100) / 100;
      formattedValue = displayValue % 1 === 0 
        ? displayValue.toString() 
        : displayValue.toFixed(2).replace(/\.?0+$/, '');
      // Use singular "cup" for values <= 1, plural "cups" for values > 1
      return `${formattedValue} ${displayValue <= 1 ? 'cup' : 'cups'}`;
    default:
      displayValue = Math.round(value);
      formattedValue = displayValue.toString();
      return `${formattedValue} ml`;
  }
}

/**
 * Format water value for display in a specific unit
 * Uses centralized display formatting with proper decimal places
 */
export function formatWaterValue(value: number, unit: WaterUnit): string {
  return formatWaterValueForDisplay(value, unit);
}

/**
 * Format water amount for display
 * Returns primary display (ml) and secondary display (cups/oz)
 */
export function formatWaterDisplay(
  ml: number,
  preference: 'metric' | 'imperial'
): { primary: string; secondary: string | null } {
  const primary = `${ml} ml`;
  
  let secondary: string | null = null;
  if (preference === 'imperial') {
    const oz = mlToOz(ml);
    secondary = `≈ ${oz} fl oz`;
  } else {
    // For metric, show cups as secondary
    const cups = mlToCups(ml);
    if (cups >= 1) {
      secondary = `≈ ${cups} cups`;
    }
  }
  
  return { primary, secondary };
}

/**
 * Format water value for display, returning value and unit separately
 * This is useful for UI components that need to display value and unit in different styles
 * Uses centralized display formatting with proper decimal places
 * 
 * @param value - The value in the specified unit
 * @param unit - The unit (ml, floz, or cup)
 * @returns Object with formatted value (number as string, no trailing zeros) and unit label
 */
export function formatWaterValueParts(
  value: number,
  unit: WaterUnit
): { value: string; unit: string } {
  let displayValue: number;
  let formattedValue: string;
  
  switch (unit) {
    case 'ml':
      // Round to whole number (0 decimals)
      displayValue = Math.round(value);
      formattedValue = displayValue.toString();
      return { value: formattedValue, unit: 'ml' };
    case 'floz':
      // Round to 1 decimal max
      displayValue = Math.round(value * 10) / 10;
      formattedValue = displayValue % 1 === 0 
        ? displayValue.toString() 
        : displayValue.toFixed(1).replace(/\.?0+$/, '');
      return { value: formattedValue, unit: 'fl oz' };
    case 'cup':
      // Round to 2 decimals max
      displayValue = Math.round(value * 100) / 100;
      formattedValue = displayValue % 1 === 0 
        ? displayValue.toString() 
        : displayValue.toFixed(2).replace(/\.?0+$/, '');
      return { 
        value: formattedValue, 
        unit: displayValue <= 1 ? 'cup' : 'cups' 
      };
    default:
      displayValue = Math.round(value);
      formattedValue = displayValue.toString();
      return { value: formattedValue, unit: 'ml' };
  }
}

/**
 * Parse user input based on unit preference
 * Returns ml value
 */
export function parseWaterInput(
  input: string,
  preference: 'metric' | 'imperial'
): number | null {
  const cleaned = input.trim().replace(/[^0-9.]/g, '');
  const numericValue = parseFloat(cleaned);
  
  if (isNaN(numericValue) || numericValue < 0) {
    return null;
  }
  
  // Convert to ml based on preference
  if (preference === 'imperial') {
    return ozToMl(numericValue);
  } else {
    // Metric: input is already in ml
    return Math.round(numericValue);
  }
}

/**
 * Generate nice tick values for water gauge scale
 * Returns array of tick values (in ml) that are evenly spaced and rounded to convenient increments
 * 
 * @param goalMl - The goal in ml
 * @param tickCount - Number of ticks to generate (default: 4, plus bottom = 5 total)
 * @returns Array of tick values in ml, including 0 at the bottom
 */
export function generateWaterTickValues(goalMl: number, tickCount: number = 4): number[] {
  if (!goalMl || goalMl <= 0) {
    return [0];
  }

  // Calculate step size
  const step = goalMl / tickCount;
  
  // Round step to a convenient increment (nearest 50 or 100 ml)
  let roundedStep: number;
  if (step < 100) {
    roundedStep = Math.round(step / 50) * 50; // Round to nearest 50
  } else if (step < 500) {
    roundedStep = Math.round(step / 100) * 100; // Round to nearest 100
  } else {
    roundedStep = Math.round(step / 250) * 250; // Round to nearest 250 for larger goals
  }
  
  // Ensure we have at least some step size
  if (roundedStep < 50) {
    roundedStep = 50;
  }
  
  // Generate tick values
  const ticks: number[] = [0]; // Always include 0 at bottom
  for (let i = 1; i <= tickCount; i++) {
    const value = roundedStep * i;
    // Cap at goal value
    if (value <= goalMl) {
      ticks.push(value);
    }
  }
  
  // Ensure goal is included (or very close to it)
  if (ticks[ticks.length - 1] < goalMl * 0.95) {
    ticks.push(goalMl);
  } else {
    // Replace last tick with goal if it's close
    ticks[ticks.length - 1] = goalMl;
  }
  
  return ticks;
}

