import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useUserConfig } from '@/hooks/use-user-config';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { getDashboardDayLabel } from '@/utils/dashboardDayLabel';
import { getTodayKey, getYesterdayKey } from '@/utils/dateTime';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

// Constants for exercise chips
const MAX_EXERCISE_CHIPS_PER_DAY = 8;
const KM_TO_MILES_CONVERSION = 1.60934; // Conversion factor: 1 mile = 1.60934 kilometers

type ExerciseActivitiesChartProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  recentDays: string[];
  recentDaysLogs: Array<{ data?: Array<{ name: string; category: string; minutes?: number | null; distance_km?: number | null }> }>;
  category: 'strength' | 'cardio_mind_body';
  titleIcons: Array<{ name: string; size?: number }>;
  titleText: string;
  isWide: boolean;
  showTopBorder?: boolean;
  showSelectedOutline?: boolean;
  showFocusOutline?: boolean;
};

export function ExerciseActivitiesChart({
  dateString,
  colors,
  recentDays,
  recentDaysLogs,
  category,
  titleIcons,
  titleText,
  isWide,
  showTopBorder = true,
  showSelectedOutline = true,
  showFocusOutline = true,
}: ExerciseActivitiesChartProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: userConfig } = useUserConfig();
  const daysToShow = recentDays.length;
  
  // Get user preferences for displaying duration and distance
  const distanceUnit = (userConfig?.distance_unit as 'km' | 'mi') ?? 'km';
  const showDuration = userConfig?.exercise_track_cardio_duration ?? true;
  const showDistance = userConfig?.exercise_track_cardio_distance ?? true;

  const recentDaysData = useMemo(() => {
    return recentDays.map((day, idx) => {
      const dayLogs = recentDaysLogs[idx]?.data || [];
      // Filter to the specified category
      const filteredLogs = dayLogs.filter(log => log.category === category);
      const uniqueExercises = Array.from(new Set(filteredLogs.map(log => log.name)));
      
      // Calculate duration and distance for cardio_mind_body category
      let totalMinutes = 0;
      let totalDistanceKm = 0;
      if (category === 'cardio_mind_body') {
        totalMinutes = filteredLogs.reduce((sum, log) => sum + (log.minutes || 0), 0);
        totalDistanceKm = filteredLogs.reduce((sum, log) => sum + (log.distance_km || 0), 0);
      }
      
      return {
        dayKey: day,
        exercises: uniqueExercises.slice(0, MAX_EXERCISE_CHIPS_PER_DAY),
        totalCount: uniqueExercises.length,
        totalMinutes: Math.round(totalMinutes),
        totalDistanceKm: Math.round(totalDistanceKm),
      };
    });
  }, [recentDays, recentDaysLogs, category]);

  return (
    <View style={[
      styles.exerciseChipsSection, 
      { borderTopColor: colors.separator },
      !showTopBorder && { borderTopWidth: 0, marginTop: 0, paddingTop: 0 }
    ]}>
      <View style={styles.exerciseChipsTitleRow}>
        <ThemedText style={[styles.exerciseChipsTitle, { color: colors.text }]}>
          {t('dashboard.exercise.last_days', { days: daysToShow })} - 
        </ThemedText>
        {titleIcons.map((icon, idx) => (
          <IconSymbol
            key={idx}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name={icon.name as any}
            size={icon.size || 16}
            color={colors.accentExercise}
          />
        ))}
        <ThemedText style={[styles.exerciseChipsTitle, { color: colors.text }]}>
          {titleText}
        </ThemedText>
      </View>
      {/* Check if there are any exercises across all days */}
      {recentDaysData.every(day => day.totalCount === 0) ? (
        <ThemedText style={[styles.exerciseChipsNone, { color: colors.textTertiary }]}>
          {t('dashboard.snapshot.status_none')}
        </ThemedText>
      ) : (
        <View style={styles.exerciseChipsGrid}>
          {recentDaysData.map((dayData) => {
            const isSelected = dayData.dayKey === dateString;
            const date = new Date(dayData.dayKey + 'T00:00:00');
            const todayKey = getTodayKey();
            const yesterdayKey = getYesterdayKey();

            const weekdayLabel = getDashboardDayLabel({
              dateKey: dayData.dayKey,
              todayKey,
              yesterdayKey,
              t,
              getWeekdayLabel: () => date.toLocaleDateString(undefined, { weekday: 'short' }),
            });
            
            const chipsToShow = dayData.exercises;
            const remaining = dayData.totalCount - chipsToShow.length;
            const hasExercises = chipsToShow.length > 0;
            
            // Calculate dynamic height based on content
            // Each chip: paddingVertical (2*Spacing.xxs=4px) + text (~12px) + marginBottom (6px) = ~22px
            // Using 24px per chip for better visual spacing
            const CHIP_HEIGHT_PX = 24;
            const PLACEHOLDER_HEIGHT_PX = 18; // Just enough for dash text
            // Metrics height: calculate based on how many metrics are actually shown
            let metricsLineCount = 0;
            if (category === 'cardio_mind_body') {
              if (showDuration) metricsLineCount++;
              if (showDistance) metricsLineCount++;
            }
            const METRIC_LINE_HEIGHT_PX = 12;
            const METRIC_GAP_PX = 2;
            const METRIC_MARGIN_BOTTOM_PX = 4;
            const metricsHeight = metricsLineCount > 0 
              ? (metricsLineCount * METRIC_LINE_HEIGHT_PX) + ((metricsLineCount - 1) * METRIC_GAP_PX) + METRIC_MARGIN_BOTTOM_PX
              : 0;
            const DAY_LABEL_HEIGHT_PX = 14; // FontSize.xs (10px) + marginTop (Spacing.xxs=4px)
            const columnPadding = Spacing.xs * 2; // top and bottom padding (8px total)
            
            const chipsHeight = hasExercises 
              ? (chipsToShow.length * CHIP_HEIGHT_PX) + (remaining > 0 ? CHIP_HEIGHT_PX : 0)
              : PLACEHOLDER_HEIGHT_PX;
            
            const dynamicColumnHeight = metricsHeight + chipsHeight + columnPadding;
            const dynamicDayColumnHeight = dynamicColumnHeight + DAY_LABEL_HEIGHT_PX + Spacing.xxs;
            
            // Create accessibility label for the day column
            const exerciseCount = dayData.totalCount;
            const exerciseLabel = exerciseCount === 0
              ? t('dashboard.exercise.no_exercises')
              : exerciseCount === 1
              ? t('dashboard.exercise.activity_one')
              : t('dashboard.exercise.activity_other');
            const accessibilityLabel = `${weekdayLabel}, ${exerciseCount} ${exerciseLabel}`;
            const accessibilityHint = t('dashboard.food.chart_bar_hint');
            
            return (
              <TouchableOpacity
                key={dayData.dayKey}
                style={[
                  styles.exerciseDayColumn,
                  { minHeight: dynamicDayColumnHeight },
                  showSelectedOutline && isSelected && { borderColor: colors.accentExercise, borderWidth: 2 },
                  getMinTouchTargetStyle(),
                ]}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  router.push(`/exercise?date=${dayData.dayKey}`);
                }}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(accessibilityLabel, accessibilityHint)}
                {...(showFocusOutline && Platform.OS === 'web' && getFocusStyle(colors.accentExercise))}
              >
                <View style={[styles.columnContent, { flex: 1, justifyContent: 'flex-end' }]}>
                  <View style={[styles.exerciseChipsColumn, { minHeight: chipsHeight, maxHeight: chipsHeight }]}>
                    {chipsToShow.length === 0 ? (
                      <View style={styles.exerciseChipPlaceholder}>
                        <ThemedText style={[styles.exerciseChipPlaceholderText, { color: colors.textTertiary }]}>
                          —
                        </ThemedText>
                      </View>
                    ) : (
                      <>
                        {chipsToShow.map((exerciseName, chipIndex) => (
                          <View
                            key={`${dayData.dayKey}-${exerciseName}-${chipIndex}`}
                            style={[
                              styles.exerciseChip,
                              { backgroundColor: colors.backgroundSecondary, maxWidth: isWide ? 96 : 72 },
                            ]}
                          >
                            <ThemedText
                              style={[styles.exerciseChipText, { color: colors.text }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {exerciseName}
                            </ThemedText>
                          </View>
                        ))}
                        {remaining > 0 && (
                          <View style={[styles.exerciseChip, styles.exerciseChipMore, { backgroundColor: colors.accentExercise + '20' }]}>
                            <ThemedText style={[styles.exerciseChipText, { color: colors.accentExercise }]}>
                              +{remaining}
                            </ThemedText>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                  {/* Duration and Distance display right above the date (only for cardio_mind_body) */}
                  {category === 'cardio_mind_body' && (showDuration || showDistance) && (
                    <View style={styles.metricsContainer}>
                      {showDuration && (
                        <ThemedText style={[styles.metricText, { color: colors.textSecondary }]}>
                          🕐 {dayData.totalMinutes} {t('units.min')}
                        </ThemedText>
                      )}
                      {showDistance && (
                        <ThemedText style={[styles.metricText, { color: colors.textSecondary }]}>
                          {(() => {
                            // Convert distance based on user preference
                            let distanceValue = dayData.totalDistanceKm;
                            if (distanceUnit === 'mi') {
                              distanceValue = dayData.totalDistanceKm / KM_TO_MILES_CONVERSION;
                            }
                            // Round to integer
                            const roundedDistance = Math.round(distanceValue);
                            const unitLabel = distanceUnit === 'mi' ? t('units.mi') : t('units.km');
                            return `📏${roundedDistance} ${unitLabel}`;
                          })()}
                        </ThemedText>
                      )}
                    </View>
                  )}
                </View>
                <ThemedText style={[styles.exerciseDayLabel, { color: colors.textSecondary }]}>
                  {weekdayLabel}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseChipsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
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
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  exerciseDayColumn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  columnContent: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
  },
  metricsContainer: {
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xxs,
    gap: Spacing.xxs, // 2px gap between metric lines
  },
  metricText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  exerciseChipsColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    overflow: 'hidden',
  },
  exerciseChip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.chip,
    marginBottom: Spacing.xs + Spacing.xxs, // 6px spacing between chips (4px + 2px)
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
