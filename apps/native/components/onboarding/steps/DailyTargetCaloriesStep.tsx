import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ActivityPickerModal } from "@/components/onboarding/ActivityPickerModal";
import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { useAuth } from "@/contexts/AuthContext";
import { saveStepFourProfile } from "@/services/onboarding";
import { ActivityLevel } from "@/lib/validation/activity";
import { colors, radius, spacing } from "@/theme/tokens";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ageFromDob } from "../../../../../utils/calculations";
import { lbToKg, roundTo1 } from "../../../../../utils/bodyMetrics";
import {
  CALORIES_PER_LB,
  computeMaintenanceRange,
  computePaceAndEta,
  formatDateForDisplay,
  getBaselineDeficitPlans,
  getWeightLossCalorieWarning,
  HARD_FLOOR,
  HARD_HARD_STOP,
  roundDownTo25,
  suggestCaloriePlans,
  type SuggestedCaloriePlan,
} from "../../../../../lib/onboarding/goal-calorie-nutrient-rules";

// Web contract: inputs (goal_type, gender, date_of_birth, height_cm, weight_lb, goal_weight_lb,
// activity_level, body_fat_percent, weight_unit) -> outputs (daily_calorie_target, maintenance_calories,
// calorie_plan, onboarding_calorie_set_at) using shared calorie rules helpers/constants.

type GoalType = "lose" | "maintain" | "gain" | "recomp";

type DailyTargetCaloriesStepProps = {
  profile: {
    date_of_birth: string | null;
    gender: "male" | "female" | null;
    height_cm: number | null;
    activity_level: ActivityLevel | null;
    weight_lb: number | null;
    weight_unit: "kg" | "lbs" | "lb" | null;
    body_fat_percent: number | null;
    goal_type: GoalType | null;
    goal_weight_lb: number | null;
  } | null;
  loading: boolean;
  error: string | null;
  onErrorClear: () => void;
  onBack: () => void;
  onContinue: () => void;
  onCalorieTargetChange: (target: {
    calorieTarget: number;
    maintenanceCalories: number;
    caloriePlan: string;
    executionMode?: "override";
  }) => void;
  onActivityLevelSaved?: (level: ActivityLevel) => void;
};

type CaloriePlanKey =
  | "moreSustainable"
  | "standard"
  | "aggressive"
  | "cautiousMinimum"
  | "sustainable_floor_1200"
  | "maintain_leaner"
  | "maintain_standard"
  | "maintain_flexible"
  | "recomp_leaner"
  | "recomp_standard"
  | "recomp_muscle"
  | "gain_lean"
  | "gain_standard"
  | "gain_aggressive"
  | "custom";

const GAIN_PRESET_PACES: Record<string, number> = {
  gain_lean: 0.4,
  gain_standard: 0.6,
  gain_aggressive: 1.3,
};

