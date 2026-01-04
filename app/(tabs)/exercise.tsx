import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, TextInput, Alert, Animated, ViewStyle, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SurfaceCard } from '@/components/common/surface-card';
import { QuickAddHeading } from '@/components/common/quick-add-heading';
import { QuickAddChip } from '@/components/common/quick-add-chip';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { SummaryCardHeader } from '@/components/layout/summary-card-header';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { CloneDayModal } from '@/components/clone-day-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { showAppToast } from '@/components/ui/app-toast';
import { MultiSelectItem } from '@/components/multi-select-item';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { HighlightableRow } from '@/components/common/highlightable-row';
import { useAuth } from '@/contexts/AuthContext';
import { useCloneFromPreviousDay } from '@/hooks/use-clone-from-previous-day';
import { useCloneDayEntriesMutation } from '@/hooks/use-clone-day-entries';
import { useMassDeleteEntriesMutation } from '@/hooks/use-mass-delete-entries';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, Shadows, Layout, FontSize, ModuleThemes, SemanticColors } from '@/constants/theme';
import { TEXT_LIMITS, RANGES } from '@/constants/constraints';
import { getLocalDateKey } from '@/utils/dateTime';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useUserConfig } from '@/hooks/use-user-config';
import {
  useExerciseLogsForDate,
  useExerciseSummaryForRecentDays,
  useRecentAndFrequentExercises,
  useCreateExerciseLog,
  useUpdateExerciseLog,
  useDeleteExerciseLog,
} from '@/hooks/use-exercise-logs';
import { RecentFrequentDayRange } from '@/lib/services/exerciseLogs';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
import { InlineEditableNumberChip } from '@/components/ui/InlineEditableNumberChip';
import { RepsRangeBottomSheet } from '@/components/exercise/RepsRangeBottomSheet';
import { IntensityBottomSheet } from '@/components/exercise/IntensityBottomSheet';
import { ConfettiCelebrationModal } from '@/components/ConfettiCelebrationModal';
import { pickRandomDayCompletionMessage } from '@/constants/dayCompletionMessages';
import { useConfettiToastMessage } from '@/hooks/useConfettiToastMessage';
import { useDailySumConsumedRange } from '@/hooks/use-daily-sum-consumed-range';
import type { DailyLogStatus } from '@/utils/types';

// Constants for responsive breakpoints and conversion factors
// These are UI layout constants, not spacing tokens, so they live here per guideline 11
const NARROW_SCREEN_BREAKPOINT = 380; // Breakpoint for narrow mobile screens
const LARGE_SCREEN_BREAKPOINT = 768; // Breakpoint for tablet/desktop screens
const KM_TO_MILES_CONVERSION = 1.60934; // Conversion factor: 1 mile = 1.60934 kilometers
const DAY_SUMMARY_CONTENT_INSET = Spacing.md; // Tighter inset for Day Summary card content than SurfaceCard default

// Distance precision helpers
/**
 * Round a number to 2 decimal places (for display and user input)
 */
const roundTo2Decimals = (value: number): number => {
  return Math.round(value * 100) / 100;
};

/**
 * Round a number to 4 decimal places (for storage in distance_km)
 */
const roundTo4Decimals = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};

/**
 * Format a number for display with up to 2 decimals, trimming trailing zeros
 */
const formatDistanceForDisplay = (value: number): number => {
  const rounded = roundTo2Decimals(value);
  return rounded;
};

/**
 * Format minutes as "#h#m" (e.g., 522 minutes -> "8h42m", 42 minutes -> "42m", 8 hours -> "8h")
 */
const formatMinutesAsHoursMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
};

// Preset exercises with category
type ExercisePreset = {
  label: string; // Display label with emoji (stored in DB)
  category: 'cardio_mind_body' | 'strength';
};

const COMMON_CARDIO_MIND_BODY: ExercisePreset[] = [
  { label: '🚶‍♂️Walking', category: 'cardio_mind_body' },
  { label: '🏃Running', category: 'cardio_mind_body' },
  { label: '🏃‍♀️Jogging', category: 'cardio_mind_body' },
  { label: '🚴Cycling', category: 'cardio_mind_body' },
  { label: '🏊Swimming', category: 'cardio_mind_body' },
  { label: '🥾Hiking', category: 'cardio_mind_body' },
  { label: '🔄Elliptical', category: 'cardio_mind_body' },
  { label: '🚣Rowing', category: 'cardio_mind_body' },
  { label: '🏃‍♂️Treadmill', category: 'cardio_mind_body' },
  { label: '🪜Stair Climber', category: 'cardio_mind_body' },
  { label: '🧘Yoga', category: 'cardio_mind_body' },
  { label: '🤸Pilates', category: 'cardio_mind_body' },
  { label: '📼Aerobics', category: 'cardio_mind_body' },
  { label: '💃Zumba', category: 'cardio_mind_body' },
  { label: '🕺Dance', category: 'cardio_mind_body' },
  { label: '🩰Barre', category: 'cardio_mind_body' },
  { label: '🔥HIIT', category: 'cardio_mind_body' },
  { label: '🔁Circuit Training', category: 'cardio_mind_body' },
  { label: '🔀Cross Training', category: 'cardio_mind_body' },
  { label: '🤲Stretching', category: 'cardio_mind_body' },
  { label: '⚽Soccer / Football', category: 'cardio_mind_body' },
  { label: '🏀Basketball', category: 'cardio_mind_body' },
  { label: '🎾Tennis', category: 'cardio_mind_body' },
  { label: '🏸Badminton', category: 'cardio_mind_body' },
  { label: '🏐Volleyball', category: 'cardio_mind_body' },
  { label: '⚾Baseball', category: 'cardio_mind_body' },
  { label: '🏒Hockey', category: 'cardio_mind_body' },
  { label: '🏈American Football', category: 'cardio_mind_body' },
];

const COMMON_STRENGTH_WORKOUTS: ExercisePreset[] = [
  { label: '🏋️Bench Press', category: 'strength' },
  { label: '🏋️Squat', category: 'strength' },
  { label: '🏋️Deadlift', category: 'strength' },
  { label: '🤸Pull-Ups', category: 'strength' },
  { label: '🤸Push-Ups', category: 'strength' },
  { label: '🏋️Shoulder Press', category: 'strength' },
  { label: '⬇️Lat Pulldown', category: 'strength' },
  { label: '↔️Row', category: 'strength' },
  { label: '🦵Lunges', category: 'strength' },
  { label: '🦵Leg Press', category: 'strength' },
  { label: '🦵Leg Curl', category: 'strength' },
  { label: '🦵Leg Extension', category: 'strength' },
  { label: '🦵Calf Raises', category: 'strength' },
  { label: '💪Biceps', category: 'strength' },
  { label: '💪Triceps', category: 'strength' },
  { label: '🍑Hip Thrust', category: 'strength' },
  { label: '🏋️‍♂️Chest', category: 'strength' },
  { label: '🧠Core / Abs', category: 'strength' },
  { label: '🏋️Kettlebell Swings', category: 'strength' },
  { label: '🏋️Barbell Row', category: 'strength' },
];

// Presentational component for exercise row
type ExerciseRowProps = {
  log: { 
    id: string; 
    name: string; 
    minutes: number | null; 
    notes: string | null;
    category: 'cardio_mind_body' | 'strength';
    intensity: 'low' | 'medium' | 'high' | 'max' | null;
    distance_km: number | null;
    sets: number | null;
    reps_min: number | null;
    reps_max: number | null;
  };
  colors: typeof Colors.light;
  onEdit: () => void;
  onMinutesUpdate: (logId: string, minutes: number | null) => void;
  onSetsUpdate: (logId: string, sets: number | null) => void;
  onRepsUpdate: (logId: string) => void;
  onIntensityUpdate: (logId: string) => void;
  onDistanceUpdate: (logId: string, distance_km: number | null) => void;
  isLast: boolean;
  animationValue?: Animated.Value;
  disabled?: boolean;
};

