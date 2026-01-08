/**
 * Goal Calorie and Nutrient Rules
 * 
 * Pure functions for calculating BMR, TDEE, calorie targets, and nutrient suggestions.
 * 
 * Per engineering guidelines: Domain logic lives in plain TS modules with no React/browser/UI imports.
 */

import { lbToKg } from '@/lib/domain/weight-constants';
import { NUTRIENT_TARGETS } from '@/constants/constraints';

// Global constants - DO NOT hardcode these values elsewhere
export const CALORIES_PER_LB = 3600;
//export const CALORIE_LOSS_CONTINGENCY = 0.10;
export const CALORIE_BMR_CONTINGENCY = 0.05 ;
export const CALORIE_LOSS_ACTIVITY_CONTINGENCY = 0.2;

// Hard/soft floor constants - DO NOT hardcode these values elsewhere
export const HARD_HARD_STOP = 700; // absolute minimum, nothing selectable below this
export const HARD_FLOOR = 1200; // safety threshold, red warning
export const SOFT_FLOOR_MALE = 1400; // guidance threshold
export const SOFT_FLOOR_FEMALE = 1300; // guidance threshold

// Baseline deficit constants
export const MORE_SUSTAINABLE_DEFICIT = 300;
export const STANDARD_DEFICIT = 500;
export const AGGRESSIVE_DEFICIT = 750;
export const MAINTENANCE_BUFFER = 75;
export const CAUTIOUS_MINIMUM_CALORIES = 1200;
export const EXTREME_EDGE_CASE_THRESHOLD = 1100;

// Helper functions
function roundToNearest10(value: number): number {
  return Math.round(value / 10) * 10;
}

function floorToNearest10(value: number): number {
  return Math.floor(value / 10) * 10;
}

export function roundDownTo25(n: number): number {
  return Math.floor(n / 25) * 25;
}

function roundUpTo25(n: number): number {
  return Math.ceil(n / 25) * 25;
}

// Gain plan pace definitions (pace-first approach)
const GAIN_PRESET_PACES = {
  lean: 0.4,
  standard: 0.6,
  aggressive: 1.3,
} as const;

// Calculate calories from pace (single source of truth for gain plans)
export function caloriesFromLbPerWeek(
  maintenanceCals: number,
  lbPerWeek: number
): number {
  return maintenanceCals + (lbPerWeek * CALORIES_PER_LB) / 7;
}

function roundToNearest25(n: number): number {
  return Math.round(n / 25) * 25;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.abs(Math.floor((utc2 - utc1) / msPerDay));
}

/**
 * Map activity level string to activity multiplier
 * Maps existing activity enum to multipliers:
 * - sedentary: 1.2
 * - light: 1.375
 * - moderate: 1.55
 * - high: 1.725 (very_active)
 * - very_high: 1.9 (athlete)
 */
export function getActivityMultiplier(activityLevel: string): number {
  const mapping: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725, // very_active
    very_high: 1.9, // athlete
  };
  return mapping[activityLevel] || 1.2; // Default to sedentary
}

/**
 * Compute BMR with contingency ranges using Mifflin-St Jeor or Katch-McArdle
 * Returns both lower and upper BMR bounds
 */
export function computeBmr(params: {
  sexAtBirth: 'male' | 'female' | 'unknown';
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
}): {
  rawBmr: number;
  lowerBmr: number;
  upperBmr: number;
  method: 'mifflin' | 'katch' | 'blend';
  usedBodyFat: boolean;
} {
  const { sexAtBirth, ageYears, heightCm, weightKg, bodyFatPct } = params;

  let rawBmr: number;
  let method: 'mifflin' | 'katch' | 'blend';
  let usedBodyFat: boolean;

  // Always compute Mifflin-St Jeor (stable baseline)
  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;

  let rawBmrMifflin: number;
  if (sexAtBirth === 'male') {
    rawBmrMifflin = baseBMR + 5;
  } else if (sexAtBirth === 'female') {
    rawBmrMifflin = baseBMR - 161;
  } else {
    // unknown: midpoint between male/female constants (+5 and -161 -> -78)
    rawBmrMifflin = baseBMR - 78;
  }

  // If body fat is provided and within valid range, compute Katch-McArdle too
  const hasValidBodyFat =
    bodyFatPct !== null &&
    bodyFatPct !== undefined &&
    bodyFatPct >= 5 &&
    bodyFatPct <= 60;

  if (hasValidBodyFat) {
    const lbmKg = weightKg * (1 - bodyFatPct / 100);
    const rawBmrKatch = 370 + 21.6 * lbmKg;

    // Conservative blend: 70% Mifflin + 30% Katch
    rawBmr = 0.7 * rawBmrMifflin + 0.3 * rawBmrKatch;

    method = 'blend';
    usedBodyFat = true;
  } else {
    rawBmr = rawBmrMifflin;
    method = 'mifflin';
    usedBodyFat = false;
  }

  const lowerBmr = floorToNearest10(rawBmr * (1 - CALORIE_BMR_CONTINGENCY));
  const upperBmr = floorToNearest10(rawBmr);

  return {
    rawBmr,
    lowerBmr,
    upperBmr,
    method,
    usedBodyFat,
  };
}

/**
 * Compute maintenance range from BMR parameters and activity level
 * Returns lower and upper maintenance calories with activity breakdown
 */
export function computeMaintenanceRange(params: {
  sexAtBirth: 'male' | 'female' | 'unknown';
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  activityLevel: string;
}): {
  lowerMaintenance: number;
  upperMaintenance: number;
  lowerBmr: number;
  upperBmr: number;
  lowerActivityCalories: number;
  upperActivityCalories: number;
  activityMultiplier: number;
  bmrMethod: 'mifflin' | 'katch' | 'blend';
  usedBodyFat: boolean;
} {
  const { activityLevel, ...bmrParams } = params;
  const bmrResult = computeBmr(bmrParams);
  const multiplier = getActivityMultiplier(activityLevel);

  // Compute raw activity calories from raw BMR (before contingency and flooring)
  const rawActivityCalories = bmrResult.rawBmr * (multiplier - 1);

  // Apply contingency to activity calories
  const lowerActivityCalories = floorToNearest10(rawActivityCalories * (1 - CALORIE_LOSS_ACTIVITY_CONTINGENCY));
  const upperActivityCalories = floorToNearest10(rawActivityCalories);

  // Maintenance range
  const lowerMaintenance = bmrResult.lowerBmr + lowerActivityCalories;
  const upperMaintenance = bmrResult.upperBmr + upperActivityCalories;

  return {
    lowerMaintenance,
    upperMaintenance,
    lowerBmr: bmrResult.lowerBmr,
    upperBmr: bmrResult.upperBmr,
    lowerActivityCalories,
    upperActivityCalories,
    activityMultiplier: multiplier,
    bmrMethod: bmrResult.method,
    usedBodyFat: bmrResult.usedBodyFat,
  };
}

/**
 * Compute required daily deficit for weight loss goal using CALORIES_PER_LB
 */
export function computeRequiredDailyDeficit(params: {
  currentWeightLb: number;
  targetWeightLb: number;
  targetDateIso: string | null;
  now?: Date;
}): {
  requiredDailyDeficit: number;
  lbsToLose: number;
  daysToTarget: number;
} {
  const { currentWeightLb, targetWeightLb, targetDateIso, now = new Date() } = params;

  const lbsToLose = Math.max(0, currentWeightLb - targetWeightLb);

  if (!targetDateIso) {
    return {
      requiredDailyDeficit: 0,
      lbsToLose: Math.round(lbsToLose * 10) / 10,
      daysToTarget: 0,
    };
  }

  const targetDate = new Date(targetDateIso);
  const daysToTarget = Math.max(1, daysBetween(now, targetDate));
  
  // Use CALORIES_PER_LB constant
  const requiredDailyDeficit = roundToNearest10((lbsToLose * CALORIES_PER_LB) / daysToTarget);

  return {
    requiredDailyDeficit,
    lbsToLose: Math.round(lbsToLose * 10) / 10,
    daysToTarget,
  };
}

