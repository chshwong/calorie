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
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useDailyFoodSummary,
  useWeeklyCalInVsOut,
} from '@/hooks/use-dashboard-data';
import { useExerciseLogsForDate } from '@/hooks/use-exercise-logs';
import { useMedLogsForDate, useMedSummaryForRecentDays } from '@/hooks/use-med-logs';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useStreakState } from '@/hooks/use-streak-state';
import { useUserConfig } from '@/hooks/use-user-config';
import { compareDateKeys, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import {
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import { getDashboardDayLabel } from '@/utils/dashboardDayLabel';
import { addDays, toDateKey } from '@/utils/dateKey';
import { getTodayKey, getYesterdayKey } from '@/utils/dateTime';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
};

function DashboardFoodSection({ dateString, goalType, colors, isSmallScreen, isMobile, onPress, onDateSelect }: DashboardFoodSectionProps) {
  const { t } = useTranslation();
  const foodSummary = useDailyFoodSummary(dateString);
  const weeklyCalInVsOut = useWeeklyCalInVsOut(dateString, 7, goalType);

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

  return (
    <DashboardSectionContainer>
      <PremiumCard>
        {/* Header-only button to avoid nested <button> hydration errors on web (chart bars are interactive). */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={getMinTouchTargetStyle()}
          {...getButtonAccessibilityProps(t('dashboard.food.title'), t('dashboard.food.accessibility_hint'))}
          {...(Platform.OS === 'web' && getFocusStyle(colors.accentFood))}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <IconSymbol name="fork.knife" size={20} color={colors.accentFood} decorative />
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                {t('dashboard.food.title')}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>

          {/* Make the gauge area tappable so it behaves like "open Food Log for this date". */}
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={getMinTouchTargetStyle()}
            {...getButtonAccessibilityProps(t('dashboard.food.title'), t('dashboard.food.accessibility_hint'))}
            {...(Platform.OS === 'web' && getFocusStyle(colors.accentFood))}
          >
          <View style={styles.caloriesRow}>
            <View style={styles.foodChipsOverlay} pointerEvents="box-none">
              <View style={styles.foodChipsColumn}>
                <View style={[styles.foodChip, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.foodChipText, { color: colors.textSecondary }]}>
                    Goal: {getGoalLabel}
                  </ThemedText>
                </View>

                <View style={[styles.foodChip, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.foodChipText, { color: colors.textSecondary }]}>
                    Aim: {Number(foodSummary.caloriesGoal).toLocaleString('en-US')} {t('units.kcal')}/day
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
          </TouchableOpacity>

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
            <ThemedText style={[styles.medsValue, { color: colors.text }]}>
              {totalItems} {t('dashboard.snapshot.items')}
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
                  <IconSymbol name={icon as any} size={20} color={colors.text} decorative />
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
  // Calories row
  caloriesRow: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // IMPORTANT: anchor for absolute overlay
    marginTop: 0 - Spacing.sm,
    marginBottom: 0,
    minHeight: 220, // Reduced to minimize spacing after gauge
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Exercise styles
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

