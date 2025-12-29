/**
 * WeightNudgePicker - Horizontal slider for adjusting goal weight within a tight range
 * 
 * Used for maintain/recomp goals where target weight should be close to current weight.
 * Provides a constrained picker instead of freeform input.
 */

import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { TouchableOpacity } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { roundTo1 } from '@/utils/bodyMetrics';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface WeightNudgePickerProps {
  value: number; // Display unit value
  min: number; // Display unit
  max: number; // Display unit
  step: number; // Display unit
  unit: 'lbs' | 'kg';
  onChange: (nextDisplayValue: number) => void;
  onReset: () => void;
  disabled?: boolean;
  colors: typeof Colors.light;
}

const TRACK_WIDTH = 280;
const THUMB_SIZE = 26;

export const WeightNudgePicker: React.FC<WeightNudgePickerProps> = ({
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onReset,
  disabled = false,
  colors,
}) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const trackRef = useRef<View>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Calculate value range
  const range = max - min;
  const numSteps = Math.ceil(range / step);
  
  // Clamp value to valid range (ensure it's always within bounds for display)
  const clampedValue = Math.max(min, Math.min(max, value));
  
  // Convert value to position (0 = left/min, 1 = right/max)
  const valueToPosition = (val: number): number => {
    if (range === 0) return 0.5;
    return (val - min) / range;
  };
  
  // Convert position to value
  const positionToValue = (position: number): number => {
    const clampedPos = Math.max(0, Math.min(1, position));
    const rawValue = min + clampedPos * range;
    // Snap to nearest step
    return Math.round(rawValue / step) * step;
  };
  
  const currentPosition = valueToPosition(clampedValue);
  const thumbX = currentPosition * (TRACK_WIDTH - THUMB_SIZE);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        if (!disabled) {
          setIsDragging(true);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (disabled) return;
        
        trackRef.current?.measure((x, y, width, height, pageX, pageY) => {
          const trackLeft = pageX;
          const touchX = evt.nativeEvent.pageX;
          
          // Calculate position relative to track
          const relativeX = touchX - trackLeft;
          const position = Math.max(0, Math.min(1, relativeX / TRACK_WIDTH));
          
          const newValue = positionToValue(position);
          // Only update if change is significant enough to avoid jitter
          if (Math.abs(newValue - clampedValue) >= step / 10) {
            onChange(newValue);
          }
        });
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      },
    })
  ).current;
  
  // Format value for display
  const formatValue = (val: number): string => {
    return roundTo1(val).toString();
  };
  
  // Determine text colors based on theme
  const valueTextColor = isDark ? colors.textValueOnDark : colors.text;
  const hintTextColor = isDark ? colors.textSecondaryOnDark : colors.textSecondary;

  return (
    <View style={styles.container}>
      {/* Large centered value display */}
      <View style={styles.valueDisplay}>
        <Text variant="h2" style={[
          styles.valueText,
          { color: valueTextColor, opacity: 1 },
          disabled && styles.valueTextDisabled
        ]}>
          {formatValue(clampedValue)} {unit}
        </Text>
      </View>
      
      {/* Instructional hint - always visible for maintain/recomp */}
      {!disabled && (
        <ThemedText style={[styles.hintText, { color: hintTextColor, opacity: 1 }]}>
          {t('onboarding.goal_weight.nudge_hint')}
        </ThemedText>
      )}
      
      {/* Horizontal slider track */}
      <View 
        ref={trackRef}
        style={[styles.trackContainer, disabled && styles.trackContainerDisabled]}
        {...panResponder.panHandlers}
      >
        <View style={styles.track}>
          {/* Thumb */}
          <View 
            style={[
              styles.thumb,
              { left: thumbX },
              isDragging && styles.thumbDragging,
              disabled && styles.thumbDisabled,
            ]}
          />
        </View>
      </View>
      
      {/* Reset button */}
      <TouchableOpacity
        onPress={onReset}
        disabled={disabled}
        style={[
          styles.resetButton,
          disabled && styles.resetButtonDisabled,
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        {...getButtonAccessibilityProps(
          t('onboarding.goal_weight.reset_to_current'),
          t('onboarding.goal_weight.reset_to_current'),
          disabled
        )}
      >
        <ThemedText style={[styles.resetButtonText, disabled && styles.resetButtonTextDisabled]}>
          {t('onboarding.goal_weight.reset_to_current')}
        </ThemedText>
      </TouchableOpacity>
      
      {disabled && (
        <ThemedText style={styles.disabledMessage}>
          {t('onboarding.goal_weight.nudge_disabled')}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  valueDisplay: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  valueText: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    // Color and opacity set dynamically via inline styles
  },
  valueTextDisabled: {
    opacity: 0.5,
  },
  hintText: {
    fontSize: FontSize.sm + 1, // 12px + 1pt = 13px (within 12-13 range)
    lineHeight: (FontSize.sm + 1) * LineHeight.normal,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    // Color and opacity set dynamically via inline styles
  },
  trackContainer: {
    width: TRACK_WIDTH,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  trackContainerDisabled: {
    opacity: 0.5,
  },
  track: {
    width: TRACK_WIDTH,
    height: 2,
    backgroundColor: Colors.light.border,
    borderRadius: 1,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: -THUMB_SIZE / 2 + 1,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: onboardingColors.primary,
    ...Platform.select({
      web: {
        boxShadow: `0 2px 8px ${onboardingColors.primary}40`,
      },
      default: {
        shadowColor: onboardingColors.primary,
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      },
    }),
  },
  thumbDragging: {
    ...Platform.select({
      web: {
        boxShadow: `0 4px 12px ${onboardingColors.primary}50`,
      },
      default: {
        shadowColor: onboardingColors.primary,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      },
    }),
  },
  thumbDisabled: {
    opacity: 0.5,
  },
  resetButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  resetButtonDisabled: {
    opacity: 0.5,
  },
  resetButtonText: {
    fontSize: FontSize.sm + 2, // 12px + 2pt = 14px
    color: onboardingColors.primary,
    fontWeight: FontWeight.semibold,
  },
  resetButtonTextDisabled: {
    opacity: 0.5,
  },
  disabledMessage: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});

