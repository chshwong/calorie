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
  baseScale?: number; // Base scale multiplier for icon size (default: 1.0)
};

// Normalized viewBox for all icons
const ICON_VIEWBOX = '0 0 24 24';

// Icon path definitions - full, recognizable container shapes
// Designed to fill 80-90% of viewBox vertically, clearly readable as containers
const ICON_PATHS: Record<WaterIconVariant, string> = {
  // Small glass (50ml): narrow tall glass, fills ~85% of viewBox height
  glass: 'M 8 2 L 8 22 L 16 22 L 16 2 Z',
  
  // Cup (250ml): wider cup shape, fills ~80% of viewBox height
  cup: 'M 5 4 L 5 21 L 19 21 L 19 4 Z',
  
  // Small bottle (500ml): short bottle with neck, fills ~85% of viewBox height
  bottleSmall: 'M 9 2 L 9 4.5 L 15 4.5 L 15 2 Z M 8 4.5 L 8 20 L 16 20 L 16 4.5 Z',
  
  // Large bottle (1000ml): tall bottle with neck, fills ~90% of viewBox height
  bottleLarge: 'M 9 1 L 9 3.5 L 15 3.5 L 15 1 Z M 7 3.5 L 7 22 L 17 22 L 17 3.5 Z',
};

// Clip path definitions for water fill area (inner container)
// These define where water can appear inside each container
const CLIP_PATHS: Record<WaterIconVariant, string> = {
  glass: 'M 8.5 4 L 15.5 4 L 15.5 21 L 8.5 21 Z', // Inner area of glass
  cup: 'M 6 6 L 18 6 L 18 20 L 6 20 Z', // Inner area of cup
  bottleSmall: 'M 8.5 6 L 15.5 6 L 15.5 19 L 8.5 19 Z', // Inner area of small bottle (below neck)
  bottleLarge: 'M 7.5 5 L 16.5 5 L 16.5 21 L 7.5 21 Z', // Inner area of large bottle (below neck)
};

// Base water level (as percentage of container height, 0-1)
const BASE_WATER_LEVEL: Record<WaterIconVariant, number> = {
  glass: 0.65,   // 65% filled
  cup: 0.6,      // 60% filled
  bottleSmall: 0.7, // 70% filled
  bottleLarge: 0.65, // 65% filled
};

// Water fill bounds (Y coordinates in viewBox) - defines fillable area
const WATER_BOUNDS: Record<WaterIconVariant, { top: number; bottom: number }> = {
  glass: { top: 4, bottom: 21 },    // Water starts below rim
  cup: { top: 6, bottom: 20 },      // Water starts below rim
  bottleSmall: { top: 6, bottom: 19 }, // Water starts below neck
  bottleLarge: { top: 5, bottom: 21 }, // Water starts below neck
};

export function AnimatedWaterIcon({
  variant,
  isAnimating = false,
  size = FontSize.base,
  color,
  baseScale = 1.0,
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
      // Slowed down by ~2.5x for calmer, more fluid motion
      const baseDuration = 1000; // Increased from 400ms
      const smoothEasing = Easing.inOut(Easing.sin);
      const bounceEasing = Easing.out(Easing.cubic);

      // 1. Slosh animation (water level up and down) - slower and smoother
      waterLevel.value = withSequence(
        withTiming(BASE_WATER_LEVEL[variant] + 0.15, {
          duration: baseDuration * 0.3, // ~300ms (was 120ms)
          easing: smoothEasing,
        }),
        withTiming(BASE_WATER_LEVEL[variant] - 0.1, {
          duration: baseDuration * 0.3, // ~300ms (was 120ms)
          easing: smoothEasing,
        }),
        withTiming(BASE_WATER_LEVEL[variant], {
          duration: baseDuration * 0.4, // ~400ms (was 160ms)
          easing: smoothEasing,
        })
      );

      // 2. Wave animation (horizontal slide) - calmer wave motion
      waveOffset.value = withSequence(
        withTiming(2, {
          duration: baseDuration * 0.4, // ~400ms (was 160ms)
          easing: smoothEasing,
        }),
        withTiming(-2, {
          duration: baseDuration * 0.4, // ~400ms (was 160ms)
          easing: smoothEasing,
        }),
        withTiming(0, {
          duration: baseDuration * 0.35, // ~350ms (was 80ms)
          easing: smoothEasing,
        })
      );

      // 3. Scale pulse - softer bounce with slower timing (reduced peak to avoid overflow with larger base scale)
      scale.value = withSequence(
        withTiming(1.05, {
          duration: baseDuration * 0.25, // ~250ms (was 160ms)
          easing: bounceEasing,
        }),
        withTiming(1.0, {
          duration: baseDuration * 0.35, // ~350ms (was 240ms)
          easing: bounceEasing,
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

  // Get X position and width based on variant - updated for new container shapes
  const waterX = variant === 'glass' ? 8.5 : variant === 'cup' ? 6 : variant === 'bottleSmall' ? 8.5 : 7.5;
  const waterWidth = variant === 'glass' ? 7 : variant === 'cup' ? 12 : variant === 'bottleSmall' ? 7 : 9;

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

  // Apply base scale (for sizing different container types) and animation scale (for press feedback)
  // The transform scale will visually scale the icon while keeping the base size for layout
  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: baseScale * scale.value }],
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
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          {/* Clip path for water fill area */}
          <ClipPath id={clipPathId}>
            <Path d={clipPath} />
          </ClipPath>
        </Defs>

        {/* Content group - wraps both icon and water fill */}
        <G clipPath={`url(#${clipPathId})`}>
          {/* Water fill (animated) - appears inside container */}
          <AnimatedRect
            animatedProps={animatedWaterProps}
            x={waterX}
            width={waterWidth}
            fill={fillColor}
            opacity={0.7}
          />
          
          {/* Animated wave - moves horizontally on top of water */}
          <AnimatedPath
            animatedProps={animatedWavePath}
            stroke={waveColor}
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
        </G>
        
        {/* Icon outline (stroke only) - drawn on top so container shape is always visible */}
        <Path
          d={iconPath}
          fill="none"
          stroke={iconColor}
          strokeWidth={1.8}
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
    alignSelf: 'center', // Center in parent
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});

