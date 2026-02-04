import {
  computeBmr,
  computeMaintenanceRange,
  roundDownTo25,
  suggestCaloriePlans,
  type SuggestedCaloriePlan,
  type SupportedGoalType,
} from "../../../../lib/onboarding/goal-calorie-nutrient-rules";

export type DailyCalorieTargetInputs = {
  sexAtBirth: "male" | "female" | "unknown";
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  activityLevel: string;
  currentWeightLb: number | null;
  targetWeightLb?: number | null;
};

export type MaintenancePresetKey = "leaner_side" | "maintain" | "flexible";

export type MaintenancePreset = {
  key: MaintenancePresetKey;
  caloriesPerDay: number;
  isRecommended: boolean;
  sourceKey: SuggestedCaloriePlan["key"];
};

export function getBmrRange(params: {
  sexAtBirth: "male" | "female" | "unknown";
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
}) {
  return computeBmr(params);
}

export function getMaintenanceRange(params: {
  sexAtBirth: "male" | "female" | "unknown";
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  activityLevel: string;
}) {
  return computeMaintenanceRange(params);
}

export function getMaintenanceSummary(
  params: DailyCalorieTargetInputs & { goalType: SupportedGoalType }
) {
  const result = suggestCaloriePlans({
    goalType: params.goalType,
    sexAtBirth: params.sexAtBirth,
    ageYears: params.ageYears,
    heightCm: params.heightCm,
    weightKg: params.weightKg,
    bodyFatPct: params.bodyFatPct,
    activityLevel: params.activityLevel,
    currentWeightLb: params.currentWeightLb,
    targetWeightLb: params.targetWeightLb ?? null,
  });

  return result.maintenance;
}

export function getMaintenancePresets(
  params: DailyCalorieTargetInputs & { goalType: "maintain" | "recomp" }
): { presets: MaintenancePreset[]; recommendedKey: MaintenancePresetKey | null } {
  const result = suggestCaloriePlans({
    goalType: params.goalType,
    sexAtBirth: params.sexAtBirth,
    ageYears: params.ageYears,
    heightCm: params.heightCm,
    weightKg: params.weightKg,
    bodyFatPct: params.bodyFatPct,
    activityLevel: params.activityLevel,
    currentWeightLb: params.currentWeightLb,
    targetWeightLb: params.targetWeightLb ?? null,
  });

  const orderedKeys =
    params.goalType === "maintain"
      ? (["maintain_leaner", "maintain_standard", "maintain_flexible"] as const)
      : (["recomp_leaner", "recomp_standard", "recomp_muscle"] as const);

  const keyMap: Record<(typeof orderedKeys)[number], MaintenancePresetKey> = {
    maintain_leaner: "leaner_side",
    maintain_standard: "maintain",
    maintain_flexible: "flexible",
    recomp_leaner: "leaner_side",
    recomp_standard: "maintain",
    recomp_muscle: "flexible",
  };

  const presets = orderedKeys
    .map((key) => result.plans.find((plan) => plan.key === key))
    .filter((plan): plan is SuggestedCaloriePlan => Boolean(plan))
    .map((plan) => ({
      key: keyMap[plan.key as (typeof orderedKeys)[number]],
      caloriesPerDay: plan.caloriesPerDay,
      isRecommended: plan.isRecommended,
      sourceKey: plan.key,
    }));

  const recommendedKey = presets.find((preset) => preset.isRecommended)?.key ?? null;

  return { presets, recommendedKey };
}

export function getCustomCalorieConfig(
  params: DailyCalorieTargetInputs & { goalType: SupportedGoalType }
) {
  const result = suggestCaloriePlans({
    goalType: params.goalType,
    sexAtBirth: params.sexAtBirth,
    ageYears: params.ageYears,
    heightCm: params.heightCm,
    weightKg: params.weightKg,
    bodyFatPct: params.bodyFatPct,
    activityLevel: params.activityLevel,
    currentWeightLb: params.currentWeightLb,
    targetWeightLb: params.targetWeightLb ?? null,
  });

  return {
    min: result.custom.min,
    max: result.custom.max,
    step: 25,
  };
}

export function clampCustomCalories(
  value: number,
  config: { min: number; max: number }
) {
  const clamped = Math.max(config.min, Math.min(config.max, value));
  return Math.max(config.min, roundDownTo25(clamped));
}
