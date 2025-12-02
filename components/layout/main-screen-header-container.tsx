import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Spacing } from '@/constants/theme';

type MainScreenHeaderContainerProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Standardized container for the top header section across all main tab screens.
 * Provides consistent padding and spacing for:
 * - Greeting
 * - Date row
 * - First summary card
 * 
 * Used by: Food Log Home, Exercise Home, Meds Home, Water Home
 */
export function MainScreenHeaderContainer({ children, style }: MainScreenHeaderContainerProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0, // Minimal top margin to match Dashboard
    paddingHorizontal: Spacing.lg,
    marginBottom: 0, // No spacing - Summary card sits directly below date row
  },
});
