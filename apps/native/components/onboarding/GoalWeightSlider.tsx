import React, { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";

type GoalWeightSliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  unitLabel: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
};

const THUMB_SIZE = 26;

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function GoalWeightSlider({
  value,
  min,
  max,
  step,
  unitLabel,
  disabled,
  onChange,
  onReset,
}: GoalWeightSliderProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [trackWidth, setTrackWidth] = useState(0);
  const [thumbLeft, setThumbLeft] = useState(0);
  const range = max - min;

  const maxThumbLeft = Math.max(0, trackWidth - THUMB_SIZE);

  const valueToLeft = (val: number) => {
    if (range === 0 || maxThumbLeft === 0) return 0;
    const ratio = (val - min) / range;
    return clamp(ratio * maxThumbLeft, 0, maxThumbLeft);
  };

  const leftToValue = (left: number) => {
    if (maxThumbLeft === 0) return min;
    const ratio = left / maxThumbLeft;
    const rawValue = min + ratio * range;
    const stepped = min + Math.round((rawValue - min) / step) * step;
    return clamp(stepped, min, max);
  };

  useEffect(() => {
    if (trackWidth > 0 && range > 0) {
      setThumbLeft(valueToLeft(value));
    }
  }, [value, trackWidth, range, min, max]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        if (!disabled) {
          const left = clamp(evt.nativeEvent.locationX - THUMB_SIZE / 2, 0, maxThumbLeft);
          const nextValue = leftToValue(left);
          onChange(nextValue);
        }
      },
      onPanResponderMove: (evt) => {
        if (disabled) return;
        const left = clamp(evt.nativeEvent.locationX - THUMB_SIZE / 2, 0, maxThumbLeft);
        const nextValue = leftToValue(left);
        onChange(nextValue);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => null,
    })
  ).current;

  return (
    <View style={styles.container}>
      <Text variant="caption" tone="muted" style={styles.hint}>
        {disabled ? t("onboarding.goal_weight.nudge_disabled") : t("onboarding.goal_weight.nudge_hint")}
      </Text>

      <View style={styles.valueRow}>
        <Text variant="title" style={{ color: theme.text }}>
          {value.toFixed(1)}
        </Text>
        <Text variant="caption" tone="muted">
          {unitLabel}
        </Text>
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.border }]}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={[styles.trackFill, { width: thumbLeft + THUMB_SIZE / 2, backgroundColor: theme.primary }]} />
        <View
          style={[
            styles.thumb,
            {
              left: thumbLeft,
              backgroundColor: theme.card,
              borderColor: theme.primary,
              shadowColor: theme.primary,
            },
          ]}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onReset}
        disabled={disabled}
        style={[styles.reset, disabled && styles.disabled]}
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
  valueRow: {
    alignItems: "center",
    gap: spacing.xs,
  },
  track: {
    width: "100%",
    height: 6,
    borderRadius: radius.pill,
    overflow: "visible",
    justifyContent: "center",
  },
  trackFill: {
    height: 6,
    borderRadius: radius.pill,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  reset: {
    alignSelf: "center",
  },
  disabled: {
    opacity: 0.6,
  },
});
