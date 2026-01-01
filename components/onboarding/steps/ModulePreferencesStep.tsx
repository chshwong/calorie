import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, LineHeight, Layout, Typography } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

export type ModulePreference = 'Exercise' | 'Med' | 'Water';

interface ModulePreferencesStepProps {
  selectedModules: ModulePreference[]; // ordered, max 2
  onSelectedModulesChange: (modules: ModulePreference[]) => void;
  loading: boolean;
  colors: typeof Colors.light;
}

const OPTIONS: Array<{ key: ModulePreference; titleKey: string; subtitleKey: string }> = [
  { key: 'Exercise', titleKey: 'onboarding.module_preferences.exercise_title', subtitleKey: 'onboarding.module_preferences.exercise_subtitle' },
  { key: 'Med', titleKey: 'onboarding.module_preferences.med_title', subtitleKey: 'onboarding.module_preferences.med_subtitle' },
  { key: 'Water', titleKey: 'onboarding.module_preferences.water_title', subtitleKey: 'onboarding.module_preferences.water_subtitle' },
];

export const ModulePreferencesStep: React.FC<ModulePreferencesStepProps> = ({
  selectedModules,
  onSelectedModulesChange,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const [pressedCard, setPressedCard] = useState<ModulePreference | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedModules), [selectedModules]);

  const toggle = (m: ModulePreference) => {
    // Clear message on any tap
    setLimitMessage(null);

    if (selectedSet.has(m)) {
      onSelectedModulesChange(selectedModules.filter((x) => x !== m));
      return;
    }

    if (selectedModules.length >= 2) {
      setLimitMessage(t('onboarding.module_preferences.pick_up_to_2'));
      return;
    }

    onSelectedModulesChange([...selectedModules, m]);
  };

  const getRank = (m: ModulePreference): number | null => {
    const idx = selectedModules.indexOf(m);
    return idx >= 0 ? idx + 1 : null;
  };

  return (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.module_preferences.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.module_preferences.subtitle')}
      </ThemedText>

      <View style={styles.cardStack}>
        {OPTIONS.map((opt) => {
          const selected = selectedSet.has(opt.key);
          const pressed = pressedCard === opt.key;
          const rank = getRank(opt.key);

          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.card,
                {
                  borderColor: selected ? onboardingColors.primary : colors.border,
                  backgroundColor: selected ? colors.backgroundSecondary : colors.background,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: pressed ? 0.96 : 1,
                },
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={() => toggle(opt.key)}
              onPressIn={() => setPressedCard(opt.key)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(opt.titleKey)}${rank ? ` ${t('onboarding.module_preferences.selected_rank', { rank })}` : ''}`,
                t('onboarding.module_preferences.tap_to_toggle'),
                loading
              )}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={styles.cardTextCol}>
                <Text variant="h4" style={[styles.cardTitle, { color: colors.text }]}>
                  {t(opt.titleKey)}
                </Text>
                <Text variant="body" style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {t(opt.subtitleKey)}
                </Text>
              </View>

              {rank && (
                <View style={[styles.rankBadge, { backgroundColor: onboardingColors.primary }]}>
                  <ThemedText style={[styles.rankBadgeText, { color: Colors.light.textInverse }]}>
                    {rank}
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {limitMessage && (
        <ThemedText style={[styles.limitMessage, { color: colors.textSecondary }]}>
          {limitMessage}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stepContent: {
    gap: Spacing.xl,
  },
  stepTitle: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    ...Typography.bodyLarge,
    textAlign: 'center',
    marginTop: -Spacing.sm,
  },
  cardStack: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  card: {
    borderWidth: 1.5, // Standard border width (matches onboarding inputs); no token currently exists
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: Layout.minTouchTarget,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
    ...Shadows.sm,
  },
  cardTextCol: {
    paddingRight: Spacing['4xl'],
  },
  cardTitle: {
    fontWeight: FontWeight.bold, // Override h4 variant's semibold to bold
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  rankBadge: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  rankBadgeText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  limitMessage: {
    ...Typography.bodySmall,
    textAlign: 'center',
    marginTop: -Spacing.sm,
  },
});


