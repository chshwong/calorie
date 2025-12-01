/**
 * NUTRITION & SERVING LOGIC - SINGLE SOURCE OF TRUTH
 * 
 * All nutrient calculations in the app must go through this module.
 * Never implement custom math in components.
 * 
 * Data Model:
 * - food_master: All nutrient values are for exactly serving_size × serving_unit of that food
 *   - serving_size: canonical amount (e.g., 100 for 100g, 250 for 250ml)
 *   - serving_unit: canonical unit ('g' for solids, 'ml' for liquids)
 * 
 * - food_servings: User-friendly serving definitions with normalized weight/volume
 *   - weight_g: serving weight in grams (for solid foods)
 *   - volume_ml: serving volume in milliliters (for liquid foods)
 *   - serving_name: display label (e.g., "1 cup cooked", "1 slice")
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FoodMaster {
  id: string;
  name: string;
  brand?: string | null;
  serving_size: number;    // canonical amount (e.g., 100 for 100g, 250 for 250ml)
  serving_unit: string;    // canonical unit ('g', 'ml', or custom like 'piece')
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  source?: string | null;
  is_custom?: boolean;
  owner_user_id?: string | null;
  // Sorting/quality fields
  is_base_food?: boolean;      // Base foods appear first in search results
  is_quality_data?: boolean;   // Quality-verified data appears second
  order_index?: number | null; // Manual ordering (smaller = higher priority, null treated as 0)
  barcode?: string | null;
}

/**
 * FoodServing represents a user-friendly serving definition.
 * 
 * For weight-based foods (serving_unit = 'g'):
 *   - weight_g stores the serving weight in grams
 *   - volume_ml should be null
 * 
 * For volume-based foods (serving_unit = 'ml'):
 *   - volume_ml stores the serving volume in milliliters
 *   - weight_g should be null
 */
export interface FoodServing {
  id: string;
  food_id: string;
  serving_name: string;          // display label (e.g., "1 cup cooked", "1 slice")
  weight_g?: number | null;      // serving weight in grams (for solid foods)
  volume_ml?: number | null;     // serving volume in ml (for liquid foods)
  sort_order?: number;           // UI ordering (lower = higher priority)
  is_default: boolean;
}

export interface Nutrients {
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  sugar_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
}

// Serving selection types (for calculation)
export interface RawServingSelection {
  source: 'raw';
  quantity: number;    // user input, e.g. 250
  unit: string;        // e.g. "ml", "g", etc.
}

export interface SavedServingSelection {
  source: 'saved';
  quantity: number;    // how many of that serving, e.g. 2 cups
  serving: FoodServing;
}

export type ServingSelection = RawServingSelection | SavedServingSelection;

// ============================================================================
// SERVING OPTION MODEL (for UI dropdowns)
// Per spec 8.1 - shared across all screens that show serving dropdowns
// ============================================================================

/**
 * ServingOption represents a selectable serving in a dropdown
 * - 'raw' kind: Direct unit entry (g, oz, ml, cup, etc.)
 * - 'saved' kind: A saved serving from food_servings table
 */
export type ServingOption = 
  | {
      kind: 'raw';
      unit: string;        // "g", "oz", "ml", "cup", etc.
      label: string;       // what user sees, e.g. "g", "oz", "cup (240 ml)"
      id: string;          // for React key, e.g. "raw-g", "raw-oz"
    }
  | {
      kind: 'saved';
      serving: FoodServing;
      label: string;        // e.g. "1 cup (240 ml)", "1 slice (30 g)"
      id: string;           // serving.id
    };

// ============================================================================
// UNIT DEFINITIONS
// ============================================================================

export const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb'] as const;
export const VOLUME_UNITS = ['ml', 'l', 'floz', 'cup', 'tbsp', 'tsp'] as const;

export type WeightUnit = typeof WEIGHT_UNITS[number];
export type VolumeUnit = typeof VOLUME_UNITS[number];
export type Unit = string;

// ============================================================================
// UNIT HELPERS
// ============================================================================

/**
 * Check if a unit is a weight unit
 */
export function isWeightUnit(u: Unit): u is WeightUnit {
  return WEIGHT_UNITS.includes(u.toLowerCase() as any);
}

/**
 * Check if a unit is a volume unit
 */
