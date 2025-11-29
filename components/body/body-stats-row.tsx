/**
 * Reusable component for displaying body metrics row (Age, Height, Weight, BMI)
 * 
 * Per engineering guidelines:
 * - Uses cached profile data via useBodyMetrics hook
 * - Responsive layout (wraps on mobile, single row on desktop)
 * - Loading states with skeleton placeholders
 * - All text via i18n
 */

import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BodyStatCard } from './body-stat-card';
import { useBodyMetrics } from '@/hooks/use-body-metrics';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBMICategory } from '@/utils/bmi';

type BodyStatsRowProps = {
  variant?: 'default' | 'compact';
};

export function BodyStatsRow({ variant = 'default' }: BodyStatsRowProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { age, heightCm, weightLbs, bmi, bmiLabel, isLoading } = useBodyMetrics();

  const screenWidth = Dimensions.get('window').width;
  const isMobile = screenWidth < 768;

  // Get BMI category for color
  const bmiCategory = bmi !== null ? getBMICategory(bmi) : null;

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.row, isMobile && styles.rowMobile]}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.backgroundSecondary }]} />
          ))}
        </View>
      </ThemedView>
    );
  }

  // Don't render if no data available
  if (age === null && heightCm === null && weightLbs === null && bmi === null) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.row, isMobile && styles.rowMobile]}>
        {age !== null && (
          <BodyStatCard
            labelKey="dashboard.body.age.label"
            value={Math.round(age)}
            unitKey="dashboard.body.age.unit"
          />
        )}
        {heightCm !== null && (
          <BodyStatCard
            labelKey="dashboard.body.height.label"
            value={Math.round(heightCm)}
            unitKey="dashboard.body.height.unit"
          />
        )}
        {weightLbs !== null && (
          <BodyStatCard
            labelKey="dashboard.body.weight.label"
            value={Math.round(weightLbs)}
            unitKey="dashboard.body.weight.unit"
          />
        )}
        {bmi !== null && (
          <BodyStatCard
            labelKey="dashboard.body.bmi.label"
            value={bmi}
            subLabelKey={bmiLabel || undefined}
            highlight={true}
            highlightColor={bmiCategory?.color}
          />
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  rowMobile: {
    // On mobile, allow wrapping into 2 rows
  },
  skeletonCard: {
    borderRadius: 12,
    padding: Spacing.md,
    minWidth: 80,
    flex: 1,
    height: 100,
  },
});

