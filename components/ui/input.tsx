/**
 * Shared Input Component
 * 
 * A reusable text input component with consistent styling.
 * Supports labels, error states, and various configurations.
 */

import React, { forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius, Typography, FontSize, SemanticColors } from '@/constants/theme';
import { InterFont } from '@/hooks/use-fonts';

interface InputProps extends TextInputProps {
  /** Label text above the input */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text below the input */
  helperText?: string;
  /** Additional container styles */
  containerStyle?: ViewStyle;
  /** Whether the input is required */
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      containerStyle,
      required = false,
      style,
      editable = true,
      ...props
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const hasError = !!error;
    const isDisabled = editable === false;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text
            style={[
              styles.label,
              { color: hasError ? SemanticColors.error : colors.text },
            ]}
          >
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBackground,
              borderColor: hasError
                ? SemanticColors.error
                : colors.inputBorder,
              color: colors.text,
            },
            isDisabled && styles.disabled,
            style,
          ]}
          placeholderTextColor={colors.inputPlaceholder}
          editable={editable}
          {...props}
        />
        {(error || helperText) && (
          <Text
            style={[
              styles.helperText,
              { color: hasError ? SemanticColors.error : colors.textTertiary },
            ]}
          >
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontFamily: InterFont.medium,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  required: {
    color: SemanticColors.error,
  },
  input: {
    fontFamily: InterFont.regular,
    fontSize: FontSize.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    minHeight: 44,
  },
  disabled: {
    opacity: 0.6,
  },
  helperText: {
    fontFamily: InterFont.regular,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
});

