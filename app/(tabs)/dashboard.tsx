import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DashboardSectionContainer } from '@/components/dashboard-section-container';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { PremiumCard } from '@/components/dashboard/premium-card';
import { BarChart } from '@/components/charts/bar-chart';
import { CalInVsOutChart } from '@/components/charts/cal-in-vs-out-chart';
import { MacroGauge } from '@/components/MacroGauge';
import { MiniRingGauge } from '@/components/ui/mini-ring-gauge';
import { BodyStatsRow } from '@/components/body/body-stats-row';
import { WaterCard } from '@/components/dashboard/water-card';
import { AvocadoGauge } from '@/components/gauges/AvocadoGauge';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Shadows, Layout, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useUserConfig } from '@/hooks/use-user-config';
import {
  useDailyFoodSummary,
  useWeeklyFoodCalories,
  useWeeklyCalInVsOut,
} from '@/hooks/use-dashboard-data';
import { useExerciseLogsForDate, useExerciseSummaryForRecentDays } from '@/hooks/use-exercise-logs';
import { useMedLogsForDate, useMedSummaryForRecentDays } from '@/hooks/use-med-logs';
import { useWaterDailyForDate } from '@/hooks/use-water-logs';
import { useStreakState } from '@/hooks/use-streak-state';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { calculateDailyTotals } from '@/utils/dailyTotals';
import { NUTRIENT_LIMITS } from '@/constants/nutrient-limits';
import { compareDateKeys, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { addDays, toDateKey } from '@/utils/dateKey';
import { getTodayKey } from '@/utils/dateTime';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

// Presentational Components

type DashboardFoodSectionProps = {
  dateString: string;
  goalType: 'lose' | 'maintain' | 'recomp' | 'gain';
  colors: typeof Colors.light | typeof Colors.dark;
  isSmallScreen: boolean;
  isMobile: boolean;
  onPress: () => void;
  onDateSelect: (dateString: string) => void;
};

function DashboardFoodSection({ dateString, goalType, colors, isSmallScreen, isMobile, onPress, onDateSelect }: DashboardFoodSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const foodSummary = useDailyFoodSummary(dateString);
  const weeklyCalInVsOut = useWeeklyCalInVsOut(dateString, 7, goalType);
  const { data: entries = [] } = useDailyEntries(dateString);
  const { data: userConfig } = useUserConfig();

  // Calculate daily totals (same as home screen)
  const dailyTotals = calculateDailyTotals(entries);

  // Macro values (same as home screen)
  const proteinConsumed = Number(dailyTotals?.protein ?? 0);
  const proteinTarget = Number(userConfig?.protein_g_min ?? 0);
  const fiberConsumed = Number(dailyTotals?.fiber ?? 0);
  const fiberTarget = Number(userConfig?.fiber_g_min ?? 0);
  const carbsConsumed = Number(dailyTotals?.carbs ?? 0);
  const carbsMax = Number(userConfig?.carbs_g_max ?? 0);

  // Mini gauge values (same as home screen)
  const sodiumConsumedMg = Number(
    (dailyTotals as unknown as { sodium_mg?: number | null })?.sodium_mg ?? dailyTotals?.sodium ?? 0
  );
  const sodiumMaxMg = Number((userConfig as unknown as { sodium_mg_max?: number | null })?.sodium_mg_max ?? 0);
  const sugarConsumedG = Number(
    (dailyTotals as unknown as { sugar_g?: number | null })?.sugar_g ?? dailyTotals?.sugar ?? 0
  );
  const sugarMaxG = Number((userConfig as unknown as { sugar_g_max?: number | null })?.sugar_g_max ?? 0);
  const satFatConsumedG = Number(
    (dailyTotals as unknown as { sat_fat_g?: number | null })?.sat_fat_g ??
      (dailyTotals as unknown as { sat_fat?: number | null })?.sat_fat ??
      (dailyTotals as unknown as { saturated_fat?: number | null })?.saturated_fat ??
      dailyTotals?.saturatedFat ??
      0
  );
  const satFatLimitG = NUTRIENT_LIMITS.satFatG;
  // IMPORTANT: Trans Fat should not be integer-rounded (MiniRingGauge will ceil to nearest 0.1 for display).
  // Prefer summing from raw entries (may include decimals), then fall back to totals if needed.
  const transFatConsumedG = useMemo(() => {
    const raw = entries.reduce((sum, entry) => sum + (entry.trans_fat_g ?? 0), 0);
    if (Number.isFinite(raw)) return raw;

    return Number(
      (dailyTotals as unknown as { trans_fat_g?: number | null })?.trans_fat_g ??
        (dailyTotals as unknown as { trans_fat?: number | null })?.trans_fat ??
        (dailyTotals as unknown as { transfat?: number | null })?.transfat ??
        dailyTotals?.transFat ??
        0
    );
  }, [dailyTotals, entries]);
  const transFatLimitG = NUTRIENT_LIMITS.transFatG;

  // Helper function to get goal label
  const getGoalLabel = () => {
    switch (goalType) {
      case 'lose':
        return t('onboarding.goal.lose_weight.label');
      case 'maintain':
        return t('onboarding.goal.maintain_weight.label');
      case 'recomp':
        return 'Body Recomposition';
      case 'gain':
        return t('onboarding.goal.gain_weight.label');
      default:
        return t('dashboard.food.goal'); // Fallback to generic "Goal" if goalType is unknown
    }
  };

  if (weeklyCalInVsOut.isLoading) {
    return (
      <DashboardSectionContainer>
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="fork.knife" size={20} color={colors.accentFood} />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.food.title')}
              </ThemedText>
            </View>
          </View>
          <View style={styles.loadingSkeleton}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </PremiumCard>
      </DashboardSectionContainer>
    );
  }

  return (
    <DashboardSectionContainer>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        {...(Platform.OS === 'web' && getFocusStyle(colors.accentFood))}
      >
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="fork.knife" size={20} color={colors.accentFood} />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.food.title')}
              </ThemedText>
            </View>
          </View>

          <View style={styles.caloriesRow}>
            <View style={styles.foodChipsOverlay} pointerEvents="box-none">
              <View style={styles.foodChipsColumn}>
                <View style={[styles.foodChip, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.foodChipText, { color: colors.textSecondary }]}>
                    {getGoalLabel()}
                  </ThemedText>
                </View>

                <View style={[styles.foodChip, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.foodChipText, { color: colors.textSecondary }]}>
                    {Number(foodSummary.caloriesGoal).toLocaleString('en-US')} {t('units.kcal')}/day
                  </ThemedText>
                </View>
              </View>
            </View>

            <AvocadoGauge
              consumed={Number(foodSummary.caloriesTotal)}
              target={Number(foodSummary.caloriesGoal)}
              goalType={goalType}
              size={isSmallScreen ? 190 : 220}
              strokeWidth={8}
              surfaceBg={colors.card}
              showLabel
            />
          </View>

          {/* Cals in vs out Chart */}
          <View style={styles.chartSection}>
            <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
              {t('dashboard.food.chart_cal_in_vs_out')}
            </ThemedText>
            <CalInVsOutChart
              data={weeklyCalInVsOut.data}
              selectedDate={dateString}
              todayDateString={getTodayKey()}
              onBarPress={onDateSelect}
              height={isSmallScreen ? 105 : isMobile ? 120 : 128}
            />
            {weeklyCalInVsOut.data.length > 0 && (
              <ThemedText style={[styles.chartSubtitle, { color: colors.textSubtle }]}>
                {t('dashboard.food.avg')}: {Math.round(weeklyCalInVsOut.data.reduce((sum, d) => sum + d.caloriesIn, 0) / weeklyCalInVsOut.data.length)} {t('units.kcal')}
              </ThemedText>
            )}
          </View>

          {/* Macro Gauges Row (same as home screen) */}
          <View style={styles.macroGaugeRowWrap}>
            <View style={styles.macroGaugeRow}>
              <View style={styles.macroGaugeRowGauges}>
                <View
                  style={[
                    { flexDirection: 'row' },
                    Platform.OS === 'web' ? ({ columnGap: 4 } as any) : null,
                  ]}
                >
                  {/* Protein */}
                  <View style={{ flex: 1, ...(Platform.OS !== 'web' ? { marginRight: 4 } : {}) }}>
                    <MacroGauge label={t('home.summary.protein')} value={proteinConsumed} target={proteinTarget} unit="g" size="sm" mode="min" />
                  </View>

                  {/* Fiber */}
                  <View style={{ flex: 1, ...(Platform.OS !== 'web' ? { marginRight: 4 } : {}) }}>
                    <MacroGauge label={t('home.summary.fiber')} value={fiberConsumed} target={fiberTarget} unit="g" size="sm" mode="min" />
                  </View>

                  {/* Carbs */}
                  <View style={{ flex: 1 }}>
                    <MacroGauge label={t('home.summary.carbs')} value={carbsConsumed} target={carbsMax} unit="g" size="sm" mode="max" />
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.macroTargetsGearButtonAbsolute,
                getMinTouchTargetStyle(),
                Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
              ]}
              onPress={() => router.push('/settings/my-goal/edit-targets?from=dashboard')}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              {...getButtonAccessibilityProps(
                t('settings.my_goal.a11y.edit_targets'),
                t('settings.my_goal.a11y.navigate_to_edit')
              )}
            >
              <IconSymbol name="gearshape" size={18} color={colors.textSecondary} decorative={true} />
            </TouchableOpacity>
          </View>

          {/* Mini Gauges Section - Always Visible */}
          <View style={styles.miniGaugeSection}>
            <View style={styles.miniGaugeRow}>
              <View style={[styles.miniGaugeItem, styles.miniGaugeItemSpaced]}>
                <MiniRingGauge
                  label={t('home.summary.sugar')}
                  value={sugarConsumedG}
                  target={sugarMaxG}
                  unit={t('units.g')}
                  size="xs"
                />
              </View>

              <View style={[styles.miniGaugeItem, styles.miniGaugeItemSpaced]}>
                <MiniRingGauge
                  label={t('home.summary.sodium')}
                  value={sodiumConsumedMg}
                  target={sodiumMaxMg}
                  unit={t('units.mg')}
                  size="xs"
                />
              </View>

              <View style={[styles.miniGaugeItem, styles.miniGaugeItemSpaced]}>
                <MiniRingGauge
                  label={t('home.summary.saturated_fat')}
                  value={satFatConsumedG}
                  target={satFatLimitG}
                  unit={t('units.g')}
                  size="xs"
                />
              </View>

              <View style={styles.miniGaugeItem}>
                <MiniRingGauge
                  label={t('home.summary.trans_fat')}
                  value={transFatConsumedG}
                  target={transFatLimitG}
                  unit={t('units.g')}
                  size="xs"
                  valueFormat="ceilToTenth"
                />
              </View>
            </View>
          </View>
        </PremiumCard>
      </TouchableOpacity>
    </DashboardSectionContainer>
  );
}