export function isVolumeUnit(u: Unit): u is VolumeUnit {
  return VOLUME_UNITS.includes(u.toLowerCase() as any);
}

/**
 * Get allowed units for a given food's serving unit
 * Cross-category conversions (weight ↔ volume) are NOT allowed via generic unit math
 */
export function getAllowedUnitsFor(foodServingUnit: Unit): string[] {
  const normalized = foodServingUnit.toLowerCase();
  
  if (isWeightUnit(normalized)) {
    return [...WEIGHT_UNITS];
  }
  if (isVolumeUnit(normalized)) {
    return [...VOLUME_UNITS];
  }
  
  // If it's something like "piece", "serving", etc., only allow that unit
  return [foodServingUnit];
}

/**
 * Get display name for a unit
 */
export function getUnitDisplayName(unit: string): string {
  const unitMap: Record<string, string> = {
    'g': 'g',
    'kg': 'kg',
    'oz': 'oz',
    'lb': 'lb',
    'ml': 'ml',
    'l': 'L',
    'floz': 'fl oz',
    'cup': 'cup',
    'tbsp': 'tbsp',
    'tsp': 'tsp',
  };
  return unitMap[unit.toLowerCase()] || unit;
}

// ============================================================================
// SERVING OPTION BUILDERS (shared across all screens)
// ============================================================================

/**
 * Format a raw unit label for display in dropdown
 * Shows helpful context for volume units (e.g., "cup (240 ml)")
 */
export function formatUnitLabel(unit: string): string {
  const unitMap: Record<string, string> = {
    'g': 'g',
    'kg': 'kg',
    'oz': 'oz',
    'lb': 'lb',
    'ml': 'ml',
    'l': 'L',
    'floz': 'fl oz',
    'cup': 'cup (240 ml)',
    'tbsp': 'tbsp',
    'tsp': 'tsp',
  };
  return unitMap[unit.toLowerCase()] || unit;
}

/**
 * Format a saved serving label for display
 * Shows just the serving name as stored in the database
 */
export function formatServingLabel(serving: FoodServing, food: FoodMaster): string {
  return serving.serving_name;
}

/**
 * Build the complete list of serving options for a food
 * Per spec 8.2 - this is the SINGLE SOURCE OF TRUTH for serving dropdowns
 * 
 * @param food - The food master record
 * @param servings - Array of saved servings from food_servings table
 * @returns Array of ServingOption for dropdown display
 */
export function buildServingOptions(
  food: FoodMaster,
  servings: FoodServing[]
): ServingOption[] {
  // 1) Base raw units by category (weight or volume)
  const rawUnits = getAllowedUnitsFor(food.serving_unit);
  
  const rawOptions: ServingOption[] = rawUnits.map((u) => ({
    kind: 'raw' as const,
    unit: u,
    label: formatUnitLabel(u),
    id: `raw-${u}`,
  }));

  // 2) Saved servings from database
  const savedOptions: ServingOption[] = servings.map((s) => ({
    kind: 'saved' as const,
    serving: s,
    label: formatServingLabel(s, food),
    id: s.id,
  }));

  // 3) Final list: saved servings first (more relevant), then raw units
  return [...savedOptions, ...rawOptions];
}

/**
 * Get the default serving selection for a food
 * Per spec 8.3 - determines which serving option to pre-select
 * 
 * Priority:
 * 1. If there is a default FoodServing (is_default = true), use it with quantity 1
 * 2. Otherwise, use the master record's serving_unit with quantity = serving_size
 * 
 * @param food - The food master record
 * @param servings - Array of saved servings from food_servings table
 * @returns The default quantity and serving option
 */
export function getDefaultServingSelection(
  food: FoodMaster,
  servings: FoodServing[]
): { quantity: number; defaultOption: ServingOption } {
  const options = buildServingOptions(food, servings);

  // 1) If there is a default FoodServing, use it
  const defaultServing = servings.find((s) => s.is_default);
  if (defaultServing) {
    const savedOption = options.find(
      (o) => o.kind === 'saved' && o.serving.id === defaultServing.id
    ) as ServingOption;

    return { 
      quantity: 1,
      defaultOption: savedOption 
    };
  }

  // 2) Else default to the master record's serving unit
  const masterUnit = food.serving_unit.toLowerCase();
  const rawOption = options.find(
    (o) => o.kind === 'raw' && o.unit.toLowerCase() === masterUnit
  ) as ServingOption;

  return { 
    quantity: food.serving_size,
    defaultOption: rawOption 
  };
}

