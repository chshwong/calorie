import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { GoalWeightSlider } from "@/components/onboarding/GoalWeightSlider";
import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { DB_MAX_WEIGHT_LB, DB_MIN_WEIGHT_LB, kgToLb, lbToKg } from "@/lib/domain/weight-constants";
import { getGoalWeightRange, GoalType } from "@/lib/onboarding/goal-weight-validation";
import { limitWeightInput, roundTo1, WeightUnit } from "@/lib/validation/weight";
import { colors, spacing } from "@/theme/tokens";

type GoalWeightStepProps = {
  goalType: GoalType | "";
  currentWeightUnit: WeightUnit;
  currentWeightLb: number | null;
  goalWeightKg: string;
  goalWeightLb: string;
  loading: boolean;
  errorKey: string | null;
  errorParams?: Record<string, any> | null;
  onGoalWeightKgChange: (value: string) => void;
  onGoalWeightLbChange: (value: string) => void;
  onErrorClear: () => void;
  onBack: () => void;
  onContinue: () => void;
};

export function GoalWeightStep({
  goalType,
  currentWeightUnit,
  currentWeightLb,
  goalWeightKg,
  goalWeightLb,
  loading,
  errorKey,
  errorParams,
  onGoalWeightKgChange,
  onGoalWeightLbChange,
  onErrorClear,
  onBack,
  onContinue,
}: GoalWeightStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const unitLabel = currentWeightUnit === "kg" ? t("units.kg") : t("units.lbs");
  const hasPrefilledRef = useRef(false);
  const previousGoalRef = useRef<GoalType | "">(goalType);

  const range = useMemo(() => {
    if (!currentWeightLb || !goalType) return null;
    return getGoalWeightRange({ currentWeightLb, goalType });
  }, [currentWeightLb, goalType]);

  useEffect(() => {
    if (goalType && goalType !== previousGoalRef.current) {
      previousGoalRef.current = goalType;
      hasPrefilledRef.current = false;
    }
  }, [goalType]);

  useEffect(() => {
    if (goalType === "maintain" || goalType === "recomp") {
      if (!currentWeightLb || hasPrefilledRef.current) return;
      if (goalWeightKg.trim() || goalWeightLb.trim()) {
        hasPrefilledRef.current = true;
        return;
      }
      const targetLb = currentWeightLb;
      onGoalWeightLbChange(roundTo1(targetLb).toString());
      onGoalWeightKgChange(roundTo1(lbToKg(targetLb)).toString());
      hasPrefilledRef.current = true;
    }
  }, [goalType, currentWeightLb, goalWeightKg, goalWeightLb, onGoalWeightKgChange, onGoalWeightLbChange]);

  const recommended = useMemo(() => {
    if (!range || range.recommendedLb === null) return null;
    const display =
      currentWeightUnit === "kg"
        ? roundTo1(lbToKg(range.recommendedLb))
        : roundTo1(range.recommendedLb);
    return { weight: display, unit: unitLabel };
  }, [currentWeightUnit, range, unitLabel]);

  const showSuggestionUnavailable =
    (goalType === "lose" || goalType === "gain") && range?.recommendedLb === null;

  const placeholder = useMemo(() => {
    if (recommended) {
      return t(
        currentWeightUnit === "kg"
          ? "onboarding.goal_weight.placeholder_example_kg"
          : "onboarding.goal_weight.placeholder_example_lb",
        { weight: recommended.weight.toString() }
      );
    }
    return t(
      currentWeightUnit === "kg"
        ? "onboarding.goal_weight.placeholder_fallback_kg"
        : "onboarding.goal_weight.placeholder_fallback_lb"
    );
  }, [currentWeightUnit, recommended, t]);

  const isGlobalValid = useMemo(() => {
    const raw = currentWeightUnit === "kg" ? goalWeightKg : goalWeightLb;
    if (!raw.trim()) return false;
    const value = parseFloat(raw);
    if (!isFinite(value) || isNaN(value) || value <= 0) return false;
    if (currentWeightUnit === "kg") {
      const minKg = lbToKg(DB_MIN_WEIGHT_LB);
      const maxKg = lbToKg(DB_MAX_WEIGHT_LB);
      return value >= minKg && value <= maxKg;
    }
    return value >= DB_MIN_WEIGHT_LB && value <= DB_MAX_WEIGHT_LB;
  }, [currentWeightUnit, goalWeightKg, goalWeightLb]);

  return (
    <OnboardingShell
      step={7}
      totalSteps={12}
      title={t("onboarding.goal_weight.title")}
      subtitle={t("onboarding.goal_weight.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <MaterialCommunityIcons name="flag-outline" size={64} color={theme.primary} />
          </View>
        </HeroCard>
      }
      footer={
        <View style={styles.actions}>
          <Button title={t("common.back")} variant="secondary" onPress={onBack} disabled={loading} />
          <Button
            title={t("common.next")}
            onPress={onContinue}
            disabled={loading || !goalType || !isGlobalValid}
            loading={loading}
          />
        </View>
      }
    >
      <View style={styles.section}>
        {currentWeightLb !== null && goalType ? (
          <View style={styles.metaBlock}>
            <Text variant="caption" tone="muted">
              {t("onboarding.goal_weight.your_current_weight")}:{" "}
              {roundTo1(currentWeightUnit === "kg" ? lbToKg(currentWeightLb) : currentWeightLb)}{" "}
              {unitLabel}
            </Text>
            <Text variant="caption" tone="muted">
              {t("onboarding.goal_weight.your_goal")}:{" "}
              {goalType === "lose"
                ? t("onboarding.goal.lose_weight.label")
                : goalType === "gain"
                ? t("onboarding.goal.gain_weight.label")
                : goalType === "maintain"
                ? t("onboarding.goal.maintain_weight.label")
                : t("onboarding.goal.recomp.label")}
            </Text>
            {recommended ? (
              <Text variant="caption" tone="muted" style={styles.metaHint}>
                {t("onboarding.goal_weight.suggest_prefix")}
                {recommended.weight} {recommended.unit}
              </Text>
            ) : showSuggestionUnavailable ? (
              <Text variant="caption" tone="muted" style={styles.metaHint}>
                {t("onboarding.goal_weight.suggestion_unavailable")}
              </Text>
            ) : null}
          </View>
        ) : null}

        {goalType === "maintain" || goalType === "recomp" ? (
          range && currentWeightLb !== null ? (
            <GoalWeightSlider
              value={
                currentWeightUnit === "kg"
                  ? goalWeightKg.trim()
                    ? parseFloat(goalWeightKg)
                    : roundTo1(lbToKg(range.recommendedLb ?? range.minLb))
                  : goalWeightLb.trim()
                  ? parseFloat(goalWeightLb)
                  : roundTo1(range.recommendedLb ?? range.minLb)
              }
              min={currentWeightUnit === "kg" ? roundTo1(lbToKg(range.minLb)) : roundTo1(range.minLb)}
              max={currentWeightUnit === "kg" ? roundTo1(lbToKg(range.maxLb)) : roundTo1(range.maxLb)}
              step={currentWeightUnit === "kg" ? 0.05 : 0.1}
              unitLabel={currentWeightUnit === "kg" ? t("units.kg") : t("units.lbs")}
              disabled={loading}
              onChange={(nextDisplay) => {
                const nextLb = currentWeightUnit === "kg" ? kgToLb(nextDisplay) : nextDisplay;
                const clampedLb = Math.max(range.minLb, Math.min(range.maxLb, nextLb));
                if (currentWeightUnit === "kg") {
                  onGoalWeightKgChange(roundTo1(nextDisplay).toString());
                  onGoalWeightLbChange(roundTo1(clampedLb).toString());
                } else {
                  onGoalWeightLbChange(roundTo1(nextDisplay).toString());
                  onGoalWeightKgChange(roundTo1(lbToKg(clampedLb)).toString());
                }
                onErrorClear();
              }}
              onReset={() => {
                const resetLb = range.recommendedLb ?? range.minLb;
                if (currentWeightUnit === "kg") {
                  onGoalWeightKgChange(roundTo1(lbToKg(resetLb)).toString());
                  onGoalWeightLbChange(roundTo1(resetLb).toString());
                } else {
                  onGoalWeightLbChange(roundTo1(resetLb).toString());
                  onGoalWeightKgChange(roundTo1(lbToKg(resetLb)).toString());
                }
                onErrorClear();
              }}
            />
          ) : (
            <GoalWeightSlider
              value={0}
              min={0}
              max={0}
              step={1}
              unitLabel={unitLabel}
              disabled
              onChange={() => {}}
              onReset={() => {}}
            />
          )
        ) : (
          <View style={styles.inputBlock}>
            <Input
              label={`${t("onboarding.goal_weight.weight_label")} (${
                currentWeightUnit === "kg" ? t("units.kg") : t("units.lbs")
              })`}
              value={currentWeightUnit === "kg" ? goalWeightKg : goalWeightLb}
              onChangeText={(text) => {
                const sanitized = limitWeightInput(text);
                if (currentWeightUnit === "kg") {
                  onGoalWeightKgChange(sanitized);
                } else {
                  onGoalWeightLbChange(sanitized);
                }
                onErrorClear();
              }}
              placeholder={placeholder}
              keyboardType="decimal-pad"
              editable={!loading}
              accessibilityLabel={
                currentWeightUnit === "kg"
                  ? t("onboarding.goal_weight.accessibility_label_kg")
                  : t("onboarding.goal_weight.accessibility_label_lb")
              }
              accessibilityHint={placeholder}
            />
          </View>
        )}

        {errorKey ? <OnboardingErrorBox message={t(errorKey, errorParams ?? undefined)} /> : null}
      </View>
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
  metaBlock: {
    gap: spacing.xs,
    alignItems: "center",
  },
  metaHint: {
    textAlign: "center",
  },
  inputBlock: {
    width: "100%",
  },
  actions: {
    gap: spacing.md,
  },
});
