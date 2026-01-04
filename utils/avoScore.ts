/**
 * AvoScore - simple nutrition heuristic score (0–100) and letter grade.
 *
 * Philosophy:
 * - Uses nutrient density per 100 kcal (with a calorie floor) to reduce serving-size bias.
 * - Not medical advice; intended for lightweight UI feedback.
 */

export type AvoScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

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

export type AvoScoreResult = {
  score: number; // 0-100
  grade: AvoScoreGrade;
  reasons: string[]; // 1-2 items
};

const KCAL_FLOOR = 20;

// Weights
const W_PROTEIN = 30;
const W_FIBER = 30;
const W_UNSAT = 27; // reward estimated unsaturated fat density
const W_SUGAR = 15;
const W_SODIUM = 12;
const W_SAT = 12;
const W_TRANS = 8; // stronger penalty so "Trans fat" reason can appear
const W_FAT = 2; // reduce total fat penalty (avoid double-punishing healthy fats)

// Normalizers (per 100 kcal)
const N_PROTEIN = 10;
const N_FIBER = 5;
const N_UNSAT = 10;
const N_SUGAR = 12;
const N_SODIUM = 400; // mg
const N_SAT = 4;
const N_TRANS = 0.5;
const N_FAT = 15;

const REASON_THRESHOLD = 6;
// Slightly lower threshold for positive callouts so we can surface meaningful positives
// (e.g., EVOO's unsat-fat bonus) even when capped by fat-quality penalties.
const POS_REASON_THRESHOLD = 5;
const SAT_REASON_THRESHOLD_G_PER_100KCAL = 2.4; // “high sat fat” cutoff
const PROTEIN_BUFFER_THRESHOLD = 3; // g per 100 kcal
const PROTEIN_SUGAR_BUFFER = 0.3;
const FIBER_SUGAR_BUFFER_THRESHOLD = 2; // g fiber per 100 kcal
const FIBER_SUGAR_BUFFER_FACTOR = 0.3; // reduce sugar penalty by 70% (whole fruit shouldn't surface "high sugar")
const PLAIN_DAIRY_PROTEIN_THRESHOLD = 5; // g / 100 kcal
const PLAIN_DAIRY_FAT_MAX = 2; // g / 100 kcal
const PLAIN_DAIRY_SUGAR_MAX = 18; // g / 100 kcal
const PLAIN_DAIRY_BONUS = 6; // points

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function gradeFromScore(score: number): AvoScoreGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

type ContributionKey = 'Protein' | 'Fiber' | 'UnsatFat' | 'Sugar' | 'Sodium' | 'SatFat' | 'TransFat' | 'Fat';

