/**
 * Module Identity Bar - Subtle visual identifier for module pages
 * 
 * A thin colored bar at the top of module screens (Exercise, Meds, etc.)
 * that provides instant visual recognition without clutter.
 * 
 * Per engineering guidelines:
 * - Pure presentational component
 * - Uses theme tokens
 * - Zero performance impact
 * - No DB logic
 */

import { View, StyleSheet } from 'react-native';
import { ModuleThemes, type ModuleType } from '@/constants/theme';
import { BorderRadius } from '@/constants/theme';

type ModuleIdentityBarProps = {
  module: ModuleType;
};

export function ModuleIdentityBar({ module }: ModuleIdentityBarProps) {
  const moduleTheme = ModuleThemes[module];

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: moduleTheme.tint,
        },
      ]}
      accessibilityRole="none"
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 5,
    width: '100%',
    borderRadius: BorderRadius.sm,
    marginBottom: 0,
  },
});

