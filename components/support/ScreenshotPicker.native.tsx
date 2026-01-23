import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';

type ScreenshotPickerProps = {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
};

// MVP is web-only; keep a safe native placeholder so the app still builds.
export function ScreenshotPicker(_props: ScreenshotPickerProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <ThemedText style={[styles.text, { color: colors.textSecondary }]}>{t('support.native_placeholder')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  text: {
    fontSize: FontSize.sm,
  },
});

