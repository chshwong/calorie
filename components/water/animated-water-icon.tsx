/**
 * Animated Water Icon Component
 * 
 * Reusable animated water icon for Quick Add chips.
 * Uses react-native-svg and react-native-reanimated to create
 * animated water fill effects inside cup/bottle shapes.
 * 
 * Follows engineering guidelines:
 * - Pure presentational component (no business logic)
 * - Uses theme tokens for all colors and sizes
 * - Encapsulated animation logic
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, ModuleThemes, FontSize } from '@/constants/theme';
import Svg, { Path, Rect, G, ClipPath, Defs } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  withSequence,
  useAnimatedProps,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

type WaterIconVariant = 'cup' | 'glass' | 'bottleSmall' | 'bottleLarge';

type AnimatedWaterIconProps = {
  variant: WaterIconVariant;
  isAnimating?: boolean;
  size?: number;
  color?: string;
};

// Normalized viewBox for all icons
const ICON_VIEWBOX = '0 0 24 24';

// Icon path definitions (simplified shapes matching Tabler style)
const ICON_PATHS: Record<WaterIconVariant, string> = {
  cup: 'M 6 4 L 6 18 L 18 18 L 18 4 L 6 4 Z M 7 5 L 17 5 L 17 17 L 7 17 Z', // Cup outline
  glass: 'M 8 4 L 8 18 L 16 18 L 16 4 L 8 4 Z M 9 5 L 15 5 L 15 17 L 9 17 Z', // Glass outline
  bottleSmall: 'M 10 4 L 10 6 L 14 6 L 14 4 L 10 4 Z M 9 6 L 9 18 L 15 18 L 15 6 L 9 6 Z', // Small bottle
  bottleLarge: 'M 10 3 L 10 5 L 14 5 L 14 3 L 10 3 Z M 8 5 L 8 20 L 16 20 L 16 5 L 8 5 Z', // Large bottle
};

// Clip path definitions for water fill area (inner container)
const CLIP_PATHS: Record<WaterIconVariant, string> = {
  cup: 'M 7 8 L 17 8 L 17 17 L 7 17 Z', // Inner area of cup
  glass: 'M 9 6 L 15 6 L 15 17 L 9 17 Z', // Inner area of glass
  bottleSmall: 'M 10 7 L 14 7 L 14 17 L 10 17 Z', // Inner area of small bottle
  bottleLarge: 'M 9 6 L 15 6 L 15 19 L 9 19 Z', // Inner area of large bottle
};

// Base water level (as percentage of container height, 0-1)
const BASE_WATER_LEVEL: Record<WaterIconVariant, number> = {
  cup: 0.6,      // 60% filled
  glass: 0.65,   // 65% filled
  bottleSmall: 0.7, // 70% filled
  bottleLarge: 0.65, // 65% filled
};

// Water fill bounds (Y coordinates in viewBox)
const WATER_BOUNDS: Record<WaterIconVariant, { top: number; bottom: number }> = {
  cup: { top: 8, bottom: 17 },
  glass: { top: 6, bottom: 17 },
  bottleSmall: { top: 7, bottom: 17 },
  bottleLarge: { top: 6, bottom: 19 },
};

export function AnimatedWaterIcon({
  variant,
  isAnimating = false,
  size = FontSize.base,
  color,
}: AnimatedWaterIconProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const waterTheme = ModuleThemes.water;
  
  // Use provided color or fall back to theme
  const iconColor = color || waterTheme.accent;
  const fillColor = waterTheme.fill;
  const waveColor = waterTheme.fill + 'CC'; // 80% opacity for wave

  // Animation shared values
  const waterLevel = useSharedValue(BASE_WATER_LEVEL[variant]);
  const waveOffset = useSharedValue(0);
  const scale = useSharedValue(1);

  // Trigger animation when isAnimating changes to true
  useEffect(() => {
    if (isAnimating) {
      // Animation sequence: slosh, wave, pulse
      const duration = 400;
      const easing = Easing.out(Easing.ease);

      // 1. Slosh animation (water level up and down)
      waterLevel.value = withSequence(
        withTiming(BASE_WATER_LEVEL[variant] + 0.15, {
          duration: duration * 0.3,
          easing,
        }),
        withTiming(BASE_WATER_LEVEL[variant] - 0.1, {
          duration: duration * 0.3,
          easing,
        }),
        withTiming(BASE_WATER_LEVEL[variant], {
          duration: duration * 0.4,
          easing,
        })
      );

      // 2. Wave animation (horizontal slide)
      waveOffset.value = withSequence(
        withTiming(2, {
          duration: duration * 0.4,
          easing,
        }),
        withTiming(-2, {
          duration: duration * 0.4,
          easing,
        }),
        withTiming(0, {
          duration: duration * 0.2,
          easing,
        })
      );

      // 3. Scale pulse
      scale.value = withSequence(
        withTiming(1.05, {
          duration: duration * 0.4,
          easing,
        }),
        withTiming(1.0, {
          duration: duration * 0.6,
          easing,
        })
      );
    } else {
      // Reset to base values when not animating
      waterLevel.value = BASE_WATER_LEVEL[variant];
      waveOffset.value = 0;
      scale.value = 1;
    }
  }, [isAnimating, variant, waterLevel, waveOffset, scale]);

  // Calculate water fill dimensions
  const bounds = WATER_BOUNDS[variant];
  const containerHeight = bounds.bottom - bounds.top;
  const baseWaterY = bounds.top + (containerHeight * (1 - BASE_WATER_LEVEL[variant]));

  // Get X position and width based on variant
  const waterX = bounds.top === 6 ? 9 : 7;
  const waterWidth = bounds.top === 6 ? 6 : 10;

  // Animated water fill props
  const animatedWaterProps = useAnimatedProps(() => {
    const currentLevel = waterLevel.value;
    const waterY = bounds.top + (containerHeight * (1 - currentLevel));
    const waterHeight = bounds.bottom - waterY;
    return {
      y: waterY,
      height: Math.max(0, waterHeight),
    };
  });

  // Animated wave path (calculate path with offset)
  const animatedWavePath = useAnimatedProps(() => {
    const offset = waveOffset.value;
    const startX = waterX + offset;
    const midX = waterX + waterWidth / 2 + offset;
    const endX = waterX + waterWidth + offset;
    return {
      d: `M ${startX} ${baseWaterY} Q ${midX} ${baseWaterY - 1} ${endX} ${baseWaterY}`,
    };
  });

  // Animated scale style
  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Icon path and clip path
  const iconPath = ICON_PATHS[variant];
  const clipPathId = `water-clip-${variant}`;
  const clipPath = CLIP_PATHS[variant];

  return (
    <Animated.View style={[styles.container, animatedScaleStyle, { width: size, height: size }]}>
      <Svg
        width={size}
        height={size}
        viewBox={ICON_VIEWBOX}
        style={styles.svg}
      >
        <Defs>
          {/* Clip path for water fill area */}
          <ClipPath id={clipPathId}>
            <Path d={clipPath} />
          </ClipPath>
        </Defs>

        {/* Water fill (animated) */}
        <G clipPath={`url(#${clipPathId})`}>
          {/* Base water fill */}
          <AnimatedRect
            animatedProps={animatedWaterProps}
            x={waterX}
            width={waterWidth}
            fill={fillColor}
            opacity={0.7}
          />
          
          {/* Animated wave */}
          <AnimatedPath
            animatedProps={animatedWavePath}
            stroke={waveColor}
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
        </G>

        {/* Icon outline (stroke only) */}
        <Path
          d={iconPath}
          fill="none"
          stroke={iconColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});