// NOTE (engineering-guidelines.md §13 i18n):
// computeAvoScore returns i18n keys (not user-facing strings). UI must render via t().
const REASON_LABELS: Record<ContributionKey, { pos?: string; neg?: string }> = {
  Protein: { pos: 'avo_score.reasons.high_protein' },
  Fiber: { pos: 'avo_score.reasons.high_fiber' },
  UnsatFat: { pos: 'avo_score.reasons.high_unsat_fat' },
  Sugar: { neg: 'avo_score.reasons.high_sugar' },
  Sodium: { neg: 'avo_score.reasons.high_sodium' },
  SatFat: { neg: 'avo_score.reasons.high_sat_fat' },
  TransFat: { neg: 'avo_score.reasons.trans_fat' },
  Fat: { neg: 'avo_score.reasons.high_fat' },
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

  // Calorie conversions (consistent with chart)
  const kcalProtein = proteinG * 4;
  const kcalFat = fatG * 9;
  const kcalNetCarb = netCarbG * 4;
  const kcalFiber = fiberG * 2;
  const kcalCarbsTotal = kcalNetCarb + kcalFiber;
  const totalKcalForScore = kcalProtein + kcalFat + kcalCarbsTotal;

  if (!(totalKcalForScore > 0)) {
    return { score: 50, grade: 'C', reasons: ['avo_score.reasons.no_macro_data'] };
  }

  // Density per 100 kcal
  const P = proteinG / k;
  const F = fiberG / k;
  const Unsat = unsatFatG / k;
  const Su = sugarG / k;
  const Na = sodiumMg / k;
  const Sat = satFatG / k;
  const Trans = transFatG / k;
  const Fat = fatG / k;

  // Subscores
  const proteinScore = clamp01(P / N_PROTEIN);
  const fiberScore = clamp01(F / N_FIBER);
  const unsatScore = clamp01(Unsat / N_UNSAT);
  let sugarBad = clamp01(Su / N_SUGAR);
  // Protein buffering: high protein density reduces sugar penalty (e.g., skim milk, high-protein yogurt).
  // Does not change sugar chip text/logic; only affects the score.
  if (P >= PROTEIN_BUFFER_THRESHOLD) {
    sugarBad *= PROTEIN_SUGAR_BUFFER;
  }
  // Fiber-buffered sugar penalty:
  // Fiber-bound sugars (e.g. whole fruit) have lower metabolic impact.
  // This stacks with protein buffering when both apply.
  if (F >= FIBER_SUGAR_BUFFER_THRESHOLD) {
    sugarBad *= FIBER_SUGAR_BUFFER_FACTOR;
  }
  // Lactose-dominant dairy buffer:
  // Plain low-fat dairy sugars (lactose) should not be treated like free sugar.
  // Uses density per 100 kcal. Stacks with protein/fiber buffering but only mildly.
  const LACTOSE_PROTEIN_THRESHOLD = 5; // g protein per 100 kcal
  const LACTOSE_FAT_MAX = 1.5; // g fat per 100 kcal
  const LACTOSE_SUGAR_BUFFER_FACTOR = 0.5;
  if (P >= LACTOSE_PROTEIN_THRESHOLD && Fat <= LACTOSE_FAT_MAX && F === 0) {
    sugarBad *= LACTOSE_SUGAR_BUFFER_FACTOR;
  }
  const sodiumBad = clamp01(Na / N_SODIUM);
  const satBad = clamp01(Sat / N_SAT);
  const transBad = clamp01(Trans / N_TRANS);
  const fatBad = clamp01(Fat / N_FAT);

  // Unsaturated fat bonus offsets fat-related penalties (quality), but should not reward "more fat".
  // This prevents higher-fat variants (e.g., skin-on chicken) from scoring better than leaner ones.
  const rawUnsatBonus = W_UNSAT * unsatScore;

  // Only offset "bad fat" penalties (sat/trans). We intentionally do NOT offset total fat (W_FAT*fatBad),
  // so higher-fat variants can't become net-better just because they contain more unsaturated fat.
  const fatPenalty = W_SAT * satBad + W_TRANS * transBad;

  // Cap: unsat bonus can only offset fat penalties (never exceed them)
  const unsatBonus = Math.min(rawUnsatBonus, fatPenalty);

  const positive = W_PROTEIN * proteinScore + W_FIBER * fiberScore + unsatBonus;
  const negative =
    W_SUGAR * sugarBad +
    W_SODIUM * sodiumBad +
    W_SAT * satBad +
    W_TRANS * transBad +
    W_FAT * fatBad;

  let raw = positive - negative;

  // Plain high-protein dairy bonus (e.g., fat-free yogurt, skim milk).
  // Uses density per 100 kcal. No new chip; this only nudges the final score.
  const isPlainDairyLike =
    P >= PLAIN_DAIRY_PROTEIN_THRESHOLD &&
    Fat <= PLAIN_DAIRY_FAT_MAX &&
    F === 0 &&
    Su <= PLAIN_DAIRY_SUGAR_MAX;

  if (isPlainDairyLike) {
    raw += PLAIN_DAIRY_BONUS;
  }
  const score = clamp(raw + 50, 0, 100);
  const grade = gradeFromScore(score);

  // Contributions (signed)
  const contributions: Array<{ key: ContributionKey; value: number }> = [
    { key: 'Protein', value: +W_PROTEIN * proteinScore },
    { key: 'Fiber', value: +W_FIBER * fiberScore },
    {
      key: 'UnsatFat',
      value: +unsatBonus,
    },
    { key: 'Sugar', value: -W_SUGAR * sugarBad },
    { key: 'Sodium', value: -W_SODIUM * sodiumBad },
    {
      key: 'SatFat',
      value: Sat >= SAT_REASON_THRESHOLD_G_PER_100KCAL ? -W_SAT * satBad : 0,
    },
    { key: 'TransFat', value: -W_TRANS * transBad },
    { key: 'Fat', value: -W_FAT * fatBad },
  ];

  const strong = contributions
    .filter((c) =>
      c.value >= 0
        ? Math.abs(c.value) >= POS_REASON_THRESHOLD
        : Math.abs(c.value) >= REASON_THRESHOLD
    )
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const positives = strong.filter((c) => c.value > 0);
  const negatives = strong.filter((c) => c.value < 0);

  const reasons: string[] = [];

  // Prefer at least one positive if available
  if (positives.length > 0) {
    const first = positives[0];
    const label = REASON_LABELS[first.key].pos;
    if (label) reasons.push(label);
  }

  // Add the next strongest (could be positive or negative) not duplicating key
  const usedKeys = new Set<ContributionKey>();
  if (reasons.length > 0) {
    const used = positives[0];
    if (used) usedKeys.add(used.key);
  }

  for (const c of strong) {
    if (reasons.length >= 2) break;
    if (usedKeys.has(c.key)) continue;
    const label = c.value >= 0 ? REASON_LABELS[c.key].pos : REASON_LABELS[c.key].neg;
    if (label) {
      reasons.push(label);
      usedKeys.add(c.key);
    }
  }

  // If we didn't get any positives, use top negatives (up to 2)
  if (reasons.length === 0 && negatives.length > 0) {
    for (const c of negatives.slice(0, 2)) {
      const label = REASON_LABELS[c.key].neg;
      if (label) reasons.push(label);
    }
  }

  if (reasons.length === 0) {
    reasons.push('avo_score.reasons.balanced');
  }

  return { score, grade, reasons: reasons.slice(0, 2) };
}


