import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { useUserConfig } from '@/hooks/use-user-config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius, Layout, FontSize, FontWeight } from '@/constants/theme';
import { kgToLb, lbToKg, roundTo1, roundTo3 } from '@/utils/bodyMetrics';
import { useSaveWeightEntry, useWeightLogs366d, getLatestBodyFatEntry, getLatestWeightEntry } from '@/hooks/use-weight-logs';
import { useDeleteWeightLog } from '@/hooks/useDeleteWeightLog';
import { validateBodyFatPercent, validateWeightKg } from '@/utils/validation';
import { PROFILES } from '@/constants/constraints';
import { showAppToast } from '@/components/ui/app-toast';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
// @ts-ignore - native picker types are supplied by the package at runtime
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatLocalTime } from '@/utils/dateTime';
import { useAuth } from '@/contexts/AuthContext';
import { useClampedDateParam } from '@/hooks/use-clamped-date-param';
import i18n from '@/i18n';
import { clampDateKey, compareDateKeys, dateKeyToLocalStartOfDay, minDateKey as minDateKeyOf } from '@/lib/date-guard';
import { toDateKey } from '@/utils/dateKey';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { SemanticColors } from '@/constants/theme';

type WeightUnit = 'kg' | 'lbs';

export default function WeightEntryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  const { user } = useAuth();
  const userId = user?.id;
  const {
    date: dateParam,
    weightLb: weightLbParam,
    bodyFatPercent: bodyFatParam,
    entryId: entryIdParam,
    weighedAt: weighedAtParam,
    mode: modeParam,
    returnTo: returnToParam,
    returnDate: returnDateParam,
    fromDate: fromDateParam,
  } =
    useLocalSearchParams<{
      date?: string;
      weightLb?: string;
      bodyFatPercent?: string;
      entryId?: string;
      weighedAt?: string;
      mode?: EntryMode;
      returnTo?: 'day';
      returnDate?: string;
      fromDate?: string;
    }>();
  const { dateKey: clampedRouteDateKey, minDate, minDateKey, today, todayKey } = useClampedDateParam({ paramKey: 'date' });
  const weight366Query = useWeightLogs366d();
  const deleteMutation = useDeleteWeightLog(userId ?? '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialDate = useMemo(() => {
    if (dateParam && typeof dateParam === 'string') {
      const parsed = new Date(`${clampedRouteDateKey}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [clampedRouteDateKey, dateParam]);

  const preferredUnit: WeightUnit = profile?.weight_unit === 'kg' ? 'kg' : 'lbs';
const isWeb = Platform.OS === 'web';
type EntryMode = 'add_today' | 'add_for_date' | undefined;
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const editingEntryId = entryIdParam && typeof entryIdParam === 'string' ? entryIdParam : null;
  const isEditMode = Boolean(editingEntryId);
const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    if (weighedAtParam && typeof weighedAtParam === 'string') {
      const parsed = new Date(weighedAtParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const now = new Date();
    const base = new Date(initialDate);
    base.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return base;
  });
const [webTimeInput, setWebTimeInput] = useState(formatTimeInputValue(new Date()));
  const editingEntryFromCache = useMemo(
    () =>
      editingEntryId && weight366Query.data
        ? weight366Query.data.find((e) => e.id === editingEntryId)
        : null,
    [editingEntryId, weight366Query.data]
  );

  const editingEntryDateKey = useMemo(() => {
    if (!isEditMode) return null;
    const ts =
      (weighedAtParam && typeof weighedAtParam === 'string' ? weighedAtParam : null) ??
      (editingEntryFromCache?.weighed_at ?? null);
    if (!ts) return null;
    return toDateKey(ts);
  }, [editingEntryFromCache?.weighed_at, isEditMode, weighedAtParam]);

  const isLegacyPreSignupEntry = useMemo(() => {
    if (!isEditMode || !editingEntryDateKey) return false;
    return compareDateKeys(editingEntryDateKey, minDateKey) < 0;
  }, [editingEntryDateKey, isEditMode, minDateKey]);

  // For legacy pre-signup entries: allow keeping/editing that existing day, but do not allow selecting *other*
  // pre-signup days. We accomplish this by:
  // - Setting the picker minimum to the entry's day (so the calendar can show/select it)
  // - Clamping any other selection < signup min up to signup min
  const effectiveMinDateKey = useMemo(() => {
    if (isEditMode && editingEntryDateKey) return minDateKeyOf(minDateKey, editingEntryDateKey);
    return minDateKey;
  }, [editingEntryDateKey, isEditMode, minDateKey]);

  const effectiveMinDate = useMemo(() => dateKeyToLocalStartOfDay(effectiveMinDateKey), [effectiveMinDateKey]);

  const saveMutation = useSaveWeightEntry();
  const returnToDay = returnToParam === 'day';
  const returnDateKey = useMemo(() => {
    if (!returnToDay || !returnDateParam || typeof returnDateParam !== 'string') return null;
    return clampDateKey(toDateKey(returnDateParam), minDateKey, todayKey);
  }, [minDateKey, returnDateParam, returnToDay, todayKey]);
  const returnFromDateKey = useMemo(() => {
    if (!returnToDay || !fromDateParam || typeof fromDateParam !== 'string') return null;
    return clampDateKey(toDateKey(fromDateParam), minDateKey, todayKey);
  }, [fromDateParam, minDateKey, returnToDay, todayKey]);

  const navigateAfterDone = useCallback(() => {
    if (returnToDay && returnDateKey) {
      router.replace({
        pathname: '/weight/day',
        params: {
          date: returnDateKey,
          ...(returnFromDateKey ? { fromDate: returnFromDateKey } : {}),
        },
      } as any);
      return;
    }
    router.replace('/weight' as any);
  }, [returnDateKey, returnFromDateKey, returnToDay, router]);

  const handleClose = () => {
    navigateAfterDone();
  };

  const handleHeaderBack = useCallback(() => {
    // When opened from Day Weight, mimic Cancel behavior exactly (never rely on browser history).
    if (returnToDay) {
      navigateAfterDone();
      return;
    }

    // Match StandardSubheader's default behavior, but prefer /weight as the deep-link fallback.
    // @ts-ignore - canGoBack exists on navigation but types can vary
    const canGoBack = typeof (navigation as any)?.canGoBack === 'function'
      ? (navigation as any).canGoBack()
      : false;

    if (canGoBack) {
      router.back();
      return;
    }

    navigateAfterDone();
  }, [navigateAfterDone, navigation, returnToDay, router]);

  // Prefill / sync with params (edit mode only)
  useEffect(() => {
    if (!isEditMode) return;
    const unit: WeightUnit = profile?.weight_unit === 'kg' ? 'kg' : 'lbs';

    if (weightLbParam && !isNaN(parseFloat(weightLbParam))) {
      const lbValue = parseFloat(weightLbParam);
      if (unit === 'kg') {
        setWeightKg(roundTo1(lbToKg(lbValue)).toString());
        setWeightLb('');
      } else {
        setWeightLb(roundTo1(lbValue).toString());
        setWeightKg('');
      }
    }

    if (bodyFatParam && !isNaN(parseFloat(bodyFatParam))) {
      setBodyFat(roundTo1(parseFloat(bodyFatParam)).toString());
    }
  }, [isEditMode, profile?.weight_unit, weightLbParam, bodyFatParam]);

  // Keep selected date in sync with URL param changes
  useEffect(() => {
    setSelectedDate(initialDate);
    setSelectedDateTime((prev) => {
      const next = new Date(initialDate);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      return next;
    });
  }, [initialDate]);

  // Edit mode: ensure date/time reflect the record's weighed_at (not "now")
  useEffect(() => {
    if (!isEditMode) return;
    const ts = weighedAtParam && typeof weighedAtParam === 'string' ? weighedAtParam : editingEntryFromCache?.weighed_at;
    if (!ts) return;
    const parsed = new Date(ts);
    if (isNaN(parsed.getTime())) return;
    const dateOnly = new Date(parsed);
    dateOnly.setHours(0, 0, 0, 0);
    setSelectedDate(dateOnly);
    setSelectedDateTime(parsed);
    setWebTimeInput(formatTimeInputValue(parsed));
  }, [isEditMode, weighedAtParam, editingEntryFromCache?.weighed_at]);

  const latestEntry = weight366Query.data ? getLatestWeightEntry(weight366Query.data) : null;
  const latestBodyFatEntry = weight366Query.data ? getLatestBodyFatEntry(weight366Query.data) : null;

  // Add mode: refresh defaults on focus based on navigation mode
  useFocusEffect(
    useCallback(() => {
      if (isEditMode) return;
      const mode: EntryMode = modeParam === 'add_for_date' ? 'add_for_date' : 'add_today';
      const now = new Date();
      const unit: WeightUnit = profile?.weight_unit === 'kg' ? 'kg' : 'lbs';

      if (mode === 'add_for_date' && dateParam && typeof dateParam === 'string') {
        // Prefill date from param, time = now, fields empty
        const target = new Date(`${clampedRouteDateKey}T00:00:00`);
        if (!isNaN(target.getTime())) {
          setSelectedDate(target);
          const dateTime = new Date(target);
          dateTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
          setSelectedDateTime(dateTime);
          setWebTimeInput(formatTimeInputValue(dateTime));
        }
        setWeightKg('');
        setWeightLb('');
        setBodyFat('');
        setError(null);
        return;
      }

      // Default add_today behavior: latest values, date=today, time=now
      const latestWeightLb = latestEntry?.weight_lb ?? null;
      const latestBodyFatVal = latestBodyFatEntry?.body_fat_percent ?? null;

      if (unit === 'kg') {
        setWeightKg(latestWeightLb !== null ? roundTo1(lbToKg(latestWeightLb)).toString() : '');
        setWeightLb('');
      } else {
        setWeightLb(latestWeightLb !== null ? roundTo1(latestWeightLb).toString() : '');
        setWeightKg('');
      }

      setBodyFat(
        latestBodyFatVal !== null && latestBodyFatVal !== undefined
          ? roundTo1(latestBodyFatVal).toString()
          : ''
      );

      const dateOnly = new Date(now);
      dateOnly.setHours(0, 0, 0, 0);
      setSelectedDate(dateOnly);
      setSelectedDateTime(now);
      setWebTimeInput(formatTimeInputValue(now));
      setError(null);
    }, [isEditMode, modeParam, dateParam, clampedRouteDateKey, profile?.weight_unit, latestEntry?.weighed_at, latestBodyFatEntry?.weighed_at])
  );

  const isToday = isSameDay(selectedDate, new Date());
  const formattedDate = formatDateLabel(selectedDate);
  const formattedTime = formatTimeLabel(selectedDateTime);
  const unit: WeightUnit = preferredUnit;

  const handleSave = async () => {
    setError(null);

    const weightInput = unit === 'kg' ? weightKg : weightLb;
    const weightValue = parseFloat(weightInput);
    const weightKgValue = unit === 'kg' ? weightValue : lbToKg(weightValue);

    const weightErrorKey = validateWeightKg(weightKgValue);
    if (weightErrorKey) {
      const weightRangeMessage = `Weight must be between ${PROFILES.WEIGHT_LB.MIN} and ${PROFILES.WEIGHT_LB.MAX} lb.`;
      const message =
        weightErrorKey === 'onboarding.current_weight.error_weight_required'
          ? 'Please enter a valid weight.'
          : weightRangeMessage;
      setError(message);
      return;
    }

    const bodyFatValue = bodyFat.trim().length > 0 ? parseFloat(bodyFat) : null;
    const bodyFatError = validateBodyFatPercent(bodyFatValue);
    if (bodyFatError) {
      setError(bodyFatError);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    const selectedKey = toDateKey(selected);
    if (compareDateKeys(selectedKey, todayKey) > 0) {
      setError('Date cannot be in the future.');
      return;
    }
    const isAllowedLegacyDay =
      isLegacyPreSignupEntry && editingEntryDateKey && selectedKey === editingEntryDateKey;
    if (compareDateKeys(selectedKey, minDateKey) < 0 && !isAllowedLegacyDay) {
      const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
      const display = minDate.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setError(i18n.t('date_guard.tracking_starts_on', { date: display }));
      return;
    }

    const weighedAt = new Date(selectedDateTime);

    const weightLbValue = unit === 'kg' ? kgToLb(weightKgValue) : weightValue;

    try {
      const previousWeighedAtISO =
        (weighedAtParam && typeof weighedAtParam === 'string' ? weighedAtParam : null) ??
        (editingEntryFromCache?.weighed_at ?? null);

      await saveMutation.mutateAsync({
        entryId: editingEntryId ?? undefined,
        weighedAt,
        weightLb: roundTo3(weightLbValue),
        bodyFatPercent: bodyFatValue,
        previousWeighedAtISO,
      });
      showAppToast('Saved');
      navigateAfterDone();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong while saving.');
    }
  };

  const confirmAndDelete = () => {
    if (!editingEntryId) return;
    if (!userId) {
      setError('User not authenticated');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (!editingEntryId || !userId) return;
    
    // Close modal immediately
    setShowDeleteConfirm(false);
    
    // Show deleting toast
    showAppToast(i18n.t('mealtype_log.delete_entry.deleting'));
    
    const weighedAtISO =
      (weighedAtParam && typeof weighedAtParam === 'string' ? weighedAtParam : null) ??
      (editingEntryFromCache?.weighed_at ?? null);

    deleteMutation.mutate({ id: editingEntryId, weighedAtISO }, {
      onSuccess: () => {
        showAppToast(i18n.t('mealtype_log.delete_entry.deleted'));
        navigateAfterDone();
      },
      onError: (err: any) => {
        setError(err?.message || 'Failed to delete entry.');
      },
    });
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <StandardSubheader
        title={isEditMode ? 'Edit Weight' : 'Add Weight'}
        onBack={handleHeaderBack}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Layout.screenPadding * 2 }]}
        keyboardShouldPersistTaps="handled"
      >
        <DesktopPageContainer>
          <View style={{ height: Spacing.lg }} />

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.dateRow}>
              <View>
                <ThemedText style={[styles.dateLabel, { color: colors.textSecondary }]}>
                  {isToday ? 'Today' : 'Selected date'}
                </ThemedText>
                <ThemedText type="subtitle" style={{ color: colors.text }}>
                  {formattedDate}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[styles.changeDateButton, { borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
                {...getButtonAccessibilityProps('Change date')}
              >
                <IconSymbol name="calendar" size={16} color={colors.text} />
                <ThemedText style={{ color: colors.text }}>Change</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.timeRow}>
              <View style={{ gap: Spacing.xs }}>
                <ThemedText style={[styles.dateLabel, { color: colors.textSecondary }]}>
                  Time*
                </ThemedText>
            <TouchableOpacity
              style={[styles.timeField, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => {
                if (isWeb) {
                  setWebTimeInput(formatTimeInputValue(selectedDateTime));
                }
                setShowTimePicker(true);
              }}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps('Change time')}
            >
                  <ThemedText style={{ color: colors.text, fontSize: FontSize.md, fontWeight: '600' }}>
                    {formattedTime}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ gap: Spacing.xs }}>
              <ThemedText style={[styles.label, { color: colors.text }]}>Weight *</ThemedText>
              <View style={styles.inputWrapper}>
                {unit === 'kg' ? (
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: error && !weightKg ? colors.error : colors.border,
                        color: colors.text,
                        backgroundColor: colors.background,
                      },
                      Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
                    ]}
                    placeholder="Enter weight (kg)"
                    placeholderTextColor={colors.textSecondary}
                    value={weightKg}
                    autoFocus
                    onChangeText={(text) => {
                      setWeightKg(limitWeightInput(text));
                      setError(null);
                    }}
                    keyboardType="numeric"
                    editable={!saveMutation.isPending}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                    {...(getInputAccessibilityProps(
                      'Weight in kilograms',
                      'Enter your weight in kilograms',
                      error && !weightKg ? error : undefined,
                      true
                    ) as any)}
                  />
                ) : (
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: error && !weightLb ? colors.error : colors.border,
                        color: colors.text,
                        backgroundColor: colors.background,
                      },
                      Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
                    ]}
                    placeholder="Enter weight (lbs)"
                    placeholderTextColor={colors.textSecondary}
                    value={weightLb}
                    autoFocus
                    onChangeText={(text) => {
                      setWeightLb(limitWeightInput(text));
                      setError(null);
                    }}
                    keyboardType="numeric"
                    editable={!saveMutation.isPending}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                    {...(getInputAccessibilityProps(
                      'Weight in pounds',
                      'Enter your weight in pounds',
                      error && !weightLb ? error : undefined,
                      true
                    ) as any)}
                  />
                )}
                <ThemedText style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>
                  {unit === 'kg' ? 'kg' : 'lbs'}
                </ThemedText>
              </View>

              <View style={{ gap: Spacing.xs }}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Body Fat % (Optional)</ThemedText>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor:
                          error && bodyFat
                            ? colors.error
                            : colors.border,
                        color: colors.text,
                        backgroundColor: colors.background,
                      },
                      Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
                    ]}
                    placeholder="Optional (e.g., 18.5)"
                    placeholderTextColor={colors.textSecondary}
                    value={bodyFat}
                    onChangeText={(text) => {
                      setBodyFat(limitBodyFatInput(text));
                      setError(null);
                    }}
                    keyboardType="numeric"
                    maxLength={4}
                    editable={!saveMutation.isPending}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                    {...(getInputAccessibilityProps('Body fat percent', 'Enter body fat percent') as any)}
                  />
                  <ThemedText style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>
                    %
                  </ThemedText>
                </View>
                {/* Helper text removed per request */}
              </View>
            </View>

            {error && (
              <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
            )}

            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                onPress={handleClose}
                disabled={saveMutation.isPending}
                {...getButtonAccessibilityProps('Cancel')}
              >
                <ThemedText style={[styles.cancelButtonText, { color: colors.text }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>

              {isEditMode && (
                <Pressable
                  onPress={confirmAndDelete}
                  disabled={deleteMutation.isPending}
                  style={[
                    styles.deleteButton,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: BorderRadius.full,
                      paddingVertical: Spacing.md,
                      paddingHorizontal: Spacing.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    deleteMutation.isPending && { opacity: 0.6 },
                  ]}
                  {...getButtonAccessibilityProps('Delete weight entry')}
                >
                  <IconSymbol name="trash.fill" size={18} color={colors.error} decorative />
                </Pressable>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: colors.tint,
                    opacity: saveMutation.isPending ? 0.7 : 1,
                  },
                ]}
                onPress={handleSave}
                disabled={saveMutation.isPending}
                {...getButtonAccessibilityProps(isEditMode ? 'Save weight changes' : 'Save weight entry')}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                    Save
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </DesktopPageContainer>
      </ScrollView>

      <AppDatePicker
        visible={showDatePicker}
        value={selectedDate}
        minimumDate={effectiveMinDate}
        maximumDate={today}
        showTodayButton={true}
        onChange={(date) => {
          const requestedKey = toDateKey(date);
          let nextKey = clampDateKey(requestedKey, effectiveMinDateKey, todayKey);

          // Legacy pre-signup entry rule: if user tries to move it to a different pre-signup day,
          // snap to the signup minimum (so we don't allow creating additional pre-signup dates).
          if (
            isLegacyPreSignupEntry &&
            editingEntryDateKey &&
            compareDateKeys(nextKey, minDateKey) < 0 &&
            nextKey !== editingEntryDateKey
          ) {
            nextKey = minDateKey;
          }

          const nextDate = dateKeyToLocalStartOfDay(nextKey);
          setSelectedDate(nextDate);
          setSelectedDateTime((prev) => {
            const next = new Date(nextDate);
            next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
            return next;
          });
        }}
        onClose={() => setShowDatePicker(false)}
        title="Select date"
        accentColor={colors.tint}
      />

      {showTimePicker && !isWeb && (
        <DateTimePicker
          value={selectedDateTime}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'android' ? 'default' : 'spinner'}
          onChange={(event: any, date?: Date) => {
            if (Platform.OS === 'android') {
              setShowTimePicker(false);
            }
            if (date) {
              setSelectedDateTime((prev) => {
                const next = new Date(prev);
                next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                return next;
              });
            }
          }}
          style={{ backgroundColor: colors.card }}
        />
      )}
      {showTimePicker && isWeb && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowTimePicker(false)}>
          <Pressable style={[styles.modalOverlay]} onPress={() => setShowTimePicker(false)}>
            <Pressable style={[styles.webTimeModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
              <ThemedText type="subtitle" style={{ color: colors.text, marginBottom: Spacing.sm }}>
                Choose time
              </ThemedText>
              <input
                type="time"
                value={webTimeInput}
                onChange={(e: any) => setWebTimeInput(e.target.value)}
                style={{
                  padding: 8,
                  fontSize: 16,
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: BorderRadius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                }}
              />
              <View style={styles.webTimeButtons}>
                <TouchableOpacity
                  style={[styles.webTimeCancel, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => setShowTimePicker(false)}
                >
                  <ThemedText style={{ color: colors.text }}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.webTimeSave, { backgroundColor: colors.tint }]}
                  onPress={() => {
                    const next = applyWebTimeValue(selectedDateTime, webTimeInput);
                    if (next) {
                      setSelectedDateTime(next);
                    }
                    setShowTimePicker(false);
                  }}
                >
                  <ThemedText style={{ color: colors.textInverse, fontWeight: '600' }}>Set</ThemedText>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <ConfirmModal
        visible={showDeleteConfirm}
        title={i18n.t('mealtype_log.delete_entry.title_question')}
        message={i18n.t('mealtype_log.delete_entry.message_cannot_undo')}
        confirmText={i18n.t('mealtype_log.delete_entry.confirm')}
        cancelText={i18n.t('mealtype_log.delete_entry.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmButtonStyle={{ backgroundColor: SemanticColors.error }}
        confirmDisabled={deleteMutation.isPending}
      />
    </ThemedView>
  );
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateLabel(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const baseLabel = normalized.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (normalized.getTime() === today.getTime()) {
    return `Today · ${baseLabel}`;
  }
  if (normalized.getTime() === yesterday.getTime()) {
    return `Yesterday · ${baseLabel}`;
  }
  return baseLabel;
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeInputValue(date: Date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function applyWebTimeValue(baseDate: Date, value: string) {
  if (!value || !value.includes(':')) return null;
  const [hoursStr, minutesStr] = value.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const next = new Date(baseDate);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function limitToOneDecimal(text: string): string {
  const filtered = text.replace(/[^0-9.]/g, '');
  const parts = filtered.split('.');
  if (parts.length <= 1) return filtered;
  return `${parts[0]}.${parts[1].slice(0, 1)}`;
}

function limitWeightInput(text: string): string {
  const oneDecimal = limitToOneDecimal(text);
  const [intPart, decPart] = oneDecimal.split('.');
  const limitedInt = intPart.slice(0, 3);
  return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
}

function limitBodyFatInput(text: string): string {
  const oneDecimal = limitToOneDecimal(text);
  const [intPart, decPart] = oneDecimal.split('.');
  const limitedInt = intPart.slice(0, 2);
  return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Layout.screenPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...getMinTouchTargetStyle(),
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  timeRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  timeField: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...getMinTouchTargetStyle(),
  },
  changeDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    ...getMinTouchTargetStyle(),
  },
  inputWrapper: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
    paddingVertical: Spacing.sm,
  },
  inputUnitLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  helperText: {
    fontSize: FontSize.xs,
  },
  errorText: {
    fontSize: FontSize.sm,
  },
  saveButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  saveButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  cancelButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  webTimeModal: {
    width: 320,
    maxWidth: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  webTimeButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  webTimeCancel: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  webTimeSave: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  deleteButton: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  deleteButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});


