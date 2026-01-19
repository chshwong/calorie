/**
 * TargetSlider - Horizontal slider for adjusting nutrient targets
 * 
 * Reusable slider component for nutrient target selection.
 * Based on WeightNudgePicker pattern.
 */

import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Platform, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface TargetSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  onResetToRecommended: () => void;
  recommendedValue: number;
  formatValue?: (val: number) => string;
  disabled?: boolean;
  colors: typeof Colors.light;
}

const TRACK_WIDTH = 280;
const THUMB_SIZE = 26;

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

export const TargetSlider: React.FC<TargetSliderProps> = ({
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onResetToRecommended,
  recommendedValue,
  formatValue,
  disabled = false,
  colors,
}) => {
  const { t } = useTranslation();
  const trackRef = useRef<View>(null);
  const sliderOuterRef = useRef<View>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [outerWidth, setOuterWidth] = useState(0);
  const [thumbLeft, setThumbLeft] = useState(0);
  
  // Calculate value range
  const range = max - min;
  
  // Clamp value to valid range
  const clampedValue = Math.max(min, Math.min(max, value));

  // Keep latest values in refs so PanResponder callbacks don't use stale closures.
  const clampedValueRef = useRef<number>(clampedValue);
  const disabledRef = useRef<boolean>(disabled);
  const onChangeRef = useRef<(v: number) => void>(onChange);

  useEffect(() => {
    clampedValueRef.current = clampedValue;
    disabledRef.current = disabled;
    onChangeRef.current = onChange;
  }, [clampedValue, disabled, onChange]);

  // Store the last snapped value during drag, then commit it on release.
  const lastDragValueRef = useRef<number>(clampedValue);

  useEffect(() => {
    // When not dragging, keep the last drag value in sync with the externally-controlled value.
    if (!isDragging) {
      lastDragValueRef.current = clampedValue;
    }
  }, [clampedValue, isDragging]);
  
  // Calculate max thumb left position (ensures thumb never clips)
  const maxThumbLeft = Math.max(0, outerWidth - THUMB_SIZE);
  
  // Convert value to thumb left position
  const valueToLeft = (val: number): number => {
    if (range === 0 || maxThumbLeft === 0) return 0;
    const ratio = (val - min) / range;
    return clamp(ratio * maxThumbLeft, 0, maxThumbLeft);
  };
  
  // Convert thumb left position to value
  const leftToValue = (left: number): number => {
    if (maxThumbLeft === 0) return min;
    const ratio = left / maxThumbLeft;
    const rawValue = min + ratio * range;
    // Snap to nearest step (anchored to min, not 0)
    const stepped = min + Math.round((rawValue - min) / step) * step;
    return clamp(stepped, min, max);
  };
  
  // Update thumb position when value or outerWidth changes
  useEffect(() => {
    if (outerWidth > 0 && range > 0) {
      const newLeft = valueToLeft(clampedValue);
      setThumbLeft(newLeft);
    }
  }, [clampedValue, outerWidth, min, max, range]);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        if (!disabled) {
          setIsDragging(true);
        }
      },
      onPanResponderMove: (evt) => {
        if (disabledRef.current) return;
        
        sliderOuterRef.current?.measure((x, y, width, height, pageX, pageY) => {
          if (width === 0) return;
          
          const containerLeft = pageX;
          const touchX = evt.nativeEvent.pageX;
          
          // Calculate position relative to container
          const relativeX = touchX - containerLeft;
          const currentMaxThumbLeft = Math.max(0, width - THUMB_SIZE);
          const nextLeft = clamp(relativeX - THUMB_SIZE / 2, 0, currentMaxThumbLeft);
          
          setThumbLeft(nextLeft);
          
          // Convert left position to value using current width
          const ratio = currentMaxThumbLeft > 0 ? nextLeft / currentMaxThumbLeft : 0;
          const rawValue = min + ratio * range;
          const stepped = min + Math.round((rawValue - min) / step) * step;
          const newValue = clamp(stepped, min, max);

          // Track last snapped value for release commit.
          lastDragValueRef.current = newValue;
          
          // Only update if change is significant enough to avoid jitter
          if (newValue !== clampedValueRef.current) onChangeRef.current(newValue);
        });
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        if (!disabledRef.current) {
          const finalValue = lastDragValueRef.current;
          if (finalValue !== clampedValueRef.current) onChangeRef.current(finalValue);
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        if (!disabledRef.current) {
          const finalValue = lastDragValueRef.current;
          if (finalValue !== clampedValueRef.current) onChangeRef.current(finalValue);
        }
      },
    })
  ).current;
  
  // Format value for display
  const formatDisplayValue = (val: number): string => {
    if (formatValue) {
      return formatValue(val);
    }
    // Default formatting: round to nearest integer
    return Math.round(val).toString();
  };
  
  const displayValue = formatDisplayValue(clampedValue);
  const isAtRecommended = Math.abs(clampedValue - recommendedValue) < step / 2;
  
  return (
    <View style={styles.container}>
      {/* Large centered value display */}
      <View style={styles.valueDisplay}>
        <Text variant="h2" style={[styles.valueText, { color: colors.text }, disabled && styles.valueTextDisabled]}>
          {displayValue} {unit}
        </Text>
      </View>
      
      {/* Horizontal slider track with overflow container */}
      <View
        ref={sliderOuterRef}
        style={styles.sliderOuter}
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0) {
            setOuterWidth(width);
          }
        }}
      >
        <View 
          ref={trackRef}
          style={[styles.sliderInner, disabled && styles.trackContainerDisabled]}
          {...panResponder.panHandlers}
        >
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            {/* Thumb */}
            <View 
              style={[
                styles.thumb,
                { left: thumbLeft, backgroundColor: onboardingColors.primary },
                isDragging && styles.thumbDragging,
                disabled && styles.thumbDisabled,
              ]}
            />
          </View>
        </View>
      </View>
      
      {/* Reset to baseline button */}
      <TouchableOpacity
        onPress={onResetToRecommended}
        disabled={disabled || isAtRecommended}
        style={[
          styles.resetButton,
          (disabled || isAtRecommended) && styles.resetButtonDisabled,
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        {...getButtonAccessibilityProps(
          t('onboarding.daily_targets.reset_to_baseline'),
          t('onboarding.daily_targets.reset_to_baseline_hint'),
          disabled || isAtRecommended
        )}
      >
        <ThemedText style={[
          styles.resetButtonText,
          { color: onboardingColors.primary },
          (disabled || isAtRecommended) && styles.resetButtonTextDisabled
        ]}>
          {t('onboarding.daily_targets.reset_to_baseline')}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 0,
  },
  valueDisplay: {
    alignItems: 'center',
    gap: 0,
  },
  valueText: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
  },
  valueTextDisabled: {
    opacity: 0.5,
  },
  sliderOuter: {
    width: '100%',
    overflow: 'hidden',
  },
  sliderInner: {
    width: '100%',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  trackContainerDisabled: {
    opacity: 0.5,
  },
  track: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: -THUMB_SIZE / 2 + 1,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    ...Platform.select({
      web: {
        boxShadow: `0 2px 8px ${onboardingColors.primary}40`,
      } as any,
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
      } as any,
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
    paddingVertical: Spacing.xs / 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  resetButtonDisabled: {
    opacity: 0.5,
  },
  resetButtonText: {
    fontSize: FontSize.sm + 2,
    fontWeight: FontWeight.semibold,
  },
  resetButtonTextDisabled: {
    opacity: 0.5,
  },
});

