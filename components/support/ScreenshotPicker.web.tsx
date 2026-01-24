import React, { useCallback, useRef } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BorderRadius, Colors, FontSize, Layout, Spacing } from '@/constants/theme';
import { getButtonAccessibilityProps, AccessibilityHints, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type ScreenshotPickerProps = {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ScreenshotPicker({ value, onChange, disabled = false }: ScreenshotPickerProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      // Reset input so selecting the same file again triggers change
      if (inputRef.current) inputRef.current.value = '';
      onChange(file);
    },
    [onChange]
  );

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <ThemedText style={[styles.label, { color: colors.text }]}>{t('support.form.screenshot_label')}</ThemedText>

      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.pickButton,
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
            { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
          ]}
          onPress={openPicker}
          disabled={disabled}
          {...getButtonAccessibilityProps(t('support.form.screenshot_choose'), AccessibilityHints.BUTTON, disabled)}
        >
          <ThemedText style={[styles.pickButtonText, { color: colors.text }]}>
            {t('support.form.screenshot_choose')}
          </ThemedText>
        </TouchableOpacity>

        {!!value && (
          <TouchableOpacity
            style={[
              styles.removeButton,
              getMinTouchTargetStyle(),
              Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
              { borderColor: colors.border },
            ]}
            onPress={() => onChange(null)}
            disabled={disabled}
            {...getButtonAccessibilityProps(t('support.form.screenshot_remove'), AccessibilityHints.BUTTON, disabled)}
          >
            <ThemedText style={[styles.removeButtonText, { color: colors.textSecondary }]}>
              {t('support.form.screenshot_remove')}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      <ThemedText style={[styles.fileName, { color: colors.textSecondary }]} numberOfLines={1}>
        {value ? value.name : t('support.form.screenshot_none')}
      </ThemedText>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {/* Hint removed per request */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  pickButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: Layout.minTouchTarget,
    justifyContent: 'center',
  },
  pickButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  removeButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: Layout.minTouchTarget,
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  fileName: {
    fontSize: FontSize.sm,
  },
  hint: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
});

