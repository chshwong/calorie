import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DateHeader } from '@/components/date-header';
import { DashboardSectionContainer } from '@/components/dashboard-section-container';
import { PremiumCard } from '@/components/dashboard/premium-card';
import { StatTile } from '@/components/dashboard/stat-tile';
import { DonutChart } from '@/components/charts/donut-chart';
import { BarChart } from '@/components/charts/bar-chart';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Shadows, Layout, FontSize, FontWeight, DashboardAccents } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import {
  useDailyFoodSummary,
  useWeeklyFoodCalories,
  useDailyExerciseSummary,
  useWeeklyExerciseMinutes,
  useDailyMedSummary,
  useWeeklyMedPresence,
  useStreakSummary,
  useStreakHeatmap,
} from '@/hooks/use-dashboard-data';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
import { getMealTypeFromCurrentTime } from '@/utils/calculations';

// Heatmap component for streaks
type HeatmapProps = {
  data: Array<{ date: string; score: number }>;
  selectedDate?: string;
  onCellPress?: (date: string) => void;
  colors: typeof Colors.light;
  weeks?: number;
};

function Heatmap({ data, selectedDate, onCellPress, colors, weeks = 5 }: HeatmapProps) {
  const { t } = useTranslation();
  
  // Organize data into grid (weeks x days)
  const grid: Array<Array<{ date: string; score: number }>> = [];
  for (let w = 0; w < weeks; w++) {
    const week: Array<{ date: string; score: number }> = [];
    for (let d = 0; d < 7; d++) {
      const index = w * 7 + d;
      week.push(data[index] || { date: '', score: 0 });
    }
    grid.push(week);
  }

  const accentColor = colors.accentStreak;
  
  const getScoreColor = (score: number) => {
    if (score === 0) return colors.backgroundSecondary;
    if (score === 1) return `${accentColor}30`; // 30% opacity
    if (score === 2) return `${accentColor}60`; // 60% opacity
    return accentColor;
  };

  return (
    <View style={styles.heatmapContainer}>
      <View style={styles.heatmapGrid}>
        {grid.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.heatmapWeek}>
            {week.map((cell, dayIndex) => {
              const isSelected = selectedDate === cell.date;
              return (
                <TouchableOpacity
                  key={`${weekIndex}-${dayIndex}`}
                      style={[
                        styles.heatmapCell,
                        {
                          backgroundColor: getScoreColor(cell.score),
                          borderColor: isSelected ? colors.accentStreak : 'transparent',
                          borderWidth: isSelected ? 2 : 0,
                        },
                      ]}
                  onPress={() => onCellPress?.(cell.date)}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(`Day ${cell.date}, score ${cell.score}`)}
                />
              );
            })}
          </View>
        ))}
      </View>
      <ThemedText style={[styles.heatmapLegend, { color: colors.textSubtle }]}>
        {t('dashboard.streaks.score_legend')}
      </ThemedText>
    </View>
  );
}