/**
 * Get soft floor calories by sex at birth (guidance threshold)
 */
export function getSoftFloor(sexAtBirth: 'male' | 'female' | 'unknown'): number {
  if (sexAtBirth === 'male') return SOFT_FLOOR_MALE;
  if (sexAtBirth === 'female') return SOFT_FLOOR_FEMALE;
  return SOFT_FLOOR_MALE; // unknown uses male soft floor
}

/**
 * Calculate pace in lbs/week from daily deficit
 */
function calculatePaceLbsPerWeek(dailyDeficit: number): number {
  return (dailyDeficit * 7) / 3500;
}

/**
 * Calculate estimated date rounded up to nearest week
 */
function calculateEstimatedDate(lbsToLose: number, lbsPerWeek: number, now: Date = new Date()): {
  etaWeeks: number | null;
  etaDateISO: string | null;
} {
  if (lbsPerWeek <= 0 || lbsToLose <= 0) {
    return { etaWeeks: null, etaDateISO: null };
  }

  const estimateDays = lbsToLose / (lbsPerWeek / 7);
  const etaWeeks = Math.ceil(estimateDays / 7);
  
  // Round up to nearest week
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + (etaWeeks * 7));
  
  return {
    etaWeeks,
    etaDateISO: targetDate.toISOString().split('T')[0],
  };
}

/**
 * Format date as "MMM DD, YYYY"
 */
