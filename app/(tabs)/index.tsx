import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ageFromDob, bmi } from '@/utils/calculations';
import { calculateDailyTotals, groupEntriesByMealType, formatEntriesForDisplay } from '@/utils/dailyTotals';
import { getBMICategory, getGreetingKey } from '@/utils/bmi';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { MEAL_TYPE_ORDER } from '@/utils/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { useQueryClient } from '@tanstack/react-query';
import { fetchFrequentFoods } from '@/lib/services/frequentFoods';
import { fetchRecentFoods } from '@/lib/services/recentFoods';
import { fetchCustomFoods } from '@/lib/services/customFoods';
import { fetchBundles } from '@/lib/services/bundles';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { signOut, loading, retrying, user, isAdmin } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [refreshing, setRefreshing] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // SECURITY: Check if we're in password recovery mode and block access
  const { isPasswordRecovery } = useAuth();
  useEffect(() => {
    const inRecoveryMode = isPasswordRecovery();
    
    if (inRecoveryMode) {
      // User is in password recovery mode - redirect to reset-password page
      router.replace('/reset-password');
    }
  }, [router, isPasswordRecovery]);
  
  // Pull-to-refresh state for web
  const [pullToRefreshDistance, setPullToRefreshDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const pullStartY = useRef<number | null>(null);
  const pullDistance = useRef<number>(0);
  
  // Get today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get date from params if available (when navigating back from mealtype-log)
  const dateParam = params.date;
  const initialDate = dateParam && typeof dateParam === 'string' 
    ? new Date(dateParam + 'T00:00:00') 
    : new Date(today);
  
  // State for selected date (defaults to today or date from params)
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  
  // Calendar view month (for navigation)
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    return new Date(selectedDate);
  });

  // Check if selected date is from current year
  const currentYear = today.getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  
  // Calculate if it's today or yesterday
  const isToday = selectedDate.getTime() === today.getTime();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = selectedDate.getTime() === yesterday.getTime();
  
  // Format selected date for display (short form)
  // Exclude weekday for today/yesterday to save space
  // Include year only if date is from previous year
  const dateOptions: Intl.DateTimeFormatOptions = { 
    ...(isToday || isYesterday ? {} : { weekday: 'short' }),
    month: 'short', 
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' })
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  
  // Format display date with appropriate prefix (short form)
  // Note: Using t() function requires it to be called after useTranslation hook
  const getDisplayDate = (t: (key: string) => string) => {
  if (isToday) {
      return `${t('common.today')}, ${formattedDate}`;
  } else if (isYesterday) {
      return `${t('common.yesterday')}, ${formattedDate}`;
  }
    return formattedDate;
  };
  
  // Format selected date as YYYY-MM-DD for SQL query (in user's local timezone)
  // Use local date to ensure it matches what the user sees
  const selectedDateString = (() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  // Use React Query hooks for data fetching
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data: calorieEntries = [], isLoading: entriesLoading, refetch: refetchEntries } = useDailyEntries(selectedDateString);
  
  // Background prefetch for mealtype-log tab data (after Home data is ready)
  // Use default meal type 'late_night' (same as mealtype-log default)
  const defaultMealType = 'late_night';
  useEffect(() => {
    if (!user?.id || entriesLoading) return; // Wait until Home's own data is ready
    
    // Silently prefetch tab data in the background
    queryClient.prefetchQuery({
      queryKey: ['frequentFoods', user.id, defaultMealType],
      queryFn: () => fetchFrequentFoods(user.id, defaultMealType),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    });
    
    queryClient.prefetchQuery({
      queryKey: ['recentFoods', user.id, defaultMealType],
      queryFn: () => fetchRecentFoods(user.id, defaultMealType),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    });
    
    queryClient.prefetchQuery({
      queryKey: ['customFoods', user.id],
      queryFn: () => fetchCustomFoods(user.id),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    });
    
    queryClient.prefetchQuery({
      queryKey: ['bundles', user.id],
      queryFn: () => fetchBundles(user.id),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    });
  }, [user?.id, entriesLoading, queryClient]);

  // Function to go back one day
  const goBackOneDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  // Function to go forward one day (only if not today)
  const goForwardOneDay = () => {
    if (!isToday) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      setSelectedDate(newDate);
    }
  };

  // Function to open date picker
  const openDatePicker = () => {
    setShowDatePicker(true);
  };

  // Function to handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
  };

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

  // Check if a date is today (for calendar)
  const isTodayInCalendar = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  };

  // Check if a date is selected (for calendar)
  const isSelectedInCalendar = (day: number, viewMonth: Date) => {
    if (!day) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return date.getTime() === selected.getTime();
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes
    setRefreshing(true);
    await refetchEntries();
    setRefreshing(false);
  }, [refetchEntries, refreshing]);

  // Web-specific pull-to-refresh using scroll position detection
  // For web, we'll use onScroll to detect when user scrolls past top and trigger refresh
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWebScroll = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    
    const scrollY = e.nativeEvent.contentOffset?.y || 0;
    setScrollPosition(scrollY);
    
    // Detect pull-to-refresh: when scrollY is negative (scrolled past top)
    if (scrollY < -60 && !refreshing && !isPulling) {
      setIsPulling(true);
      setPullToRefreshDistance(Math.abs(scrollY));
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Trigger refresh after a brief moment
      scrollTimeoutRef.current = setTimeout(async () => {
        if (scrollY < -60) {
          await onRefresh();
        }
        setIsPulling(false);
        setPullToRefreshDistance(0);
      }, 200);
    } else if (scrollY >= 0 && isPulling) {
      // Reset if scrolled back up
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      setIsPulling(false);
      setPullToRefreshDistance(0);
    }
  }, [refreshing, isPulling, onRefresh]);

  // Update selected date if date param changes (when navigating back from mealtype-log)
  useEffect(() => {
    if (dateParam && typeof dateParam === 'string') {
      const paramDate = new Date(dateParam + 'T00:00:00');
      // Check if date is valid and different from current selected date
      if (!isNaN(paramDate.getTime())) {
        setSelectedDate((currentDate) => {
          // Only update if the date is different to avoid unnecessary re-renders
          if (paramDate.getTime() !== currentDate.getTime()) {
            setCalendarViewMonth(new Date(paramDate));
            return paramDate;
          }
          return currentDate;
        });
      }
    }
  }, [dateParam]);

  // Load summary expanded preference from storage (uses adapter per guideline 7)
  useEffect(() => {
    const saved = storage.getBoolean(STORAGE_KEYS.SUMMARY_EXPANDED, false);
    setSummaryExpanded(saved);
  }, []);

  // Toggle and save summary expanded preference
  const toggleSummary = () => {
    const newValue = !summaryExpanded;
    setSummaryExpanded(newValue);
    storage.setBoolean(STORAGE_KEYS.SUMMARY_EXPANDED, newValue);
  };

  // Refresh entries when page comes into focus (e.g., returning from mealtype-log page)
  const isInitialMount = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount since React Query handles initial fetch
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      // Small delay to ensure database writes are committed
      const timer = setTimeout(() => {
        if (user?.id) {
          refetchEntries();
        }
      }, 300);
      return () => clearTimeout(timer);
    }, [user?.id, refetchEntries])
  );

  // Only show error if profile is truly missing after all attempts (not loading, not retrying, and user exists)
  // Otherwise, keep UI visible and let background loading/retries happen silently
  if (!profile && !profileLoading && !loading && !retrying && user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ThemedText type="title" style={{ marginBottom: 16, textAlign: 'center' }}>
          {t('home.profile_not_found.title')}
        </ThemedText>
        <ThemedText style={{ marginBottom: 24, textAlign: 'center', paddingHorizontal: 20 }}>
          {t('home.profile_not_found.message')}
        </ThemedText>
        <TouchableOpacity
          style={[styles.errorLogoutButton, { backgroundColor: colors.tint, minWidth: 150 }]}
          onPress={signOut}
        >
          <Text style={styles.errorLogoutButtonText}>{t('home.profile_not_found.logout_button')}</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // Show a minimal loading modal if profile is not loaded yet
  // This keeps the main UI stable while loading/retrying happens in background
  const showLoadingModal = !profile && (profileLoading || loading || retrying);

  // If no profile yet, show empty UI with loading modal
  if (!profile) {
    return (
      <ThemedView style={styles.container}>
        {/* Small loading modal - only shows when profile is loading */}
        <Modal
          transparent={true}
          animationType="fade"
          visible={showLoadingModal}
          onRequestClose={() => {}}
        >
          <View 
            style={[styles.loadingModalOverlay, { backgroundColor: colors.overlay }]}
            pointerEvents="none"
          >
            <View style={[styles.loadingModalContent, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          </View>
        </Modal>
        <ScrollView 
          contentContainerStyle={styles.scrollContentContainer} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.scrollContent}>
            {/* Empty state - UI will populate when profile loads */}
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const actualAge = ageFromDob(profile.date_of_birth);
  const bmiValue = bmi(profile.height_cm, profile.weight_lb);

  // Get time of day greeting using domain utility
  const hour = new Date().getHours();
  const greetingKey = getGreetingKey(hour);
  const greeting = t(greetingKey);

  // Get BMI category using domain utility
  const bmiCategory = getBMICategory(bmiValue);

  // Calculate daily totals using domain utility
  const dailyTotals = calculateDailyTotals(calorieEntries);

  // Group entries by meal type using domain utility
  const groupedEntries = groupEntriesByMealType(calorieEntries);

  // Use meal type order from shared types
  const sortedMealTypes = MEAL_TYPE_ORDER;

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContentContainer} 
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isPulling}
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Platform.OS === 'ios' ? colors.tint : undefined}
              colors={Platform.OS === 'android' ? [colors.tint] : undefined}
              progressBackgroundColor={Platform.OS === 'android' ? colors.background : undefined}
            />
          ) : undefined
        }
        onScroll={Platform.OS === 'web' ? handleWebScroll : undefined}
        scrollEventThrottle={Platform.OS === 'web' ? 16 : undefined}
        contentOffset={Platform.OS === 'web' && isPulling ? { x: 0, y: -Math.min(pullToRefreshDistance, 80) } : undefined}
      >
        <View style={styles.scrollContent}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.greetingRow}>
                <ThemedText style={styles.greeting}>{greeting},</ThemedText>
                <ThemedText type="title" style={styles.welcomeText}>
                  {profile.first_name}!
                </ThemedText>
              </View>
            </View>
            <View style={styles.headerButtons}>
              {/* Manual Refresh Button for Web */}
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={[
                    styles.refreshButton, 
                    getMinTouchTargetStyle(),
                    { 
                      backgroundColor: colors.tint + '12',
                      ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                    }
                  ]}
                  onPress={onRefresh}
                  disabled={refreshing}
                  activeOpacity={0.6}
                  {...getButtonAccessibilityProps(
                    t('home.accessibility.refresh_entries'),
                    t('home.accessibility.refresh_hint')
                  )}
                >
                  <View 
                    style={[styles.refreshIconContainer, { backgroundColor: 'transparent' }]}
                    accessibilityElementsHidden={true}
                    importantForAccessibility="no-hide-descendants"
                  >
                    {refreshing ? (
                      <ActivityIndicator size="small" color={colors.tint} />
                    ) : (
                      <IconSymbol name="arrow.clockwise" size={20} color={colors.tint} decorative={true} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.profileButton, 
                  getMinTouchTargetStyle(),
                  { 
                    backgroundColor: colors.tint + '12',
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  }
                ]}
                onPress={() => router.push('/settings')}
                activeOpacity={0.6}
                testID="profile-button"
                {...getButtonAccessibilityProps(
                  t('home.accessibility.profile_settings'),
                  t('home.accessibility.profile_hint')
                )}
              >
                <View 
                  style={[styles.profileIconContainer, { backgroundColor: 'transparent' }]}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no-hide-descendants"
                >
                  <IconSymbol name="person.fill" size={20} color={colors.tint} decorative={true} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Navigation Section */}
          <View style={styles.dateNavigation} accessibilityRole="toolbar">
            <TouchableOpacity
              onPress={goBackOneDay}
              activeOpacity={0.6}
              style={[
                styles.dateNavButtonSimple,
                getMinTouchTargetStyle(),
                { 
                  ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                }
              ]}
              {...getButtonAccessibilityProps(
                t('home.date_picker.previous_day'),
                'Double tap to go to the previous day'
              )}
            >
              <View style={[styles.dateNavIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.dateNavButtonText, { color: colors.text }]}>‹</Text>
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
                  backgroundColor: colors.tint,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={openDatePicker}
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
                  <Text style={[styles.dateNavButtonText, { color: colors.text }]}>›</Text>
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
            onShow={() => {
              // Initialize calendar view to selected date when modal opens
              setCalendarViewMonth(new Date(selectedDate));
            }}
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
                              isSelectedDay && { backgroundColor: colors.tint },
                              isTodayDay && !isSelectedDay && { 
                                borderWidth: 1, 
                                borderColor: colors.tint,
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

          {/* Stats Grid - 4 squares */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.stats.age')}</ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {Math.round(actualAge)}
              </ThemedText>
              <ThemedText style={[styles.statUnit, { color: colors.textTertiary }]}>{t('home.stats.years')}</ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.stats.height')}</ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {Math.round(profile.height_cm)}
              </ThemedText>
              <ThemedText style={[styles.statUnit, { color: colors.textTertiary }]}>{t('units.cm')}</ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.stats.weight')}</ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {Math.round(profile.weight_lb)}
              </ThemedText>
              <ThemedText style={[styles.statUnit, { color: colors.textTertiary }]}>{t('units.lbs')}</ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: bmiCategory.color + '12' }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.stats.bmi')}</ThemedText>
              <ThemedText style={[styles.statValue, { color: bmiCategory.color }]}>
                {bmiValue.toFixed(1)}
              </ThemedText>
              <ThemedText style={[styles.statUnit, { color: bmiCategory.color, opacity: 0.85 }]}>
                {t(bmiCategory.labelKey)}
              </ThemedText>
            </View>
          </View>

          {/* Daily Totals Summary */}
          <View style={[styles.dailyTotalsCard, { backgroundColor: colors.card }]}>
            <View style={[styles.dailyTotalsHeader, { borderBottomColor: colors.separator }]}>
              <ThemedText style={[styles.dailyTotalsTitle, { color: colors.text }]}>
                {isToday ? t('home.summary.title_today') : t('home.summary.title_other')}
              </ThemedText>
              {entriesLoading ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <ThemedText style={[styles.entryCount, { color: colors.textSecondary }]}>
                  {t('home.summary.entry', { count: calorieEntries.length })}
                </ThemedText>
              )}
            </View>
            
            {!entriesLoading && (
              <View style={styles.dailyTotalsContent}>
                <View style={styles.dailyTotalsRow}>
                  {/* Total Calories - Left Side */}
                  <View style={styles.dailyTotalItem}>
                    <View style={styles.dailyTotalLabelRow}>
                      <ThemedText style={[styles.dailyTotalLabel, { color: colors.textSecondary }]}>{t('home.summary.total_calories')}</ThemedText>
                    </View>
                    <ThemedText style={[styles.dailyTotalValue, { color: colors.tint }]}>
                      {dailyTotals.calories} {t('units.kcal')}
                    </ThemedText>
                  </View>

                  {/* Macronutrients - Right Side */}
                  {(dailyTotals.protein > 0 || dailyTotals.carbs > 0 || dailyTotals.fat > 0 || dailyTotals.fiber > 0) && (
                    <View style={styles.dailyMacrosContainer}>
                      <View style={styles.dailyMacrosRow}>
                        {dailyTotals.protein > 0 && (
                          <View style={styles.dailyMacroItem}>
                            <ThemedText style={[styles.dailyMacroLabel, { color: colors.textSecondary }]}>{t('home.summary.protein')}</ThemedText>
                            <ThemedText style={[styles.dailyMacroValue, { color: colors.text }]}>
                              {dailyTotals.protein}{t('units.g')}
                            </ThemedText>
                          </View>
                        )}
                        {dailyTotals.carbs > 0 && (
                          <View style={styles.dailyMacroItem}>
                            <ThemedText style={[styles.dailyMacroLabel, { color: colors.textSecondary }]}>{t('home.summary.carbs')}</ThemedText>
                            <ThemedText style={[styles.dailyMacroValue, { color: colors.text }]}>
                              {dailyTotals.carbs}{t('units.g')}
                            </ThemedText>
                          </View>
                        )}
                        {dailyTotals.fat > 0 && (
                          <View style={styles.dailyMacroItem}>
                            <ThemedText style={[styles.dailyMacroLabel, { color: colors.textSecondary }]}>{t('home.summary.fat')}</ThemedText>
                            <ThemedText style={[styles.dailyMacroValue, { color: colors.text }]}>
                              {dailyTotals.fat}{t('units.g')}
                            </ThemedText>
                          </View>
                        )}
                        {dailyTotals.fiber > 0 && (
                          <View style={styles.dailyMacroItem}>
                            <ThemedText style={[styles.dailyMacroLabel, { color: colors.textSecondary }]}>{t('home.summary.fiber')}</ThemedText>
                            <ThemedText style={[styles.dailyMacroValue, { color: colors.text }]}>
                              {dailyTotals.fiber}{t('units.g')}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
                
                {/* Sub-fats Section - Collapsible */}
                <View style={[styles.subFatsSection, { borderTopColor: colors.separator }]}>
                  <TouchableOpacity 
                    style={[
                      styles.subFatsHeader,
                      getMinTouchTargetStyle(),
                      { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                    ]}
                    onPress={toggleSummary}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(
                      summaryExpanded ? t('home.accessibility.collapse_details') : t('home.accessibility.expand_details'),
                      t('home.accessibility.details_hint')
                    )}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: summaryExpanded }}
                  >
                    <View style={styles.subFatsHeaderRight}>
                      <ThemedText style={[styles.subFatsTitle, { color: colors.text }]}>{t('home.summary.more_details')}</ThemedText>
                      <IconSymbol 
                        name={summaryExpanded ? "chevron.up" : "chevron.down"} 
                        size={16} 
                        color={colors.textSecondary} 
                        style={{ marginLeft: 4 }}
                        decorative={true}
                      />
                    </View>
                  </TouchableOpacity>
                  {summaryExpanded && (
                    <View style={styles.subFatsRow}>
                      <View style={styles.subFatItem}>
                        <ThemedText style={[styles.subFatLabel, { color: colors.textSecondary }]}>{t('home.summary.saturated_fat')}</ThemedText>
                        <ThemedText style={[styles.subFatValue, { color: colors.text }]}>
                          {dailyTotals.saturatedFat}{t('units.g')}
                        </ThemedText>
                      </View>
                      <View style={styles.subFatItem}>
                        <ThemedText style={[styles.subFatLabel, { color: colors.textSecondary }]}>{t('home.summary.sugar')}</ThemedText>
                        <ThemedText style={[styles.subFatValue, { color: colors.text }]}>
                          {dailyTotals.sugar}{t('units.g')}
                        </ThemedText>
                      </View>
                      <View style={styles.subFatItem}>
                        <ThemedText style={[styles.subFatLabel, { color: colors.textSecondary }]}>{t('home.summary.sodium')}</ThemedText>
                        <ThemedText style={[styles.subFatValue, { color: colors.text }]}>
                          {dailyTotals.sodium}{t('units.mg')}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Today's Calorie Entries */}
          <View style={[styles.entriesSectionCard, { backgroundColor: colors.card }]}>
            <View style={styles.entriesSection}>
              {entriesLoading ? (
                <View style={[styles.emptyState, { backgroundColor: 'transparent' }]}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    {t('home.summary.loading_entries')}
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.entriesList}>
                {sortedMealTypes.map((mealType, index) => {
                  const group = groupedEntries[mealType];
                  // Use i18n for meal type labels
                  const mealTypeLabel = t(`home.meal_types.${mealType}`);
                  const isLast = index === sortedMealTypes.length - 1;
                  
                  return (
                    <View key={mealType}>
                      <View 
                        style={styles.mealGroupContainer}
                      >
                      {/* Meal Type Header with Totals and Log Food Button */}
                      <View style={styles.mealGroupHeader}>
                        <View style={styles.mealGroupHeaderLeft}>
                          <TouchableOpacity
                            style={[
                              styles.mealTypeBadge, 
                              getMinTouchTargetStyle(),
                              { 
                                backgroundColor: colorScheme === 'dark' ? colors.tint + '25' : colors.tint + '12',
                                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                              }
                            ]}
                            onPress={() => {
                              // Filter entries for this meal type and date (may be empty array if no entries)
                              const mealTypeEntries = group.entries.filter(entry => 
                                entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                entry.entry_date === selectedDateString
                              );
                              // Always go to mealtype-log page (whether entries exist or not)
                              router.push({
                                pathname: '/mealtype-log',
                                params: { 
                                  mealType: mealType,
                                  entryDate: selectedDateString,
                                  preloadedEntries: JSON.stringify(mealTypeEntries)
                                }
                              });
                            }}
                            activeOpacity={0.7}
                            {...getButtonAccessibilityProps(
                              `Log food for ${mealTypeLabel}`,
                              t('home.accessibility.log_food_hint', { mealType: mealTypeLabel })
                            )}
                          >
                            <View style={styles.mealTypeBadgeContent}>
                              <ThemedText style={[styles.mealTypeText, { color: colors.tint }]}>
                                {mealTypeLabel}
                              </ThemedText>
                              <View 
                                style={styles.mealTypeEditIcons}
                                accessibilityElementsHidden={true}
                                importantForAccessibility="no-hide-descendants"
                              >
                                <IconSymbol name="pencil" size={12} color={colors.tint} decorative={true} />
                                <IconSymbol name="fork.knife" size={12} color={colors.tint} decorative={true} />
                              </View>
                            </View>
                          </TouchableOpacity>
                          {/* Show "← Log Food" immediately after meal type badge when no entries (except for Late Night) */}
                          {group.entries.length === 0 && mealType !== 'late_night' && (
                            <View style={styles.addFoodPrompt}>
                              <ThemedText style={[styles.addFoodPromptText, { color: colors.tint }]}>
                                {t('home.food_log.log_food_prompt')}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                        <View style={styles.mealGroupHeaderRight}>
                          {/* Show calories when there are entries */}
                          {group.entries.length > 0 && (
                            <View style={styles.mealGroupCalories}>
                              <ThemedText style={[styles.mealGroupCaloriesValue, { color: colors.tint }]}>
                                {Math.round(group.totalCalories)} {t('home.food_log.kcal')}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Individual Entries as Descriptions */}
                      {group.entries.length > 0 && (
                        <View style={styles.mealGroupItems}>
                          {/* Consolidated view for all entries (1 or more) */}
                          {(() => {
                            // Combine all items into one sentence
                            const consolidatedItems = group.entries.map(entry => {
                              // Format: "1 x g Tofu" or "2 x servings Apple"
                              const quantity = Math.round(entry.quantity) === entry.quantity 
                                ? entry.quantity.toString() 
                                : entry.quantity.toFixed(1);
                              return `${quantity} x ${entry.unit} ${entry.item_name}`;
                            }).join(', ');
                            
                            return (
                              <View key={`items-${mealType}`} style={styles.mealGroupItem}>
                                <View style={styles.mealGroupItemLeft}>
                                  <ThemedText 
                                    style={[styles.mealGroupItemName, { color: colors.text }]}
                                    numberOfLines={6}
                                    ellipsizeMode="tail"
                                  >
                                    {consolidatedItems}
                                  </ThemedText>
                                </View>
                              </View>
                            );
                          })()}
                        </View>
                      )}
                      </View>
                      {!isLast && (
                        <View style={[styles.mealTypeDivider, { backgroundColor: colors.separator }]} />
                      )}
                    </View>
                  );
                })}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Footer with ADMIN Button - Only show if user is admin */}
      {isAdmin && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.separator }]}>
          <View style={styles.footerContent}>
            <View style={styles.footerSpacer} />
            <TouchableOpacity
              style={[
                styles.adminButton,
                getMinTouchTargetStyle(),
                {
                  backgroundColor: colors.tint,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={() => {
                router.push('/admin-page');
              }}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                t('home.admin_button'),
                'Double tap to open admin panel'
              )}
            >
              <Text style={styles.adminButtonText}>{t('home.admin_button')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
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
    maxWidth: 600,
    ...Platform.select({
      web: {
        padding: 16,
        paddingTop: 30,
        paddingBottom: 16,
      },
      default: {
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: 100, // Extra padding for FAB
      },
    }),
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
    minWidth: 0, // Allow text to wrap
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
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  profileIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  refreshIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: Platform.select({ web: 8, default: 4 }),
    paddingHorizontal: 0,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  dateNavButtonSimple: {
    paddingHorizontal: Platform.select({ web: 4, default: 4 }),
    paddingVertical: Platform.select({ web: 4, default: 4 }),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44, // Better touch target
    minHeight: 44,
  },
  dateNavIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  dateNavButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  todayButton: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dateNavButtonText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: Platform.select({ web: 4, default: 2 }),
  },
  dateDisplayText: {
    fontSize: Platform.select({ web: 14, default: 13 }),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
    paddingHorizontal: 0,
    flexShrink: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ web: 6, default: 8 }),
    marginBottom: 16,
  },
  statCard: {
    flex: Platform.select({ web: 1, default: 0 }),
    width: Platform.select({ web: 'auto', default: '47%' }), // 2 columns on mobile
    padding: Platform.select({ web: 12, default: 14 }),
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 90,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  statLabel: {
    fontSize: Platform.select({ web: 9, default: 10 }),
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    opacity: 0.7,
  },
  statValue: {
    fontSize: Platform.select({ web: 22, default: 20 }),
    fontWeight: 'bold',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: Platform.select({ web: 10, default: 11 }),
    opacity: 1.0,
    fontWeight: '500',
  },
  dailyTotalsCard: {
    padding: Platform.select({ web: 16, default: 18 }),
    borderRadius: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
        transition: 'box-shadow 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  dailyTotalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    opacity: 0.4,
  },
  dailyTotalsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyTotalsTitle: {
    fontSize: Platform.select({ web: 16, default: 18 }),
    fontWeight: 'bold',
    letterSpacing: -0.2,
  },
  dailyTotalsContent: {
    gap: 0,
  },
  dailyTotalsRow: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    justifyContent: 'space-between',
    alignItems: Platform.select({ web: 'flex-start', default: 'stretch' }),
    gap: Platform.select({ web: 20, default: 16 }),
  },
  dailyTotalItem: {
    flex: 1,
    minWidth: 0,
  },
  dailyTotalLabelRow: {
    marginBottom: 2,
  },
  dailyTotalLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
    opacity: 1.0,
  },
  dailyTotalValue: {
    fontSize: Platform.select({ web: 28, default: 24 }),
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  dailyMacrosContainer: {
    flex: Platform.select({ web: 1, default: 0 }),
    alignItems: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    justifyContent: 'flex-start',
    width: Platform.select({ web: 'auto', default: '100%' }),
  },
  dailyMacrosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ web: 16, default: 12 }),
    justifyContent: Platform.select({ web: 'flex-end', default: 'flex-start' }),
  },
  dailyMacroItem: {
    alignItems: 'center',
    minWidth: Platform.select({ web: 50, default: 60 }),
  },
  dailyMacroLabel: {
    fontSize: Platform.select({ web: 9, default: 10 }),
    fontWeight: '600',
    opacity: 1.0,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dailyMacroValue: {
    fontSize: Platform.select({ web: 14, default: 15 }),
    fontWeight: 'bold',
  },
  subFatsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    opacity: 0.3,
  },
  subFatsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 4,
  },
  subFatsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subFatsTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subFatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  subFatItem: {
    alignItems: 'flex-start',
    minWidth: 70,
  },
  subFatLabel: {
    fontSize: 9,
    fontWeight: '600',
    opacity: 1.0,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subFatValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  entriesSectionCard: {
    padding: Platform.select({ web: 16, default: 18 }),
    borderRadius: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
        transition: 'box-shadow 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  entriesSection: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: Platform.select({ web: 18, default: 20 }),
    fontWeight: 'bold',
    letterSpacing: -0.2,
  },
  entryCount: {
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '600',
  },
  entriesList: {
    gap: 0,
  },
  mealGroupContainer: {
    width: '100%',
    marginBottom: Platform.select({ web: 6, default: 8 }),
  },
  mealTypeDivider: {
    height: 2,
    width: '100%',
    marginTop: Platform.select({ web: 8, default: 10 }),
    marginBottom: Platform.select({ web: 8, default: 10 }),
    opacity: 0.6,
  },
  mealGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Platform.select({ web: 6, default: 8 }),
    paddingHorizontal: 0,
    flexWrap: 'wrap',
    gap: Platform.select({ web: 4, default: 4 }),
  },
  mealGroupDivider: {
    height: 1,
    width: '100%',
    marginBottom: Platform.select({ web: 8, default: 12 }),
  },
  mealGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ web: 10, default: 8 }),
    flex: Platform.select({ web: 1, default: 1 }),
    flexShrink: 1,
    minWidth: 0,
  },
  mealGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  mealTypeBadge: {
    paddingHorizontal: Platform.select({ web: 14, default: 16 }),
    paddingTop: Platform.select({ web: 0, default: 0 }),
    paddingBottom: Platform.select({ web: 0, default: 0 }),
    borderRadius: 12,
    minHeight: 44, // Better touch target
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  mealTypeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealTypeText: {
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    lineHeight: Platform.select({ web: 12, default: 13 }),
    marginBottom: Platform.select({ web: -1, default: -2 }),
    paddingBottom: 0,
    ...Platform.select({
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center',
      },
    }),
  },
  mealTypeEditIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  mealGroupItemCount: {
    fontSize: Platform.select({ web: 11, default: 12 }),
    opacity: 1.0,
    fontWeight: '500',
  },
  mealGroupTotals: {
    alignItems: 'flex-end',
  },
  mealGroupTotalsRow: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    alignItems: Platform.select({ web: 'center', default: 'flex-end' }),
    gap: Platform.select({ web: 12, default: 6 }),
  },
  mealGroupCalories: {
    alignItems: 'flex-end',
  },
  mealGroupCaloriesValue: {
    fontSize: Platform.select({ web: 15, default: 16 }),
    fontWeight: '600',
  },
  mealGroupCaloriesLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  addFoodPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  addFoodPromptText: {
    fontSize: Platform.select({ web: 13, default: 13 }),
    fontWeight: '600',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  mealGroupMacrosGrid: {
    flexDirection: 'column',
    gap: Platform.select({ web: 4, default: 1 }),
  },
  mealGroupMacrosRow: {
    flexDirection: 'row',
    gap: Platform.select({ web: 10, default: 2 }),
  },
  mealGroupMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: Platform.select({ web: 4, default: 2 }), // Minimal spacing under calories
    width: '100%',
  },
  mealGroupMacroItem: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: Platform.select({ web: 1, default: 0 }), // No vertical spacing
    minWidth: 0, // No minWidth
    paddingHorizontal: Platform.select({ web: 0, default: 0 }), // No horizontal padding
    marginHorizontal: Platform.select({ web: 0, default: 0 }), // No horizontal margin
  },
  mealGroupMacroLabel: {
    fontSize: Platform.select({ web: 9, default: 8 }),
    fontWeight: '600',
    opacity: 1.0,
    margin: 0,
    padding: 0,
    lineHeight: Platform.select({ web: 12, default: 10 }),
  },
  mealGroupMacroValue: {
    fontSize: Platform.select({ web: 10, default: 9 }),
    fontWeight: '600',
    margin: 0,
    padding: 0,
    lineHeight: Platform.select({ web: 12, default: 10 }),
  },
  mealGroupItems: {
    gap: 1,
  },
  mealGroupItemsEmpty: {
    gap: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  mealGroupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.select({ web: 4, default: 6 }),
    paddingHorizontal: 0,
  },
  mealGroupItemEmpty: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  mealGroupItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  mealGroupItemName: {
    fontSize: Platform.select({ web: 13, default: 14 }),
    fontWeight: '500',
    marginBottom: 0,
    opacity: 0.9,
    lineHeight: Platform.select({ web: undefined, default: 20 }),
  },
  mealGroupItemNameEmpty: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 0,
    opacity: 0.6,
  },
  mealGroupItemTime: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: '400',
  },
  mealGroupItemRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  mealGroupItemQuantity: {
    fontSize: 10,
    opacity: 1.0,
    marginBottom: 0,
  },
  mealGroupItemCalories: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.7,
    lineHeight: 18,
  },
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModalContent: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  logFoodButtonInline: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  logFoodButtonIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calendarButton: {
    width: Platform.select({ web: 44, default: 44 }),
    height: Platform.select({ web: 44, default: 44 }),
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(10, 126, 164, 0.25)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
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
  datePickerTodayButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 44,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(10, 126, 164, 0.25)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  datePickerTodayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorLogoutButton: {
    paddingHorizontal: Platform.select({ web: 14, default: 16 }),
    paddingVertical: Platform.select({ web: 8, default: 10 }),
    borderRadius: 8,
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  errorLogoutButtonText: {
    color: '#fff',
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  webRefreshIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    ...Platform.select({
      web: {
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      },
    }),
  },
  webRefreshIconContainer: {
    marginBottom: 8,
  },
  webRefreshText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    width: '100%',
    borderTopWidth: 1,
    ...Platform.select({
      web: {
        position: 'sticky',
        bottom: 0,
        zIndex: 100,
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  footerContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Platform.select({ web: 16, default: 16 }),
    paddingVertical: Platform.select({ web: 12, default: 12 }),
    paddingBottom: Platform.select({ web: 12, default: 16 }),
  },
  footerSpacer: {
    flex: 1,
  },
  adminButton: {
    paddingHorizontal: 20,
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
        elevation: 3,
      },
    }),
  },
  adminButtonText: {
    color: '#fff',
    fontSize: Platform.select({ web: 13, default: 14 }),
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
