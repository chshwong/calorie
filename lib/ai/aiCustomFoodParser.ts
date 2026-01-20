import { CUSTOM_FOOD, FOOD_ENTRY, RANGES } from '@/constants/constraints';

export type AICustomFoodField =
  | 'FOOD_NAME'
  | 'BRAND'
  | 'SERVING_SIZE'
  | 'SERVING_UNIT'
  | 'TOTAL_KCAL'
  | 'CALORIES_KCAL'
  | 'Protein_G'
  | 'Total_Carb_G'
  | 'Total_Fat_G'
  | 'FIBRE_G'
  | 'Saturated_Fat_G'
  | 'Trans_Fat_G'
  | 'Total_Sugar_G'
  | 'SODIUM_MG';

export type AICustomFoodParseError = {
  field: AICustomFoodField;
  message: string;
};

export type AICustomFoodParseWarning = {
  field: AICustomFoodField;
  message: string;
};

export type AICustomFoodParsed = {
  foodName: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  totalKcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fibreG?: number;
  saturatedFatG?: number;
  transFatG?: number;
  totalSugarG?: number;
  sodiumMg?: number;
};

export type AICustomFoodParseResult =
  | { ok: true; data: AICustomFoodParsed; warnings: AICustomFoodParseWarning[] }
  | { ok: false; errors: AICustomFoodParseError[]; warnings: AICustomFoodParseWarning[] };

const KNOWN_KEYS: AICustomFoodField[] = [
  'FOOD_NAME',
  'BRAND',
  'SERVING_SIZE',
  'SERVING_UNIT',
  'TOTAL_KCAL',
  'CALORIES_KCAL',
  'Protein_G',
  'Total_Carb_G',
  'Total_Fat_G',
  'FIBRE_G',
  'Saturated_Fat_G',
  'Trans_Fat_G',
  'Total_Sugar_G',
  'SODIUM_MG',
];

const MAX_NAME_LENGTH = CUSTOM_FOOD.NAME_MAX_LEN;
const MAX_BRAND_LENGTH = CUSTOM_FOOD.BRAND_MAX_LEN;
const MAX_MACRO = CUSTOM_FOOD.MACRO_MAX;

const ALLOWED_UNITS = [
  'g',
  'kg',
  'oz',
  'lb',
  'ml',
  'L',
  'fl oz',
  'cup',
  'pint',
  'quart',
  'gallon',
  'tbsp',
  'tsp',
];

const UNIT_BY_LOWER = new Map(ALLOWED_UNITS.map((unit) => [unit.toLowerCase(), unit]));

function normalizeKey(rawKey: string): AICustomFoodField | null {
  const trimmed = rawKey.trim();
  if ((KNOWN_KEYS as string[]).includes(trimmed)) {
    return trimmed as AICustomFoodField;
  }
  return null;
}

