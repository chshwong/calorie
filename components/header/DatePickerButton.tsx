import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize, BorderRadius, ModuleThemes, type ModuleType } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type DatePickerButtonProps = {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  today: Date;
  module?: ModuleType;
};

/**
 * Simple calendar button that opens a date picker modal
 * Extracted from DateHeader for reuse in CollapsibleModuleHeader
 */
export function DatePickerButton({
  selectedDate,
  onDateSelect,
  today,
  module,
}: DatePickerButtonProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const moduleAccent = module && ModuleThemes[module] ? ModuleThemes[module].accent : colors.tint;
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date(selectedDate));

  useEffect(() => {
    setCalendarViewMonth(new Date(selectedDate));
  }, [selectedDate]);

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
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return date.getTime() === selected.getTime();
  };

  const handleDateSelect = (date: Date) => {
    onDateSelect(date);
    setShowDatePicker(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.calendarButton,
          getMinTouchTargetStyle(),
          {
            backgroundColor: moduleAccent,
            ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
          },
          Platform.OS === 'web' && {
            zIndex: 10,
            pointerEvents: 'auto' as any, // Type assertion needed for React Native web pointerEvents type compatibility
          },
        ]}
        onPress={() => {
          setShowDatePicker(true);
          setCalendarViewMonth(new Date(selectedDate));
        }}
        activeOpacity={0.8}
        pointerEvents="auto"
        {...getButtonAccessibilityProps(
          t('home.date_picker.select_date'),
          'Double tap to open date picker'
        )}
      >
        <IconSymbol name="calendar" size={18} color="#fff" decorative={true} />
      </TouchableOpacity>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={[styles.datePickerModalOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
          pointerEvents={showDatePicker ? 'auto' : 'none'}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            pointerEvents="auto"
          >
            <View style={[styles.datePickerModalContent, { backgroundColor: colors.card }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: colors.separator }]}>
                <ThemedText style={[styles.datePickerTitle, { color: colors.text }]}>
                  {t('home.date_picker.title')}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={[
                    styles.datePickerCloseButton,
                    getMinTouchTargetStyle(),
                    { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                  ]}
                  {...getButtonAccessibilityProps(
                    'Close date picker',
                    'Double tap to close date picker'
                  )}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} decorative={true} />
                </TouchableOpacity>
              </View>
              
              {/* Selected Date Display */}
              <View style={[styles.datePickerSelectedDateContainer, { borderBottomColor: colors.separator }]}>
                <ThemedText style={[styles.datePickerSelectedDate, { color: colors.text }]}>
                  {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </ThemedText>
              </View>

              {/* Calendar Grid */}
              <View style={styles.datePickerBody}>
                {/* Month/Year Navigation */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    onPress={handlePreviousMonth}
                    style={[
                      styles.calendarNavButton,
                      getMinTouchTargetStyle(),
                      { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                    ]}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(
                      t('home.date_picker.previous_month'),
                      'Double tap to go to the previous month'
                    )}
                  >
                    <ThemedText style={[styles.calendarNavArrow, { color: colors.text }]}>←</ThemedText>
                  </TouchableOpacity>
                  <View style={styles.calendarMonthYear}>
                    <ThemedText style={[styles.calendarMonthYearText, { color: colors.text }]}>
                      {calendarViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={[
                      styles.calendarNavButton,
                      getMinTouchTargetStyle(),
                      { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                    ]}
                    activeOpacity={0.7}
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
                    
                    return (
                      <TouchableOpacity
                        key={`day-${day}`}
                        style={[
                          styles.calendarDay,
                          isSelectedDay && { backgroundColor: moduleAccent },
                          isTodayDay && !isSelectedDay && {
                            borderWidth: 1,
                            borderColor: moduleAccent,
                            borderRadius: BorderRadius.md,
                          },
                          Platform.OS === 'web' && {
                            zIndex: 1002,
                            pointerEvents: 'auto' as any, // Type assertion needed for React Native web pointerEvents type compatibility
                          },
                        ]}
                        onPress={() => {
                          const newDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
                          handleDateSelect(newDate);
                        }}
                        activeOpacity={0.7}
                        pointerEvents="auto"
                        {...getButtonAccessibilityProps(
                          `Select ${day}`,
                          `Double tap to select ${day}`
                        )}
                      >
                        <ThemedText
                          style={[
                            styles.calendarDayText,
                            { color: isSelectedDay ? '#fff' : (isTodayDay ? moduleAccent : colors.text) },
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

              {/* Footer with Cancel/OK buttons */}
              <View style={[styles.datePickerFooter, { borderTopColor: colors.separator }]}>
                <TouchableOpacity
                  style={[
                    styles.datePickerCancelButton,
                    getMinTouchTargetStyle(),
                    { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                  ]}
                  onPress={() => setShowDatePicker(false)}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    t('common.cancel'),
                    'Double tap to cancel date selection'
                  )}
                >
                  <ThemedText style={[styles.datePickerCancelButtonText, { color: colors.text }]}>
                    {t('common.cancel')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.datePickerTodayButton,
                    getMinTouchTargetStyle(),
                    {
                      backgroundColor: colors.tint,
                      ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                    }
                  ]}
                  onPress={() => {
                    handleDateSelect(new Date(today));
                  }}
                  {...getButtonAccessibilityProps(
                    t('home.date_picker.today_button'),
                    'Double tap to select today\'s date'
                  )}
                >
                  <Text style={styles.datePickerTodayButtonText}>{t('home.date_picker.today_button')}</Text>
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
  calendarButton: {
    width: 32, // Touch target size for calendar icon button
    height: 32,
    borderRadius: BorderRadius.xl, // 16px - matches standard modal/content radius
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Date Picker Modal Styles
  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    ...Platform.select({
      web: {
        zIndex: 1000,
      },
    }),
  },
  datePickerModalContent: {
    width: '100%',
    maxWidth: 400, // Standard modal max width
    borderRadius: BorderRadius.xl, // 16px - matches standard modal radius
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        zIndex: 1001,
        pointerEvents: 'auto' as any, // Type assertion needed for React Native web pointerEvents type compatibility
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  datePickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  datePickerCloseButton: {
    width: 32, // Touch target size for close button
    height: 32,
    borderRadius: BorderRadius.xl, // 16px - matches standard button radius
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerSelectedDateContainer: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  datePickerSelectedDate: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  datePickerBody: {
    padding: Spacing.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  calendarNavButton: {
    width: 40, // Larger touch target for month navigation
    height: 40,
    borderRadius: 20, // Half of width/height for perfect circle (40/2 = 20)
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavArrow: {
    fontSize: FontSize.xl, // 20px - matches standard arrow icon size
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
  },
  calendarDayText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  datePickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  datePickerCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md, // 8px - matches standard button radius
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  datePickerCancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  datePickerTodayButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md, // 8px - matches standard button radius
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerTodayButtonText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});

