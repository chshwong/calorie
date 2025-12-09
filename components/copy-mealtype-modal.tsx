/**
 * Copy Meal Type Modal Component
 * 
 * Modal for selecting a target date and meal type to copy entries to.
 * Extends CloneDayModal pattern with meal type selector.
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Platform, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MEAL_TYPE_ORDER } from '@/utils/types';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type CopyMealtypeModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (targetDate: Date, targetMealType: string, includeQuickLog: boolean, includeNotes: boolean) => void;
  sourceDate: Date;
  sourceMealType: string;
  isLoading?: boolean;
  title?: string;
  subtitle?: string;
  confirmButtonText?: string;
};

/**
 * Modal for copying meal type entries to another date and meal type
 */
export function CopyMealtypeModal({
  visible,
  onClose,
  onConfirm,
  sourceDate,
  sourceMealType,
  isLoading = false,
  title,
  subtitle,
  confirmButtonText,
}: CopyMealtypeModalProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Default target date to tomorrow
  const getDefaultTargetDate = () => {
    const tomorrow = new Date(sourceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const [targetDate, setTargetDate] = useState<Date>(getDefaultTargetDate());
  const [targetMealType, setTargetMealType] = useState<string>(sourceMealType);
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date(targetDate));
  const [includeQuickLog, setIncludeQuickLog] = useState<boolean>(false); // Default: "Exclude Quick Log"
  const [includeNotes, setIncludeNotes] = useState<boolean>(false); // Default: "Exclude Notes"

  // Update target date and meal type when modal opens
  useEffect(() => {
    if (visible) {
      const defaultDate = getDefaultTargetDate();
      setTargetDate(defaultDate);
      setTargetMealType(sourceMealType); // Default to same meal type
      setCalendarViewMonth(new Date(defaultDate));
      setIncludeQuickLog(false); // Reset to "Exclude Quick Log" (default)
      setIncludeNotes(false); // Reset to "Exclude Notes" (default)
    }
  }, [visible, sourceDate, sourceMealType]);

  // Calendar helper functions
  const generateCalendarDays = (viewMonth: Date) => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(day);
    }

    return days;
  };

  const handlePreviousMonth = () => {
    const newMonth = new Date(calendarViewMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCalendarViewMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(calendarViewMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCalendarViewMonth(newMonth);
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
    selectedDate.setHours(0, 0, 0, 0);
    setTargetDate(selectedDate);
  };

  const isSelectedInCalendar = (day: number, viewMonth: Date): boolean => {
    return (
      day === targetDate.getDate() &&
      viewMonth.getMonth() === targetDate.getMonth() &&
      viewMonth.getFullYear() === targetDate.getFullYear()
    );
  };

  const handleConfirm = () => {
    onConfirm(targetDate, targetMealType, includeQuickLog, includeNotes);
  };

  const formatDateLabel = (date: Date): string => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.background,
              paddingBottom: Platform.OS === 'web' ? Spacing.lg : insets.bottom + Spacing.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {title || t('food.copy.title', { defaultValue: 'Copy To' })}
              </ThemedText>
              {subtitle && (
                <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {subtitle}
                </ThemedText>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
              {...getButtonAccessibilityProps(t('common.close'))}
            >
              <IconSymbol name="xmark" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Meal Type Selector */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionLabel, { color: colors.text }]}>
                {t('food.copy.meal_type_label', { defaultValue: 'Meal Type' })}
              </ThemedText>
              <View style={styles.mealTypeSelector}>
                {MEAL_TYPE_ORDER.map((mealType) => {
                  const isSelected = mealType.toLowerCase() === targetMealType.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={mealType}
                      style={[
                        styles.mealTypeOption,
                        {
                          backgroundColor: isSelected ? colors.tintLight : colors.card,
                          borderColor: isSelected ? colors.tint : colors.border,
                        },
                      ]}
                      onPress={() => setTargetMealType(mealType)}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(t(`home.meal_types.${mealType}`))}
                    >
                      <ThemedText
                        style={[
                          styles.mealTypeOptionText,
                          { color: isSelected ? colors.tint : colors.text },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {t(`home.meal_types.${mealType}`)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Quick Log Radio Buttons */}
            <View style={styles.radioSection}>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  onPress={() => setIncludeQuickLog(false)}
                  activeOpacity={0.7}
                  style={styles.radioOption}
                  {...getButtonAccessibilityProps(
                    t('food.copy.exclude_quick_log', { defaultValue: 'Exclude Quick Log' })
                  )}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !includeQuickLog }}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: !includeQuickLog ? colors.tint : colors.border,
                      },
                    ]}
                  >
                    {!includeQuickLog && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: colors.tint },
                        ]}
                      />
                    )}
                  </View>
                  <ThemedText
                    style={[
                      styles.radioLabel,
                      {
                        color: !includeQuickLog ? colors.text : colors.textSecondary,
                        fontWeight: !includeQuickLog ? '600' : '400',
                      },
                    ]}
                  >
                    {t('food.copy.exclude_quick_log', { defaultValue: 'Exclude Quick Log' })}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIncludeQuickLog(true)}
                  activeOpacity={0.7}
                  style={styles.radioOption}
                  {...getButtonAccessibilityProps(
                    t('food.copy.override_quick_log', { defaultValue: 'Override Quick Log' })
                  )}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: includeQuickLog }}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: includeQuickLog ? colors.tint : colors.border,
                      },
                    ]}
                  >
                    {includeQuickLog && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: colors.tint },
                        ]}
                      />
                    )}
                  </View>
                  <ThemedText
                    style={[
                      styles.radioLabel,
                      {
                        color: includeQuickLog ? colors.text : colors.textSecondary,
                        fontWeight: includeQuickLog ? '600' : '400',
                      },
                    ]}
                  >
                    {t('food.copy.override_quick_log', { defaultValue: 'Override Quick Log' })}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notes Radio Buttons */}
            <View style={styles.radioSection}>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  onPress={() => setIncludeNotes(false)}
                  activeOpacity={0.7}
                  style={styles.radioOption}
                  {...getButtonAccessibilityProps(
                    t('food.copy.exclude_notes', { defaultValue: 'Exclude Notes' })
                  )}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !includeNotes }}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: !includeNotes ? colors.tint : colors.border,
                      },
                    ]}
                  >
                    {!includeNotes && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: colors.tint },
                        ]}
                      />
                    )}
                  </View>
                  <ThemedText
                    style={[
                      styles.radioLabel,
                      {
                        color: !includeNotes ? colors.text : colors.textSecondary,
                        fontWeight: !includeNotes ? '600' : '400',
                      },
                    ]}
                  >
                    {t('food.copy.exclude_notes', { defaultValue: 'Exclude Notes' })}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIncludeNotes(true)}
                  activeOpacity={0.7}
                  style={styles.radioOption}
                  {...getButtonAccessibilityProps(
                    t('food.copy.override_notes', { defaultValue: 'Override Notes' })
                  )}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: includeNotes }}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: includeNotes ? colors.tint : colors.border,
                      },
                    ]}
                  >
                    {includeNotes && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: colors.tint },
                        ]}
                      />
                    )}
                  </View>
                  <ThemedText
                    style={[
                      styles.radioLabel,
                      {
                        color: includeNotes ? colors.text : colors.textSecondary,
                        fontWeight: includeNotes ? '600' : '400',
                      },
                    ]}
                  >
                    {t('food.copy.override_notes', { defaultValue: 'Override Notes' })}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date Picker */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionLabel, { color: colors.text }]}>
                {t('food.copy.date_label', { defaultValue: 'Date' })}
              </ThemedText>
              <View style={styles.selectedDateDisplay}>
                <ThemedText style={[styles.selectedDateText, { color: colors.tint }]}>
                  {formatDateLabel(targetDate)}
                </ThemedText>
              </View>

              {/* Calendar Navigation */}
              <View style={styles.calendarNav}>
                <TouchableOpacity
                  onPress={handlePreviousMonth}
                  style={[
                    styles.calendarNavButton,
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(t('home.date_picker.previous_month'))}
                >
                  <ThemedText style={[styles.calendarNavArrow, { color: colors.text }]}>←</ThemedText>
                </TouchableOpacity>
                <ThemedText style={[styles.calendarMonthLabel, { color: colors.text }]}>
                  {calendarViewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </ThemedText>
                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={[
                    styles.calendarNavButton,
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(t('home.date_picker.next_month'))}
                >
                  <ThemedText style={[styles.calendarNavArrow, { color: colors.text }]}>→</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Days of Week Header */}
              <View style={styles.calendarWeekDays}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <View key={index} style={styles.calendarWeekDay}>
                    <ThemedText style={[styles.calendarWeekDayText, { color: colors.textSecondary }]}>
                      {day}
                    </ThemedText>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {generateCalendarDays(calendarViewMonth).map((day, index) => {
                  if (day === null) {
                    return <View key={`empty-${index}`} style={styles.calendarDay} />;
                  }

                  const isSelectedDay = isSelectedInCalendar(day, calendarViewMonth);
                  const dayDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
                  dayDate.setHours(0, 0, 0, 0);

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[
                        styles.calendarDay,
                        isSelectedDay && { backgroundColor: colors.tint },
                      ]}
                      onPress={() => handleDateSelect(day)}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(`Select ${day}`)}
                    >
                      <ThemedText
                        style={[
                          styles.calendarDayText,
                          { color: isSelectedDay ? '#fff' : colors.text },
                          isSelectedDay && styles.calendarDayTextSelected,
                        ]}
                      >
                        {day}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={[styles.modalFooter, { borderTopColor: colors.separator }]}>
            <TouchableOpacity
              style={[
                styles.footerButton,
                styles.cancelButton,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
                getMinTouchTargetStyle(),
                Platform.OS === 'web' && getFocusStyle(colors.tint),
              ]}
              onPress={onClose}
              disabled={isLoading}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('common.cancel'))}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.footerButton,
                styles.confirmButton,
                { backgroundColor: colors.tint },
                getMinTouchTargetStyle(),
                Platform.OS === 'web' && getFocusStyle('#fff'),
              ]}
              onPress={handleConfirm}
              disabled={isLoading}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(confirmButtonText || t('food.copy.confirm', { defaultValue: 'Copy' }))}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                  {confirmButtonText || t('food.copy.confirm', { defaultValue: 'Copy' })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
    paddingTop: Spacing.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...getMinTouchTargetStyle(),
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  mealTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.xs,
    justifyContent: 'space-between',
  },
  mealTypeOption: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...getMinTouchTargetStyle(),
  },
  mealTypeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  radioSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  radioContainer: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignItems: 'center',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...getMinTouchTargetStyle(),
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: FontSize.base,
    flex: 1,
  },
  selectedDateDisplay: {
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  selectedDateText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  calendarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  calendarNavButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  calendarNavArrow: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  calendarMonthLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  calendarWeekDayText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  calendarDayText: {
    fontSize: FontSize.base,
  },
  calendarDayTextSelected: {
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  footerButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    // backgroundColor set via style prop
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  confirmButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
