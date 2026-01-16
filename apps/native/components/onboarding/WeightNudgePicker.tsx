import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, spacing } from "@/theme/tokens";

type WeightNudgePickerProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  unitLabel: string;
  disabled?: boolean;
  onChange: (nextValue: number) => void;
  onReset: () => void;
};

export function WeightNudgePicker({
  value,
  min,
  max,
  step,
  unitLabel,
  disabled,
  onChange,
  onReset,
}: WeightNudgePickerProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const clamp = (next: number) => Math.max(min, Math.min(max, next));

  const handleStep = (direction: "down" | "up") => {
    if (disabled) return;
    const delta = direction === "down" ? -step : step;
    const next = clamp(Math.round((value + delta) * 10) / 10);
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <Text variant="caption" tone="muted" style={styles.hint}>
        {disabled ? t("onboarding.goal_weight.nudge_disabled") : t("onboarding.goal_weight.nudge_hint")}
      </Text>

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.decrease")}
          onPress={() => handleStep("down")}
          disabled={disabled}
          style={({ pressed }) => [
            styles.stepButton,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Feather name="minus" size={18} color={theme.text} />
        </Pressable>

        <View style={styles.valueBox}>
          <Text variant="title" style={{ color: theme.text }}>
            {value.toFixed(1)}
          </Text>
          <Text variant="caption" tone="muted">
            {unitLabel}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.increase")}
          onPress={() => handleStep("up")}
          disabled={disabled}
          style={({ pressed }) => [
            styles.stepButton,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Feather name="plus" size={18} color={theme.text} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onReset}
        disabled={disabled}
        style={({ pressed }) => [styles.reset, pressed && !disabled && styles.pressed]}
      >
        <Text variant="label" tone="primary">
          {t("onboarding.goal_weight.reset_to_current")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    alignItems: "center",
  },
  hint: {
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  valueBox: {
    alignItems: "center",
    minWidth: 96,
  },
  reset: {
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
});
