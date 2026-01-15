import React from 'react';
import { SafeAreaView, StyleSheet, ViewProps } from 'react-native';

import { colors, spacing } from '../../theme/tokens';
import { useColorScheme } from '../useColorScheme';

export type ScreenProps = ViewProps & {
  padding?: number;
};

export function Screen({ padding = spacing.lg, style, ...props }: ScreenProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = colors[scheme];

  return (
    <SafeAreaView
      style={[styles.base, { backgroundColor: theme.background, padding }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