export function formatDateForDisplay(dateISO: string): string {
  const date = new Date(dateISO);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Compute pace and ETA for custom calorie target
 * Returns pace in lbs/week and estimated date rounded up to nearest week
 */
export function computePaceAndEta(params: {
  maintenanceLow: number;
  maintenanceHigh: number;
  customCalories: number;
  currentWeightLb: number | null;
  targetWeightLb: number | null;
  nowDate?: Date;
}): {
  paceLbsPerWeek: number | null;
  etaWeeks: number | null;
  etaDate: Date | null;
} {
  const {
    maintenanceLow,
    maintenanceHigh,
    customCalories,
    currentWeightLb,
    targetWeightLb,
    nowDate = new Date(),
  } = params;

  // Calculate maintenance midpoint
  const maintenanceMid = (maintenanceLow + maintenanceHigh) / 2;

  // Calculate daily deficit
  const dailyDeficit = Math.max(0, maintenanceMid - customCalories);

  // Calculate pace
  const paceLbsPerWeek = dailyDeficit > 0 ? calculatePaceLbsPerWeek(dailyDeficit) : null;

  // Calculate lbs to lose
  const lbsToLose =
    currentWeightLb && targetWeightLb ? Math.max(0, currentWeightLb - targetWeightLb) : null;

  // If no deficit, no target weight, or no lbs to lose, return nulls
  if (
    paceLbsPerWeek === null ||
    paceLbsPerWeek <= 0 ||
    lbsToLose === null ||
    lbsToLose <= 0 ||
    !targetWeightLb
  ) {
    return {
      paceLbsPerWeek: paceLbsPerWeek !== null && paceLbsPerWeek > 0 ? Math.round(paceLbsPerWeek * 10) / 10 : null,
      etaWeeks: null,
      etaDate: null,
    };
  }

  // Calculate days needed
  const daysNeeded = (lbsToLose / paceLbsPerWeek) * 7;

  // Round up to nearest week
  const etaWeeks = Math.ceil(daysNeeded / 7);

  // Calculate target date (now + weeks * 7 days)
  const etaDate = new Date(nowDate);
  etaDate.setDate(etaDate.getDate() + etaWeeks * 7);

  return {
    paceLbsPerWeek: Math.round(paceLbsPerWeek * 10) / 10, // Round to 0.1
    etaWeeks,
    etaDate,
  };
}

/**
 * Plan structure for baseline deficit chips
 */
export type BaselinePlan = {
  key: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'sustainable_floor_1200';
  title: string;
  subtitle?: string; // Optional subtitle for escape-hatch plans
  caloriesPerDay: number | null;
  isVisible: boolean;
  isSelectable: boolean;
  warningLevel: 'none' | 'neutral' | 'red' | 'unsafe';
  warningText: string | null;
  isRecommended: boolean;
  paceLbsPerWeek: number | null;
  etaWeeks: number | null;
  etaDateISO: string | null;
};

export type WeightLossWarningLevel = 'none' | 'neutral' | 'red' | 'unsafe';

export function getWeightLossCalorieWarning(caloriesPerDay: number): {
  warningLevel: WeightLossWarningLevel;
  warningText: string | null;
} {
  if (!isFinite(caloriesPerDay)) {
    return { warningLevel: 'none', warningText: null };
  }

  // Tier 4: <700
  if (caloriesPerDay < HARD_HARD_STOP) {
    return { warningLevel: 'unsafe', warningText: 'This plan is unsafe and cannot be selected.' };
  }

  // Tier 3: 700–1000 (inclusive)
  if (caloriesPerDay <= 1000) {
    return { warningLevel: 'red', warningText: 'Unsafe for most people without professional supervision.' };
  }

  // Tier 2: 1001–1199
  if (caloriesPerDay < HARD_FLOOR) {
    return {
      warningLevel: 'neutral',
      warningText: 'Demanding — requires careful nutrition and monitoring.',
    };
  }

  // Tier 1: >=1200
  return { warningLevel: 'none', warningText: null };
}

export type SupportedGoalType = 'lose' | 'maintain' | 'recomp' | 'gain';

export type SuggestedCaloriePlanWarningLevel = 'none' | 'orange' | 'red';

export type SuggestedCaloriePlan = {
  key:
    | 'moreSustainable'
    | 'standard'
    | 'aggressive'
    | 'cautiousMinimum'
    | 'sustainable_floor_1200'
    | 'maintain_leaner'
    | 'maintain_standard'
    | 'maintain_flexible'
    | 'recomp_leaner'
    | 'recomp_standard'
    | 'recomp_muscle'
    | 'gain_lean'
    | 'gain_standard'
    | 'gain_aggressive';
  caloriesPerDay: number;
  isSelectable: boolean; // only blocked by HARD_HARD_STOP
  isRecommended: boolean;
  // UI should render via i18n; domain returns keys.
  titleKey: string;
  subtitleKey: string;
  warning: null | {
    level: SuggestedCaloriePlanWarningLevel;
    textKey: string;
  };
};

export function suggestCaloriePlans(params: {
  goalType: SupportedGoalType;
  sexAtBirth: 'male' | 'female' | 'unknown';
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  activityLevel: string;
  currentWeightLb: number | null;
  targetWeightLb?: number | null;
  targetDateIso?: string | null; // only used for lose (future)
  now?: Date;
}): {
  maintenance: { lower: number; upper: number; mid: number };
  plans: SuggestedCaloriePlan[];
  custom: { min: number; max: number };
  warningThresholds: {
    hardHardStop: number;
    hardFloor: number;
    softFloorMale: number;
    softFloorFemale: number;
  };
  defaultPlanKey: SuggestedCaloriePlan['key'] | 'custom';
} {
  const {
    goalType,
    sexAtBirth,
    ageYears,
    heightCm,
    weightKg,
    bodyFatPct,
    activityLevel,
    currentWeightLb,
    targetWeightLb = null,
    now,
  } = params;

  const maintenanceRange = computeMaintenanceRange({
    sexAtBirth,
    ageYears,
    heightCm,
    weightKg,
    bodyFatPct,
    activityLevel,
  });

  // Rounding rules:
  // - lower/upper ranges round DOWN
  // - midpoint rounds to nearest 10
  const lower = floorToNearest10(maintenanceRange.lowerMaintenance);
  const upper = floorToNearest10(maintenanceRange.upperMaintenance);
  const mid = roundToNearest10((lower + upper) / 2);

  const warningThresholds = {
    hardHardStop: HARD_HARD_STOP,
    hardFloor: HARD_FLOOR,
    softFloorMale: SOFT_FLOOR_MALE,
    softFloorFemale: SOFT_FLOOR_FEMALE,
  };

  // NOTE: We keep goalType === 'lose' support here for completeness,
  // but the current UI uses getBaselineDeficitPlans directly to avoid regressions.
  if (goalType === 'lose') {
    const baseline = getBaselineDeficitPlans({
      currentWeightLb,
      targetWeightLb,
      maintenanceLow: maintenanceRange.lowerMaintenance,
      maintenanceHigh: maintenanceRange.upperMaintenance,
      sexAtBirth,
      now,
    });

    const plans: SuggestedCaloriePlan[] = ([
      baseline.plans.sustainable_floor_1200,
      baseline.plans.moreSustainable,
      baseline.plans.standard,
      baseline.plans.aggressive,
      baseline.plans.cautiousMinimum,
    ].filter(Boolean) as BaselinePlan[])
      .filter((p) => p.isVisible && p.caloriesPerDay !== null)
      .map((p) => {
        const caloriesPerDay = p.caloriesPerDay as number;
        const isSelectable = caloriesPerDay >= HARD_HARD_STOP && p.isSelectable;
        const warning =
          p.warningLevel === 'red' || p.warningLevel === 'unsafe'
            ? { level: 'red' as const, textKey: 'onboarding.calorie_target.warning_unsafe' }
            : null;

        return {
          key: p.key,
          caloriesPerDay: roundDownTo25(caloriesPerDay),
          isSelectable,
          isRecommended: p.isRecommended,
          titleKey: '', // weight-loss UI currently uses title strings
          subtitleKey: '',
          warning,
        };
      });

    return {
      maintenance: { lower, upper, mid },
      plans,
      custom: {
        min: HARD_HARD_STOP,
        max: floorToNearest10(baseline.plans.custom.max),
      },
      warningThresholds,
      defaultPlanKey: (baseline.defaultPlan ?? 'custom') as any,
    };
  }

  function buildWarningForNonLoss(caloriesPerDay: number): SuggestedCaloriePlan['warning'] {
    // Maintenance and Recomp now use unified low-calorie warnings (calculated at render time)
    // Only return null here - warnings are calculated in component using getWeightLossCalorieWarning
    if (goalType === 'maintain' || goalType === 'recomp') {
      return null;
    }
    // gain - keep existing logic
    if (caloriesPerDay < lower) {
      return { level: 'orange', textKey: 'onboarding.calorie_target.gain_warning_below_maintenance' };
    }
    if (caloriesPerDay > upper + 700) {
      return { level: 'orange', textKey: 'onboarding.calorie_target.gain_warning_high' };
    }
    return null;
  }

  // For maintain/recomp: generate presets from maintenance range bounds with 25-cal rounding
  const isMaintenanceOrRecomp = goalType === 'maintain' || goalType === 'recomp';
  
  let rawPlans: Array<Omit<SuggestedCaloriePlan, 'caloriesPerDay' | 'isSelectable' | 'warning'> & { caloriesPerDay: number }>;
  
  if (isMaintenanceOrRecomp) {
    // Use raw maintenance range (not rounded lower/upper)
    const L = maintenanceRange.lowerMaintenance;
    const H = maintenanceRange.upperMaintenance;
    
    // Compute presets with 25-cal rounding
    let lean = roundUpTo25(L);
    let flex = roundUpTo25(H);
    
    // Guard A: If lean > flex (extremely tight range), set flex = lean
    if (lean > flex) {
      flex = lean;
    }
    
    // Compute midpoint
    const midRaw = (L + H) / 2;
    let mid = roundToNearest25(midRaw);
    // Clamp mid into [lean, flex]
    mid = Math.min(flex, Math.max(lean, mid));
    
    // Build plan array based on goal type
    const allPlans = goalType === 'maintain'
      ? [
          {
            key: 'maintain_leaner' as const,
            titleKey: 'onboarding.calorie_target.maintain_leaner_title',
            subtitleKey: 'onboarding.calorie_target.maintain_leaner_subtitle',
            caloriesPerDay: lean,
            isRecommended: false,
          },
          {
            key: 'maintain_standard' as const,
            titleKey: 'onboarding.calorie_target.maintain_standard_title',
            subtitleKey: 'onboarding.calorie_target.maintain_standard_subtitle',
            caloriesPerDay: mid,
            isRecommended: true,
          },
          {
            key: 'maintain_flexible' as const,
            titleKey: 'onboarding.calorie_target.maintain_flexible_title',
            subtitleKey: 'onboarding.calorie_target.maintain_flexible_subtitle',
            caloriesPerDay: flex,
            isRecommended: false,
          },
        ]
      : [
          {
            key: 'recomp_leaner' as const,
            titleKey: 'onboarding.calorie_target.recomp_leaner_title',
            subtitleKey: 'onboarding.calorie_target.recomp_leaner_subtitle',
            caloriesPerDay: lean,
            isRecommended: false,
          },
          {
            key: 'recomp_standard' as const,
            titleKey: 'onboarding.calorie_target.recomp_standard_title',
            subtitleKey: 'onboarding.calorie_target.recomp_standard_subtitle',
            caloriesPerDay: mid,
            isRecommended: true,
          },
          {
            key: 'recomp_muscle' as const,
            titleKey: 'onboarding.calorie_target.recomp_muscle_title',
            subtitleKey: 'onboarding.calorie_target.recomp_muscle_subtitle',
            caloriesPerDay: flex,
            isRecommended: false,
          },
        ];
    
    // Guard B & C: Filter duplicates
    // If all three are equal: show only recommended
    if (lean === mid && mid === flex) {
      rawPlans = allPlans.filter((p) => p.isRecommended);
    }
    // If lean === mid && mid < flex: drop leaner, show recommended + flexible
    else if (lean === mid && mid < flex) {
      rawPlans = allPlans.filter((p) => p.key !== (goalType === 'maintain' ? 'maintain_leaner' : 'recomp_leaner'));
    }
    // If mid === flex && lean < mid: drop flexible, show leaner + recommended
    else if (mid === flex && lean < mid) {
      rawPlans = allPlans.filter((p) => p.key !== (goalType === 'maintain' ? 'maintain_flexible' : 'recomp_muscle'));
    }
    // Normal case: show all three
    else {
      rawPlans = allPlans;
    }
  } else {
    // Weight gain: pace-first approach (calculate calories from pace)
    const maintenanceMid = (lower + upper) / 2;
    rawPlans = [
      {
        key: 'gain_lean',
        titleKey: 'onboarding.calorie_target.gain_lean_title',
        subtitleKey: 'onboarding.calorie_target.gain_lean_subtitle',
        caloriesPerDay: caloriesFromLbPerWeek(maintenanceMid, GAIN_PRESET_PACES.lean),
        isRecommended: true,
      },
      {
        key: 'gain_standard',
        titleKey: 'onboarding.calorie_target.gain_standard_title',
        subtitleKey: 'onboarding.calorie_target.gain_standard_subtitle',
        caloriesPerDay: caloriesFromLbPerWeek(maintenanceMid, GAIN_PRESET_PACES.standard),
        isRecommended: false,
      },
      {
        key: 'gain_aggressive',
        titleKey: 'onboarding.calorie_target.gain_aggressive_title',
        subtitleKey: 'onboarding.calorie_target.gain_aggressive_subtitle',
        caloriesPerDay: caloriesFromLbPerWeek(maintenanceMid, GAIN_PRESET_PACES.aggressive),
        isRecommended: false,
      },
    ];
  }

  const plans: SuggestedCaloriePlan[] = rawPlans.map((p) => {
    // For gain goals, round up to nearest 25; for others, round down
    const caloriesPerDay = goalType === 'gain' 
      ? roundUpTo25(p.caloriesPerDay)
      : roundDownTo25(p.caloriesPerDay);
    return {
      ...p,
      caloriesPerDay,
      isSelectable: caloriesPerDay >= HARD_HARD_STOP,
      warning: buildWarningForNonLoss(caloriesPerDay),
    };
  });

  const customMax =
    goalType === 'gain'
      ? floorToNearest10(upper + 800)
      : floorToNearest10(upper + 300);

  const defaultPlanKey: SuggestedCaloriePlan['key'] =
    (plans.find((p) => p.isRecommended)?.key ?? plans[0].key) as any;

  return {
    maintenance: { lower, upper, mid },
    plans,
    custom: { min: HARD_HARD_STOP, max: customMax },
    warningThresholds,
    defaultPlanKey,
  };
}

/**
 * Get baseline deficit calorie plans (new implementation)
 * 
 * Generates plans based on fixed deficits (-300, -500, -750) plus Cautious Minimum edge case.
 * Does NOT depend on target date - computes pace and estimated date from deficit.
 */
export function getBaselineDeficitPlans(params: {
  currentWeightLb: number | null;
  targetWeightLb: number | null;
  maintenanceLow: number;
  maintenanceHigh: number;
  sexAtBirth: 'male' | 'female' | 'unknown';
  now?: Date;
}): {
  status: 'OK' | 'EXTREME_EDGE_CASE';
  message?: string;
  plans: {
    moreSustainable: BaselinePlan;
    standard: BaselinePlan;
    aggressive: BaselinePlan;
    cautiousMinimum: BaselinePlan;
    sustainable_floor_1200?: BaselinePlan; // Optional escape-hatch plan
    custom: {
      min: number;
      max: number;
    };
  };
  defaultPlan: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'sustainable_floor_1200' | 'custom' | null;
} {
  const {
    currentWeightLb,
    targetWeightLb,
    maintenanceLow,
    maintenanceHigh,
    sexAtBirth,
    now = new Date(),
  } = params;

  const maintenanceMid = (maintenanceLow + maintenanceHigh) / 2;
  const softFloor = getSoftFloor(sexAtBirth);
  // NOTE: softFloor is used for messaging only (not eligibility) for weight-loss plan chips.

  // Calculate lbs to lose if target weight exists
  const lbsToLose = currentWeightLb && targetWeightLb
    ? Math.max(0, currentWeightLb - targetWeightLb)
    : null;

  // EXTREME EDGE CASE: maintenanceLow < 1100
  if (maintenanceLow < EXTREME_EDGE_CASE_THRESHOLD) {
    return {
      status: 'EXTREME_EDGE_CASE',
      message: 'This goal is beyond what the app can guide safely.',
      plans: {
        moreSustainable: {
          key: 'moreSustainable',
          title: 'More sustainable',
          caloriesPerDay: null,
          isVisible: false,
          isSelectable: false,
          warningLevel: 'none',
          warningText: null,
          isRecommended: false,
          paceLbsPerWeek: null,
          etaWeeks: null,
          etaDateISO: null,
        },
        standard: {
          key: 'standard',
          title: 'Standard pace',
          caloriesPerDay: null,
          isVisible: false,
          isSelectable: false,
          warningLevel: 'none',
          warningText: null,
          isRecommended: false,
          paceLbsPerWeek: null,
          etaWeeks: null,
          etaDateISO: null,
        },
        aggressive: {
          key: 'aggressive',
          title: 'Fast-tracked pace',
          caloriesPerDay: null,
          isVisible: false,
          isSelectable: false,
          warningLevel: 'none',
          warningText: null,
          isRecommended: false,
          paceLbsPerWeek: null,
          etaWeeks: null,
          etaDateISO: null,
        },
        cautiousMinimum: {
          key: 'cautiousMinimum',
          title: 'Cautious Minimum',
          caloriesPerDay: null,
          isVisible: false,
          isSelectable: false,
          warningLevel: 'none',
          warningText: null,
          isRecommended: false,
          paceLbsPerWeek: null,
          etaWeeks: null,
          etaDateISO: null,
        },
        custom: {
          min: HARD_HARD_STOP,
          max: maintenanceLow + 200,
        },
      },
      defaultPlan: 'custom',
    };
  }

  // Helper to evaluate safety for a calorie target
  function evaluateSafety(calorieTarget: number): {
    isSelectable: boolean;
    warningLevel: WeightLossWarningLevel;
    warningText: string | null;
  } {
    const { warningLevel, warningText } = getWeightLossCalorieWarning(calorieTarget);
    return {
      isSelectable: calorieTarget >= HARD_HARD_STOP,
      warningLevel,
      warningText,
    };
  }

  // Helper to calculate pace and date for a plan
  function calculatePaceAndDate(calorieTarget: number): {
    paceLbsPerWeek: number | null;
    etaWeeks: number | null;
    etaDateISO: string | null;
  } {
    const dailyDeficit = Math.max(0, maintenanceMid - calorieTarget);
    const paceLbsPerWeek = dailyDeficit > 0 ? calculatePaceLbsPerWeek(dailyDeficit) : null;

    if (paceLbsPerWeek && paceLbsPerWeek > 0 && lbsToLose !== null && lbsToLose > 0) {
      const { etaWeeks, etaDateISO } = calculateEstimatedDate(lbsToLose, paceLbsPerWeek, now);
      return { paceLbsPerWeek, etaWeeks, etaDateISO };
    }

    return { paceLbsPerWeek, etaWeeks: null, etaDateISO: null };
  }

  // AGGRESSIVE (D=750)
  const aggressiveRawTarget = maintenanceMid - AGGRESSIVE_DEFICIT;
  const aggressiveCalories = roundDownTo25(aggressiveRawTarget);
  const aggressiveSafety = evaluateSafety(aggressiveCalories);
  const aggressivePaceAndDate = calculatePaceAndDate(aggressiveCalories);

  const aggressivePlan: BaselinePlan = {
    key: 'aggressive',
    title: 'Fast-tracked pace',
    caloriesPerDay: aggressiveCalories,
    isVisible: true,
    isSelectable: aggressiveSafety.isSelectable,
    warningLevel: aggressiveSafety.warningLevel,
    warningText: aggressiveSafety.warningText,
    isRecommended: false, // Never recommended
    ...aggressivePaceAndDate,
  };

  // STANDARD (D=500)
  const standardRawTarget = maintenanceMid - STANDARD_DEFICIT;
  const standardCalories = roundDownTo25(standardRawTarget);
  const standardSafety = evaluateSafety(standardCalories);
  const standardPaceAndDate = calculatePaceAndDate(standardCalories);

  // Standard is recommended if selectable AND no warning
  const standardIsRecommended = standardSafety.isSelectable && standardSafety.warningLevel === 'none';

  const standardPlan: BaselinePlan = {
    key: 'standard',
    title: 'Standard pace',
    caloriesPerDay: standardCalories,
    isVisible: true,
    isSelectable: standardSafety.isSelectable,
    warningLevel: standardSafety.warningLevel,
    warningText: standardSafety.warningText,
    isRecommended: standardIsRecommended,
    ...standardPaceAndDate,
  };

  // MORE SUSTAINABLE (D=300)
  const moreSustainableRawTarget = maintenanceMid - MORE_SUSTAINABLE_DEFICIT;
  const moreSustainableRawCalories = roundDownTo25(moreSustainableRawTarget);

  let moreSustainableCalories: number;
  // Eligibility rule (weight loss only):
  // - "More sustainable" exists only if >= HARD_FLOOR (1200)
  // - Soft floors are messaging-only (no hiding)
  moreSustainableCalories = moreSustainableRawCalories;
  const moreSustainableIsVisible = moreSustainableCalories >= HARD_FLOOR;
  // Warnings for weight loss are tiered and computed via getWeightLossCalorieWarning().

  const moreSustainableSafety = evaluateSafety(moreSustainableCalories);
  const moreSustainablePaceAndDate = calculatePaceAndDate(moreSustainableCalories);

  const moreSustainablePlan: BaselinePlan = {
    key: 'moreSustainable',
    title: 'More sustainable',
    caloriesPerDay: moreSustainableIsVisible ? moreSustainableCalories : null,
    isVisible: moreSustainableIsVisible,
    isSelectable: moreSustainableIsVisible && moreSustainableSafety.isSelectable,
    warningLevel: moreSustainableSafety.warningLevel,
    warningText: moreSustainableSafety.warningText,
    isRecommended: false, // Only if Standard has no warning
    ...moreSustainablePaceAndDate,
  };

  // CAUTIOUS MINIMUM (edge case)
  // Show ONLY when: maintenanceLow < (softFloor + 75) AND maintenanceLow >= 1300
  const cautiousMinimumShouldShow =
    maintenanceLow < (softFloor + MAINTENANCE_BUFFER) && maintenanceLow >= 1300;

  const cautiousMinimumSafety = evaluateSafety(CAUTIOUS_MINIMUM_CALORIES);
  const cautiousMinimumPaceAndDate = calculatePaceAndDate(CAUTIOUS_MINIMUM_CALORIES);

  const cautiousMinimumPlan: BaselinePlan = {
    key: 'cautiousMinimum',
    title: 'Cautious Minimum',
    caloriesPerDay: cautiousMinimumShouldShow ? CAUTIOUS_MINIMUM_CALORIES : null,
    isVisible: cautiousMinimumShouldShow,
    isSelectable: cautiousMinimumShouldShow && cautiousMinimumSafety.isSelectable,
    warningLevel: 'none',
    warningText: null,
    isRecommended: false, // Never recommended (always has warning)
    ...cautiousMinimumPaceAndDate,
  };

  // Update recommendation logic:
  // A plan may only be recommended if:
  // - it isSelectable === true
  // - warningLevel === 'none'
  // Find all recommendable plans (visible, selectable, no warning)
  const recommendablePlans: Array<{ key: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum'; plan: BaselinePlan }> = [];
  
  if (moreSustainablePlan.isVisible && moreSustainablePlan.isSelectable && moreSustainablePlan.warningLevel === 'none') {
    recommendablePlans.push({ key: 'moreSustainable', plan: moreSustainablePlan });
  }
  if (standardPlan.isVisible && standardPlan.isSelectable && standardPlan.warningLevel === 'none') {
    recommendablePlans.push({ key: 'standard', plan: standardPlan });
  }
  if (aggressivePlan.isVisible && aggressivePlan.isSelectable && aggressivePlan.warningLevel === 'none') {
    recommendablePlans.push({ key: 'aggressive', plan: aggressivePlan });
  }
  // Cautious Minimum is never recommended (always has warning)

  // Pick preferred plan: Standard > More sustainable > Aggressive
  let recommendedKey: 'moreSustainable' | 'standard' | 'aggressive' | null = null;
  if (recommendablePlans.some(p => p.key === 'standard')) {
    recommendedKey = 'standard';
  } else if (recommendablePlans.some(p => p.key === 'moreSustainable')) {
    recommendedKey = 'moreSustainable';
  } else if (recommendablePlans.some(p => p.key === 'aggressive')) {
    recommendedKey = 'aggressive';
  }

  // Set isRecommended based on recommendedKey
  moreSustainablePlan.isRecommended = recommendedKey === 'moreSustainable';
  standardPlan.isRecommended = recommendedKey === 'standard';
  aggressivePlan.isRecommended = recommendedKey === 'aggressive';
  cautiousMinimumPlan.isRecommended = false; // Never recommended

  // Hard clamp: Remove recommendation from any plan with a warning
  if (moreSustainablePlan.warningLevel !== 'none') {
    moreSustainablePlan.isRecommended = false;
  }
  if (standardPlan.warningLevel !== 'none') {
    standardPlan.isRecommended = false;
  }
  if (aggressivePlan.warningLevel !== 'none') {
    aggressivePlan.isRecommended = false;
  }
  if (cautiousMinimumPlan.warningLevel !== 'none') {
    cautiousMinimumPlan.isRecommended = false;
  }

  // ESCAPE-HATCH: If "More sustainable" is not visible/selectable and maintenanceLow >= 1400,
  // inject a 1200-calorie "More sustainable" fallback plan
  let escapeHatchPlan: BaselinePlan | undefined = undefined;
  if (!moreSustainablePlan.isVisible || !moreSustainablePlan.isSelectable) {
    if (maintenanceLow >= 1400) {
      const escapeHatchCalories = roundDownTo25(HARD_FLOOR); // 1200
      const escapeHatchSafety = evaluateSafety(escapeHatchCalories);
      const escapeHatchPaceAndDate = calculatePaceAndDate(escapeHatchCalories);
      
      escapeHatchPlan = {
        key: 'sustainable_floor_1200',
        title: 'More sustainable',
        subtitle: 'Arrives later, easier to sustain.',
        caloriesPerDay: escapeHatchCalories,
        isVisible: true,
        isSelectable: escapeHatchSafety.isSelectable,
        warningLevel: escapeHatchSafety.warningLevel,
        warningText: escapeHatchSafety.warningText,
        isRecommended: false,
        ...escapeHatchPaceAndDate,
      };
    }
  }

  // DEFAULT SELECTION PRIORITY:
  // 1) Standard if selectable AND no warning (recommended state)
  // 2) Cautious Minimum if it exists (it is recommended in that scenario)
  // 3) More sustainable if selectable
  // 4) Escape-hatch "More sustainable" (1200) if available
  // 5) Standard if selectable (even warned)
  // 6) Aggressive if selectable
  // 7) Otherwise leave none selected and keep Custom available
  let defaultPlan: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'sustainable_floor_1200' | 'custom' | null = null;

  if (standardPlan.isSelectable && standardPlan.warningLevel === 'none') {
    defaultPlan = 'standard';
  } else if (cautiousMinimumPlan.isVisible && cautiousMinimumPlan.isSelectable) {
    defaultPlan = 'cautiousMinimum';
  } else if (moreSustainablePlan.isSelectable) {
    defaultPlan = 'moreSustainable';
  } else if (escapeHatchPlan && escapeHatchPlan.isSelectable) {
    defaultPlan = 'sustainable_floor_1200';
  } else if (standardPlan.isSelectable) {
    defaultPlan = 'standard';
  } else if (aggressivePlan.isSelectable) {
    defaultPlan = 'aggressive';
  } else {
    defaultPlan = 'custom';
  }

  const plans: {
    moreSustainable: BaselinePlan;
    standard: BaselinePlan;
    aggressive: BaselinePlan;
    cautiousMinimum: BaselinePlan;
    sustainable_floor_1200?: BaselinePlan;
    custom: {
      min: number;
      max: number;
    };
  } = {
    moreSustainable: moreSustainablePlan,
    standard: standardPlan,
    aggressive: aggressivePlan,
    cautiousMinimum: cautiousMinimumPlan,
    custom: {
      min: HARD_HARD_STOP,
      max: maintenanceLow + 200,
    },
  };

  // Insert escape-hatch plan at the beginning if it exists
  if (escapeHatchPlan) {
    plans.sustainable_floor_1200 = escapeHatchPlan;
  }

  return {
    status: 'OK',
    plans,
    defaultPlan,
  };
}

/**
 * Get hard floor calories (safety threshold - deprecated, use HARD_FLOOR constant)
 * @deprecated Use HARD_FLOOR constant directly
 */
export function getSafetyFloor(sexAtBirth: 'male' | 'female' | 'unknown'): number {
  // Legacy function for backward compatibility
  // New code should use HARD_FLOOR constant directly
  return HARD_FLOOR;
}

/**
 * Get weight loss calorie plans based on lower maintenance bound
 * All plans must be based on lowerMaintenance, never exceed it (except custom with override)
 * 
 * IMPORTANT: Floors are NOT applied to raw calculations - they are only used for:
 * - Eligibility (chip visibility)
 * - Warnings (text display)
 * - Selectability (disabled state)
 * 
 * Raw math is never clamped upward.
 */
export function getWeightLossCaloriePlans(params: {
  lowerMaintenance: number;
  upperMaintenance: number;
  requiredDailyDeficit: number | null;
  sexAtBirth: 'male' | 'female' | 'unknown';
}): {
  status: 'OK' | 'NO_DEADLINE' | 'NO_SAFE_PLAN';
  message?: string;
  lowerMaintenance: number;
  softFloor: number;
  plans: {
    onTime: {
      dailyCalories: number;
      isSelectable: boolean;
      isVisible: boolean;
      warningLevel: 'none' | 'orange' | 'red' | 'red_critical';
    };
    sustainable: {
      dailyCalories: number;
      isVisible: boolean;
    };
    accelerated: {
      dailyCalories: number;
      isVisible: boolean;
      warningLevel: 'none' | 'orange';
    };
    custom: {
      min: number;
      max: number;
    };
  };
  defaultPlan: 'sustainable' | 'accelerated' | 'onTime' | 'custom' | null;
} {
  const { lowerMaintenance, requiredDailyDeficit, sexAtBirth } = params;
  const softFloor = getSoftFloor(sexAtBirth);

  // NO_DEADLINE: If requiredDailyDeficit is null/undefined
  if (requiredDailyDeficit === null || requiredDailyDeficit === undefined) {
    // Compute maintenance-based plans (no deficit)
    // Use fixed deficit approach for sustainable (350 calories)
    const SUSTAINABLE_DEFICIT = 350;
    const sustainableRaw = lowerMaintenance - SUSTAINABLE_DEFICIT;
    const sustainableCalories = roundDownTo25(sustainableRaw);
    const sustainableIsVisible = sustainableCalories >= HARD_FLOOR && sustainableCalories < lowerMaintenance;
    
    const acceleratedCalories = roundDownTo25(lowerMaintenance * 0.75); // Approximate maintenance
    const acceleratedIsVisible = acceleratedCalories >= HARD_FLOOR;

    let defaultPlan: 'sustainable' | 'accelerated' | 'custom' = 'custom';
    if (sustainableIsVisible) {
      defaultPlan = 'sustainable';
    } else if (acceleratedIsVisible) {
      defaultPlan = 'accelerated';
    }

    return {
      status: 'NO_DEADLINE',
      lowerMaintenance,
      softFloor,
      plans: {
        onTime: {
          dailyCalories: 0,
          isSelectable: false,
          isVisible: false,
          warningLevel: 'none',
        },
      sustainable: {
        dailyCalories: sustainableCalories,
        isVisible: sustainableIsVisible,
      },
        accelerated: {
          dailyCalories: acceleratedCalories,
          isVisible: acceleratedIsVisible,
          warningLevel: 'none',
        },
        custom: {
          min: HARD_HARD_STOP,
          max: lowerMaintenance + 200,
        },
      },
      defaultPlan,
    };
  }

  // Compute raw baseline on-time calories (NO clamping)
  const baselineOnTimeCalories = lowerMaintenance - requiredDailyDeficit;

  // SUSTAINABLE: Use fixed deficit approach (350 calories) for steadier pace
  // This makes it available even when on-time is too aggressive
  const SUSTAINABLE_DEFICIT = 350;
  const sustainableRaw = lowerMaintenance - SUSTAINABLE_DEFICIT;
  const sustainableCalories = roundDownTo25(sustainableRaw);
  
  // SUSTAINABLE: Visible only if >= HARD_FLOOR and below maintenance.
  // Soft floors are messaging-only (not eligibility).
  const sustainableIsVisible = sustainableCalories >= HARD_FLOOR && sustainableCalories < lowerMaintenance;
  
  // ACCELERATED: Compute from baseline deficit (NO clamping)
  const acceleratedRaw = lowerMaintenance - (requiredDailyDeficit * 1.15);
  const acceleratedCalories = roundDownTo25(acceleratedRaw);

  // Final calories for display/selection
  const onTimeCalories = roundDownTo25(baselineOnTimeCalories);

  // ON-TIME: Always compute, eligibility based on floors
  let onTimeIsSelectable = onTimeCalories >= HARD_HARD_STOP;
  let onTimeWarningLevel: 'none' | 'orange' | 'red' | 'red_critical' = 'none';
  
  if (onTimeCalories < HARD_HARD_STOP) {
    onTimeWarningLevel = 'red_critical';
  } else if (onTimeCalories < HARD_FLOOR) {
    onTimeWarningLevel = 'red';
  }

  // ACCELERATED: Visible and selectable ONLY IF calories >= HARD_FLOOR
  const acceleratedIsVisible = acceleratedCalories >= HARD_FLOOR;
  const acceleratedWarningLevel: 'none' | 'orange' = 'none';

  // CUSTOM: min = HARD_HARD_STOP, max = lowerMaintenance + 200
  const customMax = lowerMaintenance + 200;

  // DEFAULT SELECTION RULE
  let defaultPlan: 'sustainable' | 'accelerated' | 'onTime' | 'custom' | null = null;
  if (sustainableIsVisible) {
    defaultPlan = 'sustainable';
  } else if (acceleratedIsVisible) {
    defaultPlan = 'accelerated';
  } else if (onTimeIsSelectable) {
    defaultPlan = 'onTime';
  } else {
    defaultPlan = 'custom';
  }

  // NO_SAFE_PLAN: If no preset plans are selectable (including sustainable)
  if (!onTimeIsSelectable && !sustainableIsVisible && !acceleratedIsVisible) {
    return {
      status: 'NO_SAFE_PLAN',
      message: 'Your target date requires an unsafe daily calorie deficit. Choose a later date, adjust your goal, or use Custom.',
      lowerMaintenance,
      softFloor,
      plans: {
        onTime: {
          dailyCalories: onTimeCalories,
          isSelectable: false,
          isVisible: true,
          warningLevel: onTimeWarningLevel,
        },
        sustainable: {
          dailyCalories: sustainableCalories,
          isVisible: sustainableIsVisible, // Still check if sustainable is available
        },
        accelerated: {
          dailyCalories: acceleratedCalories,
          isVisible: false,
          warningLevel: acceleratedWarningLevel,
        },
        custom: {
          min: HARD_HARD_STOP,
          max: customMax,
        },
      },
      defaultPlan: 'custom',
    };
  }

  // OK: Normal case
  return {
    status: 'OK',
    lowerMaintenance,
    softFloor,
    plans: {
      onTime: {
        dailyCalories: onTimeCalories,
        isSelectable: onTimeIsSelectable,
        isVisible: true,
        warningLevel: onTimeWarningLevel,
      },
      sustainable: {
        dailyCalories: sustainableCalories,
        isVisible: sustainableIsVisible,
      },
      accelerated: {
        dailyCalories: acceleratedCalories,
        isVisible: acceleratedIsVisible,
        warningLevel: acceleratedWarningLevel,
      },
      custom: {
        min: HARD_HARD_STOP,
        max: customMax,
      },
    },
    defaultPlan,
  };
}

/**
 * Legacy function for backward compatibility (DEPRECATED)
 * @deprecated Use computeMaintenanceRange instead
 */
export function computeTdee(params: {
  sexAtBirth: 'male' | 'female' | 'unknown';
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  activityLevel: string;
}): {
  tdee: number;
  bmr: number;
  activityCalories: number;
  activityMultiplier: number;
  bmrMethod: 'mifflin' | 'katch' | 'blend';
  usedBodyFat: boolean;
} {
  const range = computeMaintenanceRange(params);
  // Return upper bound for backward compatibility (but new code should use ranges)
  return {
    tdee: range.upperMaintenance,
    bmr: range.upperBmr,
    activityCalories: range.upperActivityCalories,
    activityMultiplier: range.activityMultiplier,
    bmrMethod: range.bmrMethod,
    usedBodyFat: range.usedBodyFat,
  };
}

/**
 * Legacy function for backward compatibility (DEPRECATED)
 * @deprecated Use getWeightLossCaloriePlans instead
 */
export function getWeightLossCaloriePresets(params: {
  tdee: number;
  sexAtBirth: 'male' | 'female' | 'unknown';
  requiredDailyDeficit?: number | null;
}): {
  floorCalories: number;
  maxDeficit: number;
  presets: Array<{
    key: 'easy' | 'recommended' | 'aggressive';
    deficit: number;
    calories: number;
    lbsPerWeek: number;
  }>;
  defaultKey: 'easy' | 'recommended' | 'aggressive';
  clippedByFloor: boolean;
} {
  // This is deprecated but kept for backward compatibility
  // New code should use getWeightLossCaloriePlans
  const floorCalories = getSafetyFloor(params.sexAtBirth);
  const maxDeficit = Math.min(1000, Math.round(0.35 * params.tdee));
  
  const presetDeficits = {
    easy: 250,
    recommended: 500,
    aggressive: 750,
  };

  let defaultKey: 'easy' | 'recommended' | 'aggressive' = 'recommended';
  if (params.requiredDailyDeficit !== null && params.requiredDailyDeficit !== undefined) {
    if (params.requiredDailyDeficit < 250) {
      defaultKey = 'easy';
    } else if (params.requiredDailyDeficit <= 650) {
      defaultKey = 'recommended';
    } else {
      defaultKey = 'aggressive';
    }
  }

  let clippedByFloor = false;
  const presets: Array<{
    key: 'easy' | 'recommended' | 'aggressive';
    deficit: number;
    calories: number;
    lbsPerWeek: number;
  }> = [];

  for (const [key, presetDeficit] of Object.entries(presetDeficits)) {
    const effectiveDeficit = Math.min(presetDeficit, maxDeficit);
    const rawCalories = params.tdee - effectiveDeficit;
    const calories = Math.max(floorCalories, rawCalories);
    
    if (calories > rawCalories) {
      clippedByFloor = true;
    }

    const actualDeficit = params.tdee - calories;
    const lbsPerWeek = (actualDeficit * 7) / 3500;

    presets.push({
      key: key as 'easy' | 'recommended' | 'aggressive',
      deficit: actualDeficit,
      calories,
      lbsPerWeek: Math.round(lbsPerWeek * 10) / 10,
    });
  }

  return {
    floorCalories,
    maxDeficit,
    presets,
    defaultKey,
    clippedByFloor,
  };
}

/**
 * Suggest weight loss nutrient targets
 */
export function suggestWeightLossNutrients(params: {
  goalWeightLb: number;
  currentWeightLb: number;
  sexAtBirth: 'male' | 'female' | 'unknown';
  activityLevel: string;
}): {
  proteinMinG: number;
  fiberMinG: number;
  carbsMaxG: number;
  sugarMaxG: number;
  sodiumMaxMg: number;
  waterTargetMl: number;
  clamps: {
    protein: { min: number; max: number; step: number };
    fiber: { min: number; max: number; step: number };
    carbs: { min: number; max: number; step: number };
    sugar: { min: number; max: number; step: number };
    sodium: { min: number; max: number; step: number };
    water: { min: number; max: number; step: number };
  };
} {
  const { goalWeightLb, currentWeightLb, sexAtBirth, activityLevel } = params;

  // Protein min
  let proteinMultiplier = 0.7; // sedentary default
  if (activityLevel === 'light' || activityLevel === 'moderate') {
    proteinMultiplier = 0.7;
  } else if (activityLevel === 'high' || activityLevel === 'very_high') {
    proteinMultiplier = 0.85;
  }
  proteinMultiplier = clamp(proteinMultiplier, 0.7, 0.85);
  let proteinG = Math.round(goalWeightLb * proteinMultiplier);
  proteinG = clamp(proteinG, 80, 250);
  proteinG = Math.round(proteinG / 5) * 5; // Round to nearest 5g

  // Fiber min
  let fiberG = 28; // unknown default
  if (sexAtBirth === 'female') {
    fiberG = 25;
  } else if (sexAtBirth === 'male') {
    fiberG = 30;
  }
  if (goalWeightLb > 190) {
    fiberG += 5;
  }
  if (activityLevel === 'high' || activityLevel === 'very_high') {
    fiberG += 3;
  }
  fiberG = Math.round(clamp(fiberG, 22, 45));

  // Carbs max (weight loss)
  let carbsG: number;
  if (activityLevel === 'sedentary') {
    carbsG = 130;
  } else if (activityLevel === 'light' || activityLevel === 'moderate') {
    carbsG = 170;
  } else {
    carbsG = 220;
  }
  carbsG = clamp(carbsG, 80, 300);
  carbsG = Math.round(carbsG / 10) * 10; // Round to nearest 10g

  // Sugar max
  const sugarG = 40;
  const sugarGClamped = clamp(sugarG, 25, 70);
  const sugarGFinal = Math.round(sugarGClamped / 5) * 5; // Round to nearest 5g

  // Sodium max
  let sodiumMg = 2300;
  if (activityLevel === 'high' || activityLevel === 'very_high') {
    sodiumMg = 2600;
  }
  sodiumMg = clamp(sodiumMg, 1500, 3500);
  sodiumMg = Math.round(sodiumMg / 100) * 100; // Round to nearest 100mg

  // Water (ml) - 30 ml per kg body weight baseline
  const weightKg = lbToKg(currentWeightLb);
  let waterMl = Math.round(weightKg * 30);
  if (activityLevel === 'light' || activityLevel === 'moderate') {
    waterMl += 300;
  } else if (activityLevel === 'high' || activityLevel === 'very_high') {
    waterMl += 700;
  }
  waterMl = clamp(waterMl, 1800, 4500);
  waterMl = Math.round(waterMl / 100) * 100; // Round to nearest 100ml

  return {
    proteinMinG: proteinG,
    fiberMinG: fiberG,
    carbsMaxG: carbsG,
    sugarMaxG: sugarGFinal,
    sodiumMaxMg: sodiumMg,
    waterTargetMl: waterMl,
    clamps: {
      protein: { min: NUTRIENT_TARGETS.PROTEIN_G.MIN, max: NUTRIENT_TARGETS.PROTEIN_G.MAX, step: NUTRIENT_TARGETS.PROTEIN_G.STEP },
      fiber: { min: NUTRIENT_TARGETS.FIBER_G.MIN, max: NUTRIENT_TARGETS.FIBER_G.MAX, step: NUTRIENT_TARGETS.FIBER_G.STEP },
      carbs: { min: NUTRIENT_TARGETS.CARBS_G.MIN, max: NUTRIENT_TARGETS.CARBS_G.MAX, step: NUTRIENT_TARGETS.CARBS_G.STEP },
      sugar: { min: NUTRIENT_TARGETS.SUGAR_G.MIN, max: NUTRIENT_TARGETS.SUGAR_G.MAX, step: NUTRIENT_TARGETS.SUGAR_G.STEP },
      sodium: { min: NUTRIENT_TARGETS.SODIUM_MG.MIN, max: NUTRIENT_TARGETS.SODIUM_MG.MAX, step: NUTRIENT_TARGETS.SODIUM_MG.STEP },
      water: { min: 1800, max: 4500, step: 100 },
    },
  };
}

/**
 * Compute suggested daily focus targets based on user inputs
 * Per engineering guidelines: Domain logic lives in plain TS modules with no React/browser/UI imports.
 */
export interface SuggestedTargets {
  proteinGMin: { value: number; min: number; max: number; step: number };
  fiberGMin: { value: number; min: number; max: number; step: number };
  carbsGMax: { value: number; min: number; max: number; step: number; isPrimary?: boolean };
  sugarGMax: { value: number; min: number; max: number; step: number };
  sodiumMgMax: { value: number; min: number; max: number; step: number };
}

export function computeSuggestedTargets(
  goalType: 'lose' | 'gain' | 'maintain' | 'recomp' | '' | null,
  currentWeightLb: number | null,
  targetWeightLb: number | null,
  heightCm: number | null,
  sexAtBirth: 'male' | 'female' | '' | null,
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | ''
): SuggestedTargets | null {
  if (!goalType || currentWeightLb === null) {
    return null;
  }

  const weightLb = targetWeightLb !== null ? targetWeightLb : currentWeightLb;
  const isWeightLoss = goalType === 'lose';

  // For weight loss, use the rules module
  if (isWeightLoss && sexAtBirth && activityLevel) {
    const suggestions = suggestWeightLossNutrients({
      goalWeightLb: weightLb,
      currentWeightLb,
      sexAtBirth: sexAtBirth as 'male' | 'female' | 'unknown',
      activityLevel,
    });

    return {
      proteinGMin: {
        value: suggestions.proteinMinG,
        min: suggestions.clamps.protein.min,
        max: suggestions.clamps.protein.max,
        step: suggestions.clamps.protein.step,
      },
      fiberGMin: {
        value: suggestions.fiberMinG,
        min: suggestions.clamps.fiber.min,
        max: suggestions.clamps.fiber.max,
        step: suggestions.clamps.fiber.step,
      },
      carbsGMax: {
        value: suggestions.carbsMaxG,
        min: suggestions.clamps.carbs.min,
        max: suggestions.clamps.carbs.max,
        step: suggestions.clamps.carbs.step,
        isPrimary: true,
      },
      sugarGMax: {
        value: suggestions.sugarMaxG,
        min: suggestions.clamps.sugar.min,
        max: suggestions.clamps.sugar.max,
        step: suggestions.clamps.sugar.step,
      },
      sodiumMgMax: {
        value: suggestions.sodiumMaxMg,
        min: suggestions.clamps.sodium.min,
        max: suggestions.clamps.sodium.max,
        step: suggestions.clamps.sodium.step,
      },
    };
  }

  // For non-weight-loss, use simplified logic (can be enhanced later)
  // Protein (always primary)
  let proteinMultiplier = 0.7; // sedentary default
  if (activityLevel === 'light' || activityLevel === 'moderate') {
    proteinMultiplier = 0.7;
  } else if (activityLevel === 'high' || activityLevel === 'very_high') {
    proteinMultiplier = 0.85;
  }
  proteinMultiplier = clamp(proteinMultiplier, 0.7, 0.85);
  let proteinG = Math.round(weightLb * proteinMultiplier);
  proteinG = clamp(proteinG, NUTRIENT_TARGETS.PROTEIN_G.MIN, NUTRIENT_TARGETS.PROTEIN_G.MAX);
  proteinG = Math.round(proteinG / NUTRIENT_TARGETS.PROTEIN_G.STEP) * NUTRIENT_TARGETS.PROTEIN_G.STEP;

  // Fiber (always primary)
  let fiberG = 28; // unknown default
  if (sexAtBirth === 'female') {
    fiberG = 25;
  } else if (sexAtBirth === 'male') {
    fiberG = 30;
  }
  if (weightLb > 190) {
    fiberG += 5;
  }
  if (activityLevel === 'high' || activityLevel === 'very_high') {
    fiberG += 3;
  }
  fiberG = clamp(Math.round(fiberG), NUTRIENT_TARGETS.FIBER_G.MIN, NUTRIENT_TARGETS.FIBER_G.MAX);

  // Carbs (secondary for non-weight-loss)
  let carbsG: number;
  if (activityLevel === 'sedentary') {
    carbsG = 220;
  } else if (activityLevel === 'light' || activityLevel === 'moderate') {
    carbsG = 260;
  } else {
    carbsG = 320;
  }
  carbsG = clamp(carbsG, NUTRIENT_TARGETS.CARBS_G.MIN, NUTRIENT_TARGETS.CARBS_G.MAX);
  carbsG = Math.round(carbsG / NUTRIENT_TARGETS.CARBS_G.STEP) * NUTRIENT_TARGETS.CARBS_G.STEP;

  // Sugar (secondary)
  const sugarG = 40;
  const sugarGClamped = clamp(sugarG, NUTRIENT_TARGETS.SUGAR_G.MIN, NUTRIENT_TARGETS.SUGAR_G.MAX);
  const sugarGFinal = Math.round(sugarGClamped / NUTRIENT_TARGETS.SUGAR_G.STEP) * NUTRIENT_TARGETS.SUGAR_G.STEP;

  // Sodium (secondary)
  let sodiumMg = 2300;
  if (activityLevel === 'high' || activityLevel === 'very_high') {
    sodiumMg = 2600;
  }
  sodiumMg = clamp(sodiumMg, NUTRIENT_TARGETS.SODIUM_MG.MIN, NUTRIENT_TARGETS.SODIUM_MG.MAX);
  sodiumMg = Math.round(sodiumMg / NUTRIENT_TARGETS.SODIUM_MG.STEP) * NUTRIENT_TARGETS.SODIUM_MG.STEP;

  return {
    proteinGMin: { value: proteinG, min: NUTRIENT_TARGETS.PROTEIN_G.MIN, max: NUTRIENT_TARGETS.PROTEIN_G.MAX, step: NUTRIENT_TARGETS.PROTEIN_G.STEP },
    fiberGMin: { value: fiberG, min: NUTRIENT_TARGETS.FIBER_G.MIN, max: NUTRIENT_TARGETS.FIBER_G.MAX, step: NUTRIENT_TARGETS.FIBER_G.STEP },
    carbsGMax: { value: carbsG, min: NUTRIENT_TARGETS.CARBS_G.MIN, max: NUTRIENT_TARGETS.CARBS_G.MAX, step: NUTRIENT_TARGETS.CARBS_G.STEP, isPrimary: false },
    sugarGMax: { value: sugarGFinal, min: NUTRIENT_TARGETS.SUGAR_G.MIN, max: NUTRIENT_TARGETS.SUGAR_G.MAX, step: NUTRIENT_TARGETS.SUGAR_G.STEP },
    sodiumMgMax: { value: sodiumMg, min: NUTRIENT_TARGETS.SODIUM_MG.MIN, max: NUTRIENT_TARGETS.SODIUM_MG.MAX, step: NUTRIENT_TARGETS.SODIUM_MG.STEP },
  };
}

/**
 * Compute slider ranges for a nutrient based on recommended value
 * Per engineering guidelines: Domain logic lives in plain TS modules with no React/browser/UI imports.
 */
export function computeSliderRange(
  recommendedValue: number,
  config: {
    minOffset: number;
    maxOffset: number;
    step: number;
    minFloor?: number;
    maxCeiling?: number;
  }
): { min: number; max: number; step: number } {
  const min = Math.max(config.minFloor ?? 0, recommendedValue - config.minOffset);
  const max = Math.min(
    config.maxCeiling ?? Infinity,
    recommendedValue + config.maxOffset
  );
  return { min, max, step: config.step };
}
