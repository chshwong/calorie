import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, TextInput, Alert, Animated, Dimensions, ViewStyle } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DateHeader } from '@/components/date-header';
import { ModuleIdentityBar } from '@/components/module/module-identity-bar';
import { SurfaceCard } from '@/components/common/surface-card';
import { QuickAddHeading } from '@/components/common/quick-add-heading';
import { QuickAddChip } from '@/components/common/quick-add-chip';
import { ModuleFAB } from '@/components/module/module-fab';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Shadows, Layout, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import {
  useExerciseLogsForDate,
  useExerciseSummaryForRecentDays,
  useRecentAndFrequentExercises,
  useCreateExerciseLog,
  useUpdateExerciseLog,
  useDeleteExerciseLog,
} from '@/hooks/use-exercise-logs';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

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

function ExerciseRow({ log, colors, onEdit, onDelete, onMinutesUpdate, isLast, animationValue }: ExerciseRowProps) {
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [minutesInput, setMinutesInput] = useState(log.minutes?.toString() || '');
  const [minutesInputError, setMinutesInputError] = useState(false);
  const minutesInputRef = useRef<TextInput>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Handle minutes input change - only allow integers in range 0-999
  const handleMinutesInputChange = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    
    if (numericOnly === '') {
      setMinutesInput('');
      setMinutesInputError(false);
      return;
    }
    
    const numValue = parseInt(numericOnly, 10);
    
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 999) {
      setMinutesInput(numericOnly);
      setMinutesInputError(false);
    } else if (!isNaN(numValue) && numValue > 999) {
      setMinutesInput('999');
      setMinutesInputError(false);
    }
  };

  // Start inline editing for minutes
  const startEditingMinutes = () => {
    setIsEditingMinutes(true);
    setMinutesInput(log.minutes?.toString() || '');
    setMinutesInputError(false);
    
    // Animate in
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Focus input after animation
    setTimeout(() => {
      minutesInputRef.current?.focus();
    }, 100);
  };

  // Save minutes inline
  const saveMinutes = () => {
    const minutesValue = minutesInput.trim();
    const minutes = minutesValue ? parseInt(minutesValue, 10) : null;

    // Validate
    if (minutesValue && (isNaN(minutes!) || minutes! < 0 || minutes! > 999)) {
      setMinutesInputError(true);
      return;
    }

    // Animate out
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsEditingMinutes(false);
    });

    // Update if changed
    if (minutes !== log.minutes) {
      onMinutesUpdate(log.id, minutes);
    }
  };

  // Cancel inline editing
  const cancelMinutesEdit = () => {
    setMinutesInput(log.minutes?.toString() || '');
    setMinutesInputError(false);
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsEditingMinutes(false);
    });
  };
  
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
          style={[styles.exerciseRowContent, Platform.OS === 'web' && getFocusStyle(colors.tint)]}
          onPress={onEdit}
          activeOpacity={0.6}
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

        {/* Minutes badge or inline editor */}
        {isEditingMinutes ? (
          <Animated.View
            style={[
              styles.minutesEditorContainer,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <TextInput
              ref={minutesInputRef}
              style={[
                styles.minutesEditorInput,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: minutesInputError ? colors.error : colors.border,
                },
              ]}
              value={minutesInput}
              onChangeText={handleMinutesInputChange}
              onBlur={saveMinutes}
              onSubmitEditing={saveMinutes}
              keyboardType="number-pad"
              maxLength={3}
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={saveMinutes}
              style={[styles.minutesEditorButton, { backgroundColor: colors.tint, marginLeft: Spacing.xs }]}
              {...getButtonAccessibilityProps('Save minutes')}
            >
              <IconSymbol name="checkmark" size={14} color={colors.textInverse} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={cancelMinutesEdit}
              style={[styles.minutesEditorButton, { backgroundColor: colors.backgroundSecondary, marginLeft: Spacing.xs }]}
              {...getButtonAccessibilityProps('Cancel')}
            >
              <IconSymbol name="xmark" size={14} color={colors.text} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            onPress={startEditingMinutes}
            style={[styles.minutesBadge, { backgroundColor: colors.infoLight, borderColor: colors.info }]}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps('Edit minutes')}
          >
            <ThemedText style={[styles.minutesBadgeText, { color: colors.info }]}>
              {log.minutes !== null ? `${log.minutes} min` : 'Add min'}
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Delete button */}
        <TouchableOpacity
          onPress={onDelete}
          style={[
            styles.deleteButtonGhost,
            {
              borderColor: colors.separator,
              backgroundColor: deleteHovered ? colors.errorLight : 'transparent',
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
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
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
  const { data: recentAndFrequentExercises = [], isLoading: isLoadingRecentFrequent } = useRecentAndFrequentExercises(60);

  // Mutations
  const createMutation = useCreateExerciseLog();
  const updateMutation = useUpdateExerciseLog();
  const deleteMutation = useDeleteExerciseLog();

  // Animation refs for newly added rows
  const animationRefs = useRef<Map<string, Animated.Value>>(new Map());

  // Modal state for custom exercise form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingLog, setEditingLog] = useState<{ id: string; name: string; minutes: number | null; notes: string | null } | null>(null);
  const [formName, setFormName] = useState('');
  const [formMinutes, setFormMinutes] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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
  const handleQuickAdd = useCallback((name: string, minutes: number | null) => {
    if (!user?.id) return;

    createMutation.mutate({
      user_id: user.id,
      date: selectedDateString,
      name: name.trim(),
      minutes: minutes,
      notes: null,
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

  // Handle minutes input change - only allow integers in range 0-999
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
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 999) {
      setFormMinutes(numericOnly);
    }
    // If number is > 999, cap it at 999
    else if (!isNaN(numValue) && numValue > 999) {
      setFormMinutes('999');
    }
    // Otherwise, don't update (invalid input)
  };

  const handleSaveExercise = () => {
    const name = formName.trim();
    const minutesValue = formMinutes.trim();
    const minutes = minutesValue ? parseInt(minutesValue, 10) : null;
    const notes = formNotes.trim() || null;

    // Validation
    if (!name) {
      Alert.alert(t('exercise.form.name_required'));
      return;
    }

    if (name.length > 30) {
      Alert.alert(t('exercise.form.name_max_length'));
      return;
    }

    // Validate minutes if provided
    if (minutesValue) {
      if (isNaN(minutes) || minutes === null) {
        Alert.alert(t('exercise.form.minutes_range'));
        return;
      }
      if (minutes < 0 || minutes > 999) {
        Alert.alert(t('exercise.form.minutes_range'));
        return;
      }
    }

    if (notes && notes.length > 200) {
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
          onSuccess: () => {
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
        setDeleteTarget(null);
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
      setSelectedDate(date);
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

  // Background gradient colors
  const backgroundGradient = colorScheme === 'dark'
    ? { from: colors.background, to: colors.backgroundSecondary }
    : { from: colors.background, to: colors.backgroundSecondary };

  return (
    <ThemedView style={[styles.container, { backgroundColor: backgroundGradient.from }]}>
      {/* Subtle background gradient effect for web */}
      {Platform.OS === 'web' && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              background: `linear-gradient(to bottom, ${backgroundGradient.from}, ${backgroundGradient.to})`,
              pointerEvents: 'none',
            },
          ]}
        />
      )}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Layout.screenPadding + 80 }]}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>
          {/* Module Identity Bar */}
          <ModuleIdentityBar module="exercise" />

          {/* Date Header with Greeting and Navigation */}
          <DateHeader
          showGreeting={true}
          module="exercise"
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

        {/* Today's Exercise Section - Card */}
        <ExerciseSectionContainer>
          <SurfaceCard module="exercise">
          {/* Sticky header */}
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
              {isToday ? t('exercise.today_title') : formatDateForDisplay(selectedDate)}
            </ThemedText>
            {logsLoading ? (
              <ActivityIndicator size="small" color={colors.tint} style={styles.loadingIndicator} />
            ) : (
              activityCount > 0 && (
                <ThemedText style={[styles.summary, { color: colors.textSecondary }]}>
                  {t('exercise.summary.total', {
                    minutes: totalMinutes,
                    count: activityCount,
                    activities: activityCount === 1 ? t('exercise.summary.activity_one') : t('exercise.summary.activity_other'),
                  })}
                </ThemedText>
              )
            )}
          </View>

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
                  {exerciseLogs.map((log, index) => (
                    <ExerciseRow
                      key={log.id}
                      log={log}
                      colors={colors}
                      onEdit={() => openEditForm({ id: log.id, name: log.name, minutes: log.minutes, notes: log.notes })}
                      onDelete={() => handleDelete(log.id, log.name)}
                      onMinutesUpdate={handleMinutesUpdate}
                      isLast={index === exerciseLogs.length - 1}
                      animationValue={animationRefs.current.get(log.id)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
          </SurfaceCard>
        </ExerciseSectionContainer>

        {/* Quick Add Section - Card */}
        <ExerciseSectionContainer>
          <SurfaceCard module="exercise">
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
            {t('exercise.quick_add_title')}
          </ThemedText>

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
                  return (
                    <QuickAddChip
                      key={`recent-${index}-${exercise.name}-${exercise.minutes}`}
                      label={exercise.name}
                      metadata={minutesText}
                      colors={colors}
                      onPress={() => handleQuickAdd(exercise.name, exercise.minutes)}
                    />
                  );
                })}
              </ScrollView>
            </>
          )}

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
              return (
                <QuickAddChip
                  key={`default-${exercise.i18nKey}`}
                  label={translatedName}
                  icon={exercise.icon}
                  colors={colors}
                  onPress={() => handleQuickAdd(translatedName, null)}
                />
              );
            })}
          </ScrollView>

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
      </ScrollView>
      
      {/* Module-specific FAB */}
      <ModuleFAB module="exercise" icon="plus" />

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
                    maxLength={30}
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
                    maxLength={3}
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
                    maxLength={200}
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
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding
    }),
  },
  // Responsive container for exercise sections
  responsiveContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  responsiveContainerLarge: {
    maxWidth: 900,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing['2xl'],
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
  cardHeader: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.separator,
    // Sticky positioning for web (optional)
    ...(Platform.OS === 'web' && {
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }),
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
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
    marginTop: Spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
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
    marginLeft: Spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  minutesBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  // Inline minutes editor styles
  minutesEditorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  minutesEditorInput: {
    width: 50,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  minutesEditorButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  deleteButtonGhost: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
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
    marginBottom: Spacing.sm,
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
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...getMinTouchTargetStyle(),
  },
  customButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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