function ExerciseRow({ log, colors, onEdit, onMinutesUpdate, onSetsUpdate, onRepsUpdate, onIntensityUpdate, onDistanceUpdate, isLast, animationValue, disabled = false, distanceUnit = 'km' }: ExerciseRowProps & { distanceUnit?: 'km' | 'mi' }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isNarrow = width < NARROW_SCREEN_BREAKPOINT;
  const colorScheme = useColorScheme();
  
  // Exercise module orange theme colors for chips
  // Use darker orange for light mode for better contrast, brighter for dark mode
  const exerciseOrange = colorScheme === 'dark' 
    ? ModuleThemes.exercise.accent // #F59E0B for dark mode
    : '#D97706'; // Darker orange-600 for light mode (better contrast on light backgrounds)
  const exerciseOrangeLight = exerciseOrange + '20'; // Light variant with opacity
  
  const rowStyle = animationValue
    ? {
        opacity: animationValue,
        transform: [
          {
            translateY: animationValue.interpolate({
              inputRange: [0, 1],
              outputRange: [4, 0],
            }),
          },
        ],
      }
    : {};

  const categoryIcon = log.category === 'cardio_mind_body' ? 'figure.run' : 'dumbbell.fill';
  const repsDisplay = log.reps_min !== null && log.reps_max !== null 
    ? log.reps_min === log.reps_max 
      ? `${log.reps_min}` 
      : `${log.reps_min}–${log.reps_max}` 
    : null;
  // NOTE: Hardcoded per user request - exact emoji labels required (🟢Low, 🟡Med, 🟠Hi, 🔴Max)
  // Future: Consider moving to i18n if internationalization needed
  const intensityLabels: Record<'low' | 'medium' | 'high' | 'max', string> = {
    low: '🟢Low',
    medium: '🟡Med',
    high: '🟠Hi',
    max: '🔴Max',
  };
  const intensityDisplay = log.intensity ? intensityLabels[log.intensity] : null;

  // Format name for narrow screens
  const formatNameForNarrow = (raw: string) => {
    if (!isNarrow) return raw;
    // If no spaces, hard truncate to 18
    if (!raw.includes(' ') && raw.length > 18) return raw.slice(0, 18) + '…';
    return raw;
  };

  return (
    <Animated.View style={rowStyle}>
      <View
        style={[
          styles.exerciseRow,
          !isLast && { borderBottomWidth: 1, borderBottomColor: colors.separator },
        ]}
      >
        <TouchableOpacity
          style={[styles.exerciseRowContent, Platform.OS === 'web' && getFocusStyle(colors.tint), disabled && { opacity: 0.6 }]}
          onPress={onEdit}
          activeOpacity={0.6}
          disabled={disabled}
          {...getButtonAccessibilityProps('Edit exercise')}
        >
          <View style={styles.exerciseRowLeft}>
            <View style={styles.exerciseNameRow}>
              <IconSymbol 
                name={categoryIcon as any} 
                size={16} 
                color={colors.textSecondary} 
                style={{ marginRight: Spacing.xs }}
              />
              <ThemedText 
                style={[styles.exerciseName, { color: colors.text, flexShrink: 1, minWidth: 0 }]}
                numberOfLines={isNarrow ? 2 : 1}
                ellipsizeMode="tail"
              >
                {formatNameForNarrow(log.name)}
              </ThemedText>
            </View>
            {log.notes && (
              <ThemedText
                style={[styles.exerciseNotes, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {log.notes}
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>

        {/* Right side: Category-specific chips and Delete button */}
        <View style={[styles.exerciseRowRight, isNarrow && { maxWidth: '55%' }]}>
          {log.category === 'cardio_mind_body' ? (
            // Cardio/Mind-Body: Minutes, Distance, Intensity chips
            <>
              <InlineEditableNumberChip
                value={log.minutes}
                onCommit={(next) => onMinutesUpdate(log.id, next)}
                unitSuffix="min"
                placeholder={t('exercise.chip.add_min')}
                min={RANGES.EXERCISE_MINUTES.MIN}
                max={RANGES.EXERCISE_MINUTES.MAX}
                allowNull
                disabled={disabled}
                colors={colors}
                badgeBackgroundColor={exerciseOrangeLight}
                badgeBorderColor={exerciseOrange}
                badgeTextColor={exerciseOrange}
                accessibilityLabel={t('exercise.chip.edit_minutes')}
                commitOnBlur
                chipPaddingHorizontal={Spacing.xs}
              />
              <InlineEditableNumberChip
                value={
                  distanceUnit === 'mi' && log.distance_km
                    ? formatDistanceForDisplay(log.distance_km / KM_TO_MILES_CONVERSION)
                    : log.distance_km !== null
                    ? formatDistanceForDisplay(log.distance_km)
                    : null
                }
                onCommit={(next) => {
                  if (next === null) {
                    onDistanceUpdate(log.id, null);
                    return;
                  }
                  // Round user input to 2 decimals before conversion
                  const roundedInput = roundTo2Decimals(next);
                  // Convert to km if needed and round to 4 decimals for storage
                  const distance_km = distanceUnit === 'mi' 
                    ? roundTo4Decimals(roundedInput * KM_TO_MILES_CONVERSION)
                    : roundTo4Decimals(roundedInput);
                  onDistanceUpdate(log.id, distance_km);
                }}
                unitSuffix={distanceUnit === 'mi' ? 'mi' : 'km'}
                placeholder={distanceUnit === 'mi' ? t('exercise.chip.add_mi') : t('exercise.chip.add_km')}
                min={RANGES.EXERCISE_DISTANCE_KM.MIN}
                max={RANGES.EXERCISE_DISTANCE_KM.MAX}
                allowNull
                disabled={disabled}
                colors={colors}
                badgeBackgroundColor={exerciseOrangeLight}
                badgeBorderColor={exerciseOrange}
                badgeTextColor={exerciseOrange}
                accessibilityLabel={t('exercise.chip.edit_distance', { unit: distanceUnit })}
                commitOnBlur
                chipPaddingHorizontal={Spacing.xs}
                allowDecimal={true}
              />
              <TouchableOpacity
                onPress={() => onIntensityUpdate(log.id)}
                disabled={disabled}
                style={[
                  styles.repsIntensityChip,
                  {
                    backgroundColor: intensityDisplay ? exerciseOrangeLight : colors.backgroundSecondary,
                    borderColor: intensityDisplay ? exerciseOrange : colors.separator,
                  },
                  disabled && { opacity: 0.6 },
                ]}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && getFocusStyle(exerciseOrange))}
                {...getButtonAccessibilityProps(intensityDisplay ? t('exercise.chip.edit_intensity_with_value', { value: intensityDisplay }) : t('exercise.chip.add_intensity'))}
              >
                <ThemedText style={[styles.repsIntensityText, { color: intensityDisplay ? exerciseOrange : colors.textSecondary }]}>
                  {intensityDisplay || t('exercise.chip.add_intensity')}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            // Strength: Sets, Reps, Intensity chips
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: Spacing.sm }}>
                <InlineEditableNumberChip
                  value={log.sets}
                  onCommit={(next) => onSetsUpdate(log.id, next)}
                  unitSuffix="x"
                  placeholder={t('exercise.chip.add_sets')}
                  min={RANGES.EXERCISE_SETS.MIN}
                  max={RANGES.EXERCISE_SETS.MAX}
                  allowNull
                  disabled={disabled}
                  colors={colors}
                  badgeBackgroundColor={exerciseOrangeLight}
                  badgeBorderColor={exerciseOrange}
                  badgeTextColor={exerciseOrange}
                  accessibilityLabel={t('exercise.chip.edit_sets')}
                  commitOnBlur
                  chipPaddingHorizontal={Spacing.xs}
                />
                <TouchableOpacity
                  onPress={() => onRepsUpdate(log.id)}
                  disabled={disabled}
                  style={[
                    styles.repsIntensityChip,
                    {
                      backgroundColor: repsDisplay ? exerciseOrangeLight : colors.backgroundSecondary,
                      borderColor: repsDisplay ? exerciseOrange : colors.separator,
                    },
                    disabled && { opacity: 0.6 },
                  ]}
                  activeOpacity={0.7}
                  {...(Platform.OS === 'web' && getFocusStyle(exerciseOrange))}
                  {...getButtonAccessibilityProps(repsDisplay ? t('exercise.chip.edit_reps_with_value', { value: repsDisplay }) : t('exercise.chip.add_reps'))}
                >
                  <ThemedText style={[styles.repsIntensityText, { color: repsDisplay ? exerciseOrange : colors.textSecondary }]}>
                    {repsDisplay || t('exercise.chip.add_reps')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => onIntensityUpdate(log.id)}
                  disabled={disabled}
                  style={[
                    styles.repsIntensityChip,
                    {
                      backgroundColor: intensityDisplay ? exerciseOrangeLight : colors.backgroundSecondary,
                      borderColor: intensityDisplay ? exerciseOrange : colors.separator,
                    },
                    disabled && { opacity: 0.6 },
                  ]}
                  activeOpacity={0.7}
                  {...(Platform.OS === 'web' && getFocusStyle(exerciseOrange))}
                  {...getButtonAccessibilityProps(intensityDisplay ? t('exercise.chip.edit_intensity_with_value', { value: intensityDisplay }) : t('exercise.chip.add_intensity'))}
                >
                  <ThemedText style={[styles.repsIntensityText, { color: intensityDisplay ? exerciseOrange : colors.textSecondary }]}>
                    {intensityDisplay || t('exercise.chip.add_intensity')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// Responsive container component for exercise sections
type ExerciseSectionContainerProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

function ExerciseSectionContainer({ children, style }: ExerciseSectionContainerProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= LARGE_SCREEN_BREAKPOINT;


  return (
    <View
      style={[
        styles.responsiveContainer,
        isLargeScreen && styles.responsiveContainerLarge,
        style,
      ]}
    >
      {children}
    </View>
  );
}


export default function ExerciseHomeScreen() {
  const { t } = useTranslation();
  const { user, profile: authProfile } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Get user config for avatar
  const { data: userConfig } = useUserConfig();
  const effectiveProfile = userConfig || authProfile;
  const updateProfileMutation = useUpdateProfile();

  // Use shared date hook - always derived from URL params
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
  const navigateWithDate = (date: Date) => {
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    router.replace({
      pathname: '/exercise',
      params: { date: dateString }
    });
  };

  // Format date for display with short weekday (used in Recent Days section)
  const formatDateForDisplay = (date: Date): string => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === todayDate.getTime()) {
      return t('common.today');
    } else if (date.getTime() === yesterday.getTime()) {
      return t('common.yesterday');
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Data fetching hooks
  const { data: exerciseLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useExerciseLogsForDate(selectedDateString);
  const { data: recentDaysSummary = [] } = useExerciseSummaryForRecentDays(7);
  const { data: recentAndFrequentExercises = [], isLoading: isLoadingRecentFrequent } = useRecentAndFrequentExercises(RecentFrequentDayRange);

  // Celebration toast hook
  const { show, props: confettiToastProps } = useConfettiToastMessage();

  // Day status tracking for celebration
  const userId = user?.id;
  const { data: dayStatusRows = [] } = useDailySumConsumedRange(userId, selectedDateString, selectedDateString);
  const todayRow = dayStatusRows[0];
  
  // Normalize status function (same as DoneForTodayButton)
  const normalizeStatus = (input: string | null | undefined): DailyLogStatus => {
    if (input === 'completed' || input === 'fasted' || input === 'unknown') return input;
    return 'unknown';
  };
  
  const dayStatus = normalizeStatus(todayRow?.log_status);
  const prevStatusRef = useRef<string | null>(null);

  // Track status transitions and trigger celebration
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === null) {
      prevStatusRef.current = dayStatus;
      return; // first load: do nothing
    }
    if (prev === 'unknown' && dayStatus === 'completed') {
      const msg = pickRandomDayCompletionMessage();
      show({ 
        title: '✅ Day Complete',
        message: msg,
        confirmText: 'Got it',
        withConfetti: true 
      });
    }
    if (prev === 'unknown' && dayStatus === 'fasted') {
      const msg = pickRandomDayCompletionMessage();
      show({ 
        title: '✅ Fasted Day',
        message: msg,
        confirmText: 'Got it',
        withConfetti: true 
      });
    }
    prevStatusRef.current = dayStatus;
  }, [dayStatus, show]);

  // Mutations
  const createMutation = useCreateExerciseLog();
  const updateMutation = useUpdateExerciseLog();
  const deleteMutation = useDeleteExerciseLog();

  // Animation refs for newly added rows
  const animationRefs = useRef<Map<string, Animated.Value>>(new Map());
  
  // Track newly added entry ID for highlight animation
  const [newEntryId, setNewEntryId] = useState<string | null>(null);

  // Modal state for custom exercise form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isTemporarilyDisabled, setIsTemporarilyDisabled] = useState(false);
  const [editingLog, setEditingLog] = useState<{ 
    id: string; 
    name: string; 
    minutes: number | null; 
    notes: string | null;
    category: 'cardio_mind_body' | 'strength';
    intensity: 'low' | 'medium' | 'high' | 'max' | null;
    distance_km: number | null;
    sets: number | null;
    reps_min: number | null;
    reps_max: number | null;
  } | null>(null);
  const [formName, setFormName] = useState('');
  const [formMinutes, setFormMinutes] = useState('');
  const [formSets, setFormSets] = useState('');
  const [formCategory, setFormCategory] = useState<'cardio_mind_body' | 'strength' | ''>('');
  const [formNotes, setFormNotes] = useState('');
  const [disabledChips, setDisabledChips] = useState<Set<string>>(new Set());

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  
  // Clone modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const cloneMutation = useCloneDayEntriesMutation('exercise_log');
  const massDeleteMutation = useMassDeleteEntriesMutation('exercise_log');
  const queryClient = useQueryClient();
  
  // Mass delete confirmation modal state
  const [showMassDeleteConfirm, setShowMassDeleteConfirm] = useState(false);
  
  // Exercise settings modal state
  const [showExerciseSettings, setShowExerciseSettings] = useState(false);
  const [settingsDistanceUnit, setSettingsDistanceUnit] = useState<'km' | 'mi'>('km');

  // Initialize settings when modal opens
  useEffect(() => {
    if (showExerciseSettings) {
      setSettingsDistanceUnit((userConfig?.distance_unit as 'km' | 'mi') ?? 'km');
    }
  }, [showExerciseSettings, userConfig?.distance_unit]);
  
  // Shared edit mode state (for both clone and delete)
  const [editMode, setEditMode] = useState(false);
  
  // Multi-select for edit mode
  const {
    isSelected: isEntrySelected,
    toggleSelection: toggleEntrySelection,
    selectAll: selectAllEntries,
    deselectAll: deselectAllEntries,
    areAllSelected: areAllEntriesSelected,
    selectedIds: selectedEntryIds,
    hasSelection: hasEntrySelection,
    clearSelection: clearEntrySelection,
  } = useMultiSelect<{ id: string }>({ enabled: editMode });
  
  // Clear selection when exiting edit mode
  useEffect(() => {
    if (!editMode) {
      clearEntrySelection();
    }
  }, [editMode]);
  
  // Reset edit mode when date changes
  useEffect(() => {
    setEditMode(false);
    clearEntrySelection();
  }, [selectedDateString]);
  
  // Mass delete handlers
  const handleMassDelete = useCallback(() => {
    if (hasEntrySelection && selectedEntryIds.size > 0) {
      setShowMassDeleteConfirm(true);
    }
  }, [hasEntrySelection, selectedEntryIds.size]);
  
  const handleMassDeleteConfirm = useCallback(async () => {
    setShowMassDeleteConfirm(false);
    if (selectedEntryIds.size === 0) return;
    
    const entryIdsArray = Array.from(selectedEntryIds);
    massDeleteMutation.mutate(
      { entryIds: entryIdsArray },
      {
        onSuccess: (deletedCount) => {
          // Exit edit mode after successful delete
          setEditMode(false);
          clearEntrySelection();
          
          if (deletedCount > 0) {
            showAppToast(t('exercise.clone.mass_delete.success_message', {
              count: deletedCount,
              items: deletedCount === 1 ? t('exercise.clone.mass_delete.item_one') : t('exercise.clone.mass_delete.item_other'),
            }));
          }
        },
        onError: (error: Error) => {
          Alert.alert(
            t('exercise.clone.mass_delete.error_title'),
            t('exercise.clone.mass_delete.error_message', {
              error: error.message || t('common.unexpected_error'),
            })
          );
        },
      }
    );
  }, [selectedEntryIds, massDeleteMutation, t, setEditMode, clearEntrySelection]);
  
  const handleMassDeleteCancel = useCallback(() => {
    setShowMassDeleteConfirm(false);
  }, []);
  
  // Previous day copy hook - reusable pattern
  const { cloneFromPreviousDay, isLoading: isCloningFromPreviousDay } = useCloneFromPreviousDay({
    entityType: 'exercise_log',
    currentDate: selectedDate,
    onSuccess: (clonedCount) => {
      if (clonedCount > 0) {
        showAppToast(t('exercise.previous_day_copy.success_message', {
          count: clonedCount,
          items: clonedCount === 1 ? t('exercise.clone.item_one') : t('exercise.clone.item_other'),
        }));
      }
    },
    onError: (error: Error) => {
      // Handle nothing to copy error
      if (error.message === 'NOTHING_TO_COPY') {
        showAppToast(t('exercise.previous_day_copy.nothing_to_copy'));
        return;
      }
      // Handle same-date error specifically
      if (error.message === 'SAME_DATE' || error.message?.includes('same date')) {
        Alert.alert(
          t('exercise.clone.error_title'),
          t('exercise.clone.same_date_error')
        );
      } else {
        Alert.alert(
          t('exercise.clone.error_title'),
          t('exercise.clone.error_message', {
            error: error.message || t('common.unexpected_error'),
          })
        );
      }
    },
  });

  // Sort exercise logs by category (cardio_mind_body first, then strength)
  // Within each category, newer entries appear at the bottom (sort by id ascending as proxy for creation time)
  const sortedExerciseLogs = useMemo(() => {
    const sorted = [...exerciseLogs].sort((a, b) => {
      // Primary sort: category (cardio_mind_body first)
      if (a.category !== b.category) {
        if (a.category === 'cardio_mind_body') return -1;
        if (b.category === 'cardio_mind_body') return 1;
        return 0;
      }
      // Secondary sort: within same category, sort by id (newer at bottom = ascending order)
      // Use id comparison as proxy for creation time
      return a.id.localeCompare(b.id);
    });
    return sorted;
  }, [exerciseLogs]);

  // Calculate totals for selected date
  // Total minutes only counts cardio/mind-body exercises (strength uses sets/reps)
  const totalMinutes = exerciseLogs.reduce((sum, log) => {
    if (log.category === 'cardio_mind_body') {
      return sum + (log.minutes || 0);
    }
    return sum;
  }, 0);
  const activityCount = exerciseLogs.length;
  
  // Calculate cardio and strength counts
  const cardioCount = exerciseLogs.filter(log => log.category === 'cardio_mind_body').length;
  const strengthCount = exerciseLogs.filter(log => log.category === 'strength').length;
  
  // Calculate total distance from cardio exercises
  const totalDistanceKm = exerciseLogs.reduce((sum, log) => {
    if (log.category === 'cardio_mind_body' && log.distance_km !== null) {
      return sum + log.distance_km;
    }
    return sum;
  }, 0);

  // Animate newly added exercise
  useEffect(() => {
    if (exerciseLogs.length > 0) {
      const lastLog = exerciseLogs[exerciseLogs.length - 1];
      if (!animationRefs.current.has(lastLog.id)) {
        const animValue = new Animated.Value(0);
        animationRefs.current.set(lastLog.id, animValue);
        Animated.timing(animValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [exerciseLogs]);

  // Handle quick add (from chips)
  const chipTextStyle = { fontSize: FontSize.sm };
  const handleQuickAdd = useCallback((name: string, minutes: number | null, category?: 'cardio_mind_body' | 'strength') => {
    if (!user?.id) return;

    // Create unique key for this chip
    const chipKey = `${name}-${minutes}`;
    
    // Disable chip for 3 seconds to prevent multiple clicks
    setDisabledChips(prev => new Set(prev).add(chipKey));
    setTimeout(() => {
      setDisabledChips(prev => {
        const next = new Set(prev);
        next.delete(chipKey);
        return next;
      });
    }, 3000);

    createMutation.mutate({
      user_id: user.id,
      date: selectedDateString,
      name: name.trim(),
      minutes: minutes,
      notes: null,
      category: category ?? 'cardio_mind_body',
      intensity: null,
      distance_km: null,
      sets: null,
      reps_min: null,
      reps_max: null,
    }, {
      onSuccess: (data) => {
        if (data?.id) {
          setNewEntryId(data.id);
        }
      },
    });
  }, [user?.id, selectedDateString, createMutation]);

  // Handle custom exercise form
  const openCustomForm = () => {
    setEditingLog(null);
    setFormName('');
    setFormMinutes('');
    setFormSets('');
    setFormCategory('');
    setFormNotes('');
    setShowCustomForm(true);
  };

  const openEditForm = (log: { 
    id: string; 
    name: string; 
    minutes: number | null; 
    notes: string | null;
    category: 'cardio_mind_body' | 'strength';
    intensity: 'low' | 'medium' | 'high' | 'max' | null;
    distance_km: number | null;
    sets: number | null;
    reps_min: number | null;
    reps_max: number | null;
  }) => {
    setEditingLog(log);
    setFormName(log.name);
    setFormMinutes(log.minutes?.toString() || '');
    setFormSets(log.sets?.toString() || '');
    setFormCategory(log.category);
    setFormNotes(log.notes || '');
    setShowCustomForm(true);
  };

  const closeCustomForm = () => {
    setShowCustomForm(false);
    setEditingLog(null);
    setFormName('');
    setFormMinutes('');
    setFormSets('');
    setFormCategory('');
    setFormNotes('');
  };

  // Handle minutes input change - only allow integers within configured range
  const handleMinutesChange = (text: string) => {
    // Remove any non-numeric characters
    const numericOnly = text.replace(/[^0-9]/g, '');
    
    // If empty, allow it (optional field)
    if (numericOnly === '') {
      setFormMinutes('');
      return;
    }
    
    // Parse the number
    const numValue = parseInt(numericOnly, 10);
    
    // If valid number and within range, set it
    if (!isNaN(numValue) && numValue >= RANGES.EXERCISE_MINUTES.MIN && numValue <= RANGES.EXERCISE_MINUTES.MAX) {
      setFormMinutes(numericOnly);
    }
    // If number is above max, cap it
    else if (!isNaN(numValue) && numValue > RANGES.EXERCISE_MINUTES.MAX) {
      setFormMinutes(RANGES.EXERCISE_MINUTES.MAX.toString());
    }
    // Otherwise, don't update (invalid input)
  };

  // Handle sets input change - only allow integers within configured range
  const handleSetsChange = (text: string) => {
    // Remove any non-numeric characters
    const numericOnly = text.replace(/[^0-9]/g, '');
    
    // If empty, allow it (optional field)
    if (numericOnly === '') {
      setFormSets('');
      return;
    }
    
    // Parse the number
    const numValue = parseInt(numericOnly, 10);
    
    // If valid number and within range, set it
    if (!isNaN(numValue) && numValue >= RANGES.EXERCISE_SETS.MIN && numValue <= RANGES.EXERCISE_SETS.MAX) {
      setFormSets(numericOnly);
    }
    // If number is above max, cap it
    else if (!isNaN(numValue) && numValue > RANGES.EXERCISE_SETS.MAX) {
      setFormSets(RANGES.EXERCISE_SETS.MAX.toString());
    }
    // Otherwise, don't update (invalid input)
  };

  const handleSaveExercise = () => {
    // Prevent multiple submissions
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }

    const name = formName.trim();
    const notes = formNotes.trim() || null;
    const category = formCategory || 'cardio_mind_body';

    // Validation
    if (!name) {
      Alert.alert(t('exercise.form.name_required'));
      return;
    }

    if (name.length > TEXT_LIMITS.EXERCISE_NAME_MAX_LEN) {
      Alert.alert(t('exercise.form.name_max_length'));
      return;
    }

    if (!editingLog && !category) {
      Alert.alert(t('exercise.form.select_category'));
      return;
    }

    if (notes && notes.length > TEXT_LIMITS.NOTES_MAX_LEN) {
      Alert.alert(t('exercise.form.notes_max_length'));
      return;
    }

    if (!user?.id) {
      Alert.alert(t('common.error'));
      return;
    }

    // Prepare updates based on category
    const finalCategory = editingLog ? editingLog.category : (category as 'cardio_mind_body' | 'strength');
    // Partial update object for exercise log - type is complex due to category-specific fields
    let updates: any = { name, notes, category: finalCategory }; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (finalCategory === 'cardio_mind_body') {
      const minutesValue = formMinutes.trim();
      const minutes = minutesValue ? parseInt(minutesValue, 10) : null;
      
      // Validate minutes if provided
      if (minutesValue) {
        if (minutes === null || isNaN(minutes)) {
          Alert.alert(t('exercise.form.minutes_range'));
          return;
        }
        if (minutes < RANGES.EXERCISE_MINUTES.MIN || minutes > RANGES.EXERCISE_MINUTES.MAX) {
          Alert.alert(t('exercise.form.minutes_range'));
          return;
        }
      }
      updates.minutes = minutes;
      updates.sets = null;
      updates.reps_min = null;
      updates.reps_max = null;
    } else {
      const setsValue = formSets.trim();
      const sets = setsValue ? parseInt(setsValue, 10) : null;
      
      // Validate sets if provided
      if (setsValue) {
        if (sets === null || isNaN(sets)) {
          Alert.alert('Sets must be a valid number');
          return;
        }
        if (sets < RANGES.EXERCISE_SETS.MIN || sets > RANGES.EXERCISE_SETS.MAX) {
          Alert.alert(`Sets must be between ${RANGES.EXERCISE_SETS.MIN} and ${RANGES.EXERCISE_SETS.MAX}`);
          return;
        }
      }
      updates.sets = sets;
      updates.minutes = null;
      // Keep existing reps/intensity if editing, otherwise null
      if (!editingLog) {
        updates.reps_min = null;
        updates.reps_max = null;
        updates.intensity = null;
      }
    }

    if (editingLog) {
      // Update existing
      updateMutation.mutate(
        {
          logId: editingLog.id,
          updates,
        },
        {
          onSuccess: () => {
            closeCustomForm();
          },
          onError: (error: Error) => {
            Alert.alert(t('exercise.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
          },
        }
      );
    } else {
      // Create new - ensure all fields are set
      // Create data object - type is complex due to category-specific optional fields
      const createData: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
        user_id: user.id,
        date: selectedDateString,
        name,
        notes,
        category: finalCategory,
        intensity: null,
        distance_km: null,
      };
      if (finalCategory === 'cardio_mind_body') {
        createData.minutes = updates.minutes;
        createData.sets = null;
        createData.reps_min = null;
        createData.reps_max = null;
      } else {
        createData.sets = updates.sets;
        createData.minutes = null;
        createData.reps_min = null;
        createData.reps_max = null;
      }
      
      createMutation.mutate(
        createData,
        {
          onSuccess: (data) => {
            if (data?.id) {
              setNewEntryId(data.id);
            }
            closeCustomForm();
          },
          onError: (error: Error) => {
            Alert.alert(t('exercise.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
          },
        }
      );
    }
  };

  // Handle delete - show confirmation modal
  const handleDelete = (logId: string, logName: string) => {
    setDeleteTarget({ id: logId, name: logName });
    setShowDeleteConfirm(true);
  };

  // Confirm delete action
  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        const deletedName = deleteTarget.name;
        setDeleteTarget(null);
        showAppToast(t('exercise.delete.success_single', { name: deletedName }));
      },
      onError: (error: Error) => {
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
        Alert.alert(t('exercise.delete.error', { error: error.message || t('common.unexpected_error') }));
      },
    });
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // Handle inline minutes update (cardio/mind-body only)
  const handleMinutesUpdate = (logId: string, minutes: number | null) => {
    updateMutation.mutate(
      {
        logId,
        updates: { minutes },
      },
      {
        onError: (error: Error) => {
          Alert.alert(t('exercise.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
        },
      }
    );
  };

  // Handle inline sets update (strength only)
  const handleSetsUpdate = (logId: string, sets: number | null) => {
    updateMutation.mutate(
      {
        logId,
        updates: { sets },
      },
      {
        onError: (error: Error) => {
          Alert.alert(t('exercise.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
        },
      }
    );
  };

  // Handle inline distance update (cardio/mind-body only)
  const handleDistanceUpdate = (logId: string, distance_km: number | null) => {
    // Ensure distance_km is rounded to 4 decimals before storage (already rounded in onCommit, but double-check)
    const finalDistanceKm = distance_km !== null ? roundTo4Decimals(distance_km) : null;
    updateMutation.mutate(
      {
        logId,
        updates: { distance_km: finalDistanceKm },
      },
      {
        onError: (error: Error) => {
          Alert.alert(t('exercise.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
        },
      }
    );
  };

  // Bottom sheet state for reps and intensity
  const [showRepsSheet, setShowRepsSheet] = useState(false);
  const [repsSheetLogId, setRepsSheetLogId] = useState<string | null>(null);
  const [showIntensitySheet, setShowIntensitySheet] = useState(false);
  const [intensitySheetLogId, setIntensitySheetLogId] = useState<string | null>(null);

  // Handle reps update (opens bottom sheet)
  const handleRepsUpdate = (logId: string) => {
    setRepsSheetLogId(logId);
    setShowRepsSheet(true);
  };

  // Handle reps save from bottom sheet
  const handleRepsSave = (repsMin: number | null, repsMax: number | null) => {
    if (!repsSheetLogId) return;
    updateMutation.mutate(
      {
        logId: repsSheetLogId,
        updates: { reps_min: repsMin, reps_max: repsMax },
      },
      {
        onError: (error: Error) => {
          Alert.alert(t('exercise.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
        },
      }
    );
    setShowRepsSheet(false);
    setRepsSheetLogId(null);
  };

  // Handle intensity update (opens bottom sheet)
  const handleIntensityUpdate = (logId: string) => {
    setIntensitySheetLogId(logId);
    setShowIntensitySheet(true);
  };

  // Handle intensity save from bottom sheet
  const handleIntensitySave = (intensity: 'low' | 'medium' | 'high' | 'max') => {
    if (!intensitySheetLogId) return;
    updateMutation.mutate(
      {
        logId: intensitySheetLogId,
        updates: { intensity },
      },
      {
        onError: (error: Error) => {
          Alert.alert(t('exercise.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
        },
      }
    );
    setShowIntensitySheet(false);
    setIntensitySheetLogId(null);
  };

  // Handle date selection from recent days
  const handleDateSelect = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      navigateWithDate(date);
    }
  };

  // Format recent days summary (for accessibility)
  const formatRecentDay = (summary: { date: string; total_minutes: number; activity_count: number; cardio_count: number; cardio_distance_km: number; strength_count: number }) => {
    const date = new Date(summary.date + 'T00:00:00');
    const dayLabel = formatDateForDisplay(date);
    const minutes = Math.round(summary.total_minutes);
    const distanceKm = summary.cardio_distance_km || 0;
    const distanceUnit = userConfig?.distance_unit ?? 'km';
    const distanceValue = distanceUnit === 'mi' && distanceKm > 0 
      ? formatDistanceForDisplay(distanceKm / KM_TO_MILES_CONVERSION)
      : formatDistanceForDisplay(distanceKm);
    const cardioCount = summary.cardio_count || 0;
    const strengthCount = summary.strength_count || 0;

    // Build accessibility string: day - duration, distance, cardio count, strength count
    const parts: string[] = [];
    
    if (minutes > 0) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0 && mins > 0) {
        parts.push(`${hours} hour${hours > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''}`);
      } else if (hours > 0) {
        parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
      } else {
        parts.push(`${mins} minute${mins > 1 ? 's' : ''}`);
      }
    }
    
    if (distanceValue > 0) {
      const formattedDistance = distanceValue % 1 === 0 
        ? distanceValue.toString() 
        : parseFloat(distanceValue.toFixed(2)).toString();
      parts.push(`${formattedDistance} ${distanceUnit === 'mi' ? 'miles' : 'kilometers'}`);
    }
    
    parts.push(`${cardioCount} cardio activities`);
    parts.push(`${strengthCount} strength activities`);

    return `${dayLabel} - ${parts.join(', ')}`;
  };

  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // Recent and frequent exercises (already combined and limited to 10)
  const typedRecentAndFrequent = (recentAndFrequentExercises || []) as Array<{ name: string; minutes: number | null; category?: 'cardio_mind_body' | 'strength' }>;
  const hasRecentFrequent = typedRecentAndFrequent.length > 0;

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
  const dateText = isToday
    ? `${t('common.today')}, ${formattedDate}`
    : selectedDate.getTime() === yesterday.getTime()
    ? `${t('common.yesterday')}, ${formattedDate}`
    : formattedDate;

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <CollapsibleModuleHeader
        dateText={dateText}
        rightAvatarUri={effectiveProfile?.avatar_url ?? undefined}
        preferredName={effectiveProfile?.first_name ?? undefined}
        rightAction={
          <DatePickerButton
            selectedDate={selectedDate}
            onDateSelect={navigateWithDate}
            today={today}
            module="exercise"
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
        module="exercise"
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>

          {/* Today's Exercise Section - Card */}
          <ExerciseSectionContainer>
            <SurfaceCard module="exercise">
              {/* Standardized Summary Card Header */}
              <SummaryCardHeader
                titleKey="home.summary.title_other"
                materialIcon="heart-pulse"
                module="exercise"
                isLoading={logsLoading}
                style={{
                  paddingHorizontal: 0,
                }}
                subtitle={
                  !logsLoading && activityCount > 0
                    ? (() => {
                        const distanceUnit = userConfig?.distance_unit ?? 'km';
                        const distanceValue = distanceUnit === 'mi' && totalDistanceKm > 0 
                          ? formatDistanceForDisplay(totalDistanceKm / KM_TO_MILES_CONVERSION)
                          : formatDistanceForDisplay(totalDistanceKm);
                        
                        const parts: string[] = [];
                        
                        if (totalMinutes > 0) {
                          parts.push(`🕒${totalMinutes} min`);
                        }
                        
                        if (distanceValue > 0) {
                          const formattedDistance = distanceValue % 1 === 0 
                            ? distanceValue.toString() 
                            : parseFloat(distanceValue.toFixed(2)).toString();
                          parts.push(`📏${formattedDistance} ${distanceUnit === 'mi' ? 'mi' : 'km'}`);
                        }
                        
                        parts.push(`🏃${cardioCount}`);
                        parts.push(`🏋️${strengthCount}`);
                        
                        return parts.join('   '); // Two spaces between sections
                      })()
                    : undefined
                }
                rightContent={
                  !logsLoading && (
                    <View style={[styles.headerButtons, styles.headerButtonsAlignRight]}>
                      {!editMode ? (
                        <>
                          {/* Clone button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (!exerciseLogs || exerciseLogs.length === 0) {
                                showAppToast(t('exercise.clone.nothing_to_copy'));
                                return;
                              }
                              setEditMode(true);
                            }}
                            disabled={!exerciseLogs || exerciseLogs.length === 0}
                            style={[
                              styles.cloneButton,
                              (!exerciseLogs || exerciseLogs.length === 0) && { opacity: 0.4 },
                            ]}
                            activeOpacity={0.7}
                            {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                            {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.enter_edit_mode'))}
                          >
                            <IconSymbol name="doc.on.doc" size={20} color={colors.tint} />
                          </TouchableOpacity>
                          
                          {/* Settings button */}
                          <TouchableOpacity
                            onPress={() => setShowExerciseSettings(true)}
                            style={styles.cloneButton}
                            activeOpacity={0.7}
                            {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                            {...getButtonAccessibilityProps('Exercise Settings')}
                          >
                            <IconSymbol name="gearshape" size={20} color={colors.tint} />
                          </TouchableOpacity>
                          
                          {/* Delete button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (!exerciseLogs || exerciseLogs.length === 0) {
                                return;
                              }
                              setEditMode(true);
                            }}
                            disabled={!exerciseLogs || exerciseLogs.length === 0}
                            style={[
                              styles.deleteButton,
                              (!exerciseLogs || exerciseLogs.length === 0) && { opacity: 0.4 },
                            ]}
                            activeOpacity={0.7}
                            {...(Platform.OS === 'web' && getFocusStyle(SemanticColors.error))}
                            {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.enter_edit_mode'))}
                          >
                            <IconSymbol name="trash.fill" size={20} color={SemanticColors.error} />
                          </TouchableOpacity>
                        </>
                      ) : (
                        /* Exit edit mode button */
                        <TouchableOpacity
                          onPress={() => {
                            setEditMode(false);
                            clearEntrySelection();
                          }}
                          style={[
                            styles.cloneButton,
                            {
                              backgroundColor: SemanticColors.successLight,
                              borderColor: SemanticColors.success + '40',
                            },
                          ]}
                          activeOpacity={0.7}
                          {...(Platform.OS === 'web' && getFocusStyle(SemanticColors.success))}
                          {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.exit_edit_mode'))}
                        >
                          <IconSymbol name="checkmark" size={20} color={SemanticColors.success} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                }
              />

          <View style={styles.daySummaryBody}>
            {logsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            ) : (
              <>
                {exerciseLogs.length === 0 ? (
                  <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('exercise.summary.no_exercises')}
                  </ThemedText>
                ) : (
                  <View style={styles.exerciseList}>
                  {/* Select All Row - Only shown in edit mode */}
                  {editMode && exerciseLogs.length > 0 && (
                    <View style={[styles.selectAllRow, { backgroundColor: colors.background, borderBottomColor: colors.separator }]}>
                      <MultiSelectItem
                        isSelected={areAllEntriesSelected(exerciseLogs, (log) => log.id)}
                        onToggle={() => {
                          if (areAllEntriesSelected(exerciseLogs, (log) => log.id)) {
                            deselectAllEntries();
                          } else {
                            selectAllEntries(exerciseLogs, (log) => log.id);
                          }
                        }}
                        style={{ paddingVertical: 12, paddingHorizontal: 16 }}
                      >
                        <View style={styles.selectAllRowContent}>
                          <ThemedText style={[styles.selectAllText, { color: colors.text }]}>
                            {t('exercise.clone.edit_mode.select_all')}
                          </ThemedText>
                          <View style={styles.selectAllActions}>
                            <TouchableOpacity
                              onPress={() => {
                                const selectedIds = Array.from(selectedEntryIds);
                                if (selectedIds.length === 0) {
                                  showAppToast(t('exercise.clone.nothing_to_copy'));
                                  return;
                                }
                                setShowCloneModal(true);
                              }}
                              disabled={!hasEntrySelection}
                              style={[
                                styles.iconButtonInRow,
                                { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40', borderWidth: 1 },
                                !hasEntrySelection && { opacity: 0.5 },
                              ]}
                              activeOpacity={0.7}
                              {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                              {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.clone_button'))}
                            >
                              <IconSymbol name="doc.on.doc" size={20} color={colors.tint} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handleMassDelete}
                              disabled={!hasEntrySelection}
                              style={[
                                styles.iconButtonInRow,
                                { backgroundColor: SemanticColors.errorLight, borderColor: SemanticColors.error + '40', borderWidth: 1 },
                                !hasEntrySelection && { opacity: 0.5 },
                              ]}
                              activeOpacity={0.7}
                              {...(Platform.OS === 'web' && getFocusStyle(SemanticColors.error))}
                              {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.delete_button'))}
                            >
                              <IconSymbol name="trash.fill" size={20} color={SemanticColors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </MultiSelectItem>
                    </View>
                  )}
                  
                  {sortedExerciseLogs.map((log, index) => {
                    const prevLog = index > 0 ? sortedExerciseLogs[index - 1] : null;
                    const showSeparator = prevLog?.category === 'cardio_mind_body' && log.category === 'strength';
                    const isLast = index === sortedExerciseLogs.length - 1;
                    
                    const rowContent = (
                      <HighlightableRow
                        key={log.id}
                        isNew={log.id === newEntryId}
                      >
                        <ExerciseRow
                          log={log}
                          colors={colors as typeof Colors.light}
                          onEdit={() => {
                            if (!editMode) {
                              openEditForm(log);
                            }
                          }}
                          onMinutesUpdate={handleMinutesUpdate}
                          onSetsUpdate={handleSetsUpdate}
                          onRepsUpdate={handleRepsUpdate}
                          onIntensityUpdate={handleIntensityUpdate}
                          onDistanceUpdate={handleDistanceUpdate}
                          distanceUnit={userConfig?.distance_unit ?? 'km'}
                          isLast={isLast}
                          animationValue={animationRefs.current.get(log.id)}
                          disabled={editMode}
                        />
                      </HighlightableRow>
                    );
                    
                    if (editMode) {
                      return (
                        <Fragment key={log.id}>
                          {showSeparator && (
                            <View style={[styles.categorySeparator, { borderTopColor: colors.separator }]} />
                          )}
                          <MultiSelectItem
                            isSelected={isEntrySelected(log.id)}
                            onToggle={() => toggleEntrySelection(log.id)}
                          >
                            {rowContent}
                          </MultiSelectItem>
                        </Fragment>
                      );
                    }
                    
                    return (
                      <Fragment key={log.id}>
                        {showSeparator && (
                          <View style={[styles.categorySeparator, { borderTopColor: colors.separator }]} />
                        )}
                        {rowContent}
                      </Fragment>
                    );
                  })}
                  </View>
                )}
              </>
            )}
          </View>
          </SurfaceCard>
        </ExerciseSectionContainer>

        {/* Quick Add Section - Card */}
        <ExerciseSectionContainer>
          <SurfaceCard module="exercise">
          <View style={styles.quickAddHeader}>
            <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
              {t('exercise.quick_add_title')}
            </ThemedText>
            <TouchableOpacity
              onPress={() => {
                // Disable button for 3 seconds to prevent multiple clicks
                setIsTemporarilyDisabled(true);
                setTimeout(() => {
                  setIsTemporarilyDisabled(false);
                }, 3000);
                
                // Check cache for previous day before cloning
                const previousDay = new Date(selectedDate);
                previousDay.setDate(previousDay.getDate() - 1);
                const previousDateString = getLocalDateKey(previousDay);
                
                // Use React Query cache to check if previous day has entries
                const previousDayQueryKey = ['exerciseLogs', user?.id, previousDateString];
                // Query cache data type - exercise logs array from React Query cache
                const cachedPreviousDayLogs = queryClient.getQueryData<any[]>(previousDayQueryKey); // eslint-disable-line @typescript-eslint/no-explicit-any
                
                // If cache exists and is empty, show message and skip DB call
                if (cachedPreviousDayLogs !== undefined && (cachedPreviousDayLogs === null || cachedPreviousDayLogs.length === 0)) {
                  showAppToast(t('exercise.previous_day_copy.nothing_to_copy'));
                  return;
                }
                
                cloneFromPreviousDay();
              }}
              style={styles.previousDayButton}
              activeOpacity={0.7}
              disabled={isCloningFromPreviousDay || isTemporarilyDisabled}
              {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
              {...getButtonAccessibilityProps(
                isToday 
                  ? t('exercise.previous_day_copy.accessibility_label_yesterday')
                  : t('exercise.previous_day_copy.accessibility_label_previous')
              )}
            >
              <IconSymbol name="doc.on.doc" size={16} color={isTemporarilyDisabled ? colors.textSecondary : colors.tint} />
              <ThemedText style={[styles.previousDayButtonText, { color: isTemporarilyDisabled ? colors.textSecondary : colors.tint }]}>
                {isToday 
                  ? t('exercise.previous_day_copy.label_yesterday')
                  : t('exercise.previous_day_copy.label_previous')}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Recent/Frequent Exercises */}
          {hasRecentFrequent && (
            <>
              <QuickAddHeading 
                labelKey="exercise.quick_add.your_recent_frequent"
                module="exercise"
                icon="dumbbell.fill"
              />
              <ScrollView
                style={styles.chipsScrollContainer}
                contentContainerStyle={styles.chipsWrapContainer}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {typedRecentAndFrequent.map((exercise, index) => {
                  const minutesText = exercise.minutes !== null && exercise.minutes !== undefined ? `${exercise.minutes} min` : null;
                  const chipKey = `${exercise.name}-${exercise.minutes}`;
                  return (
                    <QuickAddChip
                      key={`recent-${index}-${exercise.name}-${exercise.minutes}`}
                      label={exercise.name}
                      metadata={minutesText}
                      colors={colors as typeof Colors.light}
                      textStyle={chipTextStyle}
                      onPress={() => handleQuickAdd(exercise.name, exercise.minutes, exercise.category)}
                      disabled={disabledChips.has(chipKey)}
                      chipStyle={{ paddingHorizontal: Spacing.xs }}
                    />
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Custom Exercise Button */}
          <TouchableOpacity
            style={[styles.customButton, { backgroundColor: colors.tintLight, borderColor: colors.tint }]}
            onPress={openCustomForm}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(t('exercise.quick_add.add_custom'))}
          >
            <IconSymbol name="plus.circle.fill" size={18} color={colors.tint} />
            <ThemedText style={[styles.customButtonText, { color: colors.tint }]}>
              {t('exercise.quick_add.add_custom')}
            </ThemedText>
          </TouchableOpacity>

          {/* Common Cardio & Mind-Body Exercises */}
          <QuickAddHeading 
            labelKey="exercise.quick_add.common_cardio_mind_body"
            module="exercise"
            icon="figure.run"
          />
          <ScrollView
            style={styles.chipsScrollContainer}
            contentContainerStyle={styles.chipsWrapContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {COMMON_CARDIO_MIND_BODY.map((exercise) => {
              const chipKey = `${exercise.label}-null`;
              return (
                    <QuickAddChip
                      key={`cardio-${exercise.label}`}
                      label={exercise.label}
                      colors={colors as typeof Colors.light}
                      textStyle={chipTextStyle}
                      onPress={() => handleQuickAdd(exercise.label, null, exercise.category)}
                      disabled={disabledChips.has(chipKey)}
                      chipStyle={{ paddingHorizontal: Spacing.xs }}
                    />
              );
            })}
          </ScrollView>

          {/* Common Strength Workouts */}
          <QuickAddHeading 
            labelKey="exercise.quick_add.common_strength"
            module="exercise"
            icon="dumbbell.fill"
          />
          <ScrollView
            style={styles.chipsScrollContainer}
            contentContainerStyle={styles.chipsWrapContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {COMMON_STRENGTH_WORKOUTS.map((exercise) => {
              const chipKey = `${exercise.label}-null`;
              return (
                <QuickAddChip
                  key={`strength-${exercise.label}`}
                  label={exercise.label}
                  colors={colors as typeof Colors.light}
                  textStyle={chipTextStyle}
                  onPress={() => handleQuickAdd(exercise.label, null, exercise.category)}
                  disabled={disabledChips.has(chipKey)}
                  chipStyle={{ paddingHorizontal: Spacing.xs }}
                />
              );
            })}
          </ScrollView>
          </SurfaceCard>
        </ExerciseSectionContainer>

        {/* Recent Days Section - Lighter Card */}
        <ExerciseSectionContainer>
          <View style={[styles.recentDaysCard, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText type="subtitle" style={[styles.recentDaysTitle, { color: colors.text }]}>
            {t('exercise.recent_days_title')}
          </ThemedText>

          {recentDaysSummary.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('exercise.summary.no_exercises')}
            </ThemedText>
          ) : (
            <View style={styles.recentDaysList}>
              {recentDaysSummary.map((summary, index) => (
                <TouchableOpacity
                  key={summary.date}
                  style={[
                    styles.recentDayRow,
                    index < recentDaysSummary.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.separator },
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  onPress={() => handleDateSelect(summary.date)}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(formatRecentDay(summary))}
                >
                  <ThemedText style={[styles.recentDayDate, { color: colors.text }]}>
                    {formatDateForDisplay(new Date(summary.date + 'T00:00:00'))}
                  </ThemedText>
                  <ThemedText style={[styles.recentDayStats, { color: colors.textSecondary }]}>
                    {(() => {
                      const minutes = Math.round(summary.total_minutes);
                      const distanceKm = summary.cardio_distance_km || 0;
                      const distanceUnit = userConfig?.distance_unit ?? 'km';
                      const distanceValue = distanceUnit === 'mi' && distanceKm > 0 
                        ? formatDistanceForDisplay(distanceKm / KM_TO_MILES_CONVERSION)
                        : formatDistanceForDisplay(distanceKm);
                      const cardioCount = summary.cardio_count || 0;
                      const strengthCount = summary.strength_count || 0;

                      // Build stats string with emojis: 🕒{hours}m  📏{distance}{unit}   🏃{cardio}   🏋️{strength}
                      const parts: string[] = [];
                      
                      if (minutes > 0) {
                        parts.push(`🕒${formatMinutesAsHoursMinutes(minutes)}`);
                      }
                      
                      if (distanceValue > 0) {
                        // Format distance with max 2 decimals, trimming trailing zeros
                        const formattedDistance = distanceValue % 1 === 0 
                          ? distanceValue.toString() 
                          : parseFloat(distanceValue.toFixed(2)).toString();
                        parts.push(`📏${formattedDistance} ${distanceUnit === 'mi' ? 'mi' : 'km'}`);
                      }
                      
                      parts.push(`🏃${cardioCount}`);
                      parts.push(`🏋️${strengthCount}`);
                      
                      return parts.join('   '); // Two spaces between sections
                    })()}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
          </View>
        </ExerciseSectionContainer>
        </DesktopPageContainer>
      </CollapsibleModuleHeader>
      

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.confirmModalContent, { backgroundColor: colors.background }]}>
            <ThemedText type="title" style={[styles.confirmModalTitle, { color: colors.text }]}>
              {t('exercise.delete.title')}
            </ThemedText>
            <ThemedText style={[styles.confirmModalMessage, { color: colors.textSecondary }]}>
              {deleteTarget ? t('exercise.delete.message', { name: deleteTarget.name }) : t('exercise.delete.message_generic')}
            </ThemedText>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={cancelDelete}
                {...getButtonAccessibilityProps(t('exercise.delete.cancel'))}
              >
                <ThemedText style={{ color: colors.text }}>{t('exercise.delete.cancel')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.deleteConfirmButton, { backgroundColor: colors.error }]}
                onPress={confirmDelete}
                disabled={deleteMutation.isPending}
                {...getButtonAccessibilityProps(t('exercise.delete.confirm'))}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <ThemedText style={{ color: colors.textInverse }}>{t('exercise.delete.confirm')}</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Exercise Form Modal */}
      <Modal
        visible={showCustomForm}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCustomForm}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {editingLog ? t('exercise.form.title_edit') : t('exercise.form.title')}
              </ThemedText>
              <TouchableOpacity
                onPress={closeCustomForm}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps(t('common.close'))}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.formContent}>
                <View>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('exercise.form.name_label')}
                  </ThemedText>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={formName}
                    onChangeText={setFormName}
                    // NOTE: Hardcoded per user request - exact placeholder text required
                    placeholder="e.g., Mid delts, Sauna, Rock Climbing"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={TEXT_LIMITS.EXERCISE_NAME_MAX_LEN}
                    autoFocus
                  />
                </View>

                {/* Category selector - required for new exercises */}
                {!editingLog && (
                  <View>
                    <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                      Category
                    </ThemedText>
                    <View style={styles.categorySelector}>
                      <TouchableOpacity
                        style={[
                          styles.categoryOption,
                          { 
                            backgroundColor: formCategory === 'cardio_mind_body' ? colors.tintLight : colors.backgroundSecondary,
                            borderColor: formCategory === 'cardio_mind_body' ? colors.tint : colors.border,
                          }
                        ]}
                        onPress={() => setFormCategory('cardio_mind_body')}
                        activeOpacity={0.7}
                        {...getButtonAccessibilityProps('Cardio / Mind-Body')}
                      >
                        <ThemedText style={[styles.categoryOptionText, { color: formCategory === 'cardio_mind_body' ? colors.tint : colors.text }]}>
                          Cardio / Mind-Body
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.categoryOption,
                          { 
                            backgroundColor: formCategory === 'strength' ? colors.tintLight : colors.backgroundSecondary,
                            borderColor: formCategory === 'strength' ? colors.tint : colors.border,
                          }
                        ]}
                        onPress={() => setFormCategory('strength')}
                        activeOpacity={0.7}
                        {...getButtonAccessibilityProps('Strength Workout')}
                      >
                        <ThemedText style={[styles.categoryOptionText, { color: formCategory === 'strength' ? colors.tint : colors.text }]}>
                          Strength Workout
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('exercise.form.notes_label')}
                  </ThemedText>
                  <TextInput
                    style={[styles.formTextArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder={t('exercise.form.notes_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    maxLength={TEXT_LIMITS.NOTES_MAX_LEN}
                    textAlignVertical="top"
                  />
                  <ThemedText style={[styles.formHelper, { color: colors.textSecondary }]}>
                    {t('exercise.form.notes_helper')}
                  </ThemedText>
                </View>

                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={[styles.formButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={closeCustomForm}
                    {...getButtonAccessibilityProps(t('common.cancel'))}
                  >
                    <ThemedText style={{ color: colors.text }}>{t('common.cancel')}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formButton, styles.saveButton, { backgroundColor: colors.tint }]}
                    onPress={handleSaveExercise}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    {...getButtonAccessibilityProps(t('common.save'))}
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                        {t('common.save')}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Clone Day Modal */}
      <CloneDayModal
        visible={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        sourceDate={selectedDate}
        minimumDate={minDate}
        maximumDate={today}
        onConfirm={(targetDate) => {
          // Get selected entry IDs if in edit mode, otherwise clone all
          const entryIdsToClone = editMode ? Array.from(selectedEntryIds) : undefined;
          
          // Check cache before cloning - if no entries selected, show message and skip DB work
          if (editMode) {
            if (entryIdsToClone && entryIdsToClone.length === 0) {
              showAppToast(t('exercise.clone.nothing_to_copy'));
              setShowCloneModal(false);
              return;
            }
          } else {
            if (!exerciseLogs || exerciseLogs.length === 0) {
              showAppToast(t('exercise.clone.nothing_to_copy'));
              setShowCloneModal(false);
              return;
            }
          }
          
          showAppToast(t('exercise.clone.toast_cloning'));
          const targetDateString = getLocalDateKey(targetDate);
          cloneMutation.mutate(
            {
              sourceDate: selectedDateString,
              targetDate: targetDateString,
              entryIds: entryIdsToClone,
            },
            {
              onSuccess: (clonedCount) => {
                setShowCloneModal(false);
                // Exit edit mode after successful clone
                if (editMode) {
                  setEditMode(false);
                  clearEntrySelection();
                }
                if (clonedCount > 0) {
                  const formattedDate = targetDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  showAppToast(t('exercise.clone.success_toast', {
                    count: clonedCount,
                    items: clonedCount === 1 ? t('exercise.clone.item_one') : t('exercise.clone.item_other'),
                    date: formattedDate,
                  }));
                }
              },
              onError: (error: Error) => {
                setShowCloneModal(false);
                Alert.alert(
                  t('exercise.clone.error_title'),
                  t('exercise.clone.error_message', {
                    error: error.message || t('common.unexpected_error'),
                  })
                );
              },
            }
          );
        }}
        title={t('exercise.clone.title')}
        subtitle={t('exercise.clone.subtitle')}
      />

      {/* Mass Delete Confirmation Modal */}
      <ConfirmModal
        visible={showMassDeleteConfirm}
        title={t('exercise.clone.mass_delete.title')}
        message={t('exercise.clone.mass_delete.message', {
          count: selectedEntryIds.size,
          items: selectedEntryIds.size === 1 ? t('exercise.clone.mass_delete.item_one') : t('exercise.clone.mass_delete.item_other'),
        })}
        confirmText={t('exercise.clone.mass_delete.confirm')}
        cancelText={t('exercise.clone.mass_delete.cancel')}
        onConfirm={handleMassDeleteConfirm}
        onCancel={handleMassDeleteCancel}
        confirmButtonStyle={{ backgroundColor: SemanticColors.error }}
      />

      {/* Reps Range Bottom Sheet */}
      {repsSheetLogId && (
        <RepsRangeBottomSheet
          visible={showRepsSheet}
          onClose={() => {
            setShowRepsSheet(false);
            setRepsSheetLogId(null);
          }}
          onSave={handleRepsSave}
          initialRepsMin={exerciseLogs.find(log => log.id === repsSheetLogId)?.reps_min || null}
          initialRepsMax={exerciseLogs.find(log => log.id === repsSheetLogId)?.reps_max || null}
        />
      )}

      {/* Intensity Bottom Sheet */}
      {intensitySheetLogId && (
        <IntensityBottomSheet
          visible={showIntensitySheet}
          onClose={() => {
            setShowIntensitySheet(false);
            setIntensitySheetLogId(null);
          }}
          onSave={handleIntensitySave}
          currentIntensity={exerciseLogs.find(log => log.id === intensitySheetLogId)?.intensity || null}
        />
      )}

      {/* Exercise Settings Modal */}
      <Modal
        visible={showExerciseSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExerciseSettings(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {t('exercise.settings.title')}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowExerciseSettings(false)}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps(t('common.close'))}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Distance Unit Setting */}
              <View style={styles.settingsRow}>
                {/* NOTE: Hardcoded per user request - exact label "Distance Unit" required */}
                <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                  Distance Unit
                </ThemedText>
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity
                    style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      const newUnit = settingsDistanceUnit === 'km' ? 'mi' : 'km';
                      setSettingsDistanceUnit(newUnit);
                    }}
                    {...getButtonAccessibilityProps('Distance Unit')}
                  >
                    <ThemedText style={[styles.dropdownText, { color: colors.text }]}>
                      {settingsDistanceUnit === 'km' ? t('exercise.settings.kilometers') : t('exercise.settings.miles')}
                    </ThemedText>
                    <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowExerciseSettings(false)}
                {...getButtonAccessibilityProps(t('exercise.settings.cancel'))}
              >
                <ThemedText style={{ color: colors.text }}>{t('exercise.settings.cancel')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.tint }]}
                onPress={() => {
                  updateProfileMutation.mutate({ distance_unit: settingsDistanceUnit }, {
                    onSuccess: () => {
                      showAppToast(t('exercise.settings.save'));
                      setShowExerciseSettings(false);
                    },
                  });
                }}
                disabled={updateProfileMutation.isPending}
                {...getButtonAccessibilityProps(t('exercise.settings.save'))}
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <ThemedText style={{ color: colors.textInverse }}>{t('exercise.settings.save')}</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Celebration Toast */}
      <ConfettiCelebrationModal {...confettiToastProps} />
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
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    ...Platform.select({
      web: {
        minHeight: '100%',
      },
    }),
  },
  scrollContent: {
    width: '100%',
    paddingTop: Spacing.none, // 0px - minimal gap between logo and greeting
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding
    }),
  },
  // Responsive container for exercise sections
  responsiveContainer: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  responsiveContainerLarge: {
    maxWidth: 900,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing['xl'],
  },
  pageTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  pageDate: {
    fontSize: FontSize.base,
    fontWeight: '400',
  },
  todayButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...getMinTouchTargetStyle(),
  },
  todayButtonText: {
    color: Colors.light.textInverse,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  // Card styles
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  cloneButton: {
    // Transparent background - icon sits directly on card background
    backgroundColor: 'transparent',
    // Proper touch target via padding (icon is 20px, so padding ensures 44x44 minimum)
    padding: (44 - 20) / 2, // (minTouchTarget - iconSize) / 2 = 12px padding
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  quickAddHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.none,
  },
  previousDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: (44 - 16) / 2, // Ensure minimum touch target
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  previousDayButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  summary: {
    fontSize: FontSize.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadingIndicator: {
    marginVertical: Spacing.sm,
  },
  // Day Summary body wrapper - cancels SurfaceCard padding and applies tighter inset
  daySummaryBody: {
    marginHorizontal: -Spacing.xl, // Cancel SurfaceCard horizontal padding (SurfaceCard uses lg)
    paddingHorizontal: DAY_SUMMARY_CONTENT_INSET,
  },
  // Category separator between cardio_mind_body and strength sections
  categorySeparator: {
    borderTopWidth: 2,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  // Exercise list styles
  exerciseList: {
    marginTop: Spacing.none,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  exerciseRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseRowLeft: {
    flex: 1,
    marginRight: Spacing.sm,
    minWidth: 0,
    flexShrink: 1,
  },
  exerciseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    rowGap: Spacing.xs,
    columnGap: Spacing.sm,
  },
  exerciseName: {
    fontSize: FontSize.base,
    fontWeight: '400',
    marginBottom: Spacing.xs,
  },
  exerciseNotes: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.3,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flexShrink: 1,
  },
  repsIntensityChip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  repsIntensityText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  minutesBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  minutesBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  deleteButtonGhost: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    ...getMinTouchTargetStyle(),
  },
  // Quick Add chip styles
  chipSectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chipsScrollContainer: {
    // Max height for ~3 rows of chips:
    // Chip height: ~40px (padding + content)
    // Row spacing: 8px marginBottom
    // 3 rows: (40px * 3) + (8px * 2) = 136px, rounded to 140px with buffer
    // This is a layout constraint, not a spacing token, so hardcoded value is acceptable per guideline 8.1
    maxHeight: 140,
    marginBottom: Spacing.none,
    ...(Platform.OS === 'web' && {
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
  },
  chipsWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: Spacing.xs, // Small padding at bottom for better scroll feel
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...getMinTouchTargetStyle(),
  },
  customButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  // Clone edit mode styles
  selectAllRow: {
    borderBottomWidth: 1,
    paddingVertical: 0,
  },
  selectAllRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  selectAllText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerButtonsAlignRight: {
    marginRight: -Spacing.sm, // Nudge action icons right to align with row trash icons
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderColor: '#EF4444' + '40',
    ...getMinTouchTargetStyle(),
  },
  iconButtonInRow: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  selectAllActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  // Recent Days styles
  recentDaysCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
  },
  recentDaysTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  recentDaysList: {
    gap: 0,
  },
  recentDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  recentDayDate: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  recentDayStats: {
    fontSize: FontSize.gaugeLabelMd,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...getMinTouchTargetStyle(),
  },
  modalBody: {
    gap: Spacing.lg,
  },
  settingsRow: {
    marginBottom: Spacing.md,
  },
  settingDescription: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...getMinTouchTargetStyle(),
  },
  optionText: {
    fontSize: FontSize.base,
  },
  dropdownContainer: {
    marginTop: Spacing.xs,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...getMinTouchTargetStyle(),
  },
  dropdownText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  formScrollView: {
    flex: 1,
  },
  formContent: {
    gap: Spacing.lg,
  },
  formLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  formInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
  },
  formTextArea: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
    // minHeight: 100 - reasonable minimum for multiline textarea (4 lines at ~25px line height)
    // This is a layout constraint, not a spacing token, so hardcoded value is acceptable per guideline 8.1
    minHeight: 100,
  },
  formHelper: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  categorySelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  categoryOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  categoryOptionText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  formButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  formButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set inline
  },
  saveButtonText: {
    fontWeight: '600',
  },
  // Delete confirmation modal styles
  confirmModalContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    margin: Spacing.lg,
    maxWidth: 400,
    width: '90%',
    ...Shadows.lg,
  },
  confirmModalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  confirmModalMessage: {
    fontSize: FontSize.base,
    marginBottom: Spacing['2xl'],
    lineHeight: FontSize.base * 1.5,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  confirmModalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  deleteConfirmButton: {
    // backgroundColor set inline
  },
});
