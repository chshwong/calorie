/**
 * Shared Card Component
 * 
 * A reusable card container with consistent styling.
 * Supports different variants and padding options.
 */

import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

type CardVariant = 'elevated' | 'outlined' | 'filled';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  /** Card content */
  children: ReactNode;
  /** Visual variant */
  variant?: CardVariant;
  /** Padding preset */
  padding?: CardPadding;
  /** Additional styles */
  style?: ViewStyle;
}

interface PressableCardProps extends CardProps, Omit<TouchableOpacityProps, 'style'> {
  /** Make the card pressable */
  onPress: () => void;
}

function getVariantStyles(
  variant: CardVariant,
  colors: typeof Colors.light
): ViewStyle {
  switch (variant) {
    case 'elevated':
      return {
        backgroundColor: colors.card,
        ...Shadows.md,
      };
    case 'outlined':
      return {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
      };
    case 'filled':
      return {
        backgroundColor: colors.backgroundSecondary,
      };
    default:
      return {};
  }
}

function getPaddingStyles(padding: CardPadding): ViewStyle {
  switch (padding) {
    case 'none':
      return { padding: 0 };
    case 'sm':
      return { padding: Spacing.sm };
    case 'md':
      return { padding: Spacing.md };
    case 'lg':
      return { padding: Spacing.lg };
    default:
      return { padding: Spacing.md };
  }
}

export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  style,
}: CardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.container,
        getVariantStyles(variant, colors),
        getPaddingStyles(padding),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PressableCard({
  children,
  variant = 'elevated',
  padding = 'md',
  style,
  onPress,
  ...props
}: PressableCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={[
        styles.container,
        getVariantStyles(variant, colors),
        getPaddingStyles(padding),
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
});

