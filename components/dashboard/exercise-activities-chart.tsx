import { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { getTodayKey, getYesterdayKey } from '@/utils/dateTime';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

// Constants for exercise chips
const MAX_EXERCISE_CHIPS_PER_DAY = 8;

type ExerciseActivitiesChartProps = {
  dateString: string;
  colors: typeof Colors.light | typeof Colors.dark;
  recentDays: string[];
  recentDaysLogs: Array<{ data: Array<{ name: string; category: string }> }>;
  category: 'strength' | 'cardio_mind_body';
  titleIcons: Array<{ name: string; size?: number }>;
  titleText: string;
  isWide: boolean;
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
}: ExerciseActivitiesChartProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const daysToShow = recentDays.length;

  const recentDaysData = useMemo(() => {
    return recentDays.map((day, idx) => {
      const dayLogs = recentDaysLogs[idx]?.data || [];
      // Filter to the specified category
      const filteredLogs = dayLogs.filter(log => log.category === category);
      const uniqueExercises = Array.from(new Set(filteredLogs.map(log => log.name)));
      return {
        dayKey: day,
        exercises: uniqueExercises.slice(0, MAX_EXERCISE_CHIPS_PER_DAY),
        totalCount: uniqueExercises.length,
      };
    });
  }, [recentDays, recentDaysLogs, category]);

  return (
    <View style={[styles.exerciseChipsSection, { borderTopColor: colors.separator }]}>
      <View style={styles.exerciseChipsTitleRow}>
        <ThemedText style={[styles.exerciseChipsTitle, { color: colors.text }]}>
          Last {daysToShow} days - 
        </ThemedText>
        {titleIcons.map((icon, idx) => (
          <IconSymbol
            key={idx}
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
          None
        </ThemedText>
      ) : (
        <View style={styles.exerciseChipsGrid}>
          {recentDaysData.map((dayData) => {
            const isSelected = dayData.dayKey === dateString;
            const date = new Date(dayData.dayKey + 'T00:00:00');
            const todayKey = getTodayKey();
            const yesterdayKey = getYesterdayKey();
            
            let weekdayLabel: string;
            if (dayData.dayKey === todayKey) {
              weekdayLabel = t('common.today');
            } else if (dayData.dayKey === yesterdayKey) {
              weekdayLabel = t('common.yesterday');
            } else {
              weekdayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
            }
            
            const chipsToShow = dayData.exercises;
            const remaining = dayData.totalCount - chipsToShow.length;
            
            return (
              <TouchableOpacity
                key={dayData.dayKey}
                style={[
                  styles.exerciseDayColumn,
                  isSelected && { borderColor: colors.accentExercise, borderWidth: 2 },
                ]}
                onPress={() => {
                  router.push(`/exercise?date=${dayData.dayKey}`);
                }}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && getFocusStyle(colors.accentExercise))}
              >
                <View style={styles.exerciseChipsColumn}>
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
