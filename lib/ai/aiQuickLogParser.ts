import { FOOD_ENTRY, RANGES, TEXT_LIMITS } from '@/constants/constraints';

export type AIQuickLogConfidence = 'low' | 'med' | 'high';

export type AIQuickLogField =
  | 'FOOD_NAME'
  | 'TOTAL_KCAL'
  | 'Protein_G'
  | 'Total_Carb_G'
  | 'Total_Fat_G'
  | 'FIBRE_G'
  | 'Saturated_Fat_G'
  | 'Trans_Fat_G'
  | 'Total_Sugar_G'
  | 'SODIUM_MG'
  | 'CONFIDENCE';

export type AIQuickLogParseError = {
  field: AIQuickLogField;
  message: string;
};

export type AIQuickLogParseWarning = {
  field: AIQuickLogField;
  message: string;
};

export type AIQuickLogParsed = {
  foodName: string;
  totalKcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fibreG?: number;
  saturatedFatG?: number;
  transFatG?: number;
  totalSugarG?: number;
  sodiumMg?: number;
  confidence?: AIQuickLogConfidence;
};

export type AIQuickLogParseResult =
  | { ok: true; data: AIQuickLogParsed; warnings: AIQuickLogParseWarning[] }
  | { ok: false; errors: AIQuickLogParseError[]; warnings: AIQuickLogParseWarning[] };

const KNOWN_KEYS: AIQuickLogField[] = [
  'FOOD_NAME',
  'TOTAL_KCAL',
  'Protein_G',
  'Total_Carb_G',
  'Total_Fat_G',
  'FIBRE_G',
  'Saturated_Fat_G',
  'Trans_Fat_G',
  'Total_Sugar_G',
  'SODIUM_MG',
  'CONFIDENCE',
];

// Legacy key aliases for backward compatibility (1-2 releases)
const LEGACY_KEY_ALIASES: Record<string, AIQuickLogField> = {
  'P_G': 'Protein_G',
  'C_G': 'Total_Carb_G',
  'F_G': 'Total_Fat_G',
};