function extractFirstNumber(rawValue: string): number | null {
  const m = rawValue.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseHeaderLines(text: string): Map<AICustomFoodField, string> {
  const map = new Map<AICustomFoodField, string>();

  let cleanedText = text.trim();
  if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n?/, '');
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.replace(/\n?```$/, '');
  }

  const lines = cleanedText.split(/\r?\n/);
  let seenAnyHeader = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (seenAnyHeader) break;
      continue;
    }

    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;

    const rawKey = trimmed.slice(0, idx);
    const rawVal = trimmed.slice(idx + 1).trim();
    const key = normalizeKey(rawKey);
    if (!key) continue;

    seenAnyHeader = true;
    if (!map.has(key)) {
      map.set(key, rawVal);
    }
  }

  return map;
}

function normalizeBrand(input: string | undefined, errors: AICustomFoodParseError[]): string | undefined {
  const brand = (input ?? '').trim();
  if (!brand) return undefined;
  if (brand.length > MAX_BRAND_LENGTH) {
    errors.push({
      field: 'BRAND',
      message: `BRAND exceeds ${MAX_BRAND_LENGTH} characters.`,
    });
  }
  return brand;
}

function normalizeUnit(rawUnit: string | undefined, errors: AICustomFoodParseError[]): string | null {
  const cleaned = (rawUnit ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    errors.push({ field: 'SERVING_UNIT', message: 'SERVING_UNIT is required.' });
    return null;
  }
  const canonical = UNIT_BY_LOWER.get(cleaned.toLowerCase());
  if (!canonical) {
    errors.push({
      field: 'SERVING_UNIT',
      message: `SERVING_UNIT must be one of: ${ALLOWED_UNITS.join(', ')}.`,
    });
    return null;
  }
  return canonical;
}

function enforceOneDecimal(n: number, field: AICustomFoodField, warnings: AICustomFoodParseWarning[]): number {
  const rounded = Math.round(n * 10) / 10;
  const originalDecimals = (n.toString().split('.')[1]?.length ?? 0);
  if (originalDecimals > 1) {
    warnings.push({
      field,
      message: `${field} had more than 1 decimal place and was rounded to ${rounded.toFixed(1)}.`,
    });
  }
  return rounded;
}

function parseOptionalInRange(params: {
  field: AICustomFoodField;
  raw: string | undefined;
  min: number;
  max: number;
  warnings: AICustomFoodParseWarning[];
  isGramsField?: boolean;
}): number | undefined {
  const { field, raw, min, max, warnings, isGramsField = false } = params;
  const rawTrimmed = (raw ?? '').trim();
  if (!rawTrimmed) return undefined;

  const n = extractFirstNumber(rawTrimmed);
  if (n == null) {
    warnings.push({ field, message: `${field} was not numeric and was ignored.` });
    return undefined;
  }
  if (n < min || n > max) {
    warnings.push({ field, message: `${field} was out of range (${min}–${max}) and was ignored.` });
    return undefined;
  }
  if (isGramsField) {
    return enforceOneDecimal(n, field, warnings);
  }
  return n;
}

export type AICustomFoodParseOptions = {
  allowBlankFoodName?: boolean;
};

function normalizeFoodName(
  input: string | undefined,
  errors: AICustomFoodParseError[],
  allowBlank: boolean
): string {
  const name = (input ?? '').trim();
  if (!name) {
    if (!allowBlank) {
      errors.push({ field: 'FOOD_NAME', message: 'FOOD_NAME is required.' });
    }
    return '';
  }
  if (name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: 'FOOD_NAME',
      message: `FOOD_NAME exceeds ${MAX_NAME_LENGTH} characters.`,
    });
  }
  return name;
}

export function parseAICustomFoodReply(
  text: string,
  options: AICustomFoodParseOptions = {}
): AICustomFoodParseResult {
  const warnings: AICustomFoodParseWarning[] = [];
  const errors: AICustomFoodParseError[] = [];

  const headers = parseHeaderLines(text);
  const hasFoodNameHeader = headers.has('FOOD_NAME');
  const allowBlankFoodName = options.allowBlankFoodName === true;

  if (!hasFoodNameHeader) {
    errors.push({ field: 'FOOD_NAME', message: 'FOOD_NAME header missing.' });
  }

  const rawServingSize = headers.get('SERVING_SIZE');
  const servingSizeNumber = rawServingSize ? extractFirstNumber(rawServingSize) : null;
  if (servingSizeNumber == null) {
    errors.push({
      field: 'SERVING_SIZE',
      message: `SERVING_SIZE is required and must be a number between ${FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE} and ${CUSTOM_FOOD.QUANTITY_MAX}.`,
    });
  } else if (servingSizeNumber <= FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE || servingSizeNumber > CUSTOM_FOOD.QUANTITY_MAX) {
    errors.push({
      field: 'SERVING_SIZE',
      message: `SERVING_SIZE is out of range (${FOOD_ENTRY.QUANTITY.MIN_EXCLUSIVE}–${CUSTOM_FOOD.QUANTITY_MAX}).`,
    });
  }

  const servingUnit = normalizeUnit(headers.get('SERVING_UNIT'), errors);

  const rawTotalKcal = headers.get('TOTAL_KCAL') ?? headers.get('CALORIES_KCAL');
  const totalKcalNumber = rawTotalKcal ? extractFirstNumber(rawTotalKcal) : null;
  if (totalKcalNumber == null) {
    errors.push({
      field: 'TOTAL_KCAL',
      message: `TOTAL_KCAL is required and must be a number between ${RANGES.CALORIES_KCAL.MIN} and ${RANGES.CALORIES_KCAL.MAX}.`,
    });
  } else if (totalKcalNumber < RANGES.CALORIES_KCAL.MIN || totalKcalNumber > RANGES.CALORIES_KCAL.MAX) {
    errors.push({
      field: 'TOTAL_KCAL',
      message: `TOTAL_KCAL is out of range (${RANGES.CALORIES_KCAL.MIN}–${RANGES.CALORIES_KCAL.MAX}).`,
    });
  }

  const foodName = normalizeFoodName(headers.get('FOOD_NAME'), errors, allowBlankFoodName);
  const brand = normalizeBrand(headers.get('BRAND'), errors);

  if (errors.length > 0 || !servingUnit || servingSizeNumber == null || totalKcalNumber == null) {
    return { ok: false, errors, warnings };
  }

  const proteinG = parseOptionalInRange({
    field: 'Protein_G',
    raw: headers.get('Protein_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: MAX_MACRO,
    warnings,
    isGramsField: true,
  });

  const carbsG = parseOptionalInRange({
    field: 'Total_Carb_G',
    raw: headers.get('Total_Carb_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: MAX_MACRO,
    warnings,
    isGramsField: true,
  });

  const fatG = parseOptionalInRange({
    field: 'Total_Fat_G',
    raw: headers.get('Total_Fat_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: MAX_MACRO,
    warnings,
    isGramsField: true,
  });

  const fibreG = parseOptionalInRange({
    field: 'FIBRE_G',
    raw: headers.get('FIBRE_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: MAX_MACRO,
    warnings,
    isGramsField: true,
  });

  const saturatedFatG = parseOptionalInRange({
    field: 'Saturated_Fat_G',
    raw: headers.get('Saturated_Fat_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: MAX_MACRO,
    warnings,
    isGramsField: true,
  });

  const transFatG = parseOptionalInRange({
    field: 'Trans_Fat_G',
    raw: headers.get('Trans_Fat_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: MAX_MACRO,
    warnings,
    isGramsField: true,
  });

  const totalSugarG = parseOptionalInRange({
    field: 'Total_Sugar_G',
    raw: headers.get('Total_Sugar_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: MAX_MACRO,
    warnings,
    isGramsField: true,
  });

  const sodiumMg = parseOptionalInRange({
    field: 'SODIUM_MG',
    raw: headers.get('SODIUM_MG'),
    min: RANGES.SODIUM_MG.MIN,
    max: RANGES.SODIUM_MG.MAX,
    warnings,
  });

  return {
    ok: true,
    data: {
      foodName,
      brand,
      servingSize: servingSizeNumber,
      servingUnit,
      totalKcal: totalKcalNumber,
      proteinG,
      carbsG,
      fatG,
      fibreG,
      saturatedFatG,
      transFatG,
      totalSugarG,
      sodiumMg,
    },
    warnings,
  };
}
