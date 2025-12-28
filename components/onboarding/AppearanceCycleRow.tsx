import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, BorderRadius, Spacing, Typography, FontSize, Layout } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';

export type AppearanceMode = 'auto' | 'light' | 'dark';

type AppearanceCycleRowProps = {
  mode: AppearanceMode;
  onPress: () => void;
};

function modeIcon(mode: AppearanceMode) {
  switch (mode) {
    case 'light':
      return 'sun.max.fill' as const;
    case 'dark':
      return 'moon.fill' as const;
    case 'auto':
    default:
      return 'desktopcomputer' as const;
  }
}

function modeLabel(mode: AppearanceMode, t: (key: string) => string) {
  switch (mode) {
    case 'light':
      return t('onboarding.name_age.appearance_value_light');
    case 'dark':
      return t('onboarding.name_age.appearance_value_dark');
    case 'auto':
    default:
      return t('onboarding.name_age.appearance_value_system');
  }
}

export function AppearanceCycleRow({ mode, onPress }: AppearanceCycleRowProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const currentLabel = modeLabel(mode, t);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('onboarding.name_age.appearance_title')}, ${currentLabel}. ${t('onboarding.name_age.appearance_subtitle')}`}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.border,
          backgroundColor: colors.backgroundSecondary,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: onboardingColors.backgroundTint }]}>
        <IconSymbol
          name={modeIcon(mode)}
          size={FontSize.xl}
          color={onboardingColors.primaryDark}
          decorative={true}
        />
      </View>

      <View style={styles.textCol}>
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {t('onboarding.name_age.appearance_title')}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('onboarding.name_age.appearance_subtitle')}
        </ThemedText>
      </View>

      <View style={[styles.pill, { backgroundColor: colors.background }]}>
        <ThemedText style={[styles.pillText, { color: colors.textSecondary }]}>{currentLabel}</ThemedText>
        <IconSymbol name="chevron.right" size={FontSize.lg} color={colors.icon} decorative={true} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5, // Standard border width (matches onboarding inputs); no token currently exists
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    minHeight: Layout.minTouchTarget,
  },
  iconBadge: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.labelLarge,
  },
  subtitle: {
    ...Typography.body,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
  },
  pillText: {
    ...Typography.bodySmall,
  },
});


