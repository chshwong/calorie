/**
 * NumericUnitInput - Reusable component for numeric inputs with unit labels
 * 
 * Displays a compact numeric input with an adjacent unit label (e.g., "150 lb")
 * Used for weight, height, and other numeric measurements in onboarding.
 */

import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getInputAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface NumericUnitInputProps {
  value: string;
  onChangeText: (text: string) => void;
  unitLabel: string; // e.g., "lb", "kg", "cm", "ft", "in", "%"
  placeholder?: string; // e.g., "150"
  keyboardType?: 'numeric' | 'number-pad' | 'decimal-pad';
  width?: number; // default 88
  testID?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  error?: string;
  required?: boolean;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

export const NumericUnitInput: React.FC<NumericUnitInputProps> = ({
  value,
  onChangeText,
  unitLabel,
  placeholder,
  keyboardType = 'numeric',
  width = 88,
  testID,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  error,
  required = false,
  borderColor,
  backgroundColor,
  textColor,
}) => {
  const colors = Colors.light;
  
  const inputBorderColor = borderColor || (error ? Colors.light.error : colors.border);
  const inputBackgroundColor = backgroundColor || Colors.light.background;
  const inputTextColor = textColor || colors.text;

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.input,
          {
            width,
            borderColor: inputBorderColor,
            color: inputTextColor,
            backgroundColor: inputBackgroundColor,
          },
          Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={!disabled}
        testID={testID}
        {...getInputAccessibilityProps(
          accessibilityLabel || '',
          accessibilityHint,
          error,
          required
        )}
      />
      <Text variant="label" style={[styles.unitLabel, { color: colors.textSecondary }]}>
        {unitLabel}
      </Text>
    </View>
  );
};

/**
 * Container style for two NumericUnitInputs side-by-side
 * Use this wrapper when you need two inputs in a row (e.g., ft/in)
 */
export const NumericUnitInputRow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <View style={styles.rowContainer}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    minHeight: Spacing['5xl'] + Spacing.xs, // 52px - matches existing inputs
    textAlign: 'right',
    ...Platform.select({
      web: {
        outlineWidth: 0,
        boxSizing: 'border-box',
      },
      default: {},
    }),
  },
  unitLabel: {
    marginLeft: Spacing.md, // 12px gap
    fontSize: FontSize.md, // Match input text size
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.md * LineHeight.normal,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md, // 12px gap between inputs
  },
});

