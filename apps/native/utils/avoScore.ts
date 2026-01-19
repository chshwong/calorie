export type AvoScoreGrade = "A" | "B" | "C" | "D" | "F";

export type AvoScoreInput = {
  calories: number;
  carbG: number;
  fiberG: number;
  proteinG: number;
  fatG: number;
  sugarG: number;
  sodiumMg: number;
  satFatG: number;
  transFatG: number;
};

export type AvoScoreBasis = "per100g" | "per100ml";

export function normalizeAvoScoreInputToBasis(
  input: AvoScoreInput,
  gramsOrMlForCurrentSelection: number,
  basis: AvoScoreBasis
): AvoScoreInput {
  const denom = Math.max(gramsOrMlForCurrentSelection, 1);
  const scale = 100 / denom;

  return {
    calories: input.calories * scale,
    carbG: input.carbG * scale,
    fiberG: input.fiberG * scale,
    proteinG: input.proteinG * scale,
    fatG: input.fatG * scale,
    sugarG: input.sugarG * scale,
    sodiumMg: input.sodiumMg * scale,
    satFatG: input.satFatG * scale,
    transFatG: input.transFatG * scale,
  };
}

export type AvoScoreResult = {
  score: number;
  grade: AvoScoreGrade;
  reasons: string[];
};

const KCAL_FLOOR = 20;
const W_PROTEIN = 30;
const W_FIBER = 30;
const W_UNSAT = 27;
const W_SUGAR = 15;
const W_SODIUM = 12;
const W_SAT = 12;
const W_TRANS = 8;
const W_FAT = 2;

const N_PROTEIN = 10;
const N_FIBER = 5;
const N_UNSAT = 10;
const N_SUGAR = 12;
const N_SODIUM = 400;
const N_SAT = 4;
const N_TRANS = 0.5;
const N_FAT = 15;

const REASON_THRESHOLD = 6;
const POS_REASON_THRESHOLD = 5;
const SAT_REASON_THRESHOLD_G_PER_100KCAL = 2.4;
const PROTEIN_BUFFER_THRESHOLD = 3;
const PROTEIN_SUGAR_BUFFER = 0.3;
const FIBER_SUGAR_BUFFER_THRESHOLD = 2;
const FIBER_SUGAR_BUFFER_FACTOR = 0.3;
const PLAIN_DAIRY_PROTEIN_THRESHOLD = 5;
const PLAIN_DAIRY_FAT_MAX = 2;
const PLAIN_DAIRY_SUGAR_MAX = 18;
const PLAIN_DAIRY_BONUS = 6;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function gradeFromScore(score: number): AvoScoreGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

type ContributionKey =
  | "Protein"
  | "Fiber"
  | "UnsatFat"
  | "Sugar"
  | "Sodium"
  | "SatFat"
  | "TransFat"
  | "Fat";

const REASON_LABELS: Record<ContributionKey, { pos?: string; neg?: string }> = {
  Protein: { pos: "avo_score.reasons.high_protein" },
  Fiber: { pos: "avo_score.reasons.high_fiber" },
  UnsatFat: { pos: "avo_score.reasons.high_unsat_fat" },
  Sugar: { neg: "avo_score.reasons.high_sugar" },
  Sodium: { neg: "avo_score.reasons.high_sodium" },
  SatFat: { neg: "avo_score.reasons.high_sat_fat" },
  TransFat: { neg: "avo_score.reasons.trans_fat" },
  Fat: { neg: "avo_score.reasons.high_fat" },
};