/**
 * Get the weight or volume value from a serving based on the food's canonical unit.
 * This is the SINGLE SOURCE OF TRUTH for extracting the normalized serving size.
 * 
 * @param serving - The food serving
 * @param food - The food master record (determines whether to use weight or volume)
 * @returns The serving size in grams (for weight) or ml (for volume)
 */
export function getServingNormalizedValue(serving: FoodServing, food: FoodMaster): number {
  const normalizedUnit = food.serving_unit.toLowerCase();
  
  if (isVolumeUnit(normalizedUnit)) {
    // Volume-based food: use volume_ml
    return serving.volume_ml ?? 0;
  } else {
    // Weight-based food: use weight_g
    return serving.weight_g ?? 0;
  }
}

/**
 * Get master units from a ServingOption
 * This converts a UI serving selection to master units for nutrition calculation
 * 
 * @param option - The selected serving option
 * @param quantity - How many of that serving
 * @param food - The food master record (needed for raw unit conversions)
 * @returns The quantity in master units
 */
export function getMasterUnitsFromServingOption(
  option: ServingOption,
  quantity: number,
  food: FoodMaster
): number {
  if (option.kind === 'saved') {
    // Saved serving: get normalized value (weight_g or volume_ml) and multiply by quantity
    const normalizedValue = getServingNormalizedValue(option.serving, food);
    return quantity * normalizedValue;
  } else {
    // Raw unit: convert to master unit
    try {
      return convertToMasterUnit(quantity, option.unit, food);
    } catch {
      // Cross-category conversion not possible, return as-is
      return quantity;
    }
  }
}

// ============================================================================
// UNIT CONVERSIONS
// ============================================================================

/**
 * Convert between weight units
 * @throws Error if unknown weight unit
 */
export function convertWeight(quantity: number, from: Unit, to: Unit): number {
  const fromNorm = from.toLowerCase();
  const toNorm = to.toLowerCase();
  
  if (fromNorm === toNorm) return quantity;
  
  // Normalize to grams
  let grams: number;
  switch (fromNorm) {
    case 'g':  grams = quantity; break;
    case 'kg': grams = quantity * 1000; break;
    case 'oz': grams = quantity * 28.3495; break;
    case 'lb': grams = quantity * 453.592; break;
    default:
      throw new Error(`Unknown weight unit: ${from}`);
  }
  
  // Convert grams → target
  switch (toNorm) {
    case 'g':  return grams;
    case 'kg': return grams / 1000;
    case 'oz': return grams / 28.3495;
    case 'lb': return grams / 453.592;
    default:
      throw new Error(`Unknown weight unit: ${to}`);
  }
}

/**
 * Convert between volume units
 * Uses: 240 ml = 1 cup, 15 ml = 1 tbsp, 5 ml = 1 tsp, 29.5735 ml = 1 floz, 1000 ml = 1 L
 * @throws Error if unknown volume unit
 */
export function convertVolume(quantity: number, from: Unit, to: Unit): number {
  const fromNorm = from.toLowerCase();
  const toNorm = to.toLowerCase();
  
  if (fromNorm === toNorm) return quantity;
  
  // Normalize to ml
  let ml: number;
  switch (fromNorm) {
    case 'ml':   ml = quantity; break;
    case 'l':    ml = quantity * 1000; break;
    case 'cup':  ml = quantity * 240; break;
    case 'tbsp': ml = quantity * 15; break;
    case 'tsp':  ml = quantity * 5; break;
    case 'floz': ml = quantity * 29.5735; break;
    default:
      throw new Error(`Unknown volume unit: ${from}`);
  }
  
  // Convert ml → target
  switch (toNorm) {
    case 'ml':   return ml;
    case 'l':    return ml / 1000;
    case 'cup':  return ml / 240;
    case 'tbsp': return ml / 15;
    case 'tsp':  return ml / 5;
    case 'floz': return ml / 29.5735;
    default:
      throw new Error(`Unknown volume unit: ${to}`);
  }
}

