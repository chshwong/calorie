import { BurnedCaloriesModal } from '@/components/burned/BurnedCaloriesModal';
import { DailyBurnWearableSyncSlot } from '@/components/burned/DailyBurnWearableSyncSlot';
import { EnergyEquation } from '@/components/burned/EnergyEquation';
import { CalInVsOutChart } from '@/components/charts/cal-in-vs-out-chart';
import { DashboardSectionContainer } from '@/components/dashboard-section-container';
import { ExerciseActivitiesChart } from '@/components/dashboard/exercise-activities-chart';
import { PremiumCard } from '@/components/dashboard/premium-card';
import { WaterCard } from '@/components/dashboard/water-card';
import { WeightCard } from '@/components/dashboard/weight-card';
import { AvocadoGauge } from '@/components/gauges/AvocadoGauge';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { TapHintOverlay } from '@/components/TapHintOverlay';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showAppToast } from '@/components/ui/app-toast';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDailySumExercisesStepsForDate } from '@/hooks/use-daily-sum-exercises';
import {
  useDailyFoodSummary,
  useWeeklyCalInVsOut,
} from '@/hooks/use-dashboard-data';
import { useExerciseLogsForDate } from '@/hooks/use-exercise-logs';
import { useFitbitConnectionQuery } from '@/hooks/use-fitbit-connection';
import { useFitbitSyncOrchestrator } from '@/hooks/use-fitbit-sync-orchestrator';
import { useMedLogsForDate, useMedSummaryForRecentDays } from '@/hooks/use-med-logs';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useStreakState } from '@/hooks/use-streak-state';
import { useUserConfig } from '@/hooks/use-user-config';
import { compareDateKeys, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { getFoodLoggingStreakLabel } from '@/src/lib/streaks/foodStreakLabel';
import {
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import { getLocalDateString, getMealTypeFromCurrentTime } from '@/utils/calculations';
import { getDashboardDayLabel } from '@/utils/dashboardDayLabel';
import { addDays, toDateKey } from '@/utils/dateKey';
import { getTodayKey, getYesterdayKey } from '@/utils/dateTime';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Platform, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';

// Presentational Components

// Constants for exercise chips
const MAX_EXERCISE_CHIPS_PER_DAY = 8;

type DashboardFoodSectionProps = {
  dateString: string;
  goalType: 'lose' | 'maintain' | 'recomp' | 'gain';
  colors: typeof Colors.light | typeof Colors.dark;
  isSmallScreen: boolean;
  isMobile: boolean;
  onPress: () => void;
  onDateSelect: (dateString: string) => void;
  onEditBurned: () => void;
  onPressExercise: () => void;
  foodSummary: ReturnType<typeof useDailyFoodSummary>;
  onTapHintRectChange?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onTapHintVisibleChange?: (visible: boolean) => void;
  willSyncWeight?: boolean;
  willSyncSteps?: boolean;
};

function DashboardFoodSection({ dateString, goalType, colors, isSmallScreen, isMobile, onPress, onDateSelect, onEditBurned, onPressExercise, foodSummary, onTapHintRectChange, onTapHintVisibleChange, willSyncWeight, willSyncSteps }: DashboardFoodSectionProps) {
  const { t } = useTranslation();
  const weeklyCalInVsOut = useWeeklyCalInVsOut(dateString, 7, goalType);
  const { data: stepsRow } = useDailySumExercisesStepsForDate(dateString);
  const stepsForDay = stepsRow?.steps ?? 0;
  const fitbit = useFitbitConnectionQuery({ enabled: Platform.OS === 'web' });
  const fitbitOrchestrator = useFitbitSyncOrchestrator();

  const mealCals = useMemo(() => {
    const out = { breakfast: 0, lunch: 0, dinner: 0, afternoon_snack: 0 };
    const entries = foodSummary.entries ?? [];
    if (!Array.isArray(entries)) return out;
    for (const e of entries) {
      const mt = e.meal_type?.toLowerCase?.() ?? '';
      const cals = Number(e.calories_kcal ?? 0);
      if (mt === 'breakfast') out.breakfast += cals;
      else if (mt === 'lunch') out.lunch += cals;
      else if (mt === 'dinner') out.dinner += cals;
      else if (mt === 'afternoon_snack' || mt === 'snack') out.afternoon_snack += cals;
    }
    return out;
  }, [foodSummary.entries]);

  useEffect(() => {
    if (!__DEV__) return;
    const sum = mealCals.breakfast + mealCals.lunch + mealCals.dinner + mealCals.afternoon_snack;
    const total = Number(foodSummary.caloriesTotal ?? 0);
    if (Math.abs(Math.round(sum) - Math.round(total)) > 1) {
      console.warn('[Dashboard] meal calories != total', { sum, total, mealCals });
    }
  }, [mealCals, foodSummary]);

  const format4 = (n: number) => {
    const s = String(Math.max(0, Math.round(n)));
    return s.padStart(4, ' ');
  };

  const mealRows = [
    { key: 'breakfast', emoji: '☀️', value: mealCals.breakfast },
    { key: 'lunch', emoji: '🕛', value: mealCals.lunch },
    { key: 'afternoon_snack', emoji: '🥑', value: mealCals.afternoon_snack },
    { key: 'dinner', emoji: '🌙', value: mealCals.dinner },
  ];

  const totalEatenCalories = Number(foodSummary.caloriesTotal ?? 0);
  const normalizedLogStatus = (foodSummary.logStatus ?? '').toLowerCase();
  const isFoodLoading = foodSummary.isLoading || foodSummary.isFetching;

  const foodState = useMemo(() => {
    if (isFoodLoading) return 'LOADING';
    if (totalEatenCalories === 0 && (normalizedLogStatus === 'fasted' || normalizedLogStatus === 'completed')) {
      return 'FASTED_OR_COMPLETED_ZERO';
    }
    if (totalEatenCalories > 0) return 'LOGGED';
    return 'START_LOGGING';
  }, [isFoodLoading, normalizedLogStatus, totalEatenCalories]);

  const isStartLogging = foodState === 'START_LOGGING';
  const isFastedOrCompleted = foodState === 'FASTED_OR_COMPLETED_ZERO';
  const isFasted = isFastedOrCompleted && normalizedLogStatus === 'fasted';
  const statusChipLabel = isFastedOrCompleted
    ? (isFasted ? t('dashboard.food.status_fasted_chip') : t('dashboard.food.status_completed_chip'))
    : null;
  const statusHint = isFastedOrCompleted
    ? (isFasted ? t('dashboard.food.status_fasted_hint') : t('dashboard.food.status_completed_hint'))
    : null;

  const logFirstMealRef = useRef<View>(null);
  const updateLogFirstMealRect = useCallback(() => {
    if (!logFirstMealRef.current) return;
    logFirstMealRef.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onTapHintRectChange?.({ x, y, width, height });
      }
    });
  }, [onTapHintRectChange]);

  useEffect(() => {
    onTapHintVisibleChange?.(isStartLogging);
    if (!isStartLogging) {
      onTapHintRectChange?.(null);
      return;
    }
    const raf = requestAnimationFrame(updateLogFirstMealRect);
    return () => cancelAnimationFrame(raf);
  }, [isStartLogging, onTapHintRectChange, onTapHintVisibleChange, updateLogFirstMealRect]);

  // Calculate averages, excluding days with no value (0 or invalid) - memoized for performance
  const avgStats = useMemo(() => {
    if (weeklyCalInVsOut.data.length === 0) return null;
    const eatenValues = weeklyCalInVsOut.data.filter(d => d.caloriesIn > 0).map(d => d.caloriesIn);
    const burnedValues = weeklyCalInVsOut.data.filter(d => d.caloriesOut > 0).map(d => d.caloriesOut);
    
    const avgEaten = eatenValues.length > 0 
      ? Math.round(eatenValues.reduce((sum, val) => sum + val, 0) / eatenValues.length)
      : 0;
    const avgBurned = burnedValues.length > 0
      ? Math.round(burnedValues.reduce((sum, val) => sum + val, 0) / burnedValues.length)
      : 0;
    
    return { avgEaten, avgBurned };
  }, [weeklyCalInVsOut.data]);

  // Helper function to get goal label - memoized to avoid recreation on every render
  const getGoalLabel = useMemo(() => {
    switch (goalType) {
      case 'lose':
        return t('onboarding.goal.lose_weight.label');
      case 'maintain':
        return t('onboarding.goal.maintain_weight.label');
      case 'recomp':
        return t('onboarding.goal.recomp.label');
      case 'gain':
        return t('onboarding.goal.gain_weight.label');
      default:
        return t('dashboard.food.goal'); // Fallback to generic "Goal" if goalType is unknown
    }
  }, [goalType, t]);

  if (weeklyCalInVsOut.isLoading) {
    return (
      <DashboardSectionContainer>
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="fork.knife" size={20} color={colors.accentFood} decorative />
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

  const gaugeSize = isSmallScreen ? 190 : 220;

  return (
    <DashboardSectionContainer>
      <PremiumCard>
        {/* Header-only button to avoid nested <button> hydration errors on web (chart bars are interactive). */}
        <View style={styles.cardHeader}>
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={getMinTouchTargetStyle()}
            {...getButtonAccessibilityProps(t('dashboard.food.title'), t('dashboard.food.accessibility_hint'))}
            {...(Platform.OS === 'web' && getFocusStyle(colors.accentFood))}
          >
            <View style={styles.cardTitleRow}>
              <IconSymbol name="fork.knife" size={20} color={colors.accentFood} decorative />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.food.title')}
              </ThemedText>
              {isFastedOrCompleted && statusChipLabel && (
                <View style={[styles.foodStatusChip, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.foodStatusChipText, { color: colors.textSecondary }]}>
                    {statusChipLabel}
                  </ThemedText>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.foodHeaderRight}>
            <View style={[styles.syncPill, { backgroundColor: colors.backgroundSecondary }]}>
              {Platform.OS === 'web' && (
                <DailyBurnWearableSyncSlot
                  isConnected={fitbit.isConnected}
                  lastSyncAt={fitbit.lastSyncAt}
                  onSync={async () => {
                    const res = await fitbitOrchestrator.syncFitbitAllNow({
                      dateKey: toDateKey(dateString),
                      includeBurnApply: true,
                    });
                    if (res.weightOk === false && res.weightErrorCode === 'INSUFFICIENT_SCOPE') {
                      showAppToast(t('weight.settings.wearable.toast.reconnect_to_enable_weight_sync'));
                    }
                  }}
                  variant="compact"
                  willSyncWeight={willSyncWeight}
                  willSyncSteps={willSyncSteps}
                />
              )}
            </View>
          </View>
        </View>
        {isFastedOrCompleted && statusHint && (
          <ThemedText style={[styles.foodStatusHint, { color: colors.textSecondary }]}>
            {statusHint}
          </ThemedText>
        )}

          {/* Gauge area: Cal by meal (left), Burn−Eaten=Deficit (center-right), AvocadoGauge (center), chips (bottom). Sync is in card header. */}
          <View style={styles.caloriesRow}>
            <View style={styles.mealBreakdownOverlay}>
              <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                style={getMinTouchTargetStyle()}
                {...getButtonAccessibilityProps(t('dashboard.food.title'), t('dashboard.food.accessibility_hint'))}
                {...(Platform.OS === 'web' && getFocusStyle(colors.accentFood))}
              >
                <View style={[styles.mealBreakdownConnector, { backgroundColor: colors.border }]} />
                <ThemedText style={[styles.mealBreakdownTitle, { color: colors.textMuted }]}>
                  Cal by meal
                </ThemedText>
                <View style={styles.mealBreakdownStack}>
                  {isStartLogging ? (
                    <View style={styles.emptyMealCopy}>
                      <ThemedText style={[styles.emptyMealTitle, { color: colors.textSecondary }]}>
                        {t('dashboard.food.start_logging_empty_title')}
                      </ThemedText>
                      <ThemedText style={[styles.emptyMealSubtitle, { color: colors.textMuted }]}>
                        {t('dashboard.food.start_logging_empty_subtitle')}
                      </ThemedText>
                    </View>
                  ) : (
                    mealRows.map(r => {
                      const v = Math.round(r.value ?? 0);
                      const isZero = v === 0;
                      return (
                        <View key={r.key} style={[styles.mealRow, isZero && styles.mealRowZero]}>
                          <ThemedText style={[styles.mealEmoji, { color: colors.textSecondary }]}>
                            {r.emoji}
                          </ThemedText>
                          <ThemedText
                            style={[styles.mealValue, { color: colors.textSecondary }]}
                          >
                            {format4(v)}
                          </ThemedText>
                        </View>
                      );
                    })
                  )}
                </View>
              </TouchableOpacity>
              <View style={[styles.leftOverlayDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                onPress={onPressExercise}
                activeOpacity={0.7}
                style={getMinTouchTargetStyle()}
                {...getButtonAccessibilityProps(t('dashboard.exercise.title'), t('dashboard.exercise.accessibility_hint'))}
                {...(Platform.OS === 'web' && getFocusStyle(colors.accentExercise))}
              >
                <ThemedText style={[styles.leftOverlaySubheader, { color: colors.textSecondary }]}>
                  Steps
                </ThemedText>
                <View style={[styles.mealRow, styles.stepsRowTight]}>
                  <ThemedText style={[styles.mealEmoji, { color: colors.textSecondary }]}>👣</ThemedText>
                  <ThemedText style={[styles.mealValue, { color: colors.textSecondary }]}>{format4(stepsForDay)}</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
            {!isStartLogging && (
              <View style={styles.burnEquationOverlay} pointerEvents="box-none">
                <EnergyEquation
                  dateKey={dateString}
                  layout="vertical"
                  variant="minimalVertical"
                  showSync={false}
                  compact={isSmallScreen || isMobile}
                  onEditBurned={onEditBurned}
                />
              </View>
            )}
            <View style={styles.gaugeArea}>
              <View style={styles.avocadoCenterWrap}>
                <View style={[styles.avocadoInnerWrap, Platform.OS === 'web' && styles.avocadoInnerWrapWeb]}>
                  <View style={styles.gaugeOnTop}>
                    <TouchableOpacity
                      onPress={onPress}
                      activeOpacity={0.7}
                      style={getMinTouchTargetStyle()}
                      {...getButtonAccessibilityProps(t('dashboard.food.title'), t('dashboard.food.accessibility_hint'))}
                      {...(Platform.OS === 'web' && getFocusStyle(colors.accentFood))}
                    >
                      <View style={[styles.avocadoGaugeDimWrap, isStartLogging && styles.avocadoGaugeDimmed]}>
                        <AvocadoGauge
                          consumed={Number(foodSummary.caloriesTotal)}
                          target={Number(foodSummary.caloriesGoal)}
                          goalType={goalType}
                          size={gaugeSize}
                          strokeWidth={8}
                          surfaceBg={colors.card}
                          showLabel
                          animationKey={dateString}
                        />
                      </View>
                      {isStartLogging && (
                        <View pointerEvents="none" style={styles.avocadoCtaOverlay}>
                          <View
                            ref={logFirstMealRef}
                            onLayout={updateLogFirstMealRect}
                            style={[styles.avocadoCtaPill, { backgroundColor: colors.accentFood }]}
                          >
                            <ThemedText style={styles.avocadoCtaPillText}>
                              {t('dashboard.food.start_logging_button')}
                            </ThemedText>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  {!isStartLogging && (
                    <TouchableOpacity
                      onPress={onPress}
                      activeOpacity={0.7}
                      style={[styles.avocadoChipsOverlay, getMinTouchTargetStyle()]}
                      {...getButtonAccessibilityProps(t('dashboard.food.title'), t('dashboard.food.accessibility_hint'))}
                      {...(Platform.OS === 'web' && getFocusStyle(colors.accentFood))}
                    >
                      <View style={[styles.foodChip, { backgroundColor: colors.backgroundSecondary }]}>
                        <ThemedText
                          style={[styles.foodChipText, { color: colors.textSecondary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          Goal: {getGoalLabel}
                        </ThemedText>
                      </View>
                      <View style={[styles.foodChip, { backgroundColor: colors.backgroundSecondary }]}>
                        <ThemedText
                          style={[styles.foodChipText, { color: colors.textSecondary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          Aim: {Number(foodSummary.caloriesGoal).toLocaleString('en-US')} {t('units.kcal')}/day
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
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
              yesterdayDateString={getYesterdayKey()}
              useYdayLabel
              onBarPress={onDateSelect}
              height={isSmallScreen ? 105 : isMobile ? 120 : 128}
            />
            {avgStats && (
              <ThemedText style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                Avg 🥑: {avgStats.avgEaten} {t('units.kcal')}/day  ·  Avg 🔥: {avgStats.avgBurned} {t('units.kcal')}/day
              </ThemedText>
            )}
          </View>

      </PremiumCard>
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
  const router = useRouter();
  const { data: logs = [], isLoading } = useExerciseLogsForDate(dateString);
  
  // Determine number of days to show based on screen width and orientation
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isWide = isLandscape || width >= 700;
  const daysToShow = isWide ? 7 : 5;
  
  // Fetch exercise logs for last N days for chips display
  const recentDays = useMemo(() => {
    const days: string[] = [];
    const endDate = new Date(dateString + 'T00:00:00');
    for (let i = daysToShow - 1; i >= 0; i--) {
      const day = new Date(endDate);
      day.setDate(day.getDate() - i);
      const dayKey = toDateKey(day);
      if (compareDateKeys(dayKey, dateString) <= 0) {
        days.push(dayKey);
      }
    }
    // Always return the requested number of days, padding with the last valid day if needed
    while (days.length < daysToShow) {
      days.push(days[days.length - 1] || dateString);
    }
    return days.slice(0, daysToShow);
  }, [dateString, daysToShow]);
  
  // Fetch logs for each day (hooks must be called unconditionally, but we'll only use up to daysToShow)
  const day1Logs = useExerciseLogsForDate(recentDays[0] || dateString);
  const day2Logs = useExerciseLogsForDate(recentDays[1] || dateString);
  const day3Logs = useExerciseLogsForDate(recentDays[2] || dateString);
  const day4Logs = useExerciseLogsForDate(recentDays[3] || dateString);
  const day5Logs = useExerciseLogsForDate(recentDays[4] || dateString);
  const day6Logs = useExerciseLogsForDate(recentDays[5] || dateString);
  const day7Logs = useExerciseLogsForDate(recentDays[6] || dateString);
  
  const recentDaysLogs = [day1Logs, day2Logs, day3Logs, day4Logs, day5Logs, day6Logs, day7Logs];

  if (isLoading) {
    return (
      <DashboardSectionContainer>
        <PremiumCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="figure.run" size={20} color={colors.accentExercise} decorative />
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
      <PremiumCard>
        {/* Header-only button to avoid nested <button> hydration errors on web (day columns are interactive). */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={getMinTouchTargetStyle()}
          {...getButtonAccessibilityProps(t('dashboard.snapshot.ex'), t('dashboard.exercise.accessibility_hint'))}
          {...(Platform.OS === 'web' && getFocusStyle(colors.accentExercise))}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="figure.run" size={20} color={colors.accentExercise} decorative />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.snapshot.ex')}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>

          {/* Cardio/Mind-body Activities Chart */}
          <ExerciseActivitiesChart
            dateString={dateString}
            colors={colors}
            recentDays={recentDays.slice(0, daysToShow)}
            recentDaysLogs={recentDaysLogs}
            category="cardio_mind_body"
            titleIcons={[
              { name: 'figure.run', size: 16 },
              { name: 'figure.seated', size: 16 },
            ]}
            titleText="Cardio & Mind-Body"
            isWide={isWide}
            showTopBorder={false}
            showSelectedOutline={false}
            showFocusOutline={false}
          />
          
          {/* Strength Activities Chart */}
          <ExerciseActivitiesChart
            dateString={dateString}
            colors={colors}
            recentDays={recentDays.slice(0, daysToShow)}
            recentDaysLogs={recentDaysLogs}
            category="strength"
            titleIcons={[
              { name: 'dumbbell.fill', size: 16 },
              { name: 'figure.strengthtraining.traditional', size: 16 },
            ]}
            titleText="Strength Activities"
            isWide={isWide}
            showSelectedOutline={false}
            showFocusOutline={false}
          />
      </PremiumCard>
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
  const router = useRouter();
  const { user } = useAuth();
  const { data: logs = [], isLoading } = useMedLogsForDate(dateString);
  const { data: weeklySummary = [] } = useMedSummaryForRecentDays(7);
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  // Calculate summary inline
  const totalItems = logs.length;
  const medCount = logs.filter(log => log.type === 'med').length;
  const suppCount = logs.filter(log => log.type === 'supp').length;
  const lastItem = logs.length > 0 ? logs[logs.length - 1] : null;
  const lastItemName = lastItem?.name || null;
  const lastItemDose = lastItem && lastItem.dose_amount !== null && lastItem.dose_unit
    ? `${lastItem.dose_amount} ${lastItem.dose_unit}`
    : null;

  // Format "Logged" summary text based on selected date
  const loggedSummaryText = useMemo(() => {
    if (dateString === todayKey) {
      return `Logged today: ${totalItems}`;
    } else if (dateString === yesterdayKey) {
      return `Logged yday: ${totalItems}`;
    } else {
      const date = new Date(dateString + 'T00:00:00');
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
      return `Logged on ${dayLabel}: ${totalItems}`;
    }
  }, [dateString, todayKey, yesterdayKey, totalItems]);

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
              <IconSymbol name="pills.fill" size={20} color={colors.accentMeds} decorative />
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
      <PremiumCard>
        {/* Header-only button to avoid nested <button> hydration errors on web (adherence dots are interactive). */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={getMinTouchTargetStyle()}
          {...getButtonAccessibilityProps(t('dashboard.meds.title'), t('dashboard.meds.accessibility_hint'))}
          {...(Platform.OS === 'web' && getFocusStyle(colors.accentMeds))}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="pills.fill" size={20} color={colors.accentMeds} decorative />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.meds.title')}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>

          <View style={styles.medsToday}>
            <ThemedText style={[styles.medsLoggedSummary, { color: colors.textSecondary }]}>
              {loggedSummaryText}
            </ThemedText>
            <ThemedText style={[styles.medsSubtext, { color: colors.textMuted }]}>
              {medCount} {t('dashboard.meds.med')} · {suppCount} {t('dashboard.meds.supp')}
            </ThemedText>
            {lastItemName && (
              <ThemedText style={[styles.medsLast, { color: colors.textSubtle }]}>
                {t('dashboard.meds.last', { 
                  name: lastItemName, 
                  dose: lastItemDose ? ` – ${lastItemDose}` : '' 
                })}
              </ThemedText>
            )}
          </View>

          <View style={styles.chartSection}>
            <View style={styles.rangeTitleRow}>
              <ThemedText style={[styles.rangeTitle, { color: colors.text }]}>
                {t('common.last_7_days')}
              </ThemedText>
            </View>
            <View style={styles.adherenceRow}>
              {weeklyData.map((day) => {
                const date = new Date(day.date + 'T00:00:00');
                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                const displayLabel = getDashboardDayLabel({
                  dateKey: day.date,
                  todayKey,
                  yesterdayKey,
                  t,
                  getWeekdayLabel: () => dayLabel.charAt(0),
                });
                return (
                  <Pressable
                    key={day.date}
                    style={[
                      styles.adherenceDot,
                      {
                        backgroundColor: day.hasAnyBoolean ? colors.accentMeds : colors.backgroundSecondary,
                      },
                      Platform.OS === 'web' && ({ outlineStyle: 'none', outlineWidth: 0 } as any),
                    ]}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      router.push({ pathname: '/meds', params: { date: day.date } } as any);
                    }}
                    android_ripple={null}
                    {...getButtonAccessibilityProps(
                      t('dashboard.meds.a11y_day_label', {
                        day: getDashboardDayLabel({
                          dateKey: day.date,
                          todayKey,
                          yesterdayKey,
                          t,
                          getWeekdayLabel: () => dayLabel,
                        }),
                      }),
                      t('dashboard.meds.a11y_day_hint')
                    )}
                  >
                    <ThemedText style={[styles.adherenceLabel, { color: day.hasAnyBoolean ? colors.textInverse : colors.textSecondary }]}>
                      {displayLabel}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
      </PremiumCard>
    </DashboardSectionContainer>
  );
}

type DashboardWaterSectionProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  onPress?: () => void;
};

type DashboardWeightSectionProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  onPress?: () => void;
};

function DashboardWeightSection({ dateString, onPress }: DashboardWeightSectionProps) {
  return (
    <DashboardSectionContainer>
      <WeightCard dateString={dateString} onPress={onPress} />
    </DashboardSectionContainer>
  );
}

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
  const router = useRouter();
  const { loginStreak, foodStreak, isLoading: isLoadingStreaks } = useStreakState();
  const todayKey = getTodayKey();

  // Define streak types with labels, icons, and category colors
  const streakTypes: Array<{
    type: 'login' | 'food';
    label: string;
    icon: IconSymbolName;
    streak: typeof loginStreak;
    accentColor: string;
  }> = [
    { 
      type: 'login' as const, 
      label: t('dashboard.streaks.login'), 
      icon: 'person.fill' as IconSymbolName, 
      streak: loginStreak,
      accentColor: colors.accentStreak, // Purple for login streak
    },
    { 
      type: 'food' as const, 
      label: t('dashboard.streaks.food'), 
      icon: 'fork.knife' as IconSymbolName, 
      streak: foodStreak,
      accentColor: colors.accentFood, // Salmon for food streak
    },
  ];

  // Helper to generate 7-day indicator for last 7 calendar days
  // Returns array where dots[0] = oldest (today-6), dots[6] = today (newest)
  const getWeekIndicator = (lastDayKey: string | null, currentDays: number, status: 'active' | 'broken') => {
    if (!lastDayKey || status === 'broken' || currentDays === 0) {
      // If broken or no streak, all empty
      return Array(7).fill(false);
    }

    // Generate last 7 calendar days in chronological order (oldest to newest)
    // days[0] = today-6 (oldest), days[6] = today (newest)
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(addDays(todayKey, -i));
    }
    // Verify: days[0] should be oldest, days[6] should be today
    // days[0] = addDays(todayKey, -6) = today-6 ✓
    // days[6] = addDays(todayKey, -0) = today ✓

    // Determine which days are part of the streak
    // lastDayKey is the last day that was part of the streak
    // The streak spans from (lastDayKey - currentDays + 1) to lastDayKey
    const lastDayDate = new Date(lastDayKey + 'T00:00:00');
    const streakStartDate = new Date(lastDayDate);
    streakStartDate.setDate(streakStartDate.getDate() - (currentDays - 1));

    // Build dots array in chronological order (oldest to newest)
    // dots[0] = status for days[0] (today-6), dots[6] = status for days[6] (today)
    const dots: boolean[] = [];
    for (const dayKey of days) {
      const dayDate = new Date(dayKey + 'T00:00:00');
      const isInStreak = dayDate >= streakStartDate && dayDate <= lastDayDate;
      dots.push(isInStreak);
    }

    // Ensure correct order: dots[0] = oldest, dots[6] = today
    // If somehow reversed, reverse only at this point (but should already be correct)
    return dots;
  };

  // Helper to check if today is logged
  const isTodayLogged = (lastDayKey: string | null) => {
    return lastDayKey === todayKey;
  };

  // Helper to get PR (personal best) text
  const getPRText = (currentDays: number, bestDays: number) => {
    if (currentDays === bestDays && currentDays > 0) {
      return t('dashboard.streaks.best_tied', { days: bestDays });
    }
    if (currentDays > bestDays) {
      return t('dashboard.streaks.best_new_pr', { days: currentDays });
    }
    return t('dashboard.streaks.best_days', { days: bestDays });
  };

  // Helper to get motivation message
  const getMotivationText = (currentDays: number, bestDays: number) => {
    if (bestDays > 0 && currentDays < bestDays) {
      const daysToBeat = bestDays - currentDays;
      if (daysToBeat <= 2) {
        return daysToBeat === 1 
          ? t('dashboard.streaks.motivation_one')
          : t('dashboard.streaks.motivation_plural', { days: daysToBeat });
      }
    }
    return null;
  };

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
          {streakTypes.map(({ type, label, icon, streak, accentColor }, index) => {
            if (!streak) {
              return null; // Don't render if streak data not available
            }

            const { currentDays, bestDays, status, lastDayKey } = streak;
            const weekDots = getWeekIndicator(lastDayKey, currentDays, status);
            const prText = getPRText(currentDays, bestDays);
            const motivationText = getMotivationText(currentDays, bestDays);
            const todayLogged = isTodayLogged(lastDayKey);
            const isAtRisk = status === 'active' && !todayLogged;
            // Use the same emoji-tier logic for both Login + Food streaks.
            // Dashboard always shows an emoji; for 0–1 days we fall back to a neutral 📅.
            const streakEmoji = getFoodLoggingStreakLabel(currentDays)?.emoji ?? '📅';

            const handlePress = () => {
              if (type === 'login') {
                // Navigate to home/index page (main calorie tracking page)
                // Using /(tabs) which defaults to the index tab
                // Note: Type assertion needed due to expo-router type limitations with tab routes
                router.push('/(tabs)' as Parameters<typeof router.push>[0]);
              } else if (type === 'food') {
                // Navigate to Food Diary (Today) with appropriate meal type
                const todayString = getLocalDateString();
                const mealType = getMealTypeFromCurrentTime();
                router.push({
                  pathname: '/(tabs)/mealtype-log',
                  params: {
                    entryDate: todayString,
                    mealType: mealType,
                    preloadedEntries: JSON.stringify([]),
                  },
                });
              }
            };

            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.streakRow, 
                  { backgroundColor: colors.backgroundSecondary },
                  getMinTouchTargetStyle(),
                ]}
                activeOpacity={0.7}
                onPress={handlePress}
                {...getButtonAccessibilityProps(label, t('dashboard.streaks.accessibility_hint'))}
                {...(Platform.OS === 'web' && getFocusStyle(accentColor))}
              >
                <View style={styles.streakLeft}>
                  <View style={[styles.streakIconContainer, { backgroundColor: accentColor + '20' }]}>
                    <IconSymbol name={icon as IconSymbolName} size={18} color={accentColor} decorative />
                  </View>
                  <View style={styles.streakLabelContainer}>
                    <ThemedText style={[styles.streakLabel, { color: colors.text }]}>
                      {label}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.streakRight}>
                  <View style={styles.streakHeroContainer}>
                    <View style={styles.streakHeroRow}>
                      <ThemedText style={[styles.streakHeroValue, { color: colors.text }]}>
                        {currentDays}
                      </ThemedText>
                      {status === 'active' && (
                        <ThemedText 
                          style={[
                            styles.streakFireEmoji,
                            isAtRisk && { opacity: 0.5 }
                          ]}
                        >
                          {streakEmoji}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText style={[styles.streakHeroLabel, { color: colors.textMuted }]}>
                      {currentDays === 1 
                        ? t('dashboard.streaks.day_streak')
                        : t('dashboard.streaks.days_streak')}
                    </ThemedText>
                    {motivationText ? (
                      <ThemedText style={[styles.streakMotivationText, { color: accentColor }]}>
                        {motivationText}
                      </ThemedText>
                    ) : (
                      <ThemedText style={[styles.streakPRText, { color: colors.textMuted }]}>
                        {prText}
                      </ThemedText>
                    )}
                    {isAtRisk && (
                      <ThemedText style={[styles.streakAtRiskText, { color: colors.textMuted }]}>
                        {t('dashboard.streaks.at_risk')}
                      </ThemedText>
                    )}
                  </View>
                  {status === 'active' && (
                    <View 
                      style={[
                        styles.streakActiveIndicator, 
                        { 
                          backgroundColor: isAtRisk ? accentColor + '60' : accentColor 
                        }
                      ]}
                    >
                      <IconSymbol name="flame.fill" size={12} color={colors.textInverse} decorative />
                    </View>
                  )}
                </View>
                <View style={[styles.streakWeekIndicator, { borderTopColor: colors.backgroundTertiary }]}>
                  {index === 0 && (
                    <View style={styles.streakWeekIndicatorHeader}>
                      <ThemedText style={[styles.streakWeekLabel, { color: colors.textMuted }]}>
                        {t('dashboard.streaks.last_7_days')}
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.streakWeekDotsContainer}>
                    {/* Render in chronological order: left = oldest, right = today */}
                    {/* Per user instruction: if array is built newest-first, reverse it at render time */}
                    {(() => {
                      // Create copy to avoid mutating source data
                      const renderDots = [...weekDots];
                      // Reverse at render time to ensure: left = oldest, right = today
                      // This fixes the reversed order issue
                      const reversedDots = renderDots.reverse();
                      return reversedDots.map((filled, dotIndex) => (
                        <View
                          key={dotIndex}
                          style={[
                            styles.streakWeekDot,
                            {
                              backgroundColor: filled
                                ? accentColor
                                : colors.backgroundTertiary,
                            },
                          ]}
                        />
                      ));
                    })()}
                  </View>
                </View>
              </TouchableOpacity>
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
  const [burnedModalVisible, setBurnedModalVisible] = useState(false);
  const [tapHintRect, setTapHintRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [tapHintVisible, setTapHintVisible] = useState(false);
  
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


  // Handle date selection from charts
  const handleDateSelect = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      navigateWithDate(date);
    }
  };

  // Format date for display (same logic as index.tsx) - memoized for performance
  const formattedDateText = useMemo(() => {
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
  }, [selectedDate, isToday, t]);


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
        dateText={formattedDateText}
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

        {/* Food Section - Full Width */}
        <DashboardFoodSection
          dateString={selectedDateString}
          goalType={goalType}
          colors={colors}
          isSmallScreen={isSmallScreen}
          isMobile={isMobile}
          onPress={() => router.push(`/?date=${selectedDateString}`)}
          onDateSelect={handleDateSelect}
          onEditBurned={() => setBurnedModalVisible(true)}
          onPressExercise={() => router.push(`/exercise?date=${selectedDateString}`)}
          foodSummary={foodSummary}
          onTapHintRectChange={setTapHintRect}
          onTapHintVisibleChange={setTapHintVisible}
          willSyncWeight={userConfig?.weight_sync_provider === 'fitbit'}
          willSyncSteps={userConfig?.exercise_sync_steps === true}
        />

        {/* Module Grid - 2 columns on desktop, single column on mobile */}
        <View style={[styles.moduleGrid, isMobile && styles.moduleGridMobile]}>
          <DashboardWeightSection
            dateString={selectedDateString}
            colors={colors}
            onPress={() => router.push(`/weight?date=${selectedDateString}`)}
          />

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
        <BurnedCaloriesModal
          visible={burnedModalVisible}
          onClose={() => setBurnedModalVisible(false)}
          entryDate={selectedDateString}
        />
        </View>
        </DesktopPageContainer>
      </CollapsibleModuleHeader>
      <TapHintOverlay visible={tapHintVisible} targetRect={tapHintRect} durationMs={4000} />
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
  foodStatusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.chip,
  },
  foodStatusChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  foodStatusHint: {
    fontSize: FontSize.sm,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
  foodHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
    marginTop: Spacing.none, // Minimal spacing after avocado gauge
    marginBottom: Spacing.sm, // Reduced spacing before macro gauges
  },
  chartTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Layout.chartGapCompact,
  },
  // Match Water dashboard mini chart title style ("Last 7 days")
  rangeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  rangeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  chartSubtitle: {
    fontSize: FontSize.sm,
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
  // Calories row: gauge centered; left/right stacks are absolute overlays (don't affect layout)
  caloriesRow: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // IMPORTANT: anchor for absolute overlay
    marginTop: 0,
    marginBottom: 0,
    minHeight: 220, // Reduced to minimize spacing after gauge
    overflow: 'visible',
  },
  mealBreakdownOverlay: {
    position: 'absolute',
    left: Spacing.md,
    top: 0,
    zIndex: 6,
    alignItems: 'flex-start',
  },
  mealBreakdownConnector: {
    position: 'absolute',
    left: 0,
    top: 26,
    width: 18,
    height: 1,
    opacity: 0.25,
  },
  // Right overlay: Burn − Eaten = Deficit (behind gauge so status numbers stay on top)
  burnEquationOverlay: {
    position: 'absolute',
    right: 10,
    top: 0,
    zIndex: 1,
    elevation: 0,
    alignItems: 'flex-end',
    width: 96,
    opacity: 0.85,
    overflow: 'visible',
  },
  mealBreakdownTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.2,
    marginBottom: 4,
    includeFontPadding: false,
    opacity: 0.85,
  },
  mealBreakdownStack: {
    alignItems: 'flex-start',
    gap: 2,
  },
  emptyMealCopy: {
    gap: 2,
  },
  emptyMealTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  emptyMealSubtitle: {
    fontSize: FontSize.xs,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealRowZero: {
    opacity: 0.45,
  },
  mealEmoji: {
    width: 18,
    fontSize: FontSize.sm,
    marginRight: 1,
    textAlign: 'center',
    includeFontPadding: false,
  },
  mealValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textAlign: 'right',
    includeFontPadding: false,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  leftOverlayDivider: {
    height: 1,
    width: 72,
    borderRadius: 1,
    marginTop: 6,
    marginBottom: 4,
    opacity: 0.6,
  },
  leftOverlaySubheader: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
    lineHeight: 14,
    opacity: 0.85,
  },
  stepsRowTight: {
    marginTop: 0,
  },
  foodChipsOverlay: {
    position: 'absolute',
    left: Spacing.md, // shift into the left white space
    top: 0, // align with top of avocado area
    zIndex: 5,
  },
  foodChipsColumn: {
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  gaugeArea: {
    position: 'relative',
    overflow: 'visible',
  },
  avocadoCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  avocadoInnerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 0,
    width: '100%',
  },
  avocadoInnerWrapWeb: {
    marginHorizontal: 'auto',
  },
  gaugeOnTop: {
    position: 'relative',
    zIndex: 3,
    elevation: 3,
  },
  avocadoGaugeDimWrap: {},
  avocadoGaugeDimmed: {
    opacity: 0.45,
  },
  avocadoCtaOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  avocadoCtaPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  avocadoCtaPillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#fff',
    textAlign: 'center',
  },
  gaugeCtaOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  gaugeCtaTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  gaugeCtaSubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  avocadoChipsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    zIndex: 1,
    elevation: 0,
    pointerEvents: 'box-none',
  },
  foodChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
  },
  foodChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Exercise styles
  // Meds styles
  medsToday: {
    alignItems: 'center',
    marginBottom: Layout.chartGapCompact,
  },
  medsLoggedSummary: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: 4,
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
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.xs,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  streakIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakLabelContainer: {
    flex: 1,
  },
  streakLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  streakRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  streakHeroContainer: {
    flex: 1,
  },
  streakHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  streakHeroValue: {
    fontSize: FontSize['3xl'] * 1.1,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['3xl'] * 1.2,
  },
  streakFireEmoji: {
    fontSize: FontSize.xl * 1.15,
    lineHeight: FontSize.xl * 1.3,
  },
  streakHeroLabel: {
    fontSize: FontSize.xs * 0.9,
    fontWeight: FontWeight.medium,
    marginTop: 2,
    opacity: 0.7,
  },
  streakPRText: {
    fontSize: FontSize.xs * 0.85,
    fontWeight: FontWeight.regular,
    marginTop: 2,
    opacity: 0.65,
  },
  streakMotivationText: {
    fontSize: FontSize.xs * 0.9,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  streakAtRiskText: {
    fontSize: FontSize.xs * 0.85,
    fontWeight: FontWeight.regular,
    marginTop: 4,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  streakActiveIndicator: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakWeekIndicator: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'transparent', // Will be set dynamically
  },
  streakWeekIndicatorHeader: {
    marginBottom: Spacing.xs / 2,
  },
  streakWeekLabel: {
    fontSize: FontSize.xs * 0.85,
    fontWeight: FontWeight.regular,
    opacity: 0.6,
  },
  streakWeekDotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  streakWeekDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flex: 1,
  },
  // Exercise chips section (Last N days)
  exerciseChipsSection: {
    marginTop: Layout.chartGapCompact,
    paddingTop: Layout.chartGapCompact,
    borderTopWidth: 1,
    borderTopColor: 'transparent', // Will be set dynamically
  },
  exerciseChipsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  exerciseChipsTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  exerciseChipsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: Spacing.xs,
  },
  exerciseDayColumn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    minHeight: 200,
  },
  exerciseChipsColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    minHeight: 160,
    maxHeight: 160,
    overflow: 'hidden',
  },
  exerciseChip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.chip,
    marginBottom: 6,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    includeFontPadding: false,
  },
  exerciseChipMore: {
    opacity: 0.7,
  },
  exerciseChipPlaceholder: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseChipPlaceholderText: {
    fontSize: FontSize.sm,
  },
  exerciseDayLabel: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xxs,
    textAlign: 'center',
  },
  exerciseChipsNone: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});

