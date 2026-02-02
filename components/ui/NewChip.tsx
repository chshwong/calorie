/**
 * Reusable "New" chip for feature badges (e.g. More sheet rows).
 * - Pill shape, theme tokens only, high-contrast with white text.
 * - Optional subtle scale animation on web only; respects reduced motion.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type NewChipVariant = 'new' | 'beta' | 'updated';
export type NewChipSize = 'sm' | 'md';

export type NewChipProps = {
  /** Label text; default "New" */
  label?: string;
  /** Visual variant; only 'new' styling is implemented */
  variant?: NewChipVariant;
  /** Enable subtle animation on web; default true. Disabled when reduced motion is preferred. */
  animate?: boolean;
  /** Size; default 'sm' */
  size?: NewChipSize;
};

/** Detect prefers-reduced-motion on web (no new deps). */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setPrefersReducedMotion(mq.matches);
    const listener = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}

export function NewChip({
  label = 'New',
  variant = 'new',
  animate = true,
  size = 'sm',
}: NewChipProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const prefersReducedMotion = usePrefersReducedMotion();

  const shouldAnimate =
    animate &&
    Platform.OS === 'web' &&
    !prefersReducedMotion;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shouldAnimate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.delay(1700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shouldAnimate, scaleAnim]);

  // Only 'new' variant styled for now
  const backgroundColor = variant === 'new' ? colors.tint : colors.tint;
  const textColor = colors.textOnTint;

  const isSm = size === 'sm';
  const paddingH = isSm ? Spacing.xs : Spacing.sm;
  const paddingV = isSm ? Spacing.xxs : Spacing.xs;
  const fontSize = isSm ? FontSize.xs : FontSize.sm;

  const chipContent = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius: BorderRadius.full,
        },
      ]}
      accessibilityLabel="New feature"
      accessibilityRole="text"
    >
      <ThemedText
        style={[
          styles.label,
          {
            color: textColor,
            fontSize,
            fontWeight: FontWeight.semibold,
          },
        ]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </ThemedText>
    </View>
  );

  if (shouldAnimate) {
    return (
      <View style={styles.wrapper} pointerEvents="none">
        <Animated.View style={[styles.animatedWrap, { transform: [{ scale: scaleAnim }] }]}>
          {chipContent}
        </Animated.View>
      </View>
    );
  }

  return <View style={styles.wrapper}>{chipContent}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    // Fixed-size container so scale animation doesn't shift layout
    alignSelf: 'center',
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
  },
  animatedWrap: {
    alignSelf: 'flex-start',
  },
  chip: {
    alignSelf: 'flex-start',
  },
  label: {
    letterSpacing: 0.3,
  },
});