/**
 * Convert arbitrary user unit to master unit (food_master.serving_unit)
 * All nutrient math must be based on the master unit
 * @throws Error if cross-category conversion attempted (must use food_serving instead)
 */
export function convertToMasterUnit(
  quantity: number,
  fromUnit: Unit,
  food: FoodMaster
): number {
  const toUnit = food.serving_unit.toLowerCase();
  const fromNorm = fromUnit.toLowerCase();
  
  if (fromNorm === toUnit) return quantity;
  
  if (isWeightUnit(fromNorm) && isWeightUnit(toUnit)) {
    return convertWeight(quantity, fromNorm, toUnit);
  }
  
  if (isVolumeUnit(fromNorm) && isVolumeUnit(toUnit)) {
    return convertVolume(quantity, fromNorm, toUnit);
  }
  
  // Cross-category conversions only allowed via food_serving
  throw new Error(`No direct unit conversion allowed: ${fromUnit} → ${food.serving_unit}`);
}

// ============================================================================
// SERVING SELECTION HELPERS
// ============================================================================

/**
 * Get master units from a raw serving selection
 */
export function getMasterUnitsFromRaw(
  selection: RawServingSelection,
  food: FoodMaster
): number {
  return convertToMasterUnit(selection.quantity, selection.unit, food);
}

/**
 * Get master units from a saved serving selection
 * 
 * @deprecated Use getMasterUnitsFromServingOption instead, which correctly handles
 * weight vs volume based on the food's serving_unit.
 * 
 * Note: This function requires the food parameter to determine which field to use.
 */
export function getMasterUnitsFromSaved(selection: SavedServingSelection, food: FoodMaster): number {
  // Use the correct field based on food's base unit type
  const servingValue = isVolumeUnit(food.serving_unit)
    ? (selection.serving.volume_ml ?? 0)
    : (selection.serving.weight_g ?? 0);
  return selection.quantity * servingValue;
}

/**
 * Get master units from any serving selection
 */
export function getMasterUnitsFromSelection(
  selection: ServingSelection,
  food: FoodMaster
): number {
  return selection.source === 'raw'
    ? getMasterUnitsFromRaw(selection as RawServingSelection, food)
    : getMasterUnitsFromSaved(selection as SavedServingSelection);
}

// ============================================================================
// NUTRIENT CALCULATION (SINGLE SOURCE OF TRUTH)
// ============================================================================

/**
 * Get nutrients per 1 master unit
 * Example: skim milk with serving_size=250, calories_kcal=85
 *          → 85/250 = 0.34 kcal per 1 ml
 */
export function getPerMasterUnit(food: FoodMaster): Nutrients {
  const factor = 1 / food.serving_size;
  
  return {
    calories_kcal: food.calories_kcal * factor,
    protein_g: food.protein_g != null ? food.protein_g * factor : null,
    carbs_g: food.carbs_g != null ? food.carbs_g * factor : null,
    fat_g: food.fat_g != null ? food.fat_g * factor : null,
    saturated_fat_g: food.saturated_fat_g != null ? food.saturated_fat_g * factor : null,
    trans_fat_g: food.trans_fat_g != null ? food.trans_fat_g * factor : null,
    sugar_g: food.sugar_g != null ? food.sugar_g * factor : null,
    fiber_g: food.fiber_g != null ? food.fiber_g * factor : null,
    sodium_mg: food.sodium_mg != null ? food.sodium_mg * factor : null,
  };
}

/**
 * Calculate nutrients for a diary entry
 * This is the CANONICAL calculation that all components must use
 * 
 * Three-step pipeline:
 * 1. Compute per-master-unit nutrients
 * 2. Convert the user selection into how many master units
 * 3. Multiply
 * 
 * @example
 * Skim milk: serving_size=250, serving_unit="ml", calories_kcal=85
 * User selects 250 ml raw:
 *   perUnit.calories = 85 / 250 = 0.34 kcal per ml
 *   masterUnits = 250 ml
 *   Total = 0.34 × 250 = 85 kcal
 */
