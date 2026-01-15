import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleSheet,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../theme/tokens';
import { useColorScheme } from '../useColorScheme';
import { Text, TextProps } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  title?: string;
  variant?: ButtonVariant;
  loading?: boolean;
  titleProps?: Omit<TextProps, 'children'>;
  children?: React.ReactNode;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  children,
  titleProps,
  ...props
}: ButtonProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = colors[scheme];
  const isDisabled = disabled || loading;

  const { containerStyle, textColor, spinnerColor } = getVariantStyles(theme, variant, isDisabled);

  const { style: titleStyle, ...restTitleProps } = titleProps ?? {};

  const baseStyle = [styles.base, containerStyle, isDisabled && styles.disabled];
  const pressableStyle =
    typeof style === 'function'
      ? (state: PressableStateCallbackType) => [baseStyle, style(state)]
      : [baseStyle, style];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={pressableStyle}
      {...props}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
        {title ? (
          <Text
            variant="body"
            style={[styles.text, { color: textColor }, titleStyle]}
            {...restTitleProps}
          >
            {title}
          </Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});

type ThemeColors = (typeof colors)['light'] | (typeof colors)['dark'];

function getVariantStyles(
  theme: ThemeColors,
  variant: ButtonVariant,
  isDisabled: boolean
) {
  switch (variant) {
    case 'secondary':
      return {
        containerStyle: {
          backgroundColor: theme.secondary,
          borderColor: theme.secondary,
        },
        textColor: theme.secondaryText,
        spinnerColor: theme.secondaryText,
      };
    case 'ghost':
      return {
        containerStyle: {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        },
        textColor: isDisabled ? theme.textMuted : theme.primary,
        spinnerColor: theme.primary,
      };
    case 'primary':
    default:
      return {
        containerStyle: {
          backgroundColor: theme.primary,
          borderColor: theme.primary,
        },
        textColor: theme.primaryText,
        spinnerColor: theme.primaryText,
      };
  }
}
