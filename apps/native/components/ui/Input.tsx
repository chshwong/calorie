import React from 'react';
import { StyleSheet, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../../theme/tokens';
import { useColorScheme } from '../useColorScheme';
import { Text } from './Text';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
};

export function Input({ label, error, style, containerStyle, labelStyle, ...props }: InputProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = colors[scheme];
  const showError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" tone="muted" style={[styles.label, labelStyle]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.placeholder}
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBackground,
            borderColor: showError ? theme.danger : theme.inputBorder,
            color: theme.text,
          },
          style,
        ]}
        {...props}
      />
      {showError ? (
        <Text variant="caption" tone="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  error: {
    marginTop: spacing.xs,
  },
});