function normalizeKey(rawKey: string): AIQuickLogField | null {
  const upper = rawKey.trim();
  // Check canonical keys first
  if ((KNOWN_KEYS as string[]).includes(upper)) {
    return upper as AIQuickLogField;
  }
  // Check legacy aliases
  const upperCase = upper.toUpperCase();
  if (upperCase in LEGACY_KEY_ALIASES) {
    return LEGACY_KEY_ALIASES[upperCase];
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

function parseHeaderLines(text: string): Map<AIQuickLogField, string> {
  const map = new Map<AIQuickLogField, string>();
  
  // Strip code fences (leading/trailing ``` with optional language identifier)
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```')) {
    // Remove leading code fence (``` or ```language)
    cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n?/, '');
  }
  if (cleanedText.endsWith('```')) {
    // Remove trailing code fence
    cleanedText = cleanedText.replace(/\n?```$/, '');
  }
  
  const lines = cleanedText.split(/\r?\n/);

  // Parse the "header block": keep scanning from the top until we hit a blank line
  // *after* having seen at least one known header key.
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

function normalizeFoodName(input: string | undefined, warnings: AIQuickLogParseWarning[]): string {
  const name = (input ?? '').trim();
  if (!name) return 'AI Scan';

  if (name.length > TEXT_LIMITS.AI_QUICK_LOG_NAME_MAX_LEN) {
    warnings.push({
      field: 'FOOD_NAME',
      message: `FOOD_NAME exceeded ${TEXT_LIMITS.AI_QUICK_LOG_NAME_MAX_LEN} characters and was replaced with “AI Scan”.`,
    });
    return 'AI Scan';
  }

  return name;
}

function parseConfidence(input: string | undefined, warnings: AIQuickLogParseWarning[]): AIQuickLogConfidence | undefined {
  const v = (input ?? '').trim().toLowerCase();
  if (!v) return undefined;
  if (v === 'low' || v === 'med' || v === 'high') return v;
  warnings.push({ field: 'CONFIDENCE', message: 'CONFIDENCE was not one of low|med|high and was ignored.' });
  return undefined;
}

/**
 * Enforce 1 decimal place for grams fields (round to nearest).
 * Returns the rounded number and adds a warning if truncation occurred.
 */
function enforceOneDecimal(n: number, field: AIQuickLogField, warnings: AIQuickLogParseWarning[]): number {
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
  field: AIQuickLogField;
  raw: string | undefined;
  min: number;
  max: number;
  warnings: AIQuickLogParseWarning[];
  isGramsField?: boolean; // If true, enforce 1 decimal place
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
  
  // Enforce 1 decimal place for grams fields
  if (isGramsField) {
    return enforceOneDecimal(n, field, warnings);
  }
  
  return n;
}

export function parseAIQuickLogReply(text: string): AIQuickLogParseResult {
  const warnings: AIQuickLogParseWarning[] = [];
  const errors: AIQuickLogParseError[] = [];

  const headers = parseHeaderLines(text);

  // REQUIRED: TOTAL_KCAL must be valid or we fail the whole parse.
  const rawTotalKcal = headers.get('TOTAL_KCAL');
  const totalKcalNumber = rawTotalKcal ? extractFirstNumber(rawTotalKcal) : null;
  if (totalKcalNumber == null) {
    errors.push({
      field: 'TOTAL_KCAL',
      message: `TOTAL_KCAL is required and must be a number between ${RANGES.CALORIES_KCAL.MIN} and ${RANGES.CALORIES_KCAL.MAX}.`,
    });
    return { ok: false, errors, warnings };
  }
  if (totalKcalNumber < RANGES.CALORIES_KCAL.MIN || totalKcalNumber > RANGES.CALORIES_KCAL.MAX) {
    errors.push({
      field: 'TOTAL_KCAL',
      message: `TOTAL_KCAL is out of range (${RANGES.CALORIES_KCAL.MIN}–${RANGES.CALORIES_KCAL.MAX}).`,
    });
    return { ok: false, errors, warnings };
  }

  const foodName = normalizeFoodName(headers.get('FOOD_NAME'), warnings);
  const confidence = parseConfidence(headers.get('CONFIDENCE'), warnings);

  // normalizeKey already converts legacy keys (P_G/C_G/F_G) to canonical (Protein_G/Total_Carb_G/Total_Fat_G)
  const proteinG = parseOptionalInRange({
    field: 'Protein_G',
    raw: headers.get('Protein_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: FOOD_ENTRY.MACRO_G.MAX,
    warnings,
    isGramsField: true,
  });
  
  const carbsG = parseOptionalInRange({
    field: 'Total_Carb_G',
    raw: headers.get('Total_Carb_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: FOOD_ENTRY.MACRO_G.MAX,
    warnings,
    isGramsField: true,
  });
  
  const fatG = parseOptionalInRange({
    field: 'Total_Fat_G',
    raw: headers.get('Total_Fat_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: FOOD_ENTRY.MACRO_G.MAX,
    warnings,
    isGramsField: true,
  });
  
  const fibreG = parseOptionalInRange({
    field: 'FIBRE_G',
    raw: headers.get('FIBRE_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: FOOD_ENTRY.MACRO_G.MAX,
    warnings,
    isGramsField: true,
  });
  
  const saturatedFatG = parseOptionalInRange({
    field: 'Saturated_Fat_G',
    raw: headers.get('Saturated_Fat_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: FOOD_ENTRY.MACRO_G.MAX,
    warnings,
    isGramsField: true,
  });
  
  const transFatG = parseOptionalInRange({
    field: 'Trans_Fat_G',
    raw: headers.get('Trans_Fat_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: FOOD_ENTRY.MACRO_G.MAX,
    warnings,
    isGramsField: true,
  });
  
  const totalSugarG = parseOptionalInRange({
    field: 'Total_Sugar_G',
    raw: headers.get('Total_Sugar_G'),
    min: FOOD_ENTRY.MACRO_G.MIN,
    max: FOOD_ENTRY.MACRO_G.MAX,
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
      totalKcal: Math.round(totalKcalNumber),
      proteinG,
      carbsG,
      fatG,
      fibreG,
      saturatedFatG,
      transFatG,
      totalSugarG,
      sodiumMg,
      confidence,
    },
    warnings,
  };
}

