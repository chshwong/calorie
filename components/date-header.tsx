import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize, ModuleThemes, type ModuleType } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useUserProfile } from '@/hooks/use-user-profile';
import { getGreetingKey } from '@/utils/bmi';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type DateHeaderProps = {
  /** Optional right-side action buttons (e.g., refresh, profile) */
  rightActions?: React.ReactNode;
  /** Whether to show the greeting section */
  showGreeting?: boolean;
  /** Optional module type for accent colors (exercise, meds, etc.) */
  module?: ModuleType;
  /** Optional: Use provided date state instead of creating its own */
  selectedDate?: Date;
  setSelectedDate?: (date: Date) => void;
  selectedDateString?: string;
  isToday?: boolean;
  getDisplayDate?: (t: (key: string) => string) => string;
  goBackOneDay?: () => void;
  goForwardOneDay?: () => void;
  calendarViewMonth?: Date;
  setCalendarViewMonth?: (date: Date) => void;
  today?: Date;
};

/**
 * Reusable date header component with greeting and date navigation
 * Used on both Food Log and Exercise screens
 */
export function DateHeader({ 
  rightActions, 
  showGreeting = true,
  module,
  selectedDate: propSelectedDate,
  setSelectedDate: propSetSelectedDate,
  selectedDateString: propSelectedDateString,
  isToday: propIsToday,
  getDisplayDate: propGetDisplayDate,
  goBackOneDay: propGoBackOneDay,
  goForwardOneDay: propGoForwardOneDay,
  calendarViewMonth: propCalendarViewMonth,
  setCalendarViewMonth: propSetCalendarViewMonth,
  today: propToday,
}: DateHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: profile } = useUserProfile();
  
  // Get module accent color if module is provided
  const moduleAccent = module ? ModuleThemes[module].accent : colors.tint;
  
  // Use provided date state or create own instance
  const hookDateState = useSelectedDate();
  const selectedDate = propSelectedDate ?? hookDateState.selectedDate;
  const setSelectedDate = propSetSelectedDate ?? hookDateState.setSelectedDate;
  const isToday = propIsToday ?? hookDateState.isToday;
  const getDisplayDate = propGetDisplayDate ?? hookDateState.getDisplayDate;
  const goBackOneDay = propGoBackOneDay ?? hookDateState.goBackOneDay;
  const goForwardOneDay = propGoForwardOneDay ?? hookDateState.goForwardOneDay;
  const today = propToday ?? hookDateState.today;
  
  // Calendar view month state (local to DateHeader for modal)
  const [localCalendarViewMonth, setLocalCalendarViewMonth] = useState<Date>(() => {
    return propCalendarViewMonth ? new Date(propCalendarViewMonth) : new Date(selectedDate);
  });
  const calendarViewMonth = propCalendarViewMonth ?? localCalendarViewMonth;
  const setCalendarViewMonth = propSetCalendarViewMonth ?? setLocalCalendarViewMonth;
  
  // Update local calendar view month when selectedDate changes
  useEffect(() => {
    if (!propCalendarViewMonth) {
      setLocalCalendarViewMonth(new Date(selectedDate));
    }
  }, [selectedDate, propCalendarViewMonth]);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Get time of day greeting
  const hour = new Date().getHours();
  const greetingKey = getGreetingKey(hour);
  const greeting = t(greetingKey);
  
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
    setSelectedDate(date);
    setShowDatePicker(false);
  };
  
  return (
    <>
      {/* Header Section with Greeting */}
      {showGreeting && (
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.greetingRow}>
              <ThemedText style={styles.greeting}>{greeting},</ThemedText>
              <ThemedText type="title" style={styles.welcomeText}>
                {profile?.first_name || ''}!
              </ThemedText>
            </View>
          </View>
          {rightActions && (
            <View style={styles.headerButtons}>
              {rightActions}
            </View>
          )}
        </View>
      )}
      
      {/* Date Navigation Section */}
      <View style={styles.dateNavigation} accessibilityRole="toolbar">
        <TouchableOpacity
          onPress={goBackOneDay}
          activeOpacity={0.6}
          style={[
            styles.dateNavButtonSimple,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          {...getButtonAccessibilityProps(
            t('home.date_picker.previous_day'),
            'Double tap to go to the previous day'
          )}
        >
          <View style={[styles.dateNavIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.dateNavButtonText, { color: moduleAccent }]}>‹</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.dateDisplay}>
          <ThemedText 
            style={[styles.dateDisplayText, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            accessibilityRole="text"
          >
            {getDisplayDate(t)}
          </ThemedText>
        </View>
        <TouchableOpacity
          style={[
            styles.calendarButton, 
            getMinTouchTargetStyle(),
            { 
              backgroundColor: moduleAccent,
              ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
            }
          ]}
          onPress={() => {
            setShowDatePicker(true);
            setCalendarViewMonth(new Date(selectedDate));
          }}
          activeOpacity={0.8}
          {...getButtonAccessibilityProps(
            t('home.date_picker.select_date'),
            'Double tap to open date picker'
          )}
        >
          <IconSymbol name="calendar" size={18} color="#fff" decorative={true} />
        </TouchableOpacity>
        {!isToday && (
          <TouchableOpacity
            onPress={goForwardOneDay}
            activeOpacity={0.6}
            style={[
              styles.dateNavButtonSimple,
              getMinTouchTargetStyle(),
              { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
            ]}
            {...getButtonAccessibilityProps(
              t('home.date_picker.next_day'),
              'Double tap to go to the next day'
            )}
          >
            <View style={[styles.dateNavIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.dateNavButtonText, { color: moduleAccent }]}>›</Text>
            </View>
          </TouchableOpacity>
        )}
        {isToday && <View style={styles.dateNavButtonPlaceholder} />}
      </View>
      
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
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
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
                            borderRadius: 8,
                          },
                        ]}
                        onPress={() => {
                          const newDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
                          handleDateSelect(newDate);
                        }}
                        activeOpacity={0.7}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingHorizontal: 0,
  },
  headerContent: {
    flex: 1,
    marginRight: Spacing.md,
    minWidth: 0,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  greeting: {
    fontSize: Platform.select({ web: 11, default: 12 }),
    opacity: 0.8,
    fontWeight: '500',
    marginRight: 4,
  },
  welcomeText: {
    fontSize: Platform.select({ web: 18, default: 16 }),
    fontWeight: 'bold',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: Platform.select({ web: 8, default: 4 }),
    paddingHorizontal: 0,
  },
  dateNavButtonSimple: {
    // Touch target handled by getMinTouchTargetStyle
  },
  dateNavIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavButtonText: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  dateDisplayText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  calendarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  // Date Picker Modal Styles
  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  datePickerModalContent: {
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderRadius: 8,
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerTodayButtonText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});

