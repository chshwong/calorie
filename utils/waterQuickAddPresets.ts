/**
 * Water Quick Add Presets Utility
 * 
 * Returns fixed presets based on active water unit.
 * No database storage - all presets are hard-coded.
 */

import { WaterUnit } from './waterUnits';

export type QuickAddPreset = {
  id: string;
  amount: number; // Amount in the active unit (ml, floz, or cup)
  unit: WaterUnit;
  iconType: 'smallCup' | 'cup' | 'glass' | 'bottle' | 'largeBottle' | 'custom';
  labelKey: string; // i18n key for the label
};

/**
 * Get quick add presets for ml unit
 */
function getMlPresets(): QuickAddPreset[] {
  return [
    { id: 'ml-1', amount: 50, unit: 'ml', iconType: 'smallCup', labelKey: 'water.quick_presets.small' },
    { id: 'ml-2', amount: 250, unit: 'ml', iconType: 'cup', labelKey: 'water.quick_presets.cup' },
    { id: 'ml-3', amount: 500, unit: 'ml', iconType: 'bottle', labelKey: 'water.quick_presets.bottle' },
    { id: 'ml-4', amount: 1000, unit: 'ml', iconType: 'largeBottle', labelKey: 'water.quick_presets.large_bottle' },
  ];
}

/**
 * Get quick add presets for cup unit
 */
function getCupPresets(): QuickAddPreset[] {
  return [
    { id: 'cup-1', amount: 0.25, unit: 'cup', iconType: 'smallCup', labelKey: 'water.quick_presets.quarter_cup' },
    { id: 'cup-2', amount: 1, unit: 'cup', iconType: 'cup', labelKey: 'water.quick_presets.cup' },
    { id: 'cup-3', amount: 2, unit: 'cup', iconType: 'glass', labelKey: 'water.quick_presets.two_cups' },
    { id: 'cup-4', amount: 4, unit: 'cup', iconType: 'bottle', labelKey: 'water.quick_presets.four_cups' },
  ];
}

/**
 * Get quick add presets for floz unit
 */
function getFlozPresets(): QuickAddPreset[] {
  return [
    { id: 'floz-1', amount: 2, unit: 'floz', iconType: 'smallCup', labelKey: 'water.quick_presets.small' },
    { id: 'floz-2', amount: 8, unit: 'floz', iconType: 'cup', labelKey: 'water.quick_presets.cup' },
    { id: 'floz-3', amount: 16, unit: 'floz', iconType: 'bottle', labelKey: 'water.quick_presets.bottle' },
    { id: 'floz-4', amount: 32, unit: 'floz', iconType: 'largeBottle', labelKey: 'water.quick_presets.large_bottle' },
  ];
}

/**
 * Get quick add presets based on active water unit
 * 
 * @param activeWaterUnit - The active water unit (ml, floz, or cup)
 * @returns Array of 4 preset objects
 */
export function getWaterQuickAddPresets(activeWaterUnit: WaterUnit): QuickAddPreset[] {
  switch (activeWaterUnit) {
    case 'ml':
      return getMlPresets();
    case 'cup':
      return getCupPresets();
    case 'floz':
      return getFlozPresets();
    default:
      return getMlPresets();
  }
}

/**
 * Get icon name for icon type
 * Maps iconType to SF Symbol names
 */
export function getPresetIconName(iconType: QuickAddPreset['iconType']): string {
  switch (iconType) {
    case 'smallCup':
      return 'cup.and.saucer.fill';
    case 'cup':
      return 'cup.and.saucer.fill';
    case 'glass':
      return 'wineglass.fill';
    case 'bottle':
      return 'bottle.fill';
    case 'largeBottle':
      return 'bottle.fill';
    case 'custom':
    default:
      return 'plus.circle.fill';
  }
}

