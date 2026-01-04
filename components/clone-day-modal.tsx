/**
 * Clone Day Modal Component
 * 
 * Reusable modal for selecting a target date to clone entries to.
 * Matches the app's design system and can be reused for Food and Exercise cloning.
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Platform, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

// Import i18n for locale detection
import i18n from '@/i18n';

type CloneDayModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (targetDate: Date) => void;
  sourceDate: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  isLoading?: boolean;
  title?: string;
  subtitle?: string;
  confirmButtonText?: string;
};

/**
 * Reusable modal for cloning day entries to another date
 */
export function CloneDayModal({
  visible,
  onClose,
  onConfirm,
  sourceDate,
  minimumDate,
  maximumDate,
  isLoading = false,
  title,
  subtitle,
  confirmButtonText,
}: CloneDayModalProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Default target date to tomorrow (or minimum date if tomorrow is before minimum date, or maximum date if tomorrow is after maximum date)
  const getDefaultTargetDate = () => {
    const tomorrow = new Date(sourceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // If minimumDate is set and tomorrow is before it, use minimumDate instead
    if (minimumDate) {
      const minDateNormalized = new Date(minimumDate);
      minDateNormalized.setHours(0, 0, 0, 0);
      if (tomorrow.getTime() < minDateNormalized.getTime()) {
        return minDateNormalized;
      }
    }
    
    // If maximumDate is set and tomorrow is after it, use maximumDate instead
    if (maximumDate) {
      const maxDateNormalized = new Date(maximumDate);
      maxDateNormalized.setHours(0, 0, 0, 0);
      if (tomorrow.getTime() > maxDateNormalized.getTime()) {
        return maxDateNormalized;
      }
    }
    
    return tomorrow;
  };

  const [targetDate, setTargetDate] = useState<Date>(getDefaultTargetDate());
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date(targetDate));

  // Update target date when source date, minimum date, or maximum date changes
  useEffect(() => {
    if (visible) {
      const defaultDate = getDefaultTargetDate();
      setTargetDate(defaultDate);
      setCalendarViewMonth(new Date(defaultDate));
    }
  }, [visible, sourceDate, minimumDate, maximumDate]);

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
    // Prevent navigating to months before minimum date
    if (minimumDate) {
      const newMonthFirst = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
      const minMonthFirst = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
      if (newMonthFirst < minMonthFirst) return;
    }
    setCalendarViewMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(calendarViewMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    // Prevent navigating to months after maximum date
    if (maximumDate) {
      const newMonthFirst = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
      const maxMonthFirst = new Date(maximumDate.getFullYear(), maximumDate.getMonth(), 1);
      if (newMonthFirst > maxMonthFirst) return;
    }
    setCalendarViewMonth(newMonth);
  };

  const isSelectedInCalendar = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    const selected = new Date(targetDate);
    selected.setHours(0, 0, 0, 0);
    return date.getTime() === selected.getTime();
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
    newDate.setHours(0, 0, 0, 0);
    setTargetDate(newDate);
  };

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm(targetDate);
    }
  };

  // Note: Removed today restriction - allow selecting any valid date

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'web' ? Spacing.lg : Spacing.lg }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.separator }]}>
              <View style={styles.modalHeaderContent}>
                <ThemedText type="title" style={[styles.modalTitle, { color: colors.text }]}>
                  {title || t('meds.clone.title')}
                </ThemedText>
                {subtitle && (
                  <ThemedText style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {subtitle || t('meds.clone.subtitle')}
                  </ThemedText>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeButton,
                  getMinTouchTargetStyle(),
                  { backgroundColor: colors.backgroundSecondary },
                  Platform.OS === 'web' && getFocusStyle(colors.tint),
                ]}
                disabled={isLoading}
                {...getButtonAccessibilityProps(t('common.close'))}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Selected Date Display */}
            <View style={[styles.selectedDateContainer, { borderBottomColor: colors.separator }]}>
              <ThemedText style={[styles.selectedDateText, { color: colors.text }]}>
                {targetDate.toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </ThemedText>
            </View>

            {/* Calendar */}
            <View style={styles.calendarWrapper}>
              <View style={styles.calendarContainer}>
                {/* Month/Year Navigation */}
                <View style={styles.calendarHeader}>
                <TouchableOpacity
                  onPress={handlePreviousMonth}
                  style={[
                    styles.calendarNavButton,
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  activeOpacity={0.7}
                  disabled={minimumDate ? (() => {
                    const prevMonth = new Date(calendarViewMonth);
                    prevMonth.setMonth(prevMonth.getMonth() - 1);
                    const prevMonthFirst = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
                    const minMonthFirst = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
                    return prevMonthFirst < minMonthFirst;
                  })() : false}
                  {...getButtonAccessibilityProps(t('home.date_picker.previous_month'))}
                >
                  <ThemedText style={[styles.calendarNavArrow, { color: colors.text }]}>←</ThemedText>
                </TouchableOpacity>
                <View style={styles.calendarMonthYear}>
                  <ThemedText style={[styles.calendarMonthYearText, { color: colors.text }]}>
                    {calendarViewMonth.toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={[
                    styles.calendarNavButton,
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  activeOpacity={0.7}
                  disabled={maximumDate ? (() => {
                    const nextMonth = new Date(calendarViewMonth);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    const nextMonthFirst = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
                    const maxMonthFirst = new Date(maximumDate.getFullYear(), maximumDate.getMonth(), 1);
                    return nextMonthFirst > maxMonthFirst;
                  })() : false}
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
                  
                  // Check if this date is the same as source date (should be disabled)
                  const sourceDateNormalized = new Date(sourceDate);
                  sourceDateNormalized.setHours(0, 0, 0, 0);
                  const isSameAsSource = dayDate.getTime() === sourceDateNormalized.getTime();
                  
                  // Check if this date is before the minimum allowed date (should be disabled)
                  const isBeforeMinDate = minimumDate ? (() => {
                    const minDateNormalized = new Date(minimumDate);
                    minDateNormalized.setHours(0, 0, 0, 0);
                    return dayDate.getTime() < minDateNormalized.getTime();
                  })() : false;
                  
                  // Check if this date is after the maximum allowed date (should be disabled)
                  const isAfterMaxDate = maximumDate ? (() => {
                    const maxDateNormalized = new Date(maximumDate);
                    maxDateNormalized.setHours(0, 0, 0, 0);
                    return dayDate.getTime() > maxDateNormalized.getTime();
                  })() : false;
                  
                  const isDisabled = isSameAsSource || isBeforeMinDate || isAfterMaxDate;

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[
                        styles.calendarDay,
                        isSelectedDay && { backgroundColor: colors.tint },
                        isDisabled && { opacity: 0.3 },
                      ]}
                      onPress={() => !isDisabled && handleDateSelect(day)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(`Select ${day}`)}
                    >
                      <ThemedText
                        style={[
                          styles.calendarDayText,
                          { color: isSelectedDay ? colors.textInverse : colors.text },
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
            </View>

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
                  Platform.OS === 'web' && getFocusStyle(colors.textInverse),
                ]}
                onPress={handleConfirm}
                disabled={isLoading}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(confirmButtonText || t('meds.clone.confirm'))}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={[styles.confirmButtonText, { color: colors.textInverse }]}>
                    {confirmButtonText || t('meds.clone.confirm')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' && {
      justifyContent: 'center',
      alignItems: 'center',
    }),
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: Platform.select({ web: '85%', default: '90%' }),
    width: '100%',
    ...(Platform.OS === 'web' && {
      width: '90%',
      maxWidth: 500,
      borderBottomLeftRadius: BorderRadius['2xl'],
      borderBottomRightRadius: BorderRadius['2xl'],
      paddingBottom: Spacing.lg,
    }),
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalHeaderContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.4,
  },
  closeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  selectedDateContainer: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  selectedDateText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  calendarWrapper: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  calendarContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavArrow: {
    fontSize: 20,
    fontWeight: '600',
  },
  calendarMonthYear: {
    flex: 1,
    alignItems: 'center',
  },
  calendarMonthYearText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  calendarWeekDayText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  calendarDayText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    // Color is set inline via colors.textInverse
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  footerButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // AODA-compliant touch target
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  confirmButton: {
    // backgroundColor set inline
  },
  confirmButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    // Color is set inline via colors.textInverse
  },
});

