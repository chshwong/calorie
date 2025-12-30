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
    if (!goalType) return 'Not set';
    const labels: Record<string, string> = {
      lose: 'Weight loss',
      maintain: 'Maintain',
      gain: 'Weight gain',
      recomp: 'Recomposition',
    };
    return labels[goalType] || goalType;
  };

  // Helper to format activity level
  const getActivityLabel = (activityLevel: string | null | undefined): string => {
    if (!activityLevel) return 'Not set';
    const labels: Record<string, string> = {
      sedentary: 'Sedentary',
      light: 'Light',
      moderate: 'Moderate',
      high: 'High',
      very_high: 'Very High',
    };
    return labels[activityLevel] || activityLevel;
  };

  // Helper to format goal weight
  const getGoalWeightDisplay = (): string => {
    if (!profile) return 'Not set';
    const weightUnit = profile.weight_unit || 'lb';
    if (weightUnit === 'kg') {
      if (profile.goal_weight_kg) {
        return `${roundTo1(profile.goal_weight_kg)} kg`;
      }
      if (profile.goal_weight_lb) {
        return `${roundTo1(lbToKg(profile.goal_weight_lb))} kg`;
      }
    } else {
      if (profile.goal_weight_lb) {
        return `${roundTo1(profile.goal_weight_lb)} lbs`;
      }
      if (profile.goal_weight_kg) {
        return `${roundTo1(profile.goal_weight_kg * 2.20462)} lbs`;
      }
    }
    return 'Not set';
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading...
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
          {...getLinkAccessibilityProps('Edit Goal', AccessibilityHints.EDIT)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.tint + '15' }]}>
              <IconSymbol name="target" size={24} color={colors.tint} />
            </View>
            <View style={styles.cardHeaderText}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Goal</ThemedText>
            </View>
            <IconSymbol 
              name="chevron.right" 
              size={20} 
              color={colors.textSecondary}
              {...getIconAccessibilityProps('Navigate to edit', true)}
            />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Goal Type:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {getGoalTypeLabel(profile?.goal_type)}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Goal Weight:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {getGoalWeightDisplay()}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Activity Level:</ThemedText>
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
          {...getLinkAccessibilityProps('Edit Daily Calorie Target', AccessibilityHints.EDIT)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.tint + '15' }]}>
              <IconSymbol name="chart.bar.fill" size={24} color={colors.tint} />
            </View>
            <View style={styles.cardHeaderText}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Daily Calorie Target</ThemedText>
            </View>
            <IconSymbol 
              name="chevron.right" 
              size={20} 
              color={colors.textSecondary}
              {...getIconAccessibilityProps('Navigate to edit', true)}
            />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Target:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.daily_calorie_target ? `${profile.daily_calorie_target} kcal` : 'Not set'}
              </ThemedText>
            </View>
            {profile?.maintenance_calories && (
              <View style={styles.cardRow}>
                <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Maintenance:</ThemedText>
                <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                  {profile.maintenance_calories} kcal
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
          {...getLinkAccessibilityProps('Edit Daily Focus Targets', AccessibilityHints.EDIT)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.tint + '15' }]}>
              <IconSymbol name="slider.horizontal.3" size={24} color={colors.tint} />
            </View>
            <View style={styles.cardHeaderText}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Daily Focus Targets</ThemedText>
            </View>
            <IconSymbol 
              name="chevron.right" 
              size={20} 
              color={colors.textSecondary}
              {...getIconAccessibilityProps('Navigate to edit', true)}
            />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Protein min:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.protein_g_min ? `${profile.protein_g_min} g` : 'Not set'}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Fibre min:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.fiber_g_min ? `${profile.fiber_g_min} g` : 'Not set'}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Carbs max:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.carbs_g_max ? `${profile.carbs_g_max} g` : 'Not set'}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Sugar max:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.sugar_g_max ? `${profile.sugar_g_max} g` : 'Not set'}
              </ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.cardLabel, { color: colors.textSecondary }]}>Sodium max:</ThemedText>
              <ThemedText style={[styles.cardValue, { color: colors.text }]}>
                {profile?.sodium_mg_max ? `${profile.sodium_mg_max} mg` : 'Not set'}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>

        <ThemedText style={[styles.disclaimer, { color: colors.textSecondary }]}>
          AvoVibe offers general guidance only and is not medical advice.
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

