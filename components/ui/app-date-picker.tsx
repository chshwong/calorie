/**
 * AppDatePicker - Shared date picker component with year/month selection
 * 
 * Reusable date picker used across all modules (onboarding, food logs, exercise, etc.)
 * Supports direct year selection via year/month picker modal
 * 
 * Per engineering guidelines: Reusable UI component shared across screens
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

export interface AppDatePickerProps {
  /** Current selected date */
  value: Date;
  /** Callback when date is selected */
  onChange: (date: Date) => void;
  /** Minimum selectable date */
  minimumDate?: Date;
  /** Maximum selectable date */
  maximumDate?: Date;
  /** Whether to show a "Today" shortcut button (does not close; user still confirms with Select Date). */
  showTodayButton?: boolean;
  /** Whether the picker is visible */
  visible: boolean;
  /** Callback when picker should close */
  onClose: () => void;
  /** Optional title for the picker */
  title?: string;
  /** Optional module accent color */
  accentColor?: string;
}

/**
 * Shared date picker component with year/month selection
 */
export function AppDatePicker({
  value,
  onChange,
  minimumDate,
  maximumDate,
  showTodayButton = false,
  visible,
  onClose,
  title,
  accentColor,
}: AppDatePickerProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const accent = accentColor || colors.tint;
  
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date(value));
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date>(() => new Date(value));
  const yearScrollViewRef = useRef<ScrollView>(null);
  const monthScrollViewRef = useRef<ScrollView>(null);
  
  // Update calendar view month and pendingDate when value changes or modal opens
  useEffect(() => {
    if (visible) {
      const newDate = new Date(value);
      setCalendarViewMonth(newDate);
      setPendingDate(newDate);
    }
  }, [value, visible]);
  
  // Auto-scroll to current year when year picker opens
  useEffect(() => {
    if (showYearMonthPicker && yearScrollViewRef.current) {
      const currentYear = pendingDate.getFullYear();
      const today = new Date();
      const maxYear = maximumDate ? maximumDate.getFullYear() : (minimumDate ? 2100 : today.getFullYear());
      const minYear = minimumDate ? minimumDate.getFullYear() : maxYear - 150;
      const yearIndex = maxYear - currentYear;
      const yearItemHeight = 60;
      
      setTimeout(() => {
        yearScrollViewRef.current?.scrollTo({
          y: Math.max(0, (yearIndex - 2) * yearItemHeight),
          animated: true,
        });
      }, 100);
    }
  }, [showYearMonthPicker, pendingDate, minimumDate, maximumDate]);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // If maximumDate is explicitly undefined, allow all future dates (no maximum)
  // If maximumDate is provided, use it; otherwise default to today (for backward compatibility)
  const maxDate = maximumDate !== undefined ? maximumDate : (minimumDate ? undefined : today);
  const minDate = minimumDate || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 120);
    return d;
  })();

  const isTodayShortcutDisabled = (() => {
    // Both `today` and calendar dates are treated as local-midnight.
    // Respect min/max rules in case the embedding screen sets unusual ranges.
    if (today < minDate) return true;
    if (maxDate !== undefined && today > maxDate) return true;
    return false;
  })();
  
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
    // Normalize to first day of month for comparison
    const newMonthFirst = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
    const minDateFirst = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    if (newMonthFirst >= minDateFirst) {
      setCalendarViewMonth(newMonth);
    }
  };
  
  const handleNextMonth = () => {
    const newMonth = new Date(calendarViewMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    // Only check maxDate if it's defined
    if (maxDate === undefined) {
      setCalendarViewMonth(newMonth);
    } else {
      // Normalize to first day of month for comparison
      const newMonthFirst = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
      const maxDateFirst = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      if (newMonthFirst <= maxDateFirst) {
        setCalendarViewMonth(newMonth);
      }
    }
  };
  
  const isTodayInCalendar = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  };
  
  const isSelectedInCalendar = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    const selected = new Date(pendingDate);
    selected.setHours(0, 0, 0, 0);
    return date.getTime() === selected.getTime();
  };
  
  const isDateDisabled = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    // Disable if before minDate
    if (date < minDate) return true;
    // Disable if after maxDate (only if maxDate is defined)
    if (maxDate !== undefined && date > maxDate) return true;
    return false;
  };
  
  const handleDateSelect = (day: number) => {
    const newDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
    newDate.setHours(0, 0, 0, 0);
    if (!isDateDisabled(day, calendarViewMonth)) {
      setPendingDate(newDate);
      // Do not close modal or call onChange - wait for "Select Date" button
    }
  };
  
  const handleYearMonthSelect = (year: number, month: number) => {
    const newDate = new Date(year, month, 1);
    let adjustedDate = newDate;
    if (newDate < minDate) {
      adjustedDate = new Date(minDate);
    } else if (maxDate !== undefined && newDate > maxDate) {
      adjustedDate = new Date(maxDate);
    }
    setCalendarViewMonth(adjustedDate);
    // Update pendingDate to the first day of the selected month/year, preserving the day if possible
    const currentDay = Math.min(pendingDate.getDate(), new Date(adjustedDate.getFullYear(), adjustedDate.getMonth() + 1, 0).getDate());
    const updatedPendingDate = new Date(adjustedDate.getFullYear(), adjustedDate.getMonth(), currentDay);
    updatedPendingDate.setHours(0, 0, 0, 0);
    setPendingDate(updatedPendingDate);
    // Do not close modal - wait for "Done" button
  };
  
  if (!visible) return null;
  
  return (
    <>
      {/* Main Date Picker Modal */}
      <Modal
        visible={visible && !showYearMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={[styles.overlay, { backgroundColor: colors.overlay || 'rgba(0, 0, 0, 0.5)' }]}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.title, { color: colors.text }]}>
                  {title || t('home.date_picker.title')}
                </ThemedText>
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.closeButton,
                    getMinTouchTargetStyle(),
                    { ...(Platform.OS === 'web' ? getFocusStyle(accent) : {}) },
                  ]}
                  {...getButtonAccessibilityProps('Close', 'Double tap to close date picker')}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {/* Selected Date Display */}
              <View style={[styles.selectedDateContainer, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.selectedDate, { color: colors.text }]}>
                  {pendingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </ThemedText>
              </View>

              {/* Calendar Grid */}
              <View style={styles.body}>
                {/* Month/Year Navigation */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    onPress={handlePreviousMonth}
                    style={[
                      styles.calendarNavButton,
                      getMinTouchTargetStyle(),
                      { ...(Platform.OS === 'web' ? getFocusStyle(accent) : {}) },
                    ]}
                    activeOpacity={0.7}
                    disabled={(() => {
                      const prevMonth = new Date(calendarViewMonth);
                      prevMonth.setMonth(prevMonth.getMonth() - 1);
                      // Normalize to first day of month for comparison
                      const prevMonthFirst = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
                      const minDateFirst = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                      return prevMonthFirst < minDateFirst;
                    })()}
                    {...getButtonAccessibilityProps(
                      t('home.date_picker.previous_month'),
                      'Double tap to go to the previous month'
                    )}
                  >
                    <ThemedText style={[styles.calendarNavArrow, { color: colors.text }]}>←</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.calendarMonthYear,
                      { ...(Platform.OS === 'web' ? getFocusStyle(accent) : {}) },
                    ]}
                    onPress={() => setShowYearMonthPicker(true)}
                    {...getButtonAccessibilityProps('Select month and year', 'Double tap to select a different month and year')}
                  >
                    <ThemedText style={[styles.calendarMonthYearText, { color: colors.text }]}>
                      {calendarViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </ThemedText>
                    <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={[
                      styles.calendarNavButton,
                      getMinTouchTargetStyle(),
                      { ...(Platform.OS === 'web' ? getFocusStyle(accent) : {}) },
                    ]}
                    activeOpacity={0.7}
                    disabled={(() => {
                      if (maxDate === undefined) return false;
                      const nextMonth = new Date(calendarViewMonth);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      // Normalize to first day of month for comparison
                      const nextMonthFirst = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
                      const maxDateFirst = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
                      return nextMonthFirst > maxDateFirst;
                    })()}
                    {...getButtonAccessibilityProps(
                      t('home.date_picker.next_month'),
                      'Double tap to go to the next month'
                    )}
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
                    const isTodayDay = isTodayInCalendar(day, calendarViewMonth);
                    const isDisabled = isDateDisabled(day, calendarViewMonth);
                    
                    return (
                      <TouchableOpacity
                        key={`day-${day}`}
                        style={[
                          styles.calendarDay,
                          isSelectedDay && { backgroundColor: accent },
                          isDisabled && { opacity: 0.4 },
                        ]}
                        onPress={() => handleDateSelect(day)}
                        disabled={isDisabled}
                        activeOpacity={0.7}
                        {...getButtonAccessibilityProps(
                          `Select ${day}`,
                          `Double tap to select ${day}`,
                          isDisabled
                        )}
                      >
                        <ThemedText
                          style={[
                            styles.calendarDayText,
                            { 
                              color: isSelectedDay ? '#fff' : (isTodayDay ? accent : colors.text),
                              opacity: isDisabled ? 0.4 : 1,
                            },
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

              {/* Footer */}
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    getMinTouchTargetStyle(),
                    { 
                      borderColor: colors.border,
                      ...(Platform.OS === 'web' ? getFocusStyle(accent) : {}),
                    },
                  ]}
                  onPress={onClose}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    t('common.cancel'),
                    'Double tap to cancel date selection'
                  )}
                >
                  <ThemedText style={[styles.cancelButtonText, { color: colors.text }]}>
                    {t('common.cancel')}
                  </ThemedText>
                </TouchableOpacity>
                {showTodayButton && (
                  <TouchableOpacity
                    style={[
                      styles.todayShortcutButton,
                      getMinTouchTargetStyle(),
                      {
                        borderColor: colors.border,
                        ...(Platform.OS === 'web' ? getFocusStyle(accent) : {}),
                      },
                      isTodayShortcutDisabled && { opacity: 0.4 },
                    ]}
                    onPress={() => {
                      if (isTodayShortcutDisabled) return;
                      setPendingDate(new Date(today));
                      setCalendarViewMonth(new Date(today));
                    }}
                    activeOpacity={0.7}
                    disabled={isTodayShortcutDisabled}
                    {...getButtonAccessibilityProps(
                      t('home.date_picker.today_button'),
                      "Double tap to select today's date (then confirm with Select Date)",
                      isTodayShortcutDisabled
                    )}
                  >
                    <ThemedText style={[styles.todayShortcutButtonText, { color: colors.text }]}>
                      {t('home.date_picker.today_button')}
                    </ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.todayButton, 
                    getMinTouchTargetStyle(),
                    { 
                      backgroundColor: accent,
                      ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                    }
                  ]}
                  onPress={() => {
                    onChange(pendingDate);
                    onClose();
                  }}
                  {...getButtonAccessibilityProps(
                    t('home.date_picker.select_date'),
                    'Double tap to confirm date selection'
                  )}
                >
                  <Text style={styles.todayButtonText}>{t('home.date_picker.select_date')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      {/* Year/Month Picker Modal */}
      <Modal
        visible={showYearMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowYearMonthPicker(false)}
      >
        <TouchableOpacity
          style={[styles.overlay, { backgroundColor: colors.overlay || 'rgba(0, 0, 0, 0.5)' }]}
          activeOpacity={1}
          onPress={() => setShowYearMonthPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.yearMonthModal, { backgroundColor: colors.background }]}>
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.title, { color: colors.text }]}>
                  {t('date_picker.select_year_month') || 'Select Year and Month'}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowYearMonthPicker(false)}
                  style={[
                    styles.closeButton,
                    getMinTouchTargetStyle(),
                    { ...(Platform.OS === 'web' ? getFocusStyle(accent) : {}) },
                  ]}
                  {...getButtonAccessibilityProps('Close', 'Double tap to close year and month picker')}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.yearMonthBody}>
                {/* Year Picker */}
                <View style={styles.yearMonthColumn}>
                  <ThemedText style={[styles.yearMonthLabel, { color: colors.textSecondary }]}>
                    Year
                  </ThemedText>
                  <ScrollView 
                    ref={yearScrollViewRef}
                    style={styles.yearMonthScrollView} 
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.yearMonthScrollContent}
                  >
                    {Array.from({ length: 150 }, (_, i) => {
                      const maxYear = maxDate ? maxDate.getFullYear() : 2100;
                      const year = maxYear - i;
                      if (year < minDate.getFullYear()) return null;
                      const isSelected = pendingDate.getFullYear() === year;
                      return (
                        <TouchableOpacity
                          key={year}
                          style={[
                            styles.yearMonthOption,
                            isSelected && { backgroundColor: accent, borderColor: accent },
                            !isSelected && { borderColor: colors.border },
                          ]}
                          onPress={() => {
                            const currentMonth = pendingDate.getMonth();
                            handleYearMonthSelect(year, currentMonth);
                          }}
                          {...getButtonAccessibilityProps(
                            `Select year ${year}`,
                            `Double tap to select year ${year}`,
                            false
                          )}
                          {...(Platform.OS === 'web' ? getFocusStyle(accent) : {})}
                        >
                          <ThemedText
                            style={[
                              styles.yearMonthOptionText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {year}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    }).filter(Boolean)}
                  </ScrollView>
                </View>
                
                {/* Month Picker */}
                <View style={styles.yearMonthColumn}>
                  <ThemedText style={[styles.yearMonthLabel, { color: colors.textSecondary }]}>
                    Month
                  </ThemedText>
                  <ScrollView 
                    ref={monthScrollViewRef}
                    style={styles.yearMonthScrollView} 
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.yearMonthScrollContent}
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i;
                      const monthName = new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' });
                      const isSelected = pendingDate.getMonth() === month;
                      const testDate = new Date(calendarViewMonth.getFullYear(), i, 1);
                      const isDisabled = testDate < minDate || (maxDate !== undefined && testDate > maxDate);
                      
                      return (
                        <TouchableOpacity
                          key={month}
                          style={[
                            styles.yearMonthOption,
                            isSelected && !isDisabled && { backgroundColor: accent, borderColor: accent },
                            !isSelected && { borderColor: colors.border },
                            isDisabled && { opacity: 0.4 },
                          ]}
                          onPress={() => {
                            if (isDisabled) return;
                            const currentYear = pendingDate.getFullYear();
                            handleYearMonthSelect(currentYear, month);
                          }}
                          disabled={isDisabled}
                          {...getButtonAccessibilityProps(
                            `Select ${monthName}`,
                            `Double tap to select ${monthName}`,
                            isDisabled
                          )}
                          {...(Platform.OS === 'web' ? getFocusStyle(accent) : {})}
                        >
                          <ThemedText
                            style={[
                              styles.yearMonthOptionText,
                              { color: isSelected && !isDisabled ? '#fff' : colors.text },
                            ]}
                          >
                            {monthName}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
              
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.doneButton, 
                    { backgroundColor: accent },
                    getMinTouchTargetStyle(),
                    { ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}) },
                  ]}
                  onPress={() => setShowYearMonthPicker(false)}
                  {...getButtonAccessibilityProps('Done', 'Double tap to confirm year and month selection')}
                >
                  <Text style={styles.doneButtonText}>{t('common.done')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDateContainer: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  selectedDate: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  body: {
    padding: Spacing.md,
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
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
  },
  calendarDayText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  todayShortcutButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  todayShortcutButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  todayButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  yearMonthModal: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  yearMonthBody: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  yearMonthColumn: {
    flex: 1,
    gap: Spacing.sm,
  },
  yearMonthLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    paddingLeft: Spacing.xs,
  },
  yearMonthScrollView: {
    maxHeight: 300,
  },
  yearMonthScrollContent: {
    gap: Spacing.xs,
  },
  yearMonthOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  yearMonthOptionText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  doneButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});

