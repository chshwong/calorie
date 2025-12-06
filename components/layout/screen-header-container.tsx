import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, FontSize, ModuleThemes, type ModuleType } from '@/constants/theme';

type ScreenHeaderContainerProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Standardized container for the top header section across all main tab screens.
 * Wraps the greeting and date selector row with compact, consistent spacing.
 * 
 * Spacing:
 * - paddingTop: 6 (compact top padding)
 * - paddingBottom: 6 (compact bottom padding)
 * - marginBottom: 8 (small gap before first card/section)
 * 
 * Used by: Food, Water, Exercise, Meds, Dashboard
 */
export function ScreenHeaderContainer({ children, style }: ScreenHeaderContainerProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.none,
    paddingBottom: Spacing.xxs,
    marginBottom: Spacing.xxs,  },
});

