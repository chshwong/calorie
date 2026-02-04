export interface FoodMaster {
  id: string;
  name: string;
  brand?: string | null;
  serving_size: number;
  serving_unit: string;
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
  is_base_food?: boolean;
  is_quality_data?: boolean;
  order_index?: number | null;
  barcode?: string | null;
}

export interface FoodServing {
  id: string;
  food_id: string;
  serving_name: string;
  weight_g?: number | null;
  volume_ml?: number | null;
  sort_order?: number;
  is_default: boolean;
}

export interface Nutrients {
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
}

export type ServingOption =
  | {
      kind: "raw";
      unit: string;
      label: string;
      id: string;
    }
  | {
      kind: "saved";
      serving: FoodServing;
      label: string;
      id: string;
    };

export const WEIGHT_UNITS = ["g", "kg", "oz", "lb"] as const;
export const VOLUME_UNITS = ["ml", "l", "floz", "cup", "tbsp", "tsp"] as const;

type Unit = string;

export function isWeightUnit(u: Unit) {
  return WEIGHT_UNITS.includes(u.toLowerCase() as (typeof WEIGHT_UNITS)[number]);
}

export function isVolumeUnit(u: Unit) {
  return VOLUME_UNITS.includes(u.toLowerCase() as (typeof VOLUME_UNITS)[number]);
}

export function getAllowedUnitsFor(foodServingUnit: Unit): string[] {
  const normalized = foodServingUnit.toLowerCase();
  if (isWeightUnit(normalized)) return [...WEIGHT_UNITS];
  if (isVolumeUnit(normalized)) return [...VOLUME_UNITS];
  return [foodServingUnit];
}

export function formatUnitLabel(unit: string): string {
  const unitMap: Record<string, string> = {
    g: "g",
    kg: "kg",
    oz: "oz",
    lb: "lb",
    ml: "ml",
    l: "L",
    floz: "fl oz",
    cup: "cup (240 ml)",
    tbsp: "tbsp",
    tsp: "tsp",
  };
  return unitMap[unit.toLowerCase()] || unit;
}

export function formatServingLabel(serving: FoodServing, _food: FoodMaster): string {
  return serving.serving_name;
}

export function buildServingOptions(food: FoodMaster, servings: FoodServing[]): ServingOption[] {
  const rawUnits = getAllowedUnitsFor(food.serving_unit);
  const rawOptions: ServingOption[] = rawUnits.map((u) => ({
    kind: "raw",
    unit: u,
    label: formatUnitLabel(u),
    id: `raw-${u}`,
  }));

  const savedOptions: ServingOption[] = servings.map((s) => ({
    kind: "saved",
    serving: s,
    label: formatServingLabel(s, food),
    id: s.id,
  }));

  return [...savedOptions, ...rawOptions];
}

export function getDefaultServingSelection(
  food: FoodMaster,
  servings: FoodServing[]
): { quantity: number; defaultOption: ServingOption } {
  const options = buildServingOptions(food, servings);
  const defaultServing = servings.find((s) => s.is_default);
  if (defaultServing) {
    const savedOption = options.find(
      (o) => o.kind === "saved" && o.serving.id === defaultServing.id
    ) as ServingOption;
    return { quantity: 1, defaultOption: savedOption };
  }

  const masterUnit = food.serving_unit.toLowerCase();
  const rawOption = options.find(
    (o) => o.kind === "raw" && o.unit.toLowerCase() === masterUnit
  ) as ServingOption;
  return { quantity: food.serving_size, defaultOption: rawOption };
}

export function getServingNormalizedValue(serving: FoodServing, food: FoodMaster): number {
  const normalizedUnit = food.serving_unit.toLowerCase();
  if (isVolumeUnit(normalizedUnit)) {
    return serving.volume_ml ?? 0;
  }
  return serving.weight_g ?? 0;
}

export function getMasterUnitsFromServingOption(
  option: ServingOption,
  quantity: number,
  food: FoodMaster
): number {
  if (option.kind === "saved") {
    const normalizedValue = getServingNormalizedValue(option.serving, food);
    return quantity * normalizedValue;
  }
  try {
    return convertToMasterUnit(quantity, option.unit, food);
  } catch {
    return quantity;
  }
}

export function convertWeight(quantity: number, from: Unit, to: Unit): number {
  const fromNorm = from.toLowerCase();
  const toNorm = to.toLowerCase();
  if (fromNorm === toNorm) return quantity;

  let grams: number;
  switch (fromNorm) {
    case "g":
      grams = quantity;
      break;
    case "kg":
      grams = quantity * 1000;
      break;
    case "oz":
      grams = quantity * 28.3495;
      break;
    case "lb":
      grams = quantity * 453.592;
      break;
    default:
      throw new Error(`Unknown weight unit: ${from}`);
  }

  switch (toNorm) {
    case "g":
      return grams;
    case "kg":
      return grams / 1000;
    case "oz":
      return grams / 28.3495;
    case "lb":
      return grams / 453.592;
    default:
      throw new Error(`Unknown weight unit: ${to}`);
  }
}

export function convertVolume(quantity: number, from: Unit, to: Unit): number {
  const fromNorm = from.toLowerCase();
  const toNorm = to.toLowerCase();
  if (fromNorm === toNorm) return quantity;

  let ml: number;
  switch (fromNorm) {
    case "ml":
      ml = quantity;
      break;
    case "l":
      ml = quantity * 1000;
      break;
    case "cup":
      ml = quantity * 240;
      break;
    case "tbsp":
      ml = quantity * 15;
      break;
    case "tsp":
      ml = quantity * 5;
      break;
    case "floz":
      ml = quantity * 29.5735;
      break;
    default:
      throw new Error(`Unknown volume unit: ${from}`);
  }

  switch (toNorm) {
    case "ml":
      return ml;
    case "l":
      return ml / 1000;
    case "cup":
      return ml / 240;
    case "tbsp":
      return ml / 15;
    case "tsp":
      return ml / 5;
    case "floz":
      return ml / 29.5735;
    default:
      throw new Error(`Unknown volume unit: ${to}`);
  }
}

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
  throw new Error(`No direct unit conversion allowed: ${fromUnit} -> ${food.serving_unit}`);
}

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
    saturated_fat_g:
      perUnit.saturated_fat_g != null ? perUnit.saturated_fat_g * quantityInMasterUnits : null,
    trans_fat_g:
      perUnit.trans_fat_g != null ? perUnit.trans_fat_g * quantityInMasterUnits : null,
    sugar_g: perUnit.sugar_g != null ? perUnit.sugar_g * quantityInMasterUnits : null,
    fiber_g: perUnit.fiber_g != null ? perUnit.fiber_g * quantityInMasterUnits : null,
    sodium_mg: perUnit.sodium_mg != null ? perUnit.sodium_mg * quantityInMasterUnits : null,
  };
}
