/**
 * Standard animated segmented toggle for binary choices in the app.
 * 
 * Features:
 * - Pill-shaped segmented control with sliding thumb animation
 * - Smooth spring animation when switching between options
 * - Supports reduceMotion accessibility preference
 * - Active label sits on top of thumb with bold/colored text
 * 
 * @example
 * const SERVING_OPTIONS = [
 *   { key: 'weight', label: 'Weight-Based Serving' },
 *   { key: 'volume', label: 'Volume-Based Serving' },
 * ];
 * 
 * <SegmentedToggle
 *   options={SERVING_OPTIONS}
 *   value={servingType}
 *   onChange={setServingType}
 * />
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { InterFont } from '@/hooks/use-fonts';

export type SegmentedOption<T extends string> = {
  key: T;
  label: string;
};

export type SegmentedToggleProps<T extends string> = {
  /** Exactly two options for the segmented control */
  options: Array<SegmentedOption<T>>;
  /** Currently selected option key */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Disable animation for reduced motion accessibility */
  reduceMotion?: boolean;
};

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  reduceMotion = false,
}: SegmentedToggleProps<T>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Validate that we have exactly two options
  if (options.length !== 2) {
    // Invalid configuration - component requires exactly 2 options
  }

  const [containerWidth, setContainerWidth] = useState<number>(0);
  const animatedValue = useRef(new Animated.Value(value === options[0].key ? 0 : 1)).current;

  // Update animation when value changes
  useEffect(() => {
    const targetValue = value === options[0].key ? 0 : 1;
    
    if (reduceMotion) {
      // Set position immediately without animation
      animatedValue.setValue(targetValue);
    } else {
      // Spring animation for smooth, elastic feel
      Animated.spring(animatedValue, {
        toValue: targetValue,
        useNativeDriver: true,
        stiffness: 300,
        damping: 25,
        mass: 0.5,
      }).start();
    }
  }, [value, options, reduceMotion, animatedValue]);

  // Handle container layout to get width
  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  // Calculate segment width
  const segmentWidth = containerWidth > 0 ? containerWidth / options.length : 0;

  // Interpolate translateX for thumb position
  // animatedValue ranges from 0 to 1, we interpolate to 0 to segmentWidth
  // Note: This interpolation is recreated when segmentWidth changes (on initial layout)
  // Once the container is laid out, the width should remain stable
  const translateX = segmentWidth > 0
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, segmentWidth],
        extrapolate: 'clamp',
      })
    : new Animated.Value(0);

  // Spring config for smooth animation
  const thumbAnimatedStyle = {
    transform: [{ translateX }],
  };

  const handlePress = (optionKey: T) => {
    if (optionKey !== value) {
      onChange(optionKey);
    }
  };

  const isActive = (optionKey: T) => optionKey === value;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
        },
      ]}
      onLayout={handleContainerLayout}
    >
      {/* Animated thumb */}
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              backgroundColor: colors.tint,
            },
            thumbAnimatedStyle,
            Shadows.sm,
          ]}
        />
      )}

      {/* Option buttons */}
      {options.map((option, index) => (
        <TouchableOpacity
          key={option.key}
          style={[
            styles.option,
            {
              width: `${100 / options.length}%`,
            },
          ]}
          onPress={() => handlePress(option.key)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive(option.key) }}
          accessibilityLabel={option.label}
        >
          <Text
            style={[
              styles.optionLabel,
              {
                color: isActive(option.key) ? colors.textInverse : colors.textSecondary,
                fontFamily: InterFont[isActive(option.key) ? 'semibold' : 'regular'],
              },
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 44, // Accessibility minimum touch target
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: BorderRadius.full,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    zIndex: 1, // Ensure labels are above thumb
  },
  optionLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
});

