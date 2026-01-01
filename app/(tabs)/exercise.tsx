import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, TextInput, Alert, Animated, Dimensions, ViewStyle } from 'react-native';
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
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, Shadows, Layout, FontSize, ModuleThemes } from '@/constants/theme';
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

// Static default exercises with icons and i18n keys
const DEFAULT_EXERCISES: Array<{ i18nKey: string; icon: string }> = [
  { i18nKey: 'exercise.quick_add.common_exercises_list.walking', icon: 'figure.walk' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.running', icon: 'figure.run' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.jogging', icon: 'figure.run.circle' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.gym_workout', icon: 'dumbbell.fill' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.cycling', icon: 'bicycle' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.swimming', icon: 'figure.pool.swim' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.yoga', icon: 'figure.yoga' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.stretching', icon: 'figure.flexibility' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.hiit', icon: 'bolt.fill' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.barbell_row', icon: 'figure.barbell' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.bench_press', icon: 'figure.barbell' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.biceps', icon: 'figure.arms.open' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.chest', icon: 'figure.chest' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.deadlift', icon: 'figure.strengthtraining.traditional' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.lat_pulldown', icon: 'arrow.down.circle.fill' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.overhead_press', icon: 'arrow.up.circle.fill' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.squat', icon: 'figure.strengthtraining.traditional' },
  { i18nKey: 'exercise.quick_add.common_exercises_list.triceps', icon: 'figure.arms.open' },
];

// Presentational component for exercise row
type ExerciseRowProps = {
  log: { id: string; name: string; minutes: number | null; notes: string | null };
  colors: typeof Colors.light;
  onEdit: () => void;
  onDelete: () => void;
  onMinutesUpdate: (logId: string, minutes: number | null) => void;
  isLast: boolean;
  animationValue?: Animated.Value;
};

