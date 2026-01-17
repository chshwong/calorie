import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Feather from "@expo/vector-icons/Feather";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, spacing } from "@/theme/tokens";

export type GoalType = "lose" | "maintain" | "gain" | "recomp";

type GoalStepProps = {
  goalType: GoalType | "";
  showAdvancedGoals: boolean;
  loading: boolean;
  error: string | null;
  onGoalChange: (goal: GoalType) => void;
  onShowAdvancedGoals: () => void;
  onErrorClear: () => void;
  onBack: () => void;
  onContinue: () => void;
};

const BASIC_GOALS: Array<{
  value: GoalType;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "lose",
    labelKey: "onboarding.goal.lose_weight.label",
    descriptionKey: "onboarding.goal.lose_weight.description",
  },
  {
    value: "maintain",
    labelKey: "onboarding.goal.maintain_weight.label",
    descriptionKey: "onboarding.goal.maintain_weight.description",
  },
  {
    value: "gain",
    labelKey: "onboarding.goal.gain_weight.label",
    descriptionKey: "onboarding.goal.gain_weight.description",
  },
];

const ADVANCED_GOALS: Array<{
  value: GoalType;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "recomp",
    labelKey: "onboarding.goal.recomp.label",
    descriptionKey: "onboarding.goal.recomp.description",
  },
];

export function GoalStep({
  goalType,
  showAdvancedGoals,
  loading,
  error,
  onGoalChange,
  onShowAdvancedGoals,
  onErrorClear,
  onBack,
  onContinue,
}: GoalStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const goals = useMemo(
    () => (showAdvancedGoals ? [...BASIC_GOALS, ...ADVANCED_GOALS] : BASIC_GOALS),
    [showAdvancedGoals]
  );

  return (
    <OnboardingShell
      step={6}
      totalSteps={12}
      title={t("onboarding.goal.title")}
      subtitle={t("onboarding.goal.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <Feather name="target" size={112} color={theme.primary} />
          </View>
        </HeroCard>
      }
    >
      <View style={styles.section}>
        <View style={styles.options}>
          {goals.map((option) => {
            const selected = goalType === option.value;
            return (
              <ChoiceTile
                key={option.value}
                title={t(option.labelKey)}
                description={t(option.descriptionKey)}
                selected={selected}
                onPress={() => {
                  onGoalChange(option.value);
                  onErrorClear();
                }}
                disabled={loading}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              />
            );
          })}
        </View>

        {!showAdvancedGoals ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.goal.advanced_goal")}
            accessibilityHint={t("onboarding.goal.advanced_goal_hint")}
            onPress={onShowAdvancedGoals}
            disabled={loading}
            style={styles.advancedLink}
          >
            <Text variant="label" tone="primary">
              {t("onboarding.goal.advanced_goal")}
            </Text>
          </Pressable>
        ) : null}

        {error ? (
          <Text variant="caption" tone="danger" style={styles.centerText}>
            {t(error)}
          </Text>
        ) : null}
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
  options: {
    gap: spacing.lg,
  },
  advancedLink: {
    alignSelf: "center",
  },
  actions: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
});
