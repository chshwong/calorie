/**
 * Shared Button Component
 * 
 * A reusable button component with consistent styling.
 * Supports multiple variants, sizes, and states.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius, Typography, SemanticColors, Layout } from '@/constants/theme';
import { InterFont } from '@/hooks/use-fonts';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Button text */
  children: string;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Show loading spinner */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
  /** Additional text styles */
  textStyle?: TextStyle;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const isDisabled = disabled || loading;

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.icon : colors.tint,
          },
          text: {
            color: '#FFFFFF',
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.backgroundSecondary,
          },
          text: {
            color: colors.text,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: isDisabled ? colors.border : colors.tint,
          },
          text: {
            color: isDisabled ? colors.textTertiary : colors.tint,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: isDisabled ? colors.textTertiary : colors.tint,
          },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: isDisabled ? colors.icon : SemanticColors.error,
          },
          text: {
            color: '#FFFFFF',
          },
        };
      default:
        return {
          container: {},
          text: {},
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            minHeight: 36,
          },
          text: {
            ...Typography.buttonSmall,
          },
        };
      case 'md':
        return {
          container: {
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.lg,
            minHeight: Layout.minTouchTarget,
          },
          text: {
            ...Typography.button,
          },
        };
      case 'lg':
        return {
          container: {
            paddingVertical: Spacing.lg,
            paddingHorizontal: Spacing.xl,
            minHeight: 52,
          },
          text: {
            ...Typography.button,
            fontSize: 16,
          },
        };
      default:
        return {
          container: {},
          text: {},
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles.container,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variantStyles.text.color}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            sizeStyles.text,
            variantStyles.text,
            textStyle,
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontFamily: InterFont.semibold,
    textAlign: 'center',
  },
});

