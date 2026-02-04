import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { colors, radius, spacing } from '../../theme/tokens';
import { useColorScheme } from '../useColorScheme';

export type CardProps = ViewProps;

export function Card({ style, ...props }: CardProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = colors[scheme];

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.card, borderColor: theme.border },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
});
