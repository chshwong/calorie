import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { NutrientReferenceModal, NutrientType } from "@/components/onboarding/NutrientReferenceModal";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { GoalWeightSlider } from "@/components/onboarding/GoalWeightSlider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { ActivityLevel } from "@/lib/validation/activity";
import { colors, radius, spacing } from "@/theme/tokens";
import { NUTRIENT_TARGETS } from "@/constants/constraints";
import {
  computeSuggestedTargets,
  type SuggestedTargets,
} from "../../../../../lib/onboarding/goal-calorie-nutrient-rules";

type GoalType = "lose" | "maintain" | "gain" | "recomp";

export type DailyFocusTargets = {
  proteinGMin: number;
  fiberGMin: number;
  carbsGMax: number;
  sugarGMax: number;
  sodiumMgMax: number;
};

type DailyFocusTargetsStepProps = {
  profile: {
    goal_type: GoalType | null;
    weight_lb: number | null;
    goal_weight_lb: number | null;
    height_cm: number | null;
    gender: "male" | "female" | null;
    activity_level: ActivityLevel | null;
    protein_g_min: number | null;
    fiber_g_min: number | null;
    carbs_g_max: number | null;
    sugar_g_max: number | null;
    sodium_mg_max: number | null;
  } | null;
  loading: boolean;
  error: string | null;
  onErrorClear: () => void;
  onBack: () => void;
  onContinue: () => void;
  onTargetsChange: (targets: DailyFocusTargets) => void;
};

type NutrientKey = "protein" | "fiber" | "carbs" | "sugar" | "sodium";

type NutrientConfig = {
  key: NutrientKey;
  targetKey: keyof DailyFocusTargets;
  labelKey: string;
  unit: string;
  constraintType: "min" | "max" | "target";
  showCondition?: (isWeightLoss: boolean) => boolean;
};

const DEFAULT_TARGETS: DailyFocusTargets = {
  proteinGMin: 100,
  fiberGMin: 28,
  carbsGMax: 200,
  sugarGMax: 40,
  sodiumMgMax: 2300,
};

