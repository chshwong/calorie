import React from 'react';
import { StyleSheet, Text as RNText, TextProps as RNTextProps } from 'react-native';

import { colors, fontSizes } from '../../theme/tokens';
import { useColorScheme } from '../useColorScheme';

type TextVariant = 'title' | 'body' | 'caption';
type TextTone = 'default' | 'muted' | 'primary' | 'danger';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

export function Text({ variant = 'body', tone = 'default', style, ...props }: TextProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = colors[scheme];
  const color = getToneColor(theme, tone);

  return <RNText style={[styles.base, textVariants[variant], { color }, style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    fontSize: fontSizes.body,
  },
});

const textVariants = StyleSheet.create({
  title: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: fontSizes.body,
    fontWeight: '400',
  },
  caption: {
    fontSize: fontSizes.caption,
    fontWeight: '400',
  },
});

function getToneColor(theme: typeof colors.light, tone: TextTone) {
  switch (tone) {
    case 'muted':
      return theme.textMuted;
    case 'primary':
      return theme.primary;
    case 'danger':
      return theme.danger;
    case 'default':
    default:
      return theme.text;
  }
}
