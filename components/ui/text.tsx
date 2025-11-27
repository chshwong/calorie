/**
 * Shared Text Component
 * 
 * A reusable text component with Inter font and typography presets.
 * Use this instead of React Native's Text for consistent typography.
 */

import React, { ReactNode } from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography, FontSize } from '@/constants/theme';
import { InterFont } from '@/hooks/use-fonts';

type TextVariant = 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'h4' 
  | 'body' 
  | 'bodyLarge' 
  | 'bodySmall' 
  | 'label' 
  | 'labelLarge' 
  | 'caption';

type TextColor = 'default' | 'secondary' | 'tertiary' | 'tint' | 'error' | 'success';

interface TextProps extends RNTextProps {
  /** Typography variant */
  variant?: TextVariant;
  /** Color variant */
  color?: TextColor;
  /** Children content */
  children: ReactNode;
  /** Center align text */
  center?: boolean;
}

export function Text({
  variant = 'body',
  color = 'default',
  children,
  center = false,
  style,
  ...props
}: TextProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getColor = (): string => {
    switch (color) {
      case 'default':
        return colors.text;
      case 'secondary':
        return colors.textSecondary;
      case 'tertiary':
        return colors.textTertiary;
      case 'tint':
        return colors.tint;
      case 'error':
        return colors.error;
      case 'success':
        return colors.success;
      default:
        return colors.text;
    }
  };

  const getVariantStyle = () => {
    const typographyStyle = Typography[variant];
    
    // Map font weight to Inter font family
    const getFontFamily = (weight: string) => {
      switch (weight) {
        case '700':
          return InterFont.bold;
        case '600':
          return InterFont.semibold;
        case '500':
          return InterFont.medium;
        default:
          return InterFont.regular;
      }
    };

    return {
      fontSize: typographyStyle.fontSize,
      lineHeight: typographyStyle.lineHeight,
      fontFamily: getFontFamily(typographyStyle.fontWeight),
    };
  };

  return (
    <RNText
      style={[
        getVariantStyle(),
        { color: getColor() },
        center && styles.center,
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// Convenience components for common text types
export function Heading1(props: Omit<TextProps, 'variant'>) {
  return <Text variant="h1" {...props} />;
}

export function Heading2(props: Omit<TextProps, 'variant'>) {
  return <Text variant="h2" {...props} />;
}

export function Heading3(props: Omit<TextProps, 'variant'>) {
  return <Text variant="h3" {...props} />;
}

export function Heading4(props: Omit<TextProps, 'variant'>) {
  return <Text variant="h4" {...props} />;
}

export function Body(props: Omit<TextProps, 'variant'>) {
  return <Text variant="body" {...props} />;
}

export function Caption(props: Omit<TextProps, 'variant'>) {
  return <Text variant="caption" color="tertiary" {...props} />;
}

export function Label(props: Omit<TextProps, 'variant'>) {
  return <Text variant="label" {...props} />;
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
});

