/**
 * Water Summary Card Component for Dashboard
 * 
 * Displays today's water intake with circular progress indicator
 */

import { BarChart } from '@/components/charts/bar-chart';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WaterDropGauge } from '@/components/water/water-drop-gauge';
import { BorderRadius, Colors, FontSize, ModuleThemes, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { useWaterDaily } from '@/hooks/use-water-logs';
import type { WaterDaily } from '@/lib/services/waterLogs';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { getDateString, getLastNDays } from '@/utils/calculations';
import { getYesterdayKey } from '@/utils/dateTime';
import { formatWaterValue, fromMl, getEffectiveGoal, toMl, WaterUnit } from '@/utils/waterUnits';
import { useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';

type WaterCardProps = {
  dateString?: string;
  onPress?: () => void;
};

export function WaterCard({ dateString, onPress }: WaterCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get water data - use dateString if provided, otherwise use today
  // Fetch last 14 days for chart history
  const selectedDateString = dateString || getDateString(new Date());
  const { todayWater, history, isLoading } = useWaterDaily({ 
    daysBack: 14,
    targetDateString: selectedDateString,
  });
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  
  // Get unit preference (default to metric)
  const unitPreference = (profile?.water_unit_preference as 'metric' | 'imperial') || 'metric';
  
  // Get profile water unit and goal
  const profileWaterUnit = (profile?.water_unit as WaterUnit) || 'ml';
  const profileGoalMl = profile?.water_goal_ml || null;
  const profileGoalInUnit = profileGoalMl ? fromMl(profileGoalMl, profileWaterUnit) : null;
  const profileEffectiveGoal = getEffectiveGoal(profileWaterUnit, profileGoalInUnit);
  const chartGoalMl = profileEffectiveGoal.goalMl; // Profile goal for chart (in ml)
  
  // Get today's values
  // Always read goal from water_daily.goal_ml (per-day snapshot)
  // Use getEffectiveGoal to apply unit-specific defaults if goal is missing
  const totalMl = todayWater ? toMl(todayWater.total, todayWater.water_unit as WaterUnit) : 0;
  const storedGoalMl = todayWater?.goal_ml || null;
  const activeWaterUnit = (todayWater?.water_unit as WaterUnit) || (profile?.water_unit as WaterUnit) || 'ml';
  const storedGoalInUnit = storedGoalMl ? fromMl(storedGoalMl, activeWaterUnit) : null;
  const { goalMl } = getEffectiveGoal(activeWaterUnit, storedGoalInUnit);
  
  // Prepare history data for chart (last 7 calendar days including today)
  // Generate exactly 7 days, ordered oldest to newest (left to right)
  const selectedDate = dateString ? new Date(dateString + 'T00:00:00') : new Date();
  selectedDate.setHours(0, 0, 0, 0);
  const last7Days = getLastNDays(selectedDate, 7);
  
  // Create a map of existing water data by date for quick lookup
  // IMPORTANT: Include todayWater in the map so today's value is always included
  const waterDataMap = useMemo(() => {
    const map = new Map<string, WaterDaily>();
    // First add today's water (from the same source as the droplet card)
    if (todayWater) {
      map.set(todayWater.date, todayWater);
    }
    // Then add history entries
    if (history) {
      history.forEach((water) => {
        map.set(water.date, water);
      });
    }
    return map;
  }, [todayWater, history]);
  
  // Build chart data for last 7 days
  // Chart uses ml internally for consistent scaling, but displays values in profile's unit
  const historyData = useMemo(() => {
    return last7Days.map((dateString) => {
      const water = waterDataMap.get(dateString);
      if (water) {
        const waterUnit = (water.water_unit as WaterUnit) || 'ml';
        const totalMl = toMl(water.total || 0, waterUnit);
        const totalInProfileUnit = fromMl(totalMl, profileWaterUnit);
        const displayValue = formatWaterValue(totalInProfileUnit, profileWaterUnit);
        return {
          date: dateString,
          value: totalMl, // Use ml for chart calculations (consistent scale)
          displayValue, // Formatted string for label in profile's unit
        };
      } else {
        // No data for this day - show 0 but still render bar
        return {
          date: dateString,
          value: 0,
          displayValue: formatWaterValue(0, profileWaterUnit),
        };
      }
    });
  }, [last7Days, waterDataMap, profileWaterUnit]);
  
  // Calculate dynamic y-axis max: align goal line with bars when equal (no extra padding)
  const maxDailyValue = Math.max(...historyData.map(d => d.value), 0);
  const chartMax = Math.max(maxDailyValue, chartGoalMl, 1);
  
  // Calculate goal display value in profile's unit for reference line label (always use profile unit)
  const chartGoalInProfileUnit = fromMl(chartGoalMl, profileWaterUnit);
  const goalDisplayValue = t('water.chart.goal_label', { 
    value: formatWaterValue(chartGoalInProfileUnit, profileWaterUnit)
  });
  
  const todayDateString = getDateString(new Date());
  const yesterdayDateString = getYesterdayKey();
  
  // Water accent color from module theme
  const waterTheme = ModuleThemes.water;
  const accentColor = waterTheme.accent;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/(tabs)/water');
    }
  };

  const handleDropPress = () => {
    // On dashboard, caller passes a date-aware onPress. Fall back to a date-aware route.
    if (onPress) {
      onPress();
      return;
    }
    router.push(`/water?date=${selectedDateString}`);
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

  const accessibilityLabel = t('water.dashboard.card_label', { ml: totalMl, goal: goalMl });

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
      {/* Header-only button to avoid nested <button> hydration errors on web (chart bars are interactive). */}
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        style={getMinTouchTargetStyle()}
        {...(Platform.OS === 'web' && getFocusStyle(accentColor))}
        {...getButtonAccessibilityProps(accessibilityLabel)}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconSymbol name="drop.fill" size={20} color={accentColor} />
            <ThemedText type="subtitle" style={[styles.title, { color: colors.text }]}>
              {t('water.dashboard.title')}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : (
            <>
              <Pressable
                onPress={handleDropPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                android_ripple={null}
                hitSlop={Spacing.sm}
                style={Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : undefined}
                {...getButtonAccessibilityProps(accessibilityLabel)}
              >
                <WaterDropGauge
                  totalMl={totalMl}
                  goalMl={goalMl}
                  unitPreference={unitPreference}
                  size="medium"
                />
              </Pressable>
              <View style={styles.chartContainer}>
                <View style={styles.rangeTitleRow}>
                  <ThemedText style={[styles.rangeTitle, { color: colors.text }]}>
                    {t('common.last_7_days')}
                  </ThemedText>
                </View>
                <BarChart
                  data={historyData}
                  maxValue={chartMax}
                  goalValue={chartGoalMl}
                  goalDisplayValue={goalDisplayValue}
                  selectedDate={selectedDateString}
                  todayDateString={todayDateString}
                  yesterdayDateString={yesterdayDateString}
                  useYdayLabel
                  colorScale={() => accentColor}
                  height={120}
                  showLabels={true}
                  emptyMessage={t('water.chart.empty_message')}
                  onBarPress={(dateString) => {
                    router.push({
                      pathname: '/(tabs)/water',
                      params: { date: dateString },
                    } as any);
                  }}
                />
              </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    // Match dashboard card titles (e.g., "Weight", "Move & Groove")
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 0,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  chartContainer: {
    width: '100%',
    marginTop: Spacing.sm,
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
});

