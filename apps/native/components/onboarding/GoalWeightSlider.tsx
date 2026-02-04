import React, { useMemo, useRef, useState } from "react";
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
  valueFormatter?: (value: number) => string;
  hintText?: string;
  showHint?: boolean;
  resetLabel?: string;
  resetDisabled?: boolean;
};

const THUMB_SIZE = 26;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function GoalWeightSlider({
  value,
  min,
  max,
  step,
  unitLabel,
  disabled,
  onChange,
  onReset,
  valueFormatter,
  hintText,
  showHint = true,
  resetLabel,
  resetDisabled = false,
}: GoalWeightSliderProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackLeft, setTrackLeft] = useState(0);

  const range = max - min;
  const maxThumbLeft = Math.max(0, trackWidth - THUMB_SIZE);

  const valueToLeft = (val: number) => {
    if (range <= 0 || maxThumbLeft === 0) return 0;
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

  const thumbLeft = useMemo(() => valueToLeft(value), [value, min, max, range, maxThumbLeft]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        if (disabled) return;
        const xInTrack = evt.nativeEvent.pageX - trackLeft;
        const left = clamp(xInTrack - THUMB_SIZE / 2, 0, maxThumbLeft);
        onChange(leftToValue(left));
      },
      onPanResponderMove: (evt) => {
        if (disabled) return;
        const xInTrack = evt.nativeEvent.pageX - trackLeft;
        const left = clamp(xInTrack - THUMB_SIZE / 2, 0, maxThumbLeft);
        onChange(leftToValue(left));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => null,
    })
  ).current;

  return (
    <View style={styles.container}>
      {showHint ? (
        <Text variant="caption" tone="muted" style={styles.hint}>
          {hintText ?? (disabled ? t("onboarding.goal_weight.nudge_disabled") : t("onboarding.goal_weight.nudge_hint"))}
        </Text>
      ) : null}

      <View style={styles.valueRow}>
        <Text variant="title" style={{ color: theme.text }}>
          {valueFormatter ? valueFormatter(value) : value.toFixed(1)}
        </Text>
        <Text variant="caption" tone="muted">
          {unitLabel}
        </Text>
      </View>

      <View
        ref={trackRef}
        style={styles.trackWrapper}
        onLayout={(event) => {
          setTrackWidth(event.nativeEvent.layout.width);
          trackRef.current?.measureInWindow((x) => setTrackLeft(x));
        }}
        collapsable={false}
      >
        <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.border }]}>
          <View
            pointerEvents="none"
            style={[
              styles.trackFill,
              { width: thumbLeft + THUMB_SIZE / 2, backgroundColor: theme.primary },
            ]}
          />
          <View
            pointerEvents="none"
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
        <View style={styles.gestureOverlay} pointerEvents="box-only" {...panResponder.panHandlers} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onReset}
        disabled={disabled || resetDisabled}
        style={[styles.reset, (disabled || resetDisabled) && styles.disabled]}
      >
        <Text variant="label" tone="primary">
          {resetLabel ?? t("onboarding.goal_weight.reset_to_current")}
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
  trackWrapper: {
    width: "100%",
    height: 44,
    justifyContent: "center",
  },
  gestureOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
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