export function DailyFocusTargetsStep({
  profile,
  loading,
  error,
  onErrorClear,
  onBack,
  onContinue,
  onTargetsChange,
}: DailyFocusTargetsStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [expandedSecondary, setExpandedSecondary] = useState(false);
  const [referenceTarget, setReferenceTarget] = useState<NutrientType | null>(null);

  const goalType = profile?.goal_type ?? null;
  const currentWeightLb = profile?.weight_lb ?? null;
  const targetWeightLb = profile?.goal_weight_lb ?? null;
  const heightCm = profile?.height_cm ?? null;
  const sexAtBirth = profile?.gender ?? null;
  const activityLevel = profile?.activity_level ?? null;

  const suggested = useMemo(
    () =>
      computeSuggestedTargets(
        goalType,
        currentWeightLb,
        targetWeightLb,
        heightCm,
        sexAtBirth,
        activityLevel ?? ""
      ),
    [goalType, currentWeightLb, targetWeightLb, heightCm, sexAtBirth, activityLevel]
  );

  const savedTargets = useMemo<DailyFocusTargets | null>(() => {
    if (!profile) return null;
    if (
      profile.protein_g_min === null ||
      profile.fiber_g_min === null ||
      profile.carbs_g_max === null ||
      profile.sugar_g_max === null ||
      profile.sodium_mg_max === null
    ) {
      return null;
    }
    return {
      proteinGMin: profile.protein_g_min,
      fiberGMin: profile.fiber_g_min,
      carbsGMax: profile.carbs_g_max,
      sugarGMax: profile.sugar_g_max,
      sodiumMgMax: profile.sodium_mg_max,
    };
  }, [profile]);

  const prevGoalTypeRef = useRef<typeof goalType>(goalType);
  const initializedRef = useRef(false);

  const [targets, setTargets] = useState<DailyFocusTargets>(() => {
    if (savedTargets) {
      initializedRef.current = true;
      return savedTargets;
    }
    if (suggested) {
      initializedRef.current = true;
      return {
        proteinGMin: suggested.proteinGMin.value,
        fiberGMin: suggested.fiberGMin.value,
        carbsGMax: suggested.carbsGMax.value,
        sugarGMax: suggested.sugarGMax.value,
        sodiumMgMax: suggested.sodiumMgMax.value,
      };
    }
    return DEFAULT_TARGETS;
  });

  useEffect(() => {
    if (savedTargets) return;
    if (prevGoalTypeRef.current !== goalType) {
      prevGoalTypeRef.current = goalType;
      if (suggested) {
        setTargets({
          proteinGMin: suggested.proteinGMin.value,
          fiberGMin: suggested.fiberGMin.value,
          carbsGMax: suggested.carbsGMax.value,
          sugarGMax: suggested.sugarGMax.value,
          sodiumMgMax: suggested.sodiumMgMax.value,
        });
        initializedRef.current = true;
      }
    } else if (!initializedRef.current && suggested) {
      setTargets({
        proteinGMin: suggested.proteinGMin.value,
        fiberGMin: suggested.fiberGMin.value,
        carbsGMax: suggested.carbsGMax.value,
        sugarGMax: suggested.sugarGMax.value,
        sodiumMgMax: suggested.sodiumMgMax.value,
      });
      initializedRef.current = true;
    }
  }, [goalType, suggested, savedTargets]);

  useEffect(() => {
    if (!suggested) return;
    onTargetsChange(targets);
  }, [targets, onTargetsChange, suggested]);

  if (!suggested) {
    return (
      <OnboardingShell
        step={9}
        totalSteps={12}
        title={t("onboarding.daily_targets.title")}
        subtitle={t("onboarding.daily_targets.error_missing_data")}
        hero={
          <HeroCard>
            <View style={styles.heroVisual}>
              <MaterialCommunityIcons name="target" size={64} color={theme.primary} />
            </View>
          </HeroCard>
        }
        footer={
          <View style={styles.actions}>
            <Button title={t("common.back")} variant="secondary" onPress={onBack} disabled={loading} />
            <Button title={t("common.next")} onPress={onContinue} disabled loading={loading} />
          </View>
        }
      >
        <View style={styles.section}>
          {error ? <OnboardingErrorBox message={t(error)} /> : null}
        </View>
      </OnboardingShell>
    );
  }

  const isWeightLoss = goalType === "lose";
  const isMaintenanceOrRecomp = goalType === "maintain" || goalType === "recomp";

  const getSliderRange = (
    nutrientType: NutrientKey,
    recommended: number,
    suggestedRange?: { min: number; max: number; step: number }
  ) => {
    if (suggestedRange) {
      if (nutrientType === "protein") {
        return {
          min: NUTRIENT_TARGETS.PROTEIN_SLIDER.MIN,
          max: NUTRIENT_TARGETS.PROTEIN_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === "fiber") {
        return {
          min: NUTRIENT_TARGETS.FIBER_SLIDER.MIN,
          max: NUTRIENT_TARGETS.FIBER_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === "carbs") {
        return {
          min: NUTRIENT_TARGETS.CARBS_SLIDER.MIN,
          max: NUTRIENT_TARGETS.CARBS_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === "sodium") {
        return {
          min: NUTRIENT_TARGETS.SODIUM_SLIDER.MIN,
          max: NUTRIENT_TARGETS.SODIUM_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === "sugar") {
        return {
          min: NUTRIENT_TARGETS.SUGAR_SLIDER.MIN,
          max: NUTRIENT_TARGETS.SUGAR_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      return suggestedRange;
    }

    switch (nutrientType) {
      case "protein":
        return {
          min: NUTRIENT_TARGETS.PROTEIN_SLIDER.MIN,
          max: NUTRIENT_TARGETS.PROTEIN_SLIDER.MAX,
          step: 5,
        };
      case "fiber":
        return {
          min: NUTRIENT_TARGETS.FIBER_SLIDER.MIN,
          max: NUTRIENT_TARGETS.FIBER_SLIDER.MAX,
          step: 1,
        };
      case "carbs":
        return {
          min: NUTRIENT_TARGETS.CARBS_SLIDER.MIN,
          max: NUTRIENT_TARGETS.CARBS_SLIDER.MAX,
          step: 5,
        };
      case "sugar":
        return {
          min: NUTRIENT_TARGETS.SUGAR_SLIDER.MIN,
          max: NUTRIENT_TARGETS.SUGAR_SLIDER.MAX,
          step: 5,
        };
      case "sodium":
        return {
          min: NUTRIENT_TARGETS.SODIUM_SLIDER.MIN,
          max: NUTRIENT_TARGETS.SODIUM_SLIDER.MAX,
          step: 50,
        };
      default:
        return { min: Math.max(0, recommended - 50), max: recommended + 50, step: 5 };
    }
  };

  const primaryNutrients: NutrientConfig[] = [
    {
      key: "protein",
      targetKey: "proteinGMin",
      labelKey: "onboarding.daily_targets.protein",
      unit: t("units.g"),
      constraintType: "min",
    },
    {
      key: "fiber",
      targetKey: "fiberGMin",
      labelKey: "onboarding.daily_targets.fiber",
      unit: t("units.g"),
      constraintType: "min",
    },
    {
      key: "carbs",
      targetKey: "carbsGMax",
      labelKey: "onboarding.daily_targets.carbs",
      unit: t("units.g"),
      constraintType: "max",
      showCondition: (weightLoss) => weightLoss,
    },
  ];

  const secondaryNutrients: NutrientConfig[] = [
    {
      key: "carbs",
      targetKey: "carbsGMax",
      labelKey: "onboarding.daily_targets.carbs",
      unit: t("units.g"),
      constraintType: "max",
      showCondition: (weightLoss) => !weightLoss,
    },
    {
      key: "sugar",
      targetKey: "sugarGMax",
      labelKey: "onboarding.daily_targets.sugar",
      unit: t("units.g"),
      constraintType: "max",
    },
    {
      key: "sodium",
      targetKey: "sodiumMgMax",
      labelKey: "onboarding.daily_targets.sodium",
      unit: t("units.mg"),
      constraintType: "max",
    },
  ];

  const renderTargetCard = (nutrient: NutrientConfig) => {
    const suggestedData = suggested[nutrient.targetKey as keyof SuggestedTargets] as {
      value: number;
      min: number;
      max: number;
      step: number;
    };
    const currentValue = targets[nutrient.targetKey];
    const currentTargetValue = savedTargets?.[nutrient.targetKey];
    const range = getSliderRange(
      nutrient.key,
      suggestedData.value,
      isMaintenanceOrRecomp ? undefined : { min: suggestedData.min, max: suggestedData.max, step: suggestedData.step }
    );
    const resetDisabled = Math.abs(currentValue - suggestedData.value) < range.step / 2;

    return (
      <Card key={nutrient.key} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text variant="label">{t(nutrient.labelKey)}</Text>
          {nutrient.constraintType !== "target" ? (
            <View style={[styles.badge, { backgroundColor: theme.border }]}>
              <Text variant="caption" tone="muted">
                {nutrient.constraintType === "min"
                  ? t("onboarding.daily_targets.daily_min")
                  : t("onboarding.daily_targets.daily_max")}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text variant="caption" tone="muted">
              {t("onboarding.daily_targets.suggested_value", {
                value: suggestedData.value,
                unit: nutrient.unit,
              })}
            </Text>
            {currentTargetValue != null ? (
              <Text variant="caption" tone="muted">
                {t("onboarding.daily_targets.current_value", {
                  value: currentTargetValue,
                  unit: nutrient.unit,
                })}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => setReferenceTarget(nutrient.key)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.daily_targets.reference_label")}
          >
            <View style={styles.referenceLink}>
              <Feather name="info" size={14} color={theme.primary} />
              <Text variant="caption" tone="primary">
                {t("onboarding.daily_targets.reference_label")}
              </Text>
            </View>
          </Pressable>
        </View>

        <GoalWeightSlider
          value={currentValue}
          min={range.min}
          max={range.max}
          step={range.step}
          unitLabel={nutrient.unit}
          disabled={loading}
          onChange={(value) => {
            setTargets((prev) => ({ ...prev, [nutrient.targetKey]: value }));
            onErrorClear();
          }}
          onReset={() => {
            setTargets((prev) => ({ ...prev, [nutrient.targetKey]: suggestedData.value }));
            onErrorClear();
          }}
          valueFormatter={(val) => Math.round(val).toString()}
          showHint={false}
          resetLabel={t("onboarding.daily_targets.reset_to_baseline")}
          resetDisabled={resetDisabled}
        />
      </Card>
    );
  };

  return (
    <OnboardingShell
      step={9}
      totalSteps={12}
      title={t("onboarding.daily_targets.title")}
      subtitle={t("onboarding.daily_targets.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <MaterialCommunityIcons name="target" size={64} color={theme.primary} />
          </View>
        </HeroCard>
      }
      footer={
        <View style={styles.actions}>
          <Button title={t("common.back")} variant="secondary" onPress={onBack} disabled={loading} />
          <Button title={t("common.next")} onPress={onContinue} disabled={loading} loading={loading} />
        </View>
      }
    >
      <View style={styles.section}>
        <View style={styles.sectionBlock}>
          <Text variant="label">{t("onboarding.daily_targets.primary_focus")}</Text>
          <View style={styles.cardList}>
            {primaryNutrients
              .filter((nutrient) => !nutrient.showCondition || nutrient.showCondition(isWeightLoss))
              .map(renderTargetCard)}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Pressable
            onPress={() => setExpandedSecondary((prev) => !prev)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              expandedSecondary
                ? t("onboarding.daily_targets.collapse_secondary")
                : t("onboarding.daily_targets.expand_secondary")
            }
          >
            <View style={styles.sectionHeaderRow}>
              <Text variant="label">{t("onboarding.daily_targets.secondary_targets")}</Text>
              <Feather name={expandedSecondary ? "chevron-up" : "chevron-down"} size={18} color={theme.textMuted} />
            </View>
          </Pressable>
          {expandedSecondary ? (
            <View style={styles.cardList}>
              {secondaryNutrients
                .filter((nutrient) => !nutrient.showCondition || nutrient.showCondition(isWeightLoss))
                .map(renderTargetCard)}
            </View>
          ) : null}
        </View>

        {error ? <OnboardingErrorBox message={t(error)} /> : null}
      </View>

      {referenceTarget ? (
        <NutrientReferenceModal
          visible={Boolean(referenceTarget)}
          nutrientType={referenceTarget}
          sexAtBirth={sexAtBirth}
          onClose={() => setReferenceTarget(null)}
        />
      ) : null}
    </OnboardingShell>
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
  sectionBlock: {
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardList: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  referenceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.md,
  },
});