export function calculateNutrientsForEntry(
  food: FoodMaster,
  selection: ServingSelection
): Nutrients {
  const perUnit = getPerMasterUnit(food);
  const masterUnits = getMasterUnitsFromSelection(selection, food);
  
  return {
    calories_kcal: perUnit.calories_kcal * masterUnits,
    protein_g: perUnit.protein_g != null ? perUnit.protein_g * masterUnits : null,
    carbs_g: perUnit.carbs_g != null ? perUnit.carbs_g * masterUnits : null,
    fat_g: perUnit.fat_g != null ? perUnit.fat_g * masterUnits : null,
    saturated_fat_g: perUnit.saturated_fat_g != null ? perUnit.saturated_fat_g * masterUnits : null,
    trans_fat_g: perUnit.trans_fat_g != null ? perUnit.trans_fat_g * masterUnits : null,
    sugar_g: perUnit.sugar_g != null ? perUnit.sugar_g * masterUnits : null,
    fiber_g: perUnit.fiber_g != null ? perUnit.fiber_g * masterUnits : null,
    sodium_mg: perUnit.sodium_mg != null ? perUnit.sodium_mg * masterUnits : null,
  };
}

/**
 * Simplified calculation for direct quantity/serving inputs
 * Used when we have a food and a quantity in master units
 * 
 * @param food - The food master record
 * @param quantityInMasterUnits - The quantity in master units (g or ml)
 */
export function calculateNutrientsSimple(
  food: FoodMaster,
  quantityInMasterUnits: number
): Nutrients {
  const perUnit = getPerMasterUnit(food);
  
  return {
    calories_kcal: perUnit.calories_kcal * quantityInMasterUnits,
    protein_g: perUnit.protein_g != null ? perUnit.protein_g * quantityInMasterUnits : null,
    carbs_g: perUnit.carbs_g != null ? perUnit.carbs_g * quantityInMasterUnits : null,
    fat_g: perUnit.fat_g != null ? perUnit.fat_g * quantityInMasterUnits : null,
    saturated_fat_g: perUnit.saturated_fat_g != null ? perUnit.saturated_fat_g * quantityInMasterUnits : null,
    trans_fat_g: perUnit.trans_fat_g != null ? perUnit.trans_fat_g * quantityInMasterUnits : null,
    sugar_g: perUnit.sugar_g != null ? perUnit.sugar_g * quantityInMasterUnits : null,
    fiber_g: perUnit.fiber_g != null ? perUnit.fiber_g * quantityInMasterUnits : null,
    sodium_mg: perUnit.sodium_mg != null ? perUnit.sodium_mg * quantityInMasterUnits : null,
  };
}

/**
 * Calculate weight/volume in master units for display
 * 
 * @deprecated Use getMasterUnitsFromServingOption instead, which correctly handles
 * weight vs volume based on the food's serving_unit.
 * 
 * @param serving - The serving option
 * @param quantity - How many of that serving
 * @param food - The food master record (needed to determine weight vs volume)
 */
export function calculateMasterUnitsForDisplay(
  serving: FoodServing & { isUnitBased?: boolean },
  quantity: number,
  food: FoodMaster
): number {
  if ('isUnitBased' in serving && serving.isUnitBased) {
    // For raw unit serving (1g or 1ml), quantity IS the master units
    return quantity;
  }
  // For saved servings, use the correct field based on food's base unit type
  const servingValue = isVolumeUnit(food.serving_unit)
    ? (serving.volume_ml ?? 0)
    : (serving.weight_g ?? 0);
  return servingValue * quantity;
}

// ============================================================================
// DEFAULT SERVING SELECTION
// ============================================================================

/**
 * Get the default serving for a food
 * Rules:
 * 1. If any food_serving has is_default = true, use that
 * 2. Otherwise, fall back to master record values
 * 
 * @returns { quantity, serving } or { quantity: serving_size, unit: serving_unit } for fallback
 */
export function getDefaultServing(
  food: FoodMaster,
  servings: FoodServing[]
): { quantity: number; serving?: FoodServing; unit?: string } {
  // Find default serving
  const defaultServing = servings.find(s => s.is_default);
  
  if (defaultServing) {
    return {
      quantity: 1, // Default to 1 of the serving
      serving: defaultServing,
    };
  }
  
  // Fall back to master record
  return {
    quantity: food.serving_size,
    unit: food.serving_unit,
  };
}

