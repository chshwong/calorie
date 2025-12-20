/**
 * Goal Calorie and Nutrient Rules
 * 
 * Pure functions for calculating BMR, TDEE, calorie targets, and nutrient suggestions.
 * 
 * Per engineering guidelines: Domain logic lives in plain TS modules with no React/browser/UI imports.
 */

import { lbToKg } from '@/lib/domain/weight-constants';

// Global constants - DO NOT hardcode these values elsewhere
export const CALORIES_PER_LB = 3600;
export const CALORIE_LOSS_CONTINGENCY = 0.10;

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
  method: 'mifflin' | 'katch';
  usedBodyFat: boolean;
} {
  const { sexAtBirth, ageYears, heightCm, weightKg, bodyFatPct } = params;

  let rawBmr: number;
  let method: 'mifflin' | 'katch';
  let usedBodyFat: boolean;

  // Use Katch-McArdle if body fat is provided and within valid range
  if (bodyFatPct !== null && bodyFatPct !== undefined && bodyFatPct >= 5 && bodyFatPct <= 60) {
    const lbmKg = weightKg * (1 - bodyFatPct / 100);
    rawBmr = 370 + 21.6 * lbmKg;
    method = 'katch';
    usedBodyFat = true;
  } else {
    // Otherwise use Mifflin-St Jeor
    const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
    
    if (sexAtBirth === 'male') {
      rawBmr = baseBMR + 5;
    } else if (sexAtBirth === 'female') {
      rawBmr = baseBMR - 161;
    } else {
      // unknown: use midpoint between male/female constants
      // male: +5, female: -161, midpoint: -78
      rawBmr = baseBMR - 78;
    }
    method = 'mifflin';
    usedBodyFat = false;
  }

  const lowerBmr = floorToNearest10(rawBmr * (1 - CALORIE_LOSS_CONTINGENCY));
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
  bmrMethod: 'mifflin' | 'katch';
  usedBodyFat: boolean;
} {
  const { activityLevel, ...bmrParams } = params;
  const bmrResult = computeBmr(bmrParams);
  const multiplier = getActivityMultiplier(activityLevel);

  // Compute raw activity calories from raw BMR (before contingency and flooring)
  const rawActivityCalories = bmrResult.rawBmr * (multiplier - 1);

  // Apply contingency to activity calories
  const lowerActivityCalories = floorToNearest10(rawActivityCalories * (1 - CALORIE_LOSS_CONTINGENCY));
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
  key: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum';
  title: string;
  caloriesPerDay: number | null;
  isVisible: boolean;
  isSelectable: boolean;
  warningLevel: 'none' | 'soft' | 'hard' | 'unsafe';
  isRecommended: boolean;
  paceLbsPerWeek: number | null;
  etaWeeks: number | null;
  etaDateISO: string | null;
};

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
    custom: {
      min: number;
      max: number;
    };
  };
  defaultPlan: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'custom' | null;
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
  const clampFloor = softFloor; // Same as soft floor for More sustainable clamping

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
          isRecommended: false,
          paceLbsPerWeek: null,
          etaWeeks: null,
          etaDateISO: null,
        },
        standard: {
          key: 'standard',
          title: 'Standard',
          caloriesPerDay: null,
          isVisible: false,
          isSelectable: false,
          warningLevel: 'none',
          isRecommended: false,
          paceLbsPerWeek: null,
          etaWeeks: null,
          etaDateISO: null,
        },
        aggressive: {
          key: 'aggressive',
          title: 'Aggressive',
          caloriesPerDay: null,
          isVisible: false,
          isSelectable: false,
          warningLevel: 'none',
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
    warningLevel: 'none' | 'soft' | 'hard' | 'unsafe';
  } {
    if (calorieTarget < HARD_HARD_STOP) {
      return { isSelectable: false, warningLevel: 'unsafe' };
    }
    if (calorieTarget < HARD_FLOOR) {
      return { isSelectable: true, warningLevel: 'hard' };
    }
    if (calorieTarget < softFloor) {
      return { isSelectable: true, warningLevel: 'soft' };
    }
    return { isSelectable: true, warningLevel: 'none' };
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
  const aggressiveCalories = roundToNearest10(aggressiveRawTarget);
  const aggressiveSafety = evaluateSafety(aggressiveCalories);
  const aggressivePaceAndDate = calculatePaceAndDate(aggressiveCalories);

  const aggressivePlan: BaselinePlan = {
    key: 'aggressive',
    title: 'Aggressive',
    caloriesPerDay: aggressiveCalories,
    isVisible: true,
    isSelectable: aggressiveSafety.isSelectable,
    warningLevel: aggressiveSafety.warningLevel,
    isRecommended: false, // Never recommended
    ...aggressivePaceAndDate,
  };

  // STANDARD (D=500)
  const standardRawTarget = maintenanceMid - STANDARD_DEFICIT;
  const standardCalories = roundToNearest10(standardRawTarget);
  const standardSafety = evaluateSafety(standardCalories);
  const standardPaceAndDate = calculatePaceAndDate(standardCalories);

  // Standard is recommended if selectable AND no warning
  const standardIsRecommended = standardSafety.isSelectable && standardSafety.warningLevel === 'none';

  const standardPlan: BaselinePlan = {
    key: 'standard',
    title: 'Standard',
    caloriesPerDay: standardCalories,
    isVisible: true,
    isSelectable: standardSafety.isSelectable,
    warningLevel: standardSafety.warningLevel,
    isRecommended: standardIsRecommended,
    ...standardPaceAndDate,
  };

  // MORE SUSTAINABLE (D=300)
  const moreSustainableRawTarget = maintenanceMid - MORE_SUSTAINABLE_DEFICIT;
  const moreSustainableRawCalories = roundToNearest10(moreSustainableRawTarget);

  let moreSustainableCalories: number;
  let moreSustainableIsVisible: boolean;
  let moreSustainableWarningLevel: 'none' | 'soft' | 'hard' | 'unsafe' = 'none';

  if (moreSustainableRawCalories >= softFloor) {
    // Case A: Normal path
    moreSustainableCalories = moreSustainableRawCalories;
    moreSustainableIsVisible = true;
    moreSustainableWarningLevel = 'none';
  } else {
    // Case B: Clamp behavior
    // Only show if maintenanceLow >= clampFloor + 75
    if (maintenanceLow >= clampFloor + MAINTENANCE_BUFFER) {
      moreSustainableCalories = clampFloor;
      moreSustainableIsVisible = true;
      moreSustainableWarningLevel = 'soft';
    } else {
      // Hide More sustainable
      moreSustainableCalories = clampFloor;
      moreSustainableIsVisible = false;
      moreSustainableWarningLevel = 'none';
    }
  }

  const moreSustainableSafety = evaluateSafety(moreSustainableCalories);
  const moreSustainablePaceAndDate = calculatePaceAndDate(moreSustainableCalories);

  const moreSustainablePlan: BaselinePlan = {
    key: 'moreSustainable',
    title: 'More sustainable',
    caloriesPerDay: moreSustainableIsVisible ? moreSustainableCalories : null,
    isVisible: moreSustainableIsVisible,
    isSelectable: moreSustainableIsVisible && moreSustainableSafety.isSelectable,
    warningLevel: moreSustainableIsVisible && moreSustainableWarningLevel !== 'none'
      ? moreSustainableWarningLevel
      : moreSustainableSafety.warningLevel,
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
    warningLevel: cautiousMinimumShouldShow ? 'soft' : 'none',
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

  // DEFAULT SELECTION PRIORITY:
  // 1) Standard if selectable AND no warning (recommended state)
  // 2) Cautious Minimum if it exists (it is recommended in that scenario)
  // 3) More sustainable if selectable
  // 4) Standard if selectable (even warned)
  // 5) Aggressive if selectable
  // 6) Otherwise leave none selected and keep Custom available
  let defaultPlan: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'custom' | null = null;

  if (standardPlan.isSelectable && standardPlan.warningLevel === 'none') {
    defaultPlan = 'standard';
  } else if (cautiousMinimumPlan.isVisible && cautiousMinimumPlan.isSelectable) {
    defaultPlan = 'cautiousMinimum';
  } else if (moreSustainablePlan.isSelectable) {
    defaultPlan = 'moreSustainable';
  } else if (standardPlan.isSelectable) {
    defaultPlan = 'standard';
  } else if (aggressivePlan.isSelectable) {
    defaultPlan = 'aggressive';
  } else {
    defaultPlan = 'custom';
  }

  return {
    status: 'OK',
    plans: {
      moreSustainable: moreSustainablePlan,
      standard: standardPlan,
      aggressive: aggressivePlan,
      cautiousMinimum: cautiousMinimumPlan,
      custom: {
        min: HARD_HARD_STOP,
        max: maintenanceLow + 200,
      },
    },
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
    const sustainableCalories = roundToNearest10(sustainableRaw);
    const sustainableCaloriesClamped = Math.max(sustainableCalories, softFloor);
    
    const sustainableIsVisible = sustainableCaloriesClamped < lowerMaintenance;
    
    const acceleratedCalories = roundToNearest10(lowerMaintenance * 0.75); // Approximate maintenance
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
        dailyCalories: sustainableCaloriesClamped,
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
  const sustainableCalories = roundToNearest10(sustainableRaw);
  // Clamp to safe minimum for display
  const sustainableCaloriesClamped = Math.max(sustainableCalories, softFloor);
  
  // SUSTAINABLE: Visible if target < lowerMaintenance (after clamping to softFloor, it's always >= softFloor)
  const sustainableIsVisible = sustainableCaloriesClamped < lowerMaintenance;
  
  // ACCELERATED: Compute from baseline deficit (NO clamping)
  const acceleratedRaw = lowerMaintenance - (requiredDailyDeficit * 1.15);
  const acceleratedCalories = roundToNearest10(acceleratedRaw);

  // Round to nearest 10 for display
  const onTimeCalories = roundToNearest10(baselineOnTimeCalories);

  // ON-TIME: Always compute, eligibility based on floors
  let onTimeIsSelectable = onTimeCalories >= HARD_HARD_STOP;
  let onTimeWarningLevel: 'none' | 'orange' | 'red' | 'red_critical' = 'none';
  
  if (onTimeCalories < HARD_HARD_STOP) {
    onTimeWarningLevel = 'red_critical';
  } else if (onTimeCalories < HARD_FLOOR) {
    onTimeWarningLevel = 'red';
  } else if (onTimeCalories < softFloor) {
    onTimeWarningLevel = 'orange';
  }

  // ACCELERATED: Visible and selectable ONLY IF calories >= HARD_FLOOR
  const acceleratedIsVisible = acceleratedCalories >= HARD_FLOOR;
  const acceleratedWarningLevel: 'none' | 'orange' = 
    acceleratedIsVisible && acceleratedCalories < softFloor ? 'orange' : 'none';

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
          dailyCalories: sustainableCaloriesClamped,
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
        dailyCalories: sustainableCaloriesClamped,
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
  bmrMethod: 'mifflin' | 'katch';
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
  let proteinMultiplier = 0.6; // sedentary default
  if (activityLevel === 'light' || activityLevel === 'moderate') {
    proteinMultiplier = 0.75;
  } else if (activityLevel === 'high' || activityLevel === 'very_high') {
    proteinMultiplier = 0.85;
  }
  proteinMultiplier = clamp(proteinMultiplier, 0.5, 1.0);
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
      protein: { min: 80, max: 250, step: 5 },
      fiber: { min: 22, max: 45, step: 1 },
      carbs: { min: 80, max: 300, step: 10 },
      sugar: { min: 25, max: 70, step: 5 },
      sodium: { min: 1500, max: 3500, step: 100 },
      water: { min: 1800, max: 4500, step: 100 },
    },
  };
}