function ExerciseRow({ log, colors, onEdit, onDelete, onMinutesUpdate, isLast, animationValue, disabled = false }: ExerciseRowProps) {
  const [deleteHovered, setDeleteHovered] = useState(false);
  
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
            <ThemedText style={[styles.exerciseName, { color: colors.text }]}>
              {log.name}
            </ThemedText>
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

        {/* Right side: Minutes badge and Delete button */}
        <View style={styles.exerciseRowRight}>
          <InlineEditableNumberChip
            value={log.minutes}
            onCommit={(next) => onMinutesUpdate(log.id, next)}
            unitSuffix="min"
            placeholder="Add min"
            min={RANGES.EXERCISE_MINUTES.MIN}
            max={RANGES.EXERCISE_MINUTES.MAX}
            allowNull
            disabled={disabled}
            colors={colors}
            badgeBackgroundColor={colors.infoLight}
            badgeBorderColor={colors.info}
            badgeTextColor={colors.info}
            accessibilityLabel="Edit minutes"
            commitOnBlur
          />

          {/* Delete button */}
          <TouchableOpacity
            onPress={onDelete}
            disabled={disabled}
            style={[
              styles.deleteButtonGhost,
              {
                borderColor: colors.separator,
                backgroundColor: deleteHovered ? colors.errorLight : 'transparent',
                opacity: disabled ? 0.4 : 1,
              },
            ]}
            activeOpacity={0.7}
            onPressIn={() => setDeleteHovered(true)}
            onPressOut={() => setDeleteHovered(false)}
            {...(Platform.OS === 'web' && {
              onMouseEnter: () => setDeleteHovered(true),
              onMouseLeave: () => setDeleteHovered(false),
            })}
            {...getButtonAccessibilityProps('Delete exercise')}
          >
            <IconSymbol name="trash.fill" size={16} color={colors.error} />
          </TouchableOpacity>
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
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth >= 768;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });

    return () => subscription?.remove();
  }, []);

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

  // Format date for display with full weekday (used in Recent Days section)
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
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Data fetching hooks
  const { data: exerciseLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useExerciseLogsForDate(selectedDateString);
  const { data: recentDaysSummary = [] } = useExerciseSummaryForRecentDays(7);
  const { data: recentAndFrequentExercises = [], isLoading: isLoadingRecentFrequent } = useRecentAndFrequentExercises(RecentFrequentDayRange);

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
  const [editingLog, setEditingLog] = useState<{ id: string; name: string; minutes: number | null; notes: string | null } | null>(null);
  const [formName, setFormName] = useState('');
  const [formMinutes, setFormMinutes] = useState('');
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
  
  // Initialize all entries as selected when entering edit mode
  useEffect(() => {
    if (editMode && exerciseLogs.length > 0) {
      selectAllEntries(exerciseLogs, (log) => log.id);
    } else if (!editMode) {
      clearEntrySelection();
    }
  }, [editMode]); // Only trigger when edit mode changes
  
  // Reset selection when entries change while in edit mode
  useEffect(() => {
    if (editMode && exerciseLogs.length > 0) {
      selectAllEntries(exerciseLogs, (log) => log.id);
    }
  }, [exerciseLogs.length]); // Only depend on length to avoid re-running on every render
  
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

  // Calculate totals for selected date
  const totalMinutes = exerciseLogs.reduce((sum, log) => sum + (log.minutes || 0), 0);
  const activityCount = exerciseLogs.length;

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
  const chipTextStyle = { fontSize: FontSize.base + 2 };
  const handleQuickAdd = useCallback((name: string, minutes: number | null) => {
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
    setFormNotes('');
    setShowCustomForm(true);
  };

  const openEditForm = (log: { id: string; name: string; minutes: number | null; notes: string | null }) => {
    setEditingLog(log);
    setFormName(log.name);
    setFormMinutes(log.minutes?.toString() || '');
    setFormNotes(log.notes || '');
    setShowCustomForm(true);
  };

  const closeCustomForm = () => {
    setShowCustomForm(false);
    setEditingLog(null);
    setFormName('');
    setFormMinutes('');
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

  const handleSaveExercise = () => {
    // Prevent multiple submissions
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }

    const name = formName.trim();
    const minutesValue = formMinutes.trim();
    const minutes = minutesValue ? parseInt(minutesValue, 10) : null;
    const notes = formNotes.trim() || null;

    // Validation
    if (!name) {
      Alert.alert(t('exercise.form.name_required'));
      return;
    }

    if (name.length > TEXT_LIMITS.EXERCISE_NAME_MAX_LEN) {
      Alert.alert(t('exercise.form.name_max_length'));
      return;
    }

    // Validate minutes if provided
    if (minutesValue) {
      if (isNaN(minutes) || minutes === null) {
        Alert.alert(t('exercise.form.minutes_range'));
        return;
      }
      if (minutes < RANGES.EXERCISE_MINUTES.MIN || minutes > RANGES.EXERCISE_MINUTES.MAX) {
        Alert.alert(t('exercise.form.minutes_range'));
        return;
      }
    }

    if (notes && notes.length > TEXT_LIMITS.NOTES_MAX_LEN) {
      Alert.alert(t('exercise.form.notes_max_length'));
      return;
    }

    if (!user?.id) {
      Alert.alert(t('common.error'));
      return;
    }

    if (editingLog) {
      // Update existing
      updateMutation.mutate(
        {
          logId: editingLog.id,
          updates: { name, minutes, notes },
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
      // Create new
      createMutation.mutate(
        {
          user_id: user.id,
          date: selectedDateString,
          name,
          minutes,
          notes,
        },
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

  // Handle inline minutes update
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

  // Handle date selection from recent days
  const handleDateSelect = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      navigateWithDate(date);
    }
  };

  // Format recent days summary
  const formatRecentDay = (summary: { date: string; total_minutes: number; activity_count: number }) => {
    const date = new Date(summary.date + 'T00:00:00');
    const dayLabel = formatDateForDisplay(date);
    const minutes = summary.total_minutes;
    const count = summary.activity_count;

    if (count === 0) {
      return t('exercise.recent_days.format_no_exercises', { day: dayLabel });
    }

    return t('exercise.recent_days.format', {
      day: dayLabel,
      minutes,
      count,
      activities: count === 1 ? t('exercise.recent_days.activity_one') : t('exercise.recent_days.activity_other'),
    });
  };

  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // Recent and frequent exercises (already combined and limited to 10)
  const hasRecentFrequent = recentAndFrequentExercises.length > 0;

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
                subtitle={
                  !logsLoading && activityCount > 0
                    ? t('exercise.summary.total', {
                        minutes: totalMinutes,
                        count: activityCount,
                        activities: activityCount === 1 ? t('exercise.summary.activity_one') : t('exercise.summary.activity_other'),
                      })
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
                            {...(Platform.OS === 'web' && getFocusStyle('#EF4444'))}
                            {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.enter_edit_mode'))}
                          >
                            <IconSymbol name="trash.fill" size={20} color="#EF4444" />
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
                              backgroundColor: '#10B981' + '20',
                              borderColor: '#10B981' + '40',
                            },
                          ]}
                          activeOpacity={0.7}
                          {...(Platform.OS === 'web' && getFocusStyle('#10B981'))}
                          {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.exit_edit_mode'))}
                        >
                          <IconSymbol name="checkmark" size={20} color="#10B981" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                }
              />

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
                                { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', borderWidth: 1 },
                                !hasEntrySelection && { opacity: 0.5 },
                              ]}
                              activeOpacity={0.7}
                              {...(Platform.OS === 'web' && getFocusStyle('#EF4444'))}
                              {...getButtonAccessibilityProps(t('exercise.clone.edit_mode.delete_button'))}
                            >
                              <IconSymbol name="trash.fill" size={20} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </MultiSelectItem>
                    </View>
                  )}
                  
                  {exerciseLogs.map((log, index) => {
                    const rowContent = (
                      <HighlightableRow
                        key={log.id}
                        isNew={log.id === newEntryId}
                      >
                        <ExerciseRow
                          log={log}
                          colors={colors}
                          onEdit={() => {
                            if (!editMode) {
                              openEditForm({ id: log.id, name: log.name, minutes: log.minutes, notes: log.notes });
                            }
                          }}
                          onDelete={() => {
                            if (!editMode) {
                              handleDelete(log.id, log.name);
                            }
                          }}
                          onMinutesUpdate={handleMinutesUpdate}
                          isLast={index === exerciseLogs.length - 1}
                          animationValue={animationRefs.current.get(log.id)}
                          disabled={editMode}
                        />
                      </HighlightableRow>
                    );
                    
                    if (editMode) {
                      return (
                        <MultiSelectItem
                          key={log.id}
                          isSelected={isEntrySelected(log.id)}
                          onToggle={() => toggleEntrySelection(log.id)}
                        >
                          {rowContent}
                        </MultiSelectItem>
                      );
                    }
                    
                    return rowContent;
                  })}
                </View>
              )}
            </>
          )}
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
                const cachedPreviousDayLogs = queryClient.getQueryData<any[]>(previousDayQueryKey);
                
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
                {recentAndFrequentExercises.map((exercise, index) => {
                  const minutesText = exercise.minutes !== null && exercise.minutes !== undefined ? `${exercise.minutes} min` : null;
                  const chipKey = `${exercise.name}-${exercise.minutes}`;
                  return (
                    <QuickAddChip
                      key={`recent-${index}-${exercise.name}-${exercise.minutes}`}
                      label={exercise.name}
                      metadata={minutesText}
                      colors={colors}
                      textStyle={chipTextStyle}
                      onPress={() => handleQuickAdd(exercise.name, exercise.minutes)}
                      disabled={disabledChips.has(chipKey)}
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

          {/* Static Default Exercises */}
          <QuickAddHeading 
            labelKey="exercise.quick_add.common_exercises"
            module="exercise"
            icon="figure.run"
          />
          <ScrollView
            style={styles.chipsScrollContainer}
            contentContainerStyle={styles.chipsWrapContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {DEFAULT_EXERCISES.map((exercise) => {
              const translatedName = t(exercise.i18nKey);
              const chipKey = `${translatedName}-null`;
              return (
                <QuickAddChip
                  key={`default-${exercise.i18nKey}`}
                  label={translatedName}
                  colors={colors}
                  textStyle={chipTextStyle}
                  onPress={() => handleQuickAdd(translatedName, null)}
                  disabled={disabledChips.has(chipKey)}
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
                    {summary.total_minutes} min ({summary.activity_count} {summary.activity_count === 1 ? t('exercise.recent_days.activity_one') : t('exercise.recent_days.activity_other')})
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
                    placeholder={t('exercise.form.name_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    maxLength={TEXT_LIMITS.EXERCISE_NAME_MAX_LEN}
                    autoFocus
                  />
                </View>

                <View>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('exercise.form.minutes_label')}
                  </ThemedText>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={formMinutes}
                    onChangeText={handleMinutesChange}
                    placeholder={t('exercise.form.minutes_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={RANGES.EXERCISE_MINUTES.MAX.toString().length}
                  />
                  <ThemedText style={[styles.formHelper, { color: colors.textSecondary }]}>
                    {t('exercise.form.minutes_range')}
                  </ThemedText>
                </View>

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
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />
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
  },
  exerciseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  exerciseNotes: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.3,
  },
  minutesBadge: {
    paddingHorizontal: Spacing.md,
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
    fontSize: FontSize.base,
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
