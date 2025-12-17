import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, Platform, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

type CalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onConfirm: (date: Date) => void;
  colors: typeof Colors.light;
};

export function CalendarModal({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
  onConfirm,
  colors,
}: CalendarModalProps) {
  // Calendar view month (for navigation)
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    return new Date(selectedDate);
  });

  // Get today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update calendar view month when modal opens
  useEffect(() => {
    if (visible) {
      setCalendarViewMonth(new Date(selectedDate));
    }
  }, [visible, selectedDate]);

  // Generate calendar days for a given month
  const generateCalendarDays = (viewMonth: Date) => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDay.getDay();
    
    // Days array to return
    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(day);
    }
    
    return days;
  };

  // Navigate to previous month
  const handlePreviousMonth = () => {
    const newMonth = new Date(calendarViewMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCalendarViewMonth(newMonth);
  };

  // Navigate to next month
  const handleNextMonth = () => {
    const newMonth = new Date(calendarViewMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCalendarViewMonth(newMonth);
  };

  // Check if a date is today
  const isToday = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  };

  // Check if a date is selected
  const isSelected = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return date.getTime() === selected.getTime();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.datePickerModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.datePickerModalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.datePickerHeader, { borderBottomColor: colors.icon + '20' }]}>
              <ThemedText style={[styles.datePickerTitle, { color: colors.text }]}>
                SELECT DATE
              </ThemedText>
              <TouchableOpacity
                onPress={onClose}
                style={styles.datePickerCloseButton}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Selected Date Display */}
            <View style={[styles.datePickerSelectedDateContainer, { borderBottomColor: colors.icon + '20' }]}>
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
                  style={styles.calendarNavButton}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.calendarNavArrow, { color: colors.text }]}>←</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarMonthYear}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.calendarMonthYearText, { color: colors.text }]}>
                    {calendarViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </ThemedText>
                  <ThemedText style={[styles.calendarDropdownArrow, { color: colors.textSecondary }]}>▼</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={styles.calendarNavButton}
                  activeOpacity={0.7}
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
                  
                  const isSelectedDay = isSelected(day, calendarViewMonth);
                  const isTodayDay = isToday(day, calendarViewMonth);
                  
                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[
                        styles.calendarDay,
                        isSelectedDay && { backgroundColor: colors.tint },
                        isTodayDay && !isSelectedDay && { 
                          borderWidth: 1, 
                          borderColor: colors.tint,
                          borderRadius: 8,
                        },
                      ]}
                      onPress={() => {
                        const newDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
                        onDateSelect(newDate);
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.calendarDayText,
                          { color: isSelectedDay ? '#fff' : (isTodayDay ? colors.tint : colors.text) },
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
            <View style={[styles.datePickerFooter, { borderTopColor: colors.icon + '20' }]}>
              <TouchableOpacity
                style={styles.datePickerCancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.datePickerCancelButtonText, { color: colors.tint }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.datePickerOkButton, { backgroundColor: colors.tint }]}
                onPress={() => {
                  onConfirm(selectedDate);
                }}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.datePickerOkButtonText}>
                  OK
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        backdropFilter: 'blur(10px)',
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    opacity: 0.3,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePickerSelectedDateContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  datePickerSelectedDate: {
    fontSize: 24,
    fontWeight: '600',
  },
  datePickerBody: {
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarNavButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarNavArrow: {
    fontSize: 20,
    fontWeight: '600',
  },
  calendarMonthYear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calendarMonthYearText: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarDropdownArrow: {
    fontSize: 12,
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayText: {
    fontSize: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '400',
  },
  calendarDayTextSelected: {
    fontWeight: '600',
    color: '#fff',
  },
  datePickerFooter: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  datePickerCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerOkButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  datePickerOkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