function DashboardBodyStatsSection() {
  return (
    <DashboardSectionContainer>
      <BodyStatsRow />
    </DashboardSectionContainer>
  );
}

type DashboardExerciseSectionProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  isSmallScreen: boolean;
  isMobile: boolean;
  onPress: () => void;
  onDateSelect: (dateString: string) => void;
};

function DashboardExerciseSection({ dateString, colors, isSmallScreen, isMobile, onPress, onDateSelect }: DashboardExerciseSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: userConfig } = useUserConfig();
  const { data: logs = [], isLoading } = useExerciseLogsForDate(dateString);
  const { data: weeklySummary = [] } = useExerciseSummaryForRecentDays(7);

  // User preferences for displaying duration and distance
  const showDuration = userConfig?.exercise_track_cardio_duration ?? true;
  const showDistance = userConfig?.exercise_track_cardio_distance ?? true;
  const distanceUnit = (userConfig?.distance_unit as 'km' | 'mi') ?? 'km';
  const KM_TO_MILES_CONVERSION = 1.60934;

  // Calculate summary inline
  const totalMinutes = logs.reduce((sum, log) => sum + (log.minutes || 0), 0);
  const activityCount = logs.length;
  const activityMap = new Map<string, number>();
  logs.forEach(log => {
    const count = activityMap.get(log.name) || 0;
    activityMap.set(log.name, count + 1);
  });
  const mainLabels = Array.from(activityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  // Build weekly data for chart (matching original logic)
  const days = 7;
  const endDate = new Date(dateString + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = (() => {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : startKey;
  const clampedStartKey = compareDateKeys(startKey, minDateKey) < 0 ? minDateKey : startKey;
  const startDateClamped = new Date(clampedStartKey + 'T00:00:00');

  const weeklyDataFiltered = weeklySummary
    .filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= startDateClamped && itemDate <= endDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({ 
      date: item.date, 
      totalMinutes: item.total_minutes,
      cardioDistanceKm: item.cardio_distance_km || 0,
      activityCount: item.activity_count || 0,
    }));

  // Fill in missing dates with 0
  const allDates: string[] = [];
  let cur = clampedStartKey;
  for (let i = 0; i < days; i++) {
    if (compareDateKeys(cur, dateString) > 0) break;
    allDates.push(cur);
    cur = addDays(cur, 1);
  }

  const weeklyData = allDates.map(date => {
    const existing = weeklyDataFiltered.find(d => d.date === date);
    return existing || { date, totalMinutes: 0, cardioDistanceKm: 0, activityCount: 0 };
  });

  // Format display value for each bar (duration and/or distance based on preferences)
  const formatBarDisplayValue = (minutes: number, distanceKm: number): string | undefined => {
    const parts: string[] = [];
    
    if (showDuration && minutes > 0) {
      parts.push(`${Math.round(minutes)} ${t('dashboard.snapshot.min')}`);
    }
    
    if (showDistance && distanceKm > 0) {
      let distanceValue = distanceKm;
      let distanceUnitLabel = 'km';
      
      if (distanceUnit === 'mi') {
        distanceValue = distanceKm / KM_TO_MILES_CONVERSION;
        distanceUnitLabel = 'mi';
      }
      
      // Round to 0 decimals (whole number)
      const formattedDistance = Math.round(distanceValue);
      
      parts.push(`${formattedDistance} ${distanceUnitLabel}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : undefined;
  };

  if (isLoading) {
    return (
      <DashboardSectionContainer>
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="figure.run" size={20} color={colors.accentExercise} />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.snapshot.ex')}
              </ThemedText>
            </View>
          </View>
          <View style={styles.loadingSkeleton}>
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        </PremiumCard>
      </DashboardSectionContainer>
    );
  }

  return (
    <DashboardSectionContainer>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        {...(Platform.OS === 'web' && getFocusStyle(colors.accentExercise))}
      >
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="figure.run" size={20} color={colors.accentExercise} />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.snapshot.ex')}
              </ThemedText>
            </View>
          </View>

          <View style={styles.exerciseToday}>
            <ThemedText style={[styles.exerciseValue, { color: colors.text }]}>
              {totalMinutes} {t('dashboard.snapshot.min')}
            </ThemedText>
            <ThemedText style={[styles.exerciseSubtext, { color: colors.textMuted }]}>
              {activityCount} {activityCount === 1 ? t('dashboard.exercise.activity_one') : t('dashboard.exercise.activity_other')}
            </ThemedText>
            {mainLabels.length > 0 && (
              <ThemedText style={[styles.exerciseMain, { color: colors.textSubtle }]}>
                {t('dashboard.exercise.main')}: {mainLabels.join(', ')}
              </ThemedText>
            )}
          </View>

          <View style={styles.chartSection}>
            <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
              {t('dashboard.exercise.chart_7d')}
            </ThemedText>
            <BarChart
              data={weeklyData.map(d => ({ 
                date: d.date, 
                value: d.activityCount, // Bar height based on number of exercises
                displayValue: formatBarDisplayValue(d.totalMinutes, d.cardioDistanceKm), // Display duration/distance based on preferences
              }))}
              selectedDate={dateString}
              onBarPress={onDateSelect}
              height={isSmallScreen ? 70 : isMobile ? 80 : 85}
              colorScale={(value, max) => {
                // Color scale based on exercise count instead of minutes
                if (value < 1) return `${colors.accentExercise}70`;
                if (value < 3) return `${colors.accentExercise}90`;
                return colors.accentExercise;
              }}
            />
            {totalMinutes > 0 && (
              <View style={[styles.streakChip, { backgroundColor: `${colors.accentExercise}20` }]}>
                <ThemedText style={[styles.streakChipText, { color: colors.accentExercise }]}>
                  {t('dashboard.exercise.streak')}: {totalMinutes >= 30 ? '1d' : '0d'}
                </ThemedText>
              </View>
            )}
          </View>
        </PremiumCard>
      </TouchableOpacity>
    </DashboardSectionContainer>
  );
}

type DashboardMedsSectionProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  onPress: () => void;
  onDateSelect: (dateString: string) => void;
};

function DashboardMedsSection({ dateString, colors, onPress, onDateSelect }: DashboardMedsSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: logs = [], isLoading } = useMedLogsForDate(dateString);
  const { data: weeklySummary = [] } = useMedSummaryForRecentDays(7);

  // Calculate summary inline
  const totalItems = logs.length;
  const medCount = logs.filter(log => log.type === 'med').length;
  const suppCount = logs.filter(log => log.type === 'supp').length;
  const lastItem = logs.length > 0 ? logs[logs.length - 1] : null;
  const lastItemName = lastItem?.name || null;
  const lastItemDose = lastItem && lastItem.dose_amount !== null && lastItem.dose_unit
    ? `${lastItem.dose_amount} ${lastItem.dose_unit}`
    : null;

  // Build weekly adherence data (matching original logic)
  const days = 7;
  const endDate = new Date(dateString + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = (() => {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : startKey;
  const clampedStartKey = compareDateKeys(startKey, minDateKey) < 0 ? minDateKey : startKey;
  const startDateClamped = new Date(clampedStartKey + 'T00:00:00');

  const weeklyDataFiltered = weeklySummary
    .filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= startDateClamped && itemDate <= endDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({ date: item.date, hasAnyBoolean: item.item_count > 0 }));

  // Fill in missing dates with false
  const allDates: string[] = [];
  let cur = clampedStartKey;
  for (let i = 0; i < days; i++) {
    if (compareDateKeys(cur, dateString) > 0) break;
    allDates.push(cur);
    cur = addDays(cur, 1);
  }

  const weeklyData = allDates.map(date => {
    const existing = weeklyDataFiltered.find(d => d.date === date);
    return existing || { date, hasAnyBoolean: false };
  });

  if (isLoading) {
    return (
      <DashboardSectionContainer>
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="pills.fill" size={20} color={colors.accentMeds} />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.meds.title')}
              </ThemedText>
            </View>
          </View>
          <View style={styles.loadingSkeleton}>
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        </PremiumCard>
      </DashboardSectionContainer>
    );
  }

  return (
    <DashboardSectionContainer>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        {...(Platform.OS === 'web' && getFocusStyle(colors.accentMeds))}
      >
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="pills.fill" size={20} color={colors.accentMeds} />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.meds.title')}
              </ThemedText>
            </View>
          </View>

          <View style={styles.medsToday}>
            <ThemedText style={[styles.medsValue, { color: colors.text }]}>
              {totalItems} {t('dashboard.snapshot.items')}
            </ThemedText>
            <ThemedText style={[styles.medsSubtext, { color: colors.textMuted }]}>
              {medCount} {t('dashboard.meds.med')} · {suppCount} {t('dashboard.meds.supp')}
            </ThemedText>
            {lastItemName && (
              <ThemedText style={[styles.medsLast, { color: colors.textSubtle }]}>
                {t('dashboard.meds.last')}: {lastItemName}{lastItemDose ? ` – ${lastItemDose}` : ''}
              </ThemedText>
            )}
          </View>

          <View style={styles.chartSection}>
            <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
              {t('dashboard.meds.chart_7d')}
            </ThemedText>
            <View style={styles.adherenceRow}>
              {weeklyData.map((day) => {
                const date = new Date(day.date + 'T00:00:00');
                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                const isSelected = dateString === day.date;
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.adherenceDot,
                      {
                        backgroundColor: day.hasAnyBoolean ? colors.accentMeds : colors.backgroundSecondary,
                        borderColor: isSelected ? colors.accentMeds : 'transparent',
                        borderWidth: isSelected ? 2 : 0,
                      },
                    ]}
                    onPress={() => onDateSelect(day.date)}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(`${dayLabel}, ${day.hasAnyBoolean ? 'has meds' : 'no meds'}`)}
                  >
                    <ThemedText style={[styles.adherenceLabel, { color: day.hasAnyBoolean ? colors.textInverse : colors.textSecondary }]}>
                      {dayLabel.charAt(0)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </PremiumCard>
      </TouchableOpacity>
    </DashboardSectionContainer>
  );
}

type DashboardWaterSectionProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  onPress?: () => void;
};

function DashboardWaterSection({ dateString, onPress }: DashboardWaterSectionProps) {
  return (
    <DashboardSectionContainer>
      <WaterCard dateString={dateString} onPress={onPress} />
    </DashboardSectionContainer>
  );
}

type DashboardStreaksSectionProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  isLoading: boolean;
};

function DashboardStreaksSection({ dateString, colors, isLoading }: DashboardStreaksSectionProps) {
  const { t } = useTranslation();
  const { loginStreak, foodStreak, isLoading: isLoadingStreaks } = useStreakState();

  // Define streak types with labels and icons (only Login and Food)
  const streakTypes = [
    { type: 'login' as const, label: t('dashboard.streaks.login'), icon: 'person.fill', streak: loginStreak },
    { type: 'food' as const, label: t('dashboard.streaks.food'), icon: 'fork.knife', streak: foodStreak },
  ];

  if (isLoading || isLoadingStreaks) {
    return (
      <DashboardSectionContainer>
        <PremiumCard>
          <View style={styles.streaksHeader}>
            <ThemedText style={[styles.streaksTitle, { color: colors.text }]}>
              {t('dashboard.streaks.title')}
            </ThemedText>
          </View>
          <View style={styles.streaksList}>
            {[1, 2].map((i) => (
              <View key={i} style={[styles.streakRow, { backgroundColor: colors.backgroundSecondary }]}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            ))}
          </View>
        </PremiumCard>
      </DashboardSectionContainer>
    );
  }

  return (
    <DashboardSectionContainer>
      <PremiumCard>
        <View style={styles.streaksHeader}>
          <ThemedText style={[styles.streaksTitle, { color: colors.text }]}>
            {t('dashboard.streaks.title')}
          </ThemedText>
        </View>
        <View style={styles.streaksList}>
          {streakTypes.map(({ type, label, icon, streak }) => {
            if (!streak) {
              return null; // Don't render if streak data not available
            }

            const { currentDays, bestDays, status } = streak;

            return (
              <View key={type} style={[styles.streakRow, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={styles.streakLeft}>
                  <IconSymbol name={icon as any} size={20} color={colors.text} />
                  <ThemedText style={[styles.streakLabel, { color: colors.text }]}>
                    {label}
                  </ThemedText>
                </View>
                <View style={styles.streakRight}>
                  <View style={styles.streakStats}>
                    <ThemedText style={[styles.streakValue, { color: colors.text }]}>
                      {currentDays} {t('dashboard.streaks.days')}
                    </ThemedText>
                    <ThemedText style={[styles.streakBest, { color: colors.textMuted }]}>
                      {t('dashboard.streaks.best')} {bestDays}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.streakStatus,
                      {
                        backgroundColor: status === 'active' ? colors.accentFood : colors.backgroundTertiary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.streakStatusText,
                        { color: status === 'active' ? colors.textInverse : colors.textSecondary },
                      ]}
                    >
                      {status === 'active' ? t('dashboard.streaks.active') : t('dashboard.streaks.broken')}
                    </ThemedText>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </PremiumCard>
    </DashboardSectionContainer>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user, profile: authProfile } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Get user config for avatar
  const { data: userConfig } = useUserConfig();
  const effectiveProfile = userConfig || authProfile;

  // Goal type drives calorie gauge color rules (mirrors Home / CalorieCurvyGauge).
  const rawGoalType = userConfig?.goal_type;
  const goalType: 'lose' | 'maintain' | 'recomp' | 'gain' =
    rawGoalType === 'lose' || rawGoalType === 'maintain' || rawGoalType === 'recomp' || rawGoalType === 'gain'
      ? rawGoalType
      : 'maintain';

  // Use shared date hook
  const {
    selectedDate,
    selectedDateString,
    isToday,
    today,
    minDate,
    canGoBack,
  } = useSelectedDate();

  // Calendar view month state removed - now handled by DatePickerButton component

  // Helper function to navigate with new date (updates URL param)
  const navigateWithDate = useCallback(
    (date: Date) => {
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      router.replace({
        pathname: '/dashboard',
        params: { date: dateString }
      });
    },
    [router]
  );


  // Responsive layout
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isSmallScreen = screenWidth < 375;
  const isMobile = screenWidth < 768;
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  // Dashboard data hooks - using module hooks directly
  const foodSummary = useDailyFoodSummary(selectedDateString);
  const weeklyFood = useWeeklyFoodCalories(selectedDateString, 7);


  // Handle date selection from charts
  const handleDateSelect = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      navigateWithDate(date);
    }
  };


  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // Use dashboard background color
  const dashboardBackground = colors.dashboardBackground || colors.background;

  return (
    <ThemedView style={[styles.container, { backgroundColor: dashboardBackground }]}>
      {/* Subtle background gradient for web */}
      {Platform.OS === 'web' && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: dashboardBackground,
              ...(Platform.OS === 'web' && {
                // @ts-ignore - Web-only CSS property
                backgroundImage: `linear-gradient(to bottom, ${dashboardBackground}, ${colors.backgroundSecondary})`,
              }),
            },
            { pointerEvents: 'none' as const },
          ]}
        />
      )}
      <CollapsibleModuleHeader
        dateText={(() => {
          // Format date for display (same logic as index.tsx)
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          const yesterday = new Date(todayDate);
          yesterday.setDate(yesterday.getDate() - 1);
          const currentYear = todayDate.getFullYear();
          const selectedYear = selectedDate.getFullYear();
          const isCurrentYear = selectedYear === currentYear;
          const dateOptions: Intl.DateTimeFormatOptions = {
            ...(isToday || selectedDate.getTime() === yesterday.getTime() ? {} : { weekday: 'short' }),
            month: 'short',
            day: 'numeric',
            ...(isCurrentYear ? {} : { year: 'numeric' }),
          };
          const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
          return isToday
            ? `${t('common.today')}, ${formattedDate}`
            : selectedDate.getTime() === yesterday.getTime()
            ? `${t('common.yesterday')}, ${formattedDate}`
            : formattedDate;
        })()}
        rightAvatarUri={effectiveProfile?.avatar_url ?? undefined}
        preferredName={effectiveProfile?.first_name ?? undefined}
        rightAction={
          <DatePickerButton
            selectedDate={selectedDate}
            onDateSelect={navigateWithDate}
            today={today}
            minimumDate={minDate}
            maximumDate={today}
          />
        }
        goBackOneDay={
          canGoBack
            ? () => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                navigateWithDate(newDate);
              }
            : undefined
        }
        goForwardOneDay={() => {
          if (!isToday) {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            navigateWithDate(newDate);
          }
        }}
        isToday={isToday}
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>
        {/* Dashboard: Under Under Construction */}
        <View style={styles.constructionBanner}>
          <ThemedText style={[styles.constructionText, { color: colors.textSecondary }]}>
            Dashboard: Under Construction
          </ThemedText>
        </View>

        {/* Food Section - Full Width */}
        <DashboardFoodSection
          dateString={selectedDateString}
          goalType={goalType}
          colors={colors}
          isSmallScreen={isSmallScreen}
          isMobile={isMobile}
          onPress={() => router.push(`/?date=${selectedDateString}`)}
          onDateSelect={handleDateSelect}
        />

        {/* Body Stats Section - Full Width */}
        <DashboardBodyStatsSection />

        {/* Module Grid - 2 columns on desktop, single column on mobile */}
        <View style={[styles.moduleGrid, isMobile && styles.moduleGridMobile]}>
          <DashboardExerciseSection
            dateString={selectedDateString}
            colors={colors}
            isSmallScreen={isSmallScreen}
            isMobile={isMobile}
            onPress={() => router.push(`/exercise?date=${selectedDateString}`)}
            onDateSelect={handleDateSelect}
          />

          <DashboardWaterSection
            dateString={selectedDateString}
            colors={colors}
            onPress={() => router.push(`/water?date=${selectedDateString}`)}
          />

          <DashboardMedsSection
            dateString={selectedDateString}
            colors={colors}
            onPress={() => router.push(`/meds?date=${selectedDateString}`)}
            onDateSelect={handleDateSelect}
          />

          <DashboardStreaksSection
            dateString={selectedDateString}
            colors={colors}
            isLoading={false}
          />
        </View>
        </DesktopPageContainer>
      </CollapsibleModuleHeader>
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
  constructionBanner: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  constructionText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.titleGapCompact,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
  },
  goalLabel: {
    fontSize: FontSize.md,
    marginBottom: 0,
    textAlign: 'center',
  },
  // Chart containers
  chartContainer: {
    alignItems: 'center',
    marginTop: Layout.chartGapCompact,
    marginBottom: Layout.chartGapCompact,
  },
  chartSection: {
    marginTop: Spacing.sm, // Reduced spacing after avocado gauge
    marginBottom: Spacing.sm, // Reduced spacing before macro gauges
  },
  chartTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Layout.chartGapCompact,
  },
  chartSubtitle: {
    fontSize: FontSize.xs,
    marginTop: Layout.rowGapCompact,
    textAlign: 'center',
  },
  streakChip: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
    marginTop: Layout.rowGapCompact,
  },
  streakChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  // Calories row
  caloriesRow: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // IMPORTANT: anchor for absolute overlay
    marginTop: 0 - Spacing.sm,
    marginBottom: 0,
    minHeight: 240, // ensure overlay has room, but doesn't force layout shifts
  },
  foodChipsOverlay: {
    position: 'absolute',
    left: Spacing.md, // shift into the left white space
    top: Spacing.sm, // align with top of avocado area
    zIndex: 5,
  },
  foodChipsColumn: {
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  foodChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
  },
  foodChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  // Macro gauges (same as home screen)
  macroGaugeRowWrap: {
    marginTop: Spacing.none, // Spacing handled by chartSection marginBottom
    position: 'relative',
  },
  macroGaugeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  macroGaugeRowGauges: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  macroTargetsGearButtonAbsolute: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniGaugeSection: {
    marginTop: Spacing.sm,
  },
  miniGaugeRow: {
    flexDirection: 'row',
  },
  miniGaugeItem: {
    flex: 1,
  },
  miniGaugeItemSpaced: {
    marginRight: Spacing.sm,
  },
  // Exercise styles
  exerciseToday: {
    alignItems: 'center',
    marginBottom: Layout.chartGapCompact,
  },
  exerciseValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: 3,
  },
  exerciseSubtext: {
    fontSize: FontSize.sm,
    marginBottom: 3,
  },
  exerciseMain: {
    fontSize: FontSize.xs,
  },
  // Meds styles
  medsToday: {
    alignItems: 'center',
    marginBottom: Layout.chartGapCompact,
  },
  medsValue: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    marginBottom: 3,
  },
  medsSubtext: {
    fontSize: FontSize.sm,
    marginBottom: 3,
  },
  medsLast: {
    fontSize: FontSize.xs,
  },
  // Adherence row
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: Layout.rowGapCompact,
    marginTop: Layout.chartGapCompact,
  },
  adherenceDot: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  adherenceLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  // Module grid layout
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.sectionGapCompact,
  },
  moduleGridMobile: {
    flexDirection: 'column',
    width: '100%',
  },
  // Loading skeleton
  loadingSkeleton: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Streaks section
  streaksHeader: {
    marginBottom: Layout.titleGapCompact,
  },
  streaksTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  streaksList: {
    gap: Spacing.sm,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.xs,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  streakLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  streakRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  streakStats: {
    alignItems: 'flex-end',
  },
  streakValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  streakBest: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xxs,
  },
  streakStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
  },
  streakStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});

