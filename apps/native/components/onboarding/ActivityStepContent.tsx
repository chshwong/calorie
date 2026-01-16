import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { ActivityLevel } from "@/lib/validation/activity";
import { spacing } from "@/theme/tokens";

type ActivityStepContentProps = {
  value: ActivityLevel | "";
  onChange: (level: ActivityLevel) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{
  value: ActivityLevel;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "sedentary",
    labelKey: "onboarding.activity.sedentary.label",
    descriptionKey: "onboarding.activity.sedentary.description",
  },
  {
    value: "light",
    labelKey: "onboarding.activity.light.label",
    descriptionKey: "onboarding.activity.light.description",
  },
  {
    value: "moderate",
    labelKey: "onboarding.activity.moderate.label",
    descriptionKey: "onboarding.activity.moderate.description",
  },
  {
    value: "high",
    labelKey: "onboarding.activity.high.label",
    descriptionKey: "onboarding.activity.high.description",
  },
  {
    value: "very_high",
    labelKey: "onboarding.activity.very_high.label",
    descriptionKey: "onboarding.activity.very_high.description",
  },
];

export function ActivityStepContent({ value, onChange, disabled }: ActivityStepContentProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.options}>
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <ChoiceTile
            key={option.value}
            title={t(option.labelKey)}
            description={t(option.descriptionKey)}
            selected={selected}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: spacing.lg,
  },
});
