import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { lbToKg } from '@/lib/domain/weight-constants';
import { roundTo1 } from '@/utils/bodyMetrics';
import { AccessibilityHints, getLinkAccessibilityProps, getIconAccessibilityProps } from '@/utils/accessibility';
import { openMyGoalEdit } from '@/lib/navigation/my-goal';

export default function MyGoalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: profile, isLoading } = useUserConfig();

  // Helper to format goal type
  const getGoalTypeLabel = (goalType: string | null | undefined): string => {
    if (!goalType) return t('common.not_set');
    const keyByGoalType: Record<string, string> = {
      lose: 'onboarding.goal.lose_weight.label',
      maintain: 'onboarding.goal.maintain_weight.label',
      gain: 'onboarding.goal.gain_weight.label',
      recomp: 'onboarding.goal.recomp.label',
    };
    const key = keyByGoalType[goalType];
    return key ? t(key) : goalType;
  };

  // Helper to format activity level
  const getActivityLabel = (activityLevel: string | null | undefined): string => {
    if (!activityLevel) return t('common.not_set');
    const key = `onboarding.activity.${activityLevel}.label`;
    return t(key);
  };

  // Helper to format goal weight
  const getGoalWeightDisplay = (): string => {
    if (!profile) return t('common.not_set');
    const weightUnit = profile.weight_unit || 'lb';
    if (weightUnit === 'kg') {
      if (profile.goal_weight_kg) {
        return `${roundTo1(profile.goal_weight_kg)} ${t('units.kg')}`;
      }
      if (profile.goal_weight_lb) {
        return `${roundTo1(lbToKg(profile.goal_weight_lb))} ${t('units.kg')}`;
      }
    } else {
      if (profile.goal_weight_lb) {
        return `${roundTo1(profile.goal_weight_lb)} ${t('units.lbs')}`;
      }
      if (profile.goal_weight_kg) {
        return `${roundTo1(profile.goal_weight_kg * 2.20462)} ${t('units.lbs')}`;
      }
    }
    return t('common.not_set');
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StandardSubheader title={t('settings.my_journey.goals')} />

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <DesktopPageContainer>
          <View style={styles.contentContainer}>
            {/* Card A - Goal */}
            <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => openMyGoalEdit(router, 'goal')}
          activeOpacity={0.7}
          {...getLinkAccessibilityProps(t('settings.my_goal.a11y.edit_goal'), AccessibilityHints.EDIT)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.tint + '15' }]}>
              <IconSymbol name="target" size={24} color={colors.tint} />
            </View>
            <View style={styles.cardHeaderText}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{t('settings.my_goal.cards.goal.title')}</ThemedText>
            </View>
            <IconSymbol 
              name="chevron.right" 
              size={20} 
              color={colors.textSecondary}
              {...getIconAccessibilityProps(t('settings.my_goal.a11y.navigate_to_edit'), true)}
            />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.goal.goal_type')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {getGoalTypeLabel(profile?.goal_type)}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.goal.goal_weight')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {getGoalWeightDisplay()}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.goal.activity_level')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {getActivityLabel(profile?.activity_level)}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>

        {/* Card B - Daily Calorie Target */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => router.push('/settings/my-goal/edit-calories')}
          activeOpacity={0.7}
          {...getLinkAccessibilityProps(t('settings.my_goal.a11y.edit_calories'), AccessibilityHints.EDIT)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.tint + '15' }]}>
              <IconSymbol name="chart.bar.fill" size={24} color={colors.tint} />
            </View>
            <View style={styles.cardHeaderText}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{t('onboarding.calorie_target.title')}</ThemedText>
            </View>
            <IconSymbol 
              name="chevron.right" 
              size={20} 
              color={colors.textSecondary}
              {...getIconAccessibilityProps(t('settings.my_goal.a11y.navigate_to_edit'), true)}
            />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.calories.target')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.daily_calorie_target ? `${profile.daily_calorie_target} ${t('units.kcal')}` : t('common.not_set')}
              </ThemedText>
            </View>
            {profile?.maintenance_calories && (
              <View style={styles.cardRow}>
                <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.calories.maintenance')}</ThemedText>
                <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                  {profile.maintenance_calories} {t('units.kcal')}
                </ThemedText>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Card C - Daily Focus Targets */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => router.push('/settings/my-goal/edit-targets')}
          activeOpacity={0.7}
          {...getLinkAccessibilityProps(t('settings.my_goal.a11y.edit_targets'), AccessibilityHints.EDIT)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.tint + '15' }]}>
              <IconSymbol name="slider.horizontal.3" size={24} color={colors.tint} />
            </View>
            <View style={styles.cardHeaderText}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{t('onboarding.daily_targets.title')}</ThemedText>
            </View>
            <IconSymbol 
              name="chevron.right" 
              size={20} 
              color={colors.textSecondary}
              {...getIconAccessibilityProps(t('settings.my_goal.a11y.navigate_to_edit'), true)}
            />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.targets.protein_min')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.protein_g_min ? `${profile.protein_g_min} ${t('units.g')}` : t('common.not_set')}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.targets.fiber_min')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.fiber_g_min ? `${profile.fiber_g_min} ${t('units.g')}` : t('common.not_set')}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.targets.carbs_max')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.carbs_g_max ? `${profile.carbs_g_max} ${t('units.g')}` : t('common.not_set')}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.targets.sugar_max')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.sugar_g_max ? `${profile.sugar_g_max} ${t('units.g')}` : t('common.not_set')}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('settings.my_goal.cards.targets.sodium_max')}</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.sodium_mg_max ? `${profile.sodium_mg_max} ${t('units.mg')}` : t('common.not_set')}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>

        <ThemedText style={[styles.disclaimer, { color: colors.textSecondary }]}>
          {t('settings.my_goal.disclaimer')}
        </ThemedText>
          </View>
        </DesktopPageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    ...Platform.select({
      web: {
        minHeight: '100%',
      },
    }),
  },
  contentContainer: {
    width: '100%',
    paddingTop: Spacing.none,
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    gap: Spacing.lg,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding
    }),
  },
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  cardContent: {
    gap: Spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: FontSize.base,
  },
  cardValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
  },
  disclaimer: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
  },
});