// Insights generation utility
function generateInsights(
  foodSummary: ReturnType<typeof useDailyFoodSummary>,
  weeklyFood: ReturnType<typeof useWeeklyFoodCalories>,
  exerciseSummary: ReturnType<typeof useDailyExerciseSummary>,
  weeklyExercise: ReturnType<typeof useWeeklyExerciseMinutes>,
  medSummary: ReturnType<typeof useDailyMedSummary>,
  weeklyMed: ReturnType<typeof useWeeklyMedPresence>,
  t: (key: string) => string
): Array<{ icon: string; text: string }> {
  const insights: Array<{ icon: string; text: string }> = [];

  // Protein insight
  if (foodSummary.proteinG < foodSummary.proteinGoalG * 0.8) {
    const avgProtein = weeklyFood.data.reduce((sum, d) => sum + (d.caloriesTotal > 0 ? foodSummary.proteinG : 0), 0) / Math.max(weeklyFood.data.filter(d => d.caloriesTotal > 0).length, 1);
    const diff = Math.round(((avgProtein - foodSummary.proteinGoalG) / foodSummary.proteinGoalG) * 100);
    if (diff < -10) {
      insights.push({
        icon: 'exclamationmark.triangle.fill',
        text: t('dashboard.insights.protein_low', { percent: Math.abs(diff) }),
      });
    }
  }

  // Exercise pattern insight
  const exerciseDays = weeklyExercise.data.filter(d => d.totalMinutes > 0);
  if (exerciseDays.length >= 2) {
    const dayNames = exerciseDays.map(d => {
      const date = new Date(d.date + 'T00:00:00');
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    });
    if (dayNames.length >= 2) {
      insights.push({
        icon: 'chart.line.uptrend.xyaxis',
        text: t('dashboard.insights.exercise_pattern', { days: dayNames.slice(0, 2).join(' & ') }),
      });
    }
  }

  // Meds adherence insight
  const medDays = weeklyMed.data.filter(d => d.hasAnyBoolean).length;
  if (medDays > 0) {
    insights.push({
      icon: 'pills.fill',
      text: t('dashboard.insights.meds_adherence', { days: medDays, total: weeklyMed.data.length }),
    });
  }

  return insights.slice(0, 3); // Max 3 insights
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Use shared date hook
  const {
    selectedDate,
    setSelectedDate,
    selectedDateString,
    isToday,
    today,
    calendarViewMonth,
    setCalendarViewMonth,
  } = useSelectedDate();

  // Animated values for cross-fade on date change (MUST be before early return)
  const foodValueAnim = useRef(new Animated.Value(1)).current;
  const exerciseValueAnim = useRef(new Animated.Value(1)).current;
  const medValueAnim = useRef(new Animated.Value(1)).current;
  
  // Animated values for macro bars (MUST be before early return)
  const proteinBarAnim = useRef(new Animated.Value(0)).current;
  const carbsBarAnim = useRef(new Animated.Value(0)).current;
  const fatBarAnim = useRef(new Animated.Value(0)).current;

  // Dashboard data hooks
  const foodSummary = useDailyFoodSummary(selectedDateString);
  const weeklyFood = useWeeklyFoodCalories(selectedDateString, 7);
  const exerciseSummary = useDailyExerciseSummary(selectedDateString);
  const weeklyExercise = useWeeklyExerciseMinutes(selectedDateString, 7);
  const medSummary = useDailyMedSummary(selectedDateString);
  const weeklyMed = useWeeklyMedPresence(selectedDateString, 7);
  const streakSummary = useStreakSummary();
  const streakHeatmap = useStreakHeatmap(selectedDateString, 5);

  // Generate insights
  const insights = generateInsights(
    foodSummary,
    weeklyFood,
    exerciseSummary,
    weeklyExercise,
    medSummary,
    weeklyMed,
    t
  );

  // Loading state
  const isLoading = weeklyFood.isLoading || weeklyExercise.isLoading || weeklyMed.isLoading;

  // Animate macro bars and cross-fade on date/data change
  useEffect(() => {
    if (!user) return; // Early exit if no user, but hooks already called
    
    // Cross-fade animation when date changes
    Animated.sequence([
      Animated.timing(foodValueAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(foodValueAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(exerciseValueAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(exerciseValueAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(medValueAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(medValueAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    
    // Animate macro bars from 0 to value
    const proteinPercent = Math.min(100, (foodSummary.proteinG / foodSummary.proteinGoalG) * 100);
    const carbsPercent = Math.min(100, (foodSummary.carbsG / foodSummary.carbsGoalG) * 100);
    const fatPercent = Math.min(100, (foodSummary.fatG / foodSummary.fatGoalG) * 100);
    
    Animated.parallel([
      Animated.timing(proteinBarAnim, {
        toValue: proteinPercent,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(carbsBarAnim, {
        toValue: carbsPercent,
        duration: 300,
        delay: 50,
        useNativeDriver: false,
      }),
      Animated.timing(fatBarAnim, {
        toValue: fatPercent,
        duration: 300,
        delay: 100,
        useNativeDriver: false,
      }),
    ]).start();
  }, [selectedDateString, foodSummary.proteinG, foodSummary.carbsG, foodSummary.fatG, foodSummary.proteinGoalG, foodSummary.carbsGoalG, foodSummary.fatGoalG, user, foodValueAnim, exerciseValueAnim, medValueAnim, proteinBarAnim, carbsBarAnim, fatBarAnim]);

  // Food status
  const getFoodStatus = () => {
    const ratio = foodSummary.caloriesTotal / foodSummary.caloriesGoal;
    if (ratio < 0.7) return t('dashboard.snapshot.status_low');
    if (ratio > 1.3) return t('dashboard.snapshot.status_high');
    return t('dashboard.snapshot.status_ok');
  };

  // Exercise status
  const getExerciseStatus = () => {
    if (exerciseSummary.totalMinutes >= 30) return t('dashboard.snapshot.status_done');
    return '';
  };

  // Meds status
  const getMedsStatus = () => {
    if (medSummary.totalItems > 0) return t('dashboard.snapshot.status_all');
    return t('dashboard.snapshot.status_none');
  };

  // Handle date selection from charts
  const handleDateSelect = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      setSelectedDate(date);
    }
  };

  // Quick actions
  const handleQuickAction = (action: 'food' | 'exercise' | 'med' | 'scan') => {
    if (action === 'food') {
      const mealType = getMealTypeFromCurrentTime();
      router.push(`/mealtype-log?mealType=${mealType}&date=${selectedDateString}`);
    } else if (action === 'exercise') {
      router.push(`/exercise?date=${selectedDateString}`);
    } else if (action === 'med') {
      router.push(`/meds?date=${selectedDateString}`);
    } else if (action === 'scan') {
      router.push('/barcode-scanner');
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

  // Macro segments for donut chart with food accent
  const macroSegments = [
    {
      value: foodSummary.proteinG * 4, // Protein calories (4 cal/g)
      color: colors.info,
      label: 'P',
    },
    {
      value: foodSummary.carbsG * 4, // Carbs calories (4 cal/g)
      color: colors.warning,
      label: 'C',
    },
    {
      value: foodSummary.fatG * 9, // Fat calories (9 cal/g)
      color: colors.success,
      label: 'F',
    },
  ].filter(seg => seg.value > 0);

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
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Layout.screenPadding + 80 }]}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Date Header */}
        <DateHeader
          showGreeting={true}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedDateString={selectedDateString}
          isToday={isToday}
          getDisplayDate={(t) => {
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const yesterday = new Date(todayDate);
            yesterday.setDate(yesterday.getDate() - 1);
            const formattedDate = selectedDate.toLocaleDateString('en-US', {
              ...(selectedDate.getTime() === todayDate.getTime() || selectedDate.getTime() === yesterday.getTime() ? {} : { weekday: 'short' }),
              month: 'short',
              day: 'numeric',
            });
            if (selectedDate.getTime() === todayDate.getTime()) {
              return `${t('common.today')}, ${formattedDate}`;
            } else if (selectedDate.getTime() === yesterday.getTime()) {
              return `${t('common.yesterday')}, ${formattedDate}`;
            }
            return formattedDate;
          }}
          goBackOneDay={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() - 1);
            setSelectedDate(newDate);
          }}
          goForwardOneDay={() => {
            if (!isToday) {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }
          }}
          calendarViewMonth={calendarViewMonth}
          setCalendarViewMonth={setCalendarViewMonth}
          today={today}
        />

        {/* Today Snapshot */}
        <DashboardSectionContainer>
          <View style={styles.snapshotTiles}>
            <Animated.View style={{ opacity: foodValueAnim, flex: 1 }}>
              <StatTile
                icon="fork.knife"
                label={t('dashboard.snapshot.food')}
                value={`${Math.round(foodSummary.caloriesTotal)} / ${foodSummary.caloriesGoal} ${t('dashboard.snapshot.kcal')}`}
                status={getFoodStatus()}
                accentColor={colors.accentFood}
                onPress={() => router.push(`/?date=${selectedDateString}`)}
              />
            </Animated.View>
            <Animated.View style={{ opacity: exerciseValueAnim, flex: 1 }}>
              <StatTile
                icon="figure.run"
                label={t('dashboard.snapshot.ex')}
                value={`${exerciseSummary.totalMinutes} ${t('dashboard.snapshot.min')}`}
                status={getExerciseStatus()}
                accentColor={colors.accentExercise}
                onPress={() => router.push(`/exercise?date=${selectedDateString}`)}
              />
            </Animated.View>
            <Animated.View style={{ opacity: medValueAnim, flex: 1 }}>
              <StatTile
                icon="pills.fill"
                label={t('dashboard.snapshot.meds')}
                value={`${medSummary.totalItems} ${t('dashboard.snapshot.items')}`}
                status={getMedsStatus()}
                accentColor={colors.accentMeds}
                onPress={() => router.push(`/meds?date=${selectedDateString}`)}
              />
            </Animated.View>
          </View>
        </DashboardSectionContainer>

        {/* Food Card */}
        <DashboardSectionContainer>
          <TouchableOpacity
            onPress={() => router.push(`/?date=${selectedDateString}`)}
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
                <ThemedText style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                  {Math.round(foodSummary.caloriesTotal)} / {foodSummary.caloriesGoal} {t('dashboard.snapshot.kcal')}
                </ThemedText>
              </View>

            {/* Donut Chart */}
            {macroSegments.length > 0 && (
              <View style={styles.chartContainer}>
                <DonutChart
                  segments={macroSegments.map(seg => ({
                    ...seg,
                    color: seg.label === 'P' ? colors.info : seg.label === 'C' ? colors.warning : colors.success,
                  }))}
                  centerValue={Math.round(foodSummary.caloriesTotal).toString()}
                  size={140}
                  strokeWidth={16}
                />
              </View>
            )}

            {/* Macro Goal Bars */}
            <View style={styles.macroBarsContainer}>
              <View style={styles.macroBarRow}>
                <ThemedText style={[styles.macroBarLabel, { color: colors.text }]}>
                  P {Math.round(foodSummary.proteinG)} / {foodSummary.proteinGoalG}g
                </ThemedText>
                <View style={[styles.macroBarTrack, { backgroundColor: colors.backgroundSecondary }]}>
                  <Animated.View
                    style={[
                      styles.macroBarFill,
                      {
                        width: proteinBarAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: colors.info,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.macroBarRow}>
                <ThemedText style={[styles.macroBarLabel, { color: colors.text }]}>
                  C {Math.round(foodSummary.carbsG)} / {foodSummary.carbsGoalG}g
                </ThemedText>
                <View style={[styles.macroBarTrack, { backgroundColor: colors.backgroundSecondary }]}>
                  <Animated.View
                    style={[
                      styles.macroBarFill,
                      {
                        width: carbsBarAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: colors.warning,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.macroBarRow}>
                <ThemedText style={[styles.macroBarLabel, { color: colors.text }]}>
                  F {Math.round(foodSummary.fatG)} / {foodSummary.fatGoalG}g
                </ThemedText>
                <View style={[styles.macroBarTrack, { backgroundColor: colors.backgroundSecondary }]}>
                  <Animated.View
                    style={[
                      styles.macroBarFill,
                      {
                        width: fatBarAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: colors.success,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Extra line */}
            <ThemedText style={[styles.extraLine, { color: colors.textSubtle }]}>
              {t('dashboard.food.fiber')} {Math.round(foodSummary.fiberG)} / {foodSummary.fiberGoalG || 25}g · {t('dashboard.food.sugar')} {Math.round(foodSummary.sugarG)}g
            </ThemedText>

            {/* 7-day kcal chart */}
            <View style={styles.chartSection}>
              <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
                {t('dashboard.food.chart_7d')}
              </ThemedText>
              <BarChart
                data={weeklyFood.data.map(d => ({ date: d.date, value: d.caloriesTotal }))}
                maxValue={Math.max(...weeklyFood.data.map(d => d.caloriesTotal), foodSummary.caloriesGoal)}
                goalValue={foodSummary.caloriesGoal}
                selectedDate={selectedDateString}
                onBarPress={handleDateSelect}
                height={100}
                colorScale={() => colors.accentFood}
              />
              {/* Chart subtitle */}
              {weeklyFood.data.length > 0 && (
                <ThemedText style={[styles.chartSubtitle, { color: colors.textSubtle }]}>
                  {t('dashboard.food.avg')}: {Math.round(weeklyFood.data.reduce((sum, d) => sum + d.caloriesTotal, 0) / weeklyFood.data.length)} {t('dashboard.snapshot.kcal')}
                </ThemedText>
              )}
            </View>
            </PremiumCard>
          </TouchableOpacity>
        </DashboardSectionContainer>

        {/* Exercise Card */}
        <DashboardSectionContainer>
          <TouchableOpacity
            onPress={() => router.push(`/exercise?date=${selectedDateString}`)}
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

              {/* Today summary */}
              <View style={styles.exerciseToday}>
                <ThemedText style={[styles.exerciseValue, { color: colors.text }]}>
                  {exerciseSummary.totalMinutes} {t('dashboard.snapshot.min')}
                </ThemedText>
                <ThemedText style={[styles.exerciseSubtext, { color: colors.textMuted }]}>
                  {exerciseSummary.activityCount} {exerciseSummary.activityCount === 1 ? t('dashboard.exercise.activity_one') : t('dashboard.exercise.activity_other')}
                </ThemedText>
                {exerciseSummary.mainLabels.length > 0 && (
                  <ThemedText style={[styles.exerciseMain, { color: colors.textSubtle }]}>
                    {t('dashboard.exercise.main')}: {exerciseSummary.mainLabels.join(', ')}
                  </ThemedText>
                )}
              </View>

              {/* 7-day chart */}
              <View style={styles.chartSection}>
                <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
                  {t('dashboard.exercise.chart_7d')}
                </ThemedText>
                <BarChart
                  data={weeklyExercise.data.map(d => ({ date: d.date, value: d.totalMinutes }))}
                  selectedDate={selectedDateString}
                  onBarPress={handleDateSelect}
                  height={100}
                  colorScale={(value, max) => {
                    if (value < 30) return `${colors.accentExercise}70`; // 70% opacity
                    if (value < 60) return `${colors.accentExercise}90`; // 90% opacity
                    return colors.accentExercise;
                  }}
                />
                {/* Exercise streak chip */}
                {exerciseSummary.totalMinutes > 0 && (
                  <View style={[styles.streakChip, { backgroundColor: `${colors.accentExercise}20` }]}>
                    <ThemedText style={[styles.streakChipText, { color: colors.accentExercise }]}>
                      {t('dashboard.exercise.streak')}: {exerciseSummary.totalMinutes >= 30 ? '1d' : '0d'}
                    </ThemedText>
                  </View>
                )}
              </View>
            </PremiumCard>
          </TouchableOpacity>
        </DashboardSectionContainer>

        {/* Meds Card */}
        <DashboardSectionContainer>
          <TouchableOpacity
            onPress={() => router.push(`/meds?date=${selectedDateString}`)}
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

            {/* Today summary */}
            <View style={styles.medsToday}>
              <ThemedText style={[styles.medsValue, { color: colors.text }]}>
                {medSummary.totalItems} {t('dashboard.snapshot.items')}
              </ThemedText>
              <ThemedText style={[styles.medsSubtext, { color: colors.textMuted }]}>
                {medSummary.medCount} {t('dashboard.meds.med')} · {medSummary.suppCount} {t('dashboard.meds.supp')}
              </ThemedText>
              {medSummary.lastItemName && (
                <ThemedText style={[styles.medsLast, { color: colors.textSubtle }]}>
                  {t('dashboard.meds.last')}: {medSummary.lastItemName}{medSummary.lastItemDose ? ` – ${medSummary.lastItemDose}` : ''}
                </ThemedText>
              )}
            </View>

            {/* 7-day adherence */}
            <View style={styles.chartSection}>
              <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
                {t('dashboard.meds.chart_7d')}
              </ThemedText>
              <View style={styles.adherenceRow}>
                {weeklyMed.data.map((day, index) => {
                  const date = new Date(day.date + 'T00:00:00');
                  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                  const isSelected = selectedDateString === day.date;
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
                      onPress={() => handleDateSelect(day.date)}
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

        {/* Streaks Card */}
        <DashboardSectionContainer>
          <PremiumCard>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <IconSymbol name="flame.fill" size={20} color={colors.accentStreak} />
                <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                  {t('dashboard.streaks.title')}
                </ThemedText>
              </View>
            </View>

            {/* Main streak */}
            <View style={styles.streakMain}>
              <ThemedText style={[styles.streakValue, { color: colors.text }]}>
                {t('dashboard.streaks.log_streak')}: {streakSummary.logStreakDays}d
              </ThemedText>
              <ThemedText style={[styles.streakSubtext, { color: colors.textMuted }]}>
                {t('dashboard.streaks.best')}: {streakSummary.bestStreakDays}d · {t('dashboard.streaks.next')}: {streakSummary.nextTargetDays}d
              </ThemedText>
            </View>

            {/* Heatmap */}
            <View style={styles.chartSection}>
              <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
                {t('dashboard.streaks.chart_5w')}
              </ThemedText>
              <Heatmap
                data={streakHeatmap.data}
                selectedDate={selectedDateString}
                onCellPress={handleDateSelect}
                colors={colors}
                weeks={5}
              />
            </View>
          </PremiumCard>
        </DashboardSectionContainer>

        {/* Insights Card */}
        <DashboardSectionContainer>
          <PremiumCard>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <IconSymbol name="lightbulb.fill" size={20} color={colors.info} />
                <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                  {t('dashboard.insights.title')}
                </ThemedText>
              </View>
            </View>

            {insights.length > 0 ? (
              <View style={styles.insightsList}>
                {insights.map((insight, index) => {
                  // Determine icon color based on insight type
                  let iconColor = colors.info;
                  if (insight.icon.includes('warning') || insight.icon.includes('exclamation')) {
                    iconColor = colors.warning;
                  } else if (insight.icon.includes('arrow.up') || insight.icon.includes('checkmark')) {
                    iconColor = colors.success;
                  }
                  return (
                    <View key={index} style={styles.insightRow}>
                      <IconSymbol name={insight.icon as any} size={16} color={iconColor} />
                      <ThemedText style={[styles.insightText, { color: colors.text }]}>
                        {insight.text}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            ) : (
              <ThemedText style={[styles.insightEmpty, { color: colors.textSubtle }]}>
                {t('dashboard.insights.empty')}
              </ThemedText>
            )}
          </PremiumCard>
        </DashboardSectionContainer>

        {/* Quick Actions */}
        <DashboardSectionContainer>
          <View
            style={[
              styles.quickActionsCard,
              {
                backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.9)' : colors.card,
                ...Shadows.card,
                ...(Platform.OS === 'web' && {
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }),
              },
            ]}
          >
            <ThemedText type="subtitle" style={[styles.quickActionsTitle, { color: colors.text }]}>
              {t('dashboard.quick.title')}
            </ThemedText>
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={[styles.quickActionButton, { borderColor: colors.accentFood }]}
                onPress={() => handleQuickAction('food')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(t('dashboard.quick.add_food'))}
              >
                <IconSymbol name="plus.circle.fill" size={20} color={colors.accentFood} />
                <ThemedText style={[styles.quickActionLabel, { color: colors.accentFood }]}>
                  {t('dashboard.quick.add_food')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, { borderColor: colors.accentExercise }]}
                onPress={() => handleQuickAction('exercise')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(t('dashboard.quick.add_ex'))}
              >
                <IconSymbol name="plus.circle.fill" size={20} color={colors.accentExercise} />
                <ThemedText style={[styles.quickActionLabel, { color: colors.accentExercise }]}>
                  {t('dashboard.quick.add_ex')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, { borderColor: colors.accentMeds }]}
                onPress={() => handleQuickAction('med')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(t('dashboard.quick.add_med'))}
              >
                <IconSymbol name="plus.circle.fill" size={20} color={colors.accentMeds} />
                <ThemedText style={[styles.quickActionLabel, { color: colors.accentMeds }]}>
                  {t('dashboard.quick.add_med')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, { borderColor: colors.tint }]}
                onPress={() => handleQuickAction('scan')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(t('dashboard.quick.scan'))}
              >
                <IconSymbol name="barcode.viewfinder" size={20} color={colors.tint} />
                <ThemedText style={[styles.quickActionLabel, { color: colors.tint }]}>
                  {t('dashboard.quick.scan')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </DashboardSectionContainer>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Layout.screenPadding,
  },
  // Snapshot tiles
  snapshotCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  snapshotTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statTile: {
    flex: 1,
    minWidth: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    ...getMinTouchTargetStyle(),
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  statValue: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  statStatus: {
    fontSize: FontSize.xs,
  },
  // Card styles
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
  },
  // Chart containers
  chartContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  chartSection: {
    marginTop: Layout.cardInnerPadding,
  },
  chartTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  streakChip: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
    marginTop: Spacing.sm,
  },
  streakChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  // Macro bars
  macroBarsContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  macroBarRow: {
    gap: Spacing.xs,
  },
  macroBarLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  macroBarTrack: {
    height: 6,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: BorderRadius.sm,
  },
  extraLine: {
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  // Exercise styles
  exerciseToday: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  exerciseValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  exerciseSubtext: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  exerciseMain: {
    fontSize: FontSize.xs,
  },
  // Meds styles
  medsToday: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  medsValue: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  medsSubtext: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  medsLast: {
    fontSize: FontSize.xs,
  },
  // Adherence row
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: Spacing.xs,
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
  // Streaks styles
  streakMain: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  streakValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  streakSubtext: {
    fontSize: FontSize.sm,
  },
  // Heatmap styles
  heatmapContainer: {
    alignItems: 'center',
  },
  heatmapGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  heatmapWeek: {
    gap: Spacing.xs,
  },
  heatmapCell: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    ...getMinTouchTargetStyle(),
  },
  heatmapLegend: {
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  // Quick actions
  quickActionsCard: {
    borderRadius: BorderRadius.card,
    padding: Layout.cardInnerPadding,
    overflow: 'hidden',
    width: '100%',
  },
  quickActionsTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Layout.cardInnerPadding,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    backgroundColor: 'transparent',
    gap: Spacing.xs,
    ...getMinTouchTargetStyle(),
  },
  quickActionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  // Insights styles
  insightsList: {
    gap: Spacing.md,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  insightText: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  insightEmpty: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  // Quick actions
  quickActionsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  quickActionsTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
    ...getMinTouchTargetStyle(),
  },
  quickActionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