export function DailyTargetCaloriesStep({
  profile,
  loading,
  error,
  onErrorClear,
  onBack,
  onContinue,
  onCalorieTargetChange,
  onActivityLevelSaved,
}: DailyTargetCaloriesStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<CaloriePlanKey | null>(null);
  const [customCalories, setCustomCalories] = useState<number | null>(null);
  const [executionMode, setExecutionMode] = useState<"override" | undefined>(undefined);
  const [showCustomWarningModal, setShowCustomWarningModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const goalType = profile?.goal_type ?? null;
  const currentWeightLb = profile?.weight_lb ?? null;
  const targetWeightLb = profile?.goal_weight_lb ?? null;
  const heightCm = profile?.height_cm ?? null;
  const sexAtBirth = profile?.gender ?? null;
  const activityLevel = profile?.activity_level ?? null;
  const dobISO = profile?.date_of_birth ?? null;
  const bodyFatPercent = profile?.body_fat_percent ?? null;
  const weightUnit = profile?.weight_unit === "kg" ? "kg" : "lb";

  const isWeightLoss = goalType === "lose";
  const isMaintain = goalType === "maintain";
  const isRecomp = goalType === "recomp";
  const isGain = goalType === "gain";
  const isNonLoss = isMaintain || isRecomp || isGain;

  const activityMutation = useMutation({
    mutationFn: saveStepFourProfile,
    onSuccess: (_, variables) => {
      if (!user?.id) return;
      const queryKey = ["onboarding-profile", user.id];
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return { ...old, activity_level: variables.activityLevel };
      });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const maintenanceRange = useMemo(() => {
    if (!currentWeightLb || !heightCm || !sexAtBirth || !activityLevel || !dobISO) {
      return null;
    }
    const ageYears = ageFromDob(dobISO);
    const weightKg = lbToKg(currentWeightLb);
    return computeMaintenanceRange({
      sexAtBirth: sexAtBirth as "male" | "female" | "unknown",
      ageYears,
      heightCm,
      weightKg,
      bodyFatPct: bodyFatPercent,
      activityLevel,
    });
  }, [currentWeightLb, heightCm, sexAtBirth, activityLevel, dobISO, bodyFatPercent]);

  const calculations = useMemo(() => {
    if (!isWeightLoss || !maintenanceRange) {
      return null;
    }
    return {
      plans: getBaselineDeficitPlans({
        currentWeightLb,
        targetWeightLb,
        maintenanceLow: maintenanceRange.lowerMaintenance,
        maintenanceHigh: maintenanceRange.upperMaintenance,
        sexAtBirth: sexAtBirth as "male" | "female" | "unknown",
      }),
    };
  }, [isWeightLoss, maintenanceRange, currentWeightLb, targetWeightLb, sexAtBirth]);

  const nonLossSuggestions = useMemo(() => {
    if (!isNonLoss || !currentWeightLb || !heightCm || !sexAtBirth || !activityLevel || !dobISO) {
      return null;
    }
    const ageYears = ageFromDob(dobISO);
    const weightKg = lbToKg(currentWeightLb);
    return suggestCaloriePlans({
      goalType: goalType as "maintain" | "recomp" | "gain",
      sexAtBirth: sexAtBirth as "male" | "female" | "unknown",
      ageYears,
      heightCm,
      weightKg,
      bodyFatPct: bodyFatPercent,
      activityLevel,
      currentWeightLb,
      targetWeightLb,
    });
  }, [
    isNonLoss,
    goalType,
    currentWeightLb,
    targetWeightLb,
    heightCm,
    sexAtBirth,
    activityLevel,
    dobISO,
    bodyFatPercent,
  ]);

  const currentCalorieTarget = useMemo(() => {
    if (!selectedPlan) return null;
    if (selectedPlan === "custom" && customCalories !== null) {
      return customCalories;
    }
    if (isWeightLoss && calculations && selectedPlan !== "custom") {
      const plan = calculations.plans.plans[selectedPlan as keyof typeof calculations.plans.plans];
      if (plan && "isVisible" in plan && plan.isVisible && plan.isSelectable && plan.caloriesPerDay !== null) {
        return plan.caloriesPerDay;
      }
    }
    if (isNonLoss && nonLossSuggestions && selectedPlan !== "custom") {
      const plan = nonLossSuggestions.plans.find((p) => p.key === selectedPlan);
      if (plan && plan.isSelectable && isFinite(plan.caloriesPerDay) && plan.caloriesPerDay >= HARD_HARD_STOP) {
        return plan.caloriesPerDay;
      }
    }
    if (selectedPlan !== "custom" && customCalories !== null) {
      return customCalories;
    }
    return null;
  }, [calculations, nonLossSuggestions, isWeightLoss, isNonLoss, selectedPlan, customCalories]);

  useEffect(() => {
    if (calculations && selectedPlan === null) {
      if (calculations.plans.defaultPlan) {
        setSelectedPlan(calculations.plans.defaultPlan as CaloriePlanKey);
      }
    }
    if (nonLossSuggestions && selectedPlan === null) {
      setSelectedPlan(nonLossSuggestions.defaultPlanKey as CaloriePlanKey);
    }
    if (customCalories === null && calculations) {
      let defaultCalories: number;
      if (calculations.plans.plans.standard.isVisible && calculations.plans.plans.standard.caloriesPerDay !== null) {
        defaultCalories = calculations.plans.plans.standard.caloriesPerDay;
      } else if (calculations.plans.plans.moreSustainable.isVisible && calculations.plans.plans.moreSustainable.caloriesPerDay !== null) {
        defaultCalories = calculations.plans.plans.moreSustainable.caloriesPerDay;
      } else if (calculations.plans.plans.aggressive.isVisible && calculations.plans.plans.aggressive.caloriesPerDay !== null) {
        defaultCalories = calculations.plans.plans.aggressive.caloriesPerDay;
      } else {
        defaultCalories = maintenanceRange?.lowerMaintenance ?? HARD_HARD_STOP;
      }
      const clampedCalories = Math.max(HARD_HARD_STOP, roundDownTo25(defaultCalories));
      setCustomCalories(clampedCalories);
    }
    if (customCalories === null && nonLossSuggestions) {
      const defaultPlan = nonLossSuggestions.plans.find((p) => p.key === nonLossSuggestions.defaultPlanKey);
      const defaultCalories = defaultPlan?.caloriesPerDay ?? nonLossSuggestions.maintenance.mid;
      const clampedCalories = Math.max(HARD_HARD_STOP, roundDownTo25(defaultCalories));
      setCustomCalories(clampedCalories);
    }
  }, [selectedPlan, customCalories, calculations, nonLossSuggestions, maintenanceRange]);

  useEffect(() => {
    if (isWeightLoss && calculations && selectedPlan && selectedPlan !== "custom") {
      const plan = calculations.plans.plans[selectedPlan as keyof typeof calculations.plans.plans];
      if (plan && "isSelectable" in plan && !plan.isSelectable) {
        if (calculations.plans.defaultPlan) {
          setSelectedPlan(calculations.plans.defaultPlan as CaloriePlanKey);
        } else {
          setSelectedPlan("custom");
        }
      }
    }
    if (nonLossSuggestions && selectedPlan && selectedPlan !== "custom") {
      const plan = nonLossSuggestions.plans.find((p) => p.key === selectedPlan);
      if (plan && !plan.isSelectable) {
        setSelectedPlan(nonLossSuggestions.defaultPlanKey as CaloriePlanKey);
      }
    }
  }, [calculations, nonLossSuggestions, selectedPlan, isWeightLoss]);

  const canProceed = useMemo(() => {
    if (!selectedPlan) return false;
    if (selectedPlan === "custom") {
      return customCalories !== null && isFinite(customCalories) && customCalories >= HARD_HARD_STOP;
    }
    if (isWeightLoss && calculations && selectedPlan !== "custom") {
      const plan = calculations.plans.plans[selectedPlan as keyof typeof calculations.plans.plans];
      if (!plan || !("isVisible" in plan) || !plan.isVisible || !plan.isSelectable) {
        return false;
      }
      const planCalories = plan.caloriesPerDay;
      return planCalories !== null && isFinite(planCalories) && planCalories >= HARD_HARD_STOP;
    }
    if (isNonLoss && nonLossSuggestions) {
      const plan = nonLossSuggestions.plans.find((p) => p.key === selectedPlan);
      return Boolean(
        plan && plan.isSelectable && isFinite(plan.caloriesPerDay) && plan.caloriesPerDay >= HARD_HARD_STOP
      );
    }
    return false;
  }, [calculations, nonLossSuggestions, isWeightLoss, isNonLoss, selectedPlan, customCalories]);

  useEffect(() => {
    if (currentCalorieTarget !== null && calculations && selectedPlan !== null) {
      let legacyPlanKey: string;
      if (selectedPlan === "custom") {
        legacyPlanKey = "custom";
      } else if (selectedPlan === "moreSustainable") {
        legacyPlanKey = "sustainable";
      } else if (selectedPlan === "standard") {
        legacyPlanKey = "sustainable";
      } else if (selectedPlan === "aggressive") {
        legacyPlanKey = "accelerated";
      } else if (selectedPlan === "cautiousMinimum") {
        legacyPlanKey = "sustainable";
      } else {
        legacyPlanKey = "custom";
      }
      onCalorieTargetChange({
        calorieTarget: currentCalorieTarget,
        maintenanceCalories: maintenanceRange?.lowerMaintenance ?? 0,
        caloriePlan: legacyPlanKey,
        executionMode,
      });
    }
  }, [currentCalorieTarget, calculations, selectedPlan, executionMode, onCalorieTargetChange, maintenanceRange]);

  useEffect(() => {
    if (currentCalorieTarget !== null && nonLossSuggestions && selectedPlan !== null) {
      onCalorieTargetChange({
        calorieTarget: currentCalorieTarget,
        maintenanceCalories: nonLossSuggestions.maintenance.mid,
        caloriePlan: selectedPlan,
        executionMode: undefined,
      });
    }
  }, [currentCalorieTarget, nonLossSuggestions, selectedPlan, onCalorieTargetChange]);

  const handleCustomCaloriesChange = (newValue: number) => {
    const minBound = Math.max(
      HARD_HARD_STOP,
      isWeightLoss ? calculations?.plans.plans.custom.min ?? HARD_HARD_STOP : nonLossSuggestions?.custom.min ?? HARD_HARD_STOP
    );
    const maxBound = isWeightLoss
      ? calculations?.plans.plans.custom.max ?? HARD_HARD_STOP
      : nonLossSuggestions?.custom.max ?? HARD_HARD_STOP;
    const clamped = Math.max(minBound, Math.min(maxBound, newValue));
    const next = Math.max(minBound, roundDownTo25(clamped));
    setSelectedPlan("custom");
    setCustomCalories(next);
    onErrorClear();
    if (isWeightLoss && maintenanceRange && next > maintenanceRange.lowerMaintenance && !executionMode) {
      setShowCustomWarningModal(true);
    }
  };

  const getWarningTextForLevel = (warningLevel: "none" | "neutral" | "red" | "unsafe") => {
    if (warningLevel === "unsafe") return t("onboarding.calorie_target.warning_level_unsafe");
    if (warningLevel === "red") return t("onboarding.calorie_target.warning_level_red");
    if (warningLevel === "neutral") return t("onboarding.calorie_target.warning_level_neutral");
    return null;
  };

  const getCustomWarningText = (): { text: string; color: string } | null => {
    if (customCalories === null) return null;
    if (isWeightLoss) {
      const { warningLevel } = getWeightLossCalorieWarning(customCalories);
      const warningText = getWarningTextForLevel(warningLevel);
      if (!warningText) return null;
      const color = warningLevel === "neutral" ? theme.textMuted : theme.danger;
      return { text: warningText, color };
    }
    if (isNonLoss && nonLossSuggestions) {
      const upper = nonLossSuggestions.maintenance.upper;
      const lower = nonLossSuggestions.maintenance.lower;
      if (isMaintain || isRecomp) {
        const { warningLevel } = getWeightLossCalorieWarning(customCalories);
        const warningText = getWarningTextForLevel(warningLevel);
        if (!warningText) return null;
        const color = warningLevel === "neutral" ? theme.textMuted : theme.danger;
        return { text: warningText, color };
      }
      if (isGain && customCalories < lower) {
        return { text: t("onboarding.calorie_target.gain_warning_below_maintenance"), color: theme.danger };
      }
      if (isGain && customCalories > upper + 700) {
        return { text: t("onboarding.calorie_target.gain_warning_high"), color: theme.danger };
      }
    }
    return null;
  };

  const customMeta = useMemo(() => {
    if (!isWeightLoss || !maintenanceRange || customCalories === null || !currentWeightLb) {
      return { paceLbsPerWeek: null, etaWeeks: null, etaDate: null };
    }
    return computePaceAndEta({
      maintenanceLow: maintenanceRange.lowerMaintenance,
      maintenanceHigh: maintenanceRange.upperMaintenance,
      customCalories,
      currentWeightLb,
      targetWeightLb,
    });
  }, [isWeightLoss, maintenanceRange, customCalories, currentWeightLb, targetWeightLb]);

  const customGainMeta = useMemo(() => {
    if (!isGain || !maintenanceRange || customCalories === null || !currentWeightLb || !targetWeightLb) {
      return { paceLine: null, etaLine: null };
    }
    const maintenanceMid = (maintenanceRange.lowerMaintenance + maintenanceRange.upperMaintenance) / 2;
    const dailyDelta = customCalories - maintenanceMid;
    const lbPerWeek = (dailyDelta * 7) / CALORIES_PER_LB;
    if (!lbPerWeek || lbPerWeek <= 0) {
      return { paceLine: null, etaLine: null };
    }
    const weightDeltaLb = targetWeightLb - currentWeightLb;
    if (weightDeltaLb <= 0) {
      return { paceLine: null, etaLine: null };
    }
    const weeks = Math.ceil(weightDeltaLb / lbPerWeek);
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + weeks * 7);
    return {
      paceLine: t("onboarding.calorie_target.pace_per_week", { pace: roundTo1(Math.abs(lbPerWeek)) }),
      etaLine: t("onboarding.calorie_target.eta_weeks", {
        weeks,
        suffix: weeks === 1 ? "" : "s",
        date: formatDateForDisplay(etaDate.toISOString().split("T")[0]),
      }),
    };
  }, [isGain, maintenanceRange, customCalories, currentWeightLb, targetWeightLb, t]);

  const formatWeight = (weightLb: number): string => {
    if (weightUnit === "kg") {
      return `${roundTo1(lbToKg(weightLb))} ${t("units.kg")}`;
    }
    return `${roundTo1(weightLb)} ${t("units.lbs")}`;
  };

  const getActivityLabel = (): string => {
    if (!activityLevel) return "";
    return t(`onboarding.activity.${activityLevel}.label`);
  };

  const getSubtitleText = (): string => {
    if (!targetWeightLb) {
      return t("onboarding.calorie_target.subtitle_default");
    }
    const formattedWeight = formatWeight(targetWeightLb);
    if (isWeightLoss) {
      return t("onboarding.calorie_target.subtitle_lose", { weight: formattedWeight });
    }
    if (isMaintain) {
      return t("onboarding.calorie_target.subtitle_maintain", { weight: formattedWeight });
    }
    if (isRecomp) {
      return t("onboarding.calorie_target.subtitle_recomp", { weight: formattedWeight });
    }
    if (isGain) {
      return t("onboarding.calorie_target.subtitle_gain", { weight: formattedWeight });
    }
    return t("onboarding.calorie_target.subtitle_default");
  };

  if (!isWeightLoss && !isNonLoss) {
    return (
      <OnboardingShell
        step={8}
        totalSteps={12}
        title={t("onboarding.calorie_target.title")}
        subtitle={t("onboarding.calorie_target.coming_soon")}
        hero={
          <HeroCard>
            <View style={styles.heroVisual}>
              <MaterialCommunityIcons name="fire" size={64} color={theme.primary} />
            </View>
          </HeroCard>
        }
      >
        <View style={styles.section} />
      </OnboardingShell>
    );
  }

  if (isWeightLoss && !calculations) {
    return (
      <OnboardingShell
        step={8}
        totalSteps={12}
        title={t("onboarding.calorie_target.title")}
        subtitle={t("onboarding.calorie_target.error_missing_data")}
        hero={
          <HeroCard>
            <View style={styles.heroVisual}>
              <MaterialCommunityIcons name="fire" size={64} color={theme.primary} />
            </View>
          </HeroCard>
        }
      >
        <View style={styles.section} />
      </OnboardingShell>
    );
  }

  if (isNonLoss && !nonLossSuggestions) {
    return (
      <OnboardingShell
        step={8}
        totalSteps={12}
        title={t("onboarding.calorie_target.title")}
        subtitle={t("onboarding.calorie_target.error_missing_data")}
        hero={
          <HeroCard>
            <View style={styles.heroVisual}>
              <MaterialCommunityIcons name="fire" size={64} color={theme.primary} />
            </View>
          </HeroCard>
        }
      >
        <View style={styles.section} />
      </OnboardingShell>
    );
  }

  const renderMaintenanceLine = (text: string) => {
    let [label, range] = text.split("\n");
    if (!range) {
      const colonIndex = text.indexOf(":");
      if (colonIndex !== -1) {
        label = text.substring(0, colonIndex + 1).trim();
        range = text.substring(colonIndex + 1).trim();
      } else {
        const calDayIndex = text.indexOf(t("onboarding.calorie_target.kcal_per_day"));
        if (calDayIndex !== -1) {
          label = text.substring(0, calDayIndex).trim();
          range = text.substring(calDayIndex).trim();
        }
      }
    }
    if (!range) {
      return (
        <Text variant="body" style={styles.centerText}>
          {text}
        </Text>
      );
    }
    return (
      <>
        <Text variant="body" style={styles.centerText}>
          {label}
        </Text>
        <Text variant="body" style={[styles.centerText, styles.maintenanceRange]}>
          {range}
        </Text>
      </>
    );
  };

  const renderNonLossPlan = (plan: SuggestedCaloriePlan) => {
    const selected = selectedPlan === plan.key;
    const isSelectable = plan.isSelectable;
    let paceLine: string | null = null;
    let etaLine: string | null = null;
    if (isGain && maintenanceRange && currentWeightLb && targetWeightLb) {
      const presetPace = GAIN_PRESET_PACES[plan.key];
      if (presetPace !== undefined) {
        const weightDeltaLb = targetWeightLb - currentWeightLb;
        if (weightDeltaLb > 0 && presetPace > 0) {
          const weeks = Math.ceil(Math.abs(weightDeltaLb) / presetPace);
          const etaDate = new Date();
          etaDate.setDate(etaDate.getDate() + weeks * 7);
          paceLine = t("onboarding.calorie_target.pace_per_week", { pace: roundTo1(presetPace) });
          etaLine = t("onboarding.calorie_target.eta_weeks", {
            weeks,
            suffix: weeks === 1 ? "" : "s",
            date: formatDateForDisplay(etaDate.toISOString().split("T")[0]),
          });
        }
      }
    }
    let warningText: string | null = null;
    let warningLevel: "none" | "neutral" | "red" | "unsafe" = "none";
    if ((isMaintain || isRecomp) && plan.caloriesPerDay < HARD_FLOOR) {
      const warning = getWeightLossCalorieWarning(plan.caloriesPerDay);
      warningLevel = warning.warningLevel;
      warningText = getWarningTextForLevel(warning.warningLevel);
    } else if (plan.warning) {
      warningText = t(plan.warning.textKey);
      warningLevel = plan.warning.level === "red" ? "red" : plan.warning.level === "orange" ? "neutral" : "none";
    }
    return (
      <PlanCard
        key={plan.key}
        title={t(plan.titleKey)}
        recommended={plan.isRecommended}
        caloriesText={
          isSelectable
            ? `${plan.caloriesPerDay} ${t("onboarding.calorie_target.kcal_per_day")}`
            : t("onboarding.calorie_target.below_safe_minimum")
        }
        description={t(plan.subtitleKey)}
        paceText={paceLine}
        etaText={etaLine}
        warningText={warningText ?? undefined}
        warningTone={warningLevel === "neutral" ? "muted" : warningText ? "danger" : "muted"}
        showDisabledNotice={!isSelectable}
        disabled={!isSelectable}
        selected={selected}
        onPress={() => {
          if (isSelectable) {
            setSelectedPlan(plan.key as CaloriePlanKey);
            setCustomCalories(null);
            setExecutionMode(undefined);
            onErrorClear();
          }
        }}
      />
    );
  };

  const getWeightLossTitleKey = (planKey: string) => {
    switch (planKey) {
      case "moreSustainable":
      case "sustainable_floor_1200":
        return "onboarding.calorie_target.weight_loss_more_sustainable_title";
      case "standard":
        return "onboarding.calorie_target.weight_loss_standard_title";
      case "aggressive":
        return "onboarding.calorie_target.weight_loss_aggressive_title";
      case "cautiousMinimum":
        return "onboarding.calorie_target.weight_loss_cautious_minimum_title";
      default:
        return "onboarding.calorie_target.weight_loss_standard_title";
    }
  };

  const renderWeightLossPlan = (planKey: CaloriePlanKey) => {
    if (!calculations) return null;
    const plan = calculations.plans.plans[planKey as keyof typeof calculations.plans.plans];
    if (!plan || !("isVisible" in plan) || !plan.isVisible) return null;
    if (
      planKey === "aggressive" &&
      !plan.isSelectable &&
      plan.caloriesPerDay !== null &&
      plan.caloriesPerDay < HARD_HARD_STOP
    ) {
      return null;
    }
    const selected = selectedPlan === planKey;
    const isSelectable = plan.isSelectable;
    const paceText =
      plan.paceLbsPerWeek !== null && plan.paceLbsPerWeek > 0
        ? t("onboarding.calorie_target.pace_per_week", { pace: roundTo1(plan.paceLbsPerWeek) })
        : null;
    const dateText =
      plan.etaDateISO && plan.etaWeeks !== null && plan.etaWeeks > 0
        ? t("onboarding.calorie_target.eta_weeks", {
            weeks: plan.etaWeeks,
            suffix: plan.etaWeeks === 1 ? "" : "s",
            date: formatDateForDisplay(plan.etaDateISO),
          })
        : null;
    const warningText = plan.warningLevel !== "none" ? getWarningTextForLevel(plan.warningLevel) : null;
    const planSubtitle =
      plan.subtitle && planKey === "sustainable_floor_1200"
        ? t("onboarding.calorie_target.weight_loss_escape_hatch_subtitle")
        : undefined;
    const caloriesText =
      plan.caloriesPerDay !== null && isSelectable
        ? `${plan.caloriesPerDay} ${t("onboarding.calorie_target.kcal_per_day")}`
        : plan.caloriesPerDay !== null && !isSelectable
        ? plan.caloriesPerDay < HARD_HARD_STOP
          ? planKey === "standard"
            ? t("onboarding.calorie_target.try_custom_pace_instead")
            : t("onboarding.calorie_target.below_700_not_supported")
          : t("onboarding.calorie_target.below_safe_minimum")
        : "";
    return (
      <PlanCard
        key={planKey}
        title={t(getWeightLossTitleKey(planKey))}
        recommended={plan.isRecommended}
        caloriesText={caloriesText}
        description={
          planKey === "cautiousMinimum"
            ? t("onboarding.calorie_target.lower_safety_boundary")
            : planSubtitle
        }
        paceText={paceText ?? undefined}
        etaText={dateText ?? undefined}
        warningText={warningText ?? undefined}
        warningTone={warningText ? (plan.warningLevel === "neutral" ? "muted" : "danger") : "muted"}
        showDisabledNotice={false}
        disabled={!isSelectable}
        selected={selected}
        onPress={() => {
          if (isSelectable) {
            setSelectedPlan(planKey);
            setCustomCalories(null);
            setExecutionMode(undefined);
            onErrorClear();
          }
        }}
      />
    );
  };

  const shouldShowGoalLimitWarning =
    maintenanceRange && maintenanceRange.lowerMaintenance < 1100 && (isMaintain || isRecomp);

  const shouldHideNonLossPresets =
    maintenanceRange && maintenanceRange.lowerMaintenance < 1100 && (isMaintain || isRecomp);

  return (
    <OnboardingShell
      step={8}
      totalSteps={12}
      title={t("onboarding.calorie_target.title")}
      subtitle={t("onboarding.calorie_target.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <MaterialCommunityIcons name="fire" size={64} color={theme.primary} />
          </View>
        </HeroCard>
      }
    >
      <View style={styles.section}>
        {maintenanceRange ? (
          <View style={styles.breakdownSection}>
            <Text variant="caption" tone="muted" style={styles.centerText}>
              {t("onboarding.calorie_target.bmr_range_line", {
                lowerBmr: maintenanceRange.lowerBmr,
                upperBmr: maintenanceRange.upperBmr,
              })}
            </Text>
            <Pressable onPress={() => setShowActivityModal(true)}>
              <Text variant="caption" tone="primary" style={styles.centerText}>
                {t("onboarding.calorie_target.adjust_activity_link")}
              </Text>
            </Pressable>
            <Text variant="caption" tone="muted" style={styles.centerText}>
              {t("onboarding.calorie_target.activity_range_line", {
                lowerActivity: maintenanceRange.lowerActivityCalories,
                upperActivity: maintenanceRange.upperActivityCalories,
                activityLabel: getActivityLabel(),
              })}
            </Text>
            {isWeightLoss ? (
              renderMaintenanceLine(
                t("onboarding.calorie_target.maintenance_range_line", {
                  lowerMaintenance: maintenanceRange.lowerMaintenance,
                  upperMaintenance: maintenanceRange.upperMaintenance,
                })
              )
            ) : null}
            {isNonLoss && nonLossSuggestions ? (
              renderMaintenanceLine(
                t("onboarding.calorie_target.estimated_maintenance_range_line", {
                  lower: nonLossSuggestions.maintenance.lower,
                  upper: nonLossSuggestions.maintenance.upper,
                })
              )
            ) : null}
          </View>
        ) : null}

        <Text variant="body" style={styles.centerText}>
          {getSubtitleText()}
        </Text>

        {isWeightLoss && calculations && calculations.plans.status === "EXTREME_EDGE_CASE" ? (
          <View style={[styles.warningBanner, { borderColor: theme.danger }]}>
            <Text variant="caption" tone="danger" style={styles.centerText}>
              {t("onboarding.calorie_target.extreme_edge_case_title")}
            </Text>
            <Text variant="caption" tone="muted" style={[styles.centerText, styles.warningBody]}>
              {t("onboarding.calorie_target.extreme_edge_case_body")}
            </Text>
          </View>
        ) : null}

        {shouldShowGoalLimitWarning ? (
          <View style={[styles.warningBanner, { borderColor: theme.danger }]}>
            <Text variant="caption" tone="danger" style={styles.centerText}>
              {t("onboarding.calorie_target.maintenance_recomp_warning_title")}
            </Text>
            <Text variant="caption" tone="muted" style={[styles.centerText, styles.warningBody]}>
              {isMaintain
                ? t("onboarding.calorie_target.maintenance_warning_details")
                : t("onboarding.calorie_target.recomp_warning_details")}
            </Text>
          </View>
        ) : null}

        {isWeightLoss && calculations && calculations.plans.status !== "EXTREME_EDGE_CASE" ? (
          <View style={styles.planList}>
            {calculations.plans.plans.sustainable_floor_1200
              ? renderWeightLossPlan("sustainable_floor_1200")
              : null}
            {renderWeightLossPlan("moreSustainable")}
            {renderWeightLossPlan("standard")}
            {renderWeightLossPlan("aggressive")}
            {renderWeightLossPlan("cautiousMinimum")}
          </View>
        ) : null}

        {isNonLoss && nonLossSuggestions && !shouldHideNonLossPresets ? (
          <View style={styles.planList}>
            {nonLossSuggestions.plans.map((plan) => renderNonLossPlan(plan))}
          </View>
        ) : null}

        <View style={styles.planList}>
          {selectedPlan === "custom" ? (
            <View style={[styles.planCard, styles.planCardSelected, { borderColor: theme.primary }]}>
              <View style={styles.planHeader}>
                <Text variant="body" style={styles.planTitle}>
                  {t("onboarding.calorie_target.plan_custom")}
                </Text>
              </View>
              {customCalories !== null ? (
                <>
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => handleCustomCaloriesChange(customCalories - 25)}
                      disabled={loading}
                      style={[styles.stepperButton, { borderColor: theme.border }]}
                    >
                      <Feather name="minus" size={18} color={theme.textMuted} />
                    </Pressable>
                    <View style={[styles.stepperValue, { borderColor: theme.border }]}>
                      <Text variant="body" style={styles.stepperText}>
                        {customCalories}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {t("onboarding.calorie_target.kcal_per_day")}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleCustomCaloriesChange(customCalories + 25)}
                      disabled={loading}
                      style={[styles.stepperButton, { borderColor: theme.border }]}
                    >
                      <Feather name="plus" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                  {isWeightLoss && customMeta.paceLbsPerWeek !== null && customMeta.paceLbsPerWeek > 0 ? (
                    <Text variant="caption" tone="muted" style={styles.centerText}>
                      {t("onboarding.calorie_target.pace_per_week", {
                        pace: roundTo1(customMeta.paceLbsPerWeek),
                      })}
                    </Text>
                  ) : null}
                  {isWeightLoss && customMeta.etaWeeks !== null && customMeta.etaWeeks > 0 && customMeta.etaDate ? (
                    <Text variant="caption" tone="muted" style={styles.centerText}>
                      {t("onboarding.calorie_target.eta_weeks", {
                        weeks: customMeta.etaWeeks,
                        suffix: customMeta.etaWeeks === 1 ? "" : "s",
                        date: formatDateForDisplay(customMeta.etaDate.toISOString().split("T")[0]),
                      })}
                    </Text>
                  ) : null}
                  {isGain && customGainMeta.paceLine ? (
                    <Text variant="caption" tone="muted" style={styles.centerText}>
                      {customGainMeta.paceLine}
                    </Text>
                  ) : null}
                  {isGain && customGainMeta.etaLine ? (
                    <Text variant="caption" tone="muted" style={styles.centerText}>
                      {customGainMeta.etaLine}
                    </Text>
                  ) : null}
                  {getCustomWarningText() ? (
                    <Text variant="caption" style={[styles.centerText, { color: getCustomWarningText()!.color }]}>
                      {getCustomWarningText()!.text}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : (
              <PlanCard
                title={t("onboarding.calorie_target.plan_custom")}
                caloriesText={undefined}
              selected={false}
              disabled={loading}
              onPress={() => {
                setSelectedPlan("custom");
                setCustomCalories((prev) => (prev === null ? null : Math.max(HARD_HARD_STOP, roundDownTo25(prev))));
                onErrorClear();
              }}
            />
          )}
        </View>

        {error ? <OnboardingErrorBox message={t(error)} /> : null}

        <View style={styles.actions}>
          <Button title={t("common.back")} variant="secondary" onPress={onBack} disabled={loading} />
          <Button
            title={t("common.next")}
            onPress={onContinue}
            disabled={loading || !canProceed}
            loading={loading}
          />
        </View>
      </View>

      <ActivityPickerModal
        visible={showActivityModal}
        value={activityLevel ?? ""}
        loading={activityMutation.isPending}
        onCancel={() => setShowActivityModal(false)}
        onSave={(nextValue) => {
          if (!user?.id) return;
          activityMutation.mutate(
            { userId: user.id, activityLevel: nextValue },
            {
              onSuccess: () => {
                onActivityLevelSaved?.(nextValue);
                setShowActivityModal(false);
              },
            }
          );
        }}
      />

      <Modal visible={showCustomWarningModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text variant="title" style={styles.centerText}>
              {t("onboarding.calorie_target.custom_warning_title")}
            </Text>
            <Text variant="caption" tone="muted" style={styles.centerText}>
              {t("onboarding.calorie_target.custom_warning_message")}
            </Text>
            <View style={styles.modalActions}>
              <Button
                title={t("onboarding.calorie_target.custom_warning_adjust")}
                variant="secondary"
                onPress={() => {
                  if (maintenanceRange && customCalories !== null) {
                    const adjusted = Math.max(HARD_HARD_STOP, roundDownTo25(maintenanceRange.lowerMaintenance));
                    setCustomCalories(adjusted);
                  }
                  setShowCustomWarningModal(false);
                }}
              />
              <Button
                title={t("onboarding.calorie_target.custom_warning_proceed")}
                onPress={() => {
                  setExecutionMode("override");
                  setShowCustomWarningModal(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </OnboardingShell>
  );
}

type PlanCardProps = {
  title: string;
  caloriesText?: string;
  description?: string;
  paceText?: string;
  etaText?: string;
  warningText?: string;
  warningTone?: "danger" | "muted";
  recommended?: boolean;
  selected: boolean;
  showDisabledNotice?: boolean;
  disabled: boolean;
  onPress: () => void;
};

function PlanCard({
  title,
  caloriesText,
  description,
  paceText,
  etaText,
  warningText,
  warningTone = "muted",
  recommended,
  selected,
  showDisabledNotice = false,
  disabled,
  onPress,
}: PlanCardProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.planCard,
        selected && styles.planCardSelected,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? withAlpha(theme.primary, 0.12) : theme.card,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <View style={styles.planHeader}>
        <Text variant="body" style={styles.planTitle}>
          {title}
        </Text>
        {recommended ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text variant="caption" style={styles.badgeText}>
              {t("onboarding.calorie_target.recommended_badge")}
            </Text>
          </View>
        ) : null}
      </View>
      {caloriesText ? <Text variant="body">{caloriesText}</Text> : null}
      {description ? (
        <Text variant="caption" tone="muted">
          {description}
        </Text>
      ) : null}
      {paceText ? (
        <Text variant="caption" tone="muted">
          {paceText}
        </Text>
      ) : null}
      {etaText ? (
        <Text variant="caption" tone="muted">
          {etaText}
        </Text>
      ) : null}
      {warningText ? (
        <Text variant="caption" tone={warningTone}>
          {warningText}
        </Text>
      ) : null}
      {!disabled || !showDisabledNotice ? null : (
        <Text variant="caption" tone="danger">
          {t("onboarding.calorie_target.unsafe_cannot_select")}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  heroVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    textAlign: "center",
  },
  breakdownSection: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,0,0,0.06)",
    gap: spacing.sm,
  },
  maintenanceRange: {
    fontWeight: "600",
  },
  warningBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  warningBody: {
    marginTop: spacing.xs,
  },
  planList: {
    gap: spacing.md,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  planCardSelected: {
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planTitle: {
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: "#FFFFFF",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    minWidth: 110,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  stepperText: {
    fontWeight: "700",
  },
  actions: {
    gap: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalActions: {
    gap: spacing.md,
  },
});

function withAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) {
    return color;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
