/**
 * Weight Summary Card Component for Dashboard
 * 
 * Displays latest weight entry with body fat percentage if available
 */

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WeightTrendLineChart } from '@/components/weight/WeightTrendLineChart';
import { BorderRadius, Colors, FontSize, FontWeight, ModuleThemes, Nudge, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useBodyMetrics } from '@/hooks/use-body-metrics';
import { useUserConfig } from '@/hooks/use-user-config';
import { useWeightLogs366d } from '@/hooks/use-weight-logs';
import { deriveDailyLatestWeight } from '@/lib/derive/daily-latest-weight';
import { buildWeightSeriesForDayKeys } from '@/lib/derive/weight-chart-series';
import { getLatestWeightDisplayFromLogs } from '@/lib/derive/weight-display';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { getBMICategory } from '@/utils/bmi';
import { buildDayKeysInclusive } from '@/utils/dateRangeMath';
import { getTodayKey, getYesterdayKey } from '@/utils/dateTime';
import { useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

type WeightCardProps = {
  dateString?: string;
  onPress?: () => void;
};

export function WeightCard({ dateString, onPress }: WeightCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get weight data
  const weight366Query = useWeightLogs366d();
  const rawLogs = weight366Query.data ?? [];
  const isLoading = weight366Query.isLoading;
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  
  // Get BMI data for chip overlay
  const { bmi, bmiLabel } = useBodyMetrics();
  const bmiCategory = bmi !== null ? getBMICategory(bmi) : null;
  
  // Get unit preference
  const unit: 'kg' | 'lbs' = profile?.weight_unit === 'kg' ? 'kg' : 'lbs';
  
  // Get daily latest weight data for chart
  const dailyLatest = useMemo(() => deriveDailyLatestWeight(rawLogs), [rawLogs]);
  const dailyMap = useMemo(() => {
    const m = new Map<string, typeof dailyLatest[0]>();
    for (const d of dailyLatest) {
      m.set(d.date_key, d);
    }
    return m;
  }, [dailyLatest]);
  
  // Build 7-day chart data
  const chartData = useMemo(() => {
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const selectedDate = dateString ? new Date(dateString + 'T00:00:00') : todayLocal;
    selectedDate.setHours(0, 0, 0, 0);
    
    const end = new Date(selectedDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    
    const dayKeys = buildDayKeysInclusive(start, end);
    
    // Values are "latest per day". Missing days are NaN (no dot, no interpolation, no carry-forward).
    const values = buildWeightSeriesForDayKeys({ dayKeys, dailyMap, unit });
    
    // Label all days for 7-day view
    const labelIndices = dayKeys.map((_, idx) => idx);
    
    // getLabel will be handled by WeightTrendLineChart with dayKeys prop
    const getLabel = (idx: number) => {
      const key = dayKeys[idx];
      if (!key) return '';
      const d = new Date(`${key}T00:00:00`);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    };
    
    return { values, labelIndices, getLabel, dayKeys };
  }, [dailyMap, unit, dateString]);
  
  // Calculate today and yesterday date strings
  const todayDateString = useMemo(() => getTodayKey(), []);
  const yesterdayDateString = useMemo(() => getYesterdayKey(), []);
  const selectedDateString = useMemo(() => {
    return dateString || todayDateString;
  }, [dateString, todayDateString]);
  
  // Get latest entries
  const latestDisplay = getLatestWeightDisplayFromLogs(rawLogs);
  const latestWeightValueLb = latestDisplay.weightLb;
  const latestBodyFatPercent = latestDisplay.bodyFatPercent;

  // DEV sanity check: ensure body fat display is tied to the latest weigh-in only.
  const lastLoggedWeighedAtRef = useRef<string | null>(null);
  if (__DEV__) {
    const key = latestDisplay.weighedAtISO;
    if (key && key !== lastLoggedWeighedAtRef.current) {
      // eslint-disable-next-line no-console
      console.debug('[WeightCard] latest weigh-in', { weighed_at: key, body_fat_percent: latestBodyFatPercent });
      lastLoggedWeighedAtRef.current = key;
    }
  }
  
  // Format weight display
  const latestWeightDisplay =
    latestWeightValueLb !== null
      ? unit === 'kg'
        ? `${roundTo1(lbToKg(latestWeightValueLb)).toFixed(1)} kg`
        : `${roundTo1(latestWeightValueLb).toFixed(1)} lbs`
      : '—';
  
  // Format body fat display
  const latestBodyFatDisplay =
    latestBodyFatPercent !== null && latestBodyFatPercent !== undefined
      ? `${roundTo1(latestBodyFatPercent).toFixed(1)}%`
      : null;
  
  // Weight accent color from module theme
  const weightTheme = ModuleThemes.weight;
  const accentColor = weightTheme.accent;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/(tabs)/weight');
    }
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  // Create accessibility label
  const accessibilityLabel = latestWeightValueLb !== null
    ? t('weight.dashboard.card_label', { weight: latestWeightDisplay })
    : t('weight.dashboard.no_data');

  return (
    <Animated.View
      style={[
        styles.card,
        {
          transform: [{ scale: scaleAnim }],
          backgroundColor: colors.card,
          ...Shadows.card,
        },
      ]}
    >
      <View style={[styles.header, { position: 'relative' }]}>
          {/* Header button only to avoid nested <button> issues on web (chart is interactive). */}
          <TouchableOpacity
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.7}
            style={[styles.headerLeft, getMinTouchTargetStyle()]}
            {...(Platform.OS === 'web' && getFocusStyle(accentColor))}
            {...getButtonAccessibilityProps(accessibilityLabel, t('weight.dashboard.accessibility_hint'))}
          >
            <IconSymbol name="scale.bathroom" size={20} color={accentColor} />
            <ThemedText type="subtitle" style={[styles.title, { color: colors.text }]}>
              {t('weight.dashboard.title')}
            </ThemedText>
          </TouchableOpacity>
          
          {/* BMI chip overlay - absolute positioned to the right */}
          {bmi !== null && bmiCategory && (
            <View
              style={[
                styles.bmiChip,
                {
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  // Approximate half-height for vertical centering (chip height ~36px)
                  transform: [{ translateY: -(Spacing.xl - Nudge.px2) }],
                  backgroundColor: bmiCategory.color + '12', // 12 hex = ~7% opacity
                  borderWidth: colorScheme === 'light' ? 1 : 0,
                  borderColor: colorScheme === 'light' ? colors.border : 'transparent',
                  zIndex: 10,
                },
              ]}
            >
              <ThemedText style={[styles.bmiChipValue, { color: bmiCategory.color }]}>
                {bmi.toFixed(1)}
              </ThemedText>
              {bmiLabel && (
                <ThemedText style={[styles.bmiChipLabel, { color: bmiCategory.color }]}>
                  {t(bmiLabel)}
                </ThemedText>
              )}
            </View>
          )}
        </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('common.loading')}
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.weightDisplay}>
              <ThemedText style={[styles.weightValue, { color: colors.text }]}>
                {latestWeightDisplay}
              </ThemedText>
              {latestBodyFatDisplay && (
                <ThemedText style={[styles.bodyFatText, { color: colors.textSecondary }]}>
                  {latestBodyFatDisplay} {t('weight.dashboard.body_fat')}
                </ThemedText>
              )}
            </View>

            {/* 7-day weight chart */}
            {(() => {
              // Show title always; show chart only when there are weigh-ins in the window.
              const finiteValues = chartData.values.filter((v) => Number.isFinite(v));

              return (
                <View style={styles.chartContainer}>
                  <View style={styles.rangeTitleRow}>
                    <ThemedText style={[styles.rangeTitle, { color: colors.text }]}>
                      {t('common.last_7_days')}
                    </ThemedText>
                  </View>
                  {finiteValues.length === 0 ? (
                    <ThemedText style={[styles.noWeighIns, { color: colors.textTertiary }]}>
                      {t('weight.dashboard.no_weigh_ins')}
                    </ThemedText>
                  ) : (
                    <WeightTrendLineChart
                      values={chartData.values}
                      labelIndices={chartData.labelIndices}
                      getLabel={chartData.getLabel}
                      height={120}
                      dayKeys={chartData.dayKeys}
                      todayDateString={todayDateString}
                      yesterdayDateString={yesterdayDateString}
                      useYdayLabel
                      selectedDateString={selectedDateString}
                      dailyMap={dailyMap}
                      unit={unit}
                      onDayPress={(dayKey) => {
                        router.push(`/weight?date=${dayKey}`);
                      }}
                    />
                  )}
                </View>
              );
            })()}

            {latestWeightValueLb === null && (
              <ThemedText style={[styles.logWeightText, { color: accentColor }]}>
                {t('weight.dashboard.log_weight')}
              </ThemedText>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  bmiChip: {
    alignSelf: 'flex-start',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md - Nudge.px2, // 12 - 2 = 10
    paddingVertical: Spacing.sm - Nudge.px2, // 8 - 2 = 6
    borderRadius: BorderRadius.lg, // 12
    minWidth: Spacing['6xl'] - Spacing.sm, // 64 - 8 = 56
  },
  bmiChipValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.sm + 2,
    textAlign: 'center',
  },
  bmiChipLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.xs + 2,
    marginTop: Spacing.xxs,
    textAlign: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    // Match dashboard card titles (e.g., "Move & Groove")
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  chartContainer: {
    width: '100%',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  rangeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  rangeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  noWeighIns: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  weightDisplay: {
    alignItems: 'center',
    gap: Spacing.xs / 2,
  },
  weightValue: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
  },
  bodyFatText: {
    fontSize: FontSize.xs,
  },
  logWeightText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
});
