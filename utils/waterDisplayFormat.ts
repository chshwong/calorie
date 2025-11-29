/**
 * Water Display Formatting Utility
 * 
 * Centralized formatting logic for water amounts in different units.
 * Follows engineering guidelines: all business logic in utils, reusable across components.
 * 
 * This module provides formatting functions that convert ml to display units
 * with specific rounding and formatting rules.
 */

import { WaterUnit, toMl, fromMl } from './waterUnits';

/**
 * Format water amount for display in a specific unit
 * 
 * Rules:
 * - Cups: Round to nearest 0.25, no trailing zeros (1.00 → "1", 1.25 → "1.25", 1.50 → "1.5")
 * - Ml: Round to nearest whole number, integer only (no decimals)
 * - Fl oz: Round to 1 decimal place, no trailing zero (12.0 → "12", 12.5 → "12.5")
 * 
 * @param ml - Amount in milliliters (canonical)
 * @param targetUnit - Target display unit ('ml', 'floz', or 'cup')
 * @returns Formatted number as string (without unit label)
 */
export function formatWaterAmount(ml: number, targetUnit: WaterUnit): string {
  // Convert ml to target unit using centralized conversion utility
  const valueInUnit = fromMl(ml, targetUnit);
  
  switch (targetUnit) {
    case 'ml':
      // Round to nearest whole number, integer only
      return Math.round(valueInUnit).toString();
      
    case 'floz':
      // Round to 1 decimal place, remove trailing zero
      const flozRounded = Math.round(valueInUnit * 10) / 10;
      return flozRounded % 1 === 0 
        ? flozRounded.toString() 
        : flozRounded.toFixed(1).replace(/\.0$/, '');
      
    case 'cup':
      // Round to nearest 0.25
      const cupRounded = Math.round(valueInUnit * 4) / 4;
      // Format: remove trailing zeros after decimal
      if (cupRounded % 1 === 0) {
        return cupRounded.toString(); // Whole number: "1", "2"
      } else {
        const decimal = cupRounded % 1;
        if (decimal === 0.25) {
          return cupRounded.toFixed(2); // "1.25"
        } else if (decimal === 0.5) {
          return cupRounded.toFixed(1); // "1.5"
        } else if (decimal === 0.75) {
          return cupRounded.toFixed(2); // "1.75"
        } else {
          // Fallback: show 2 decimals, remove trailing zeros
          return cupRounded.toFixed(2).replace(/\.?0+$/, '');
        }
      }
      
    default:
      return Math.round(ml).toString();
  }
}

/**
 * Get the alternate unit for approximate display
 * 
 * Rules:
 * - floz → cups
 * - ml → cups
 * - cup → ml
 * 
 * @param activeUnit - The user's active water unit
 * @returns The alternate unit to display as approximation
 */
export function getAlternateUnit(activeUnit: WaterUnit): WaterUnit {
  switch (activeUnit) {
    case 'floz':
    case 'ml':
      return 'cup';
    case 'cup':
      return 'ml';
    default:
      return 'cup';
  }
}

