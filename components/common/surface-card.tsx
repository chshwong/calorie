/**
 * Surface Card - Card component with optional module tinting
 * 
 * Reusable card component that can apply subtle module-specific background tints
 * for visual differentiation while maintaining design system consistency.
 * 
 * Per engineering guidelines:
 * - Uses theme tokens for all styling
 * - Supports optional module tinting (3-5% opacity)
 * - Theme-aware (dark/light mode)
 */

import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows, type ModuleType, ModuleThemes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SurfaceCardProps = {
  children: React.ReactNode;
  module?: ModuleType;
  style?: ViewStyle | ViewStyle[];
};

export function SurfaceCard({ children, module, style }: SurfaceCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Apply module tint if provided (3-5% opacity)
  const backgroundColor = module
    ? module === 'exercise' || module === 'meds'
      ? ModuleThemes[module].tint
      : colors.card
    : colors.card;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          ...Shadows.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
});