export function computeAvoScore(input: AvoScoreInput): AvoScoreResult {
  const calories = Number.isFinite(input.calories) ? input.calories : 0;
  const carbG = Number.isFinite(input.carbG) ? input.carbG : 0;
  const fiberG = Number.isFinite(input.fiberG) ? input.fiberG : 0;
  const proteinG = Number.isFinite(input.proteinG) ? input.proteinG : 0;
  const fatG = Number.isFinite(input.fatG) ? input.fatG : 0;
  const sugarG = Number.isFinite(input.sugarG) ? input.sugarG : 0;
  const sodiumMg = Number.isFinite(input.sodiumMg) ? input.sodiumMg : 0;
  const satFatG = Number.isFinite(input.satFatG) ? input.satFatG : 0;
  const transFatG = Number.isFinite(input.transFatG) ? input.transFatG : 0;

  const kcalBase = Math.max(calories, KCAL_FLOOR);
  const k = kcalBase / 100;

  const netCarbG = Math.max(carbG - fiberG, 0);
  const unsatFatG = Math.max(fatG - satFatG - transFatG, 0);

  const kcalProtein = proteinG * 4;
  const kcalFat = fatG * 9;
  const kcalNetCarb = netCarbG * 4;
  const kcalFiber = fiberG * 2;
  const kcalCarbsTotal = kcalNetCarb + kcalFiber;
  const totalKcalForScore = kcalProtein + kcalFat + kcalCarbsTotal;

  const proteinScore = clamp01((proteinG / k) / N_PROTEIN) * W_PROTEIN;
  const fiberScore = clamp01((fiberG / k) / N_FIBER) * W_FIBER;
  const unsatScore = clamp01((unsatFatG / k) / N_UNSAT) * W_UNSAT;

  const sugarPenalty = clamp01((sugarG / k) / N_SUGAR) * W_SUGAR;
  const sodiumPenalty = clamp01((sodiumMg / k) / N_SODIUM) * W_SODIUM;
  const satPenalty = clamp01((satFatG / k) / N_SAT) * W_SAT;
  const transPenalty = clamp01((transFatG / k) / N_TRANS) * W_TRANS;
  const fatPenalty = clamp01((fatG / k) / N_FAT) * W_FAT;

  let sugarBuffer = 1;
  if (proteinG / k >= PROTEIN_BUFFER_THRESHOLD) {
    sugarBuffer *= PROTEIN_SUGAR_BUFFER;
  }
  if (fiberG / k >= FIBER_SUGAR_BUFFER_THRESHOLD) {
    sugarBuffer *= FIBER_SUGAR_BUFFER_FACTOR;
  }

  const adjustedSugarPenalty = sugarPenalty * sugarBuffer;

  const isPlainDairy =
    proteinG / k >= PLAIN_DAIRY_PROTEIN_THRESHOLD &&
    fatG / k <= PLAIN_DAIRY_FAT_MAX &&
    sugarG / k <= PLAIN_DAIRY_SUGAR_MAX;

  const dairyBonus = isPlainDairy ? PLAIN_DAIRY_BONUS : 0;

  const rawScore =
    proteinScore +
    fiberScore +
    unsatScore +
    dairyBonus -
    adjustedSugarPenalty -
    sodiumPenalty -
    satPenalty -
    transPenalty -
    fatPenalty;

  const normalizedScore = clamp(Math.round(rawScore), 0, 100);

  const contributions: Array<{ key: ContributionKey; value: number }> = [
    { key: "Protein", value: proteinScore },
    { key: "Fiber", value: fiberScore },
    { key: "UnsatFat", value: unsatScore },
    { key: "Sugar", value: -adjustedSugarPenalty },
    { key: "Sodium", value: -sodiumPenalty },
    { key: "SatFat", value: -satPenalty },
    { key: "TransFat", value: -transPenalty },
    { key: "Fat", value: -fatPenalty },
  ];

  const reasons: string[] = [];
  const positive = contributions
    .filter((c) => c.value >= POS_REASON_THRESHOLD)
    .sort((a, b) => b.value - a.value);
  const negative = contributions
    .filter((c) => c.value <= -REASON_THRESHOLD)
    .sort((a, b) => a.value - b.value);

  for (const c of positive) {
    const key = REASON_LABELS[c.key]?.pos;
    if (key) reasons.push(key);
  }
  for (const c of negative) {
    const key = REASON_LABELS[c.key]?.neg;
    if (key) reasons.push(key);
  }

  if (satFatG / k >= SAT_REASON_THRESHOLD_G_PER_100KCAL) {
    if (!reasons.includes("avo_score.reasons.high_sat_fat")) {
      reasons.push("avo_score.reasons.high_sat_fat");
    }
  }

  const finalReasons = reasons.slice(0, 2);
  if (finalReasons.length === 0) {
    finalReasons.push(totalKcalForScore > 0 ? "avo_score.reasons.balanced" : "avo_score.reasons.no_macro_data");
  }

  return {
    score: normalizedScore,
    grade: gradeFromScore(normalizedScore),
    reasons: finalReasons,
  };
}
