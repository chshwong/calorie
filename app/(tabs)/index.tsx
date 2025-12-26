import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DateHeader } from '@/components/date-header';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { ScreenHeaderContainer } from '@/components/layout/screen-header-container';
import { SummaryCardHeader } from '@/components/layout/summary-card-header';
import { TightBrandHeader } from '@/components/layout/tight-brand-header';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { getGreetingKey } from '@/utils/bmi';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Layout, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { calculateDailyTotals, groupEntriesByMealType, formatEntriesForDisplay } from '@/utils/dailyTotals';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { MEAL_TYPE_ORDER, type CalorieEntry } from '@/utils/types';
import { useUserConfig } from '@/hooks/use-user-config';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { getLocalDateKey } from '@/utils/dateTime';
import { useQueryClient } from '@tanstack/react-query';
import { fetchFrequentFoods } from '@/lib/services/frequentFoods';
import { fetchRecentFoods } from '@/lib/services/recentFoods';
import { fetchCustomFoods } from '@/lib/services/customFoods';
import { fetchBundles } from '@/lib/services/bundles';
import { useCloneMealTypeFromPreviousDay } from '@/hooks/use-clone-meal-type-from-previous-day';
import { showAppToast } from '@/components/ui/app-toast';
import { useCopyFromYesterday } from '@/hooks/useCopyFromYesterday';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useMealtypeMeta } from '@/hooks/use-mealtype-meta';
import { useUpsertMealtypeMeta } from '@/hooks/use-upsert-mealtype-meta';
import { useCopyMealtypeEntries } from '@/hooks/use-copy-mealtype-entries';
import { NoteEditor } from '@/components/note-editor';
import { CopyMealtypeModal } from '@/components/copy-mealtype-modal';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
import { getEntriesForDate } from '@/lib/services/calorieEntries';
import { getMealtypeMetaByDate } from '@/lib/services/calories-entries-mealtype-meta';
import { MacroGauge } from '@/components/MacroGauge';

// Component for copy from yesterday button on meal type chip
type MealTypeCopyButtonProps = {
  mealType: string;
  mealTypeLabel: string;
  selectedDate: Date;
  isToday: boolean;
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string, options?: any) => string;
};

function MealTypeCopyButton({ mealType, mealTypeLabel, selectedDate, isToday, colors, t }: MealTypeCopyButtonProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isCopyingFromYesterday, runCopyFromYesterday } = useCopyFromYesterday();
  const [isTemporarilyDisabled, setIsTemporarilyDisabled] = useState(false);
  
  const { cloneMealTypeFromPreviousDay, isLoading } = useCloneMealTypeFromPreviousDay({
    currentDate: selectedDate,
    mealType,
    onSuccess: (result) => {
      if (result.totalCount > 0) {
        showAppToast(t('home.previous_day_copy.success_message', {
          count: result.totalCount,
          items: result.totalCount === 1 ? t('home.previous_day_copy.item_one') : t('home.previous_day_copy.item_other'),
        }));
      }
    },
    onError: (error: Error) => {
      // Handle nothing to copy error
      if (error.message === 'NOTHING_TO_COPY') {
        showAppToast(t('home.previous_day_copy.nothing_to_copy'));
        return;
      }
      // Handle same-date error specifically
      if (error.message === 'SAME_DATE' || error.message?.includes('same date')) {
        Alert.alert(
          t('home.previous_day_copy.error_title'),
          t('home.previous_day_copy.same_date_error')
        );
      } else {
        Alert.alert(
          t('home.previous_day_copy.error_title'),
          t('home.previous_day_copy.error_message', {
            error: error.message || t('common.unexpected_error'),
          })
        );
      }
    },
  });

  const handleCopy = () => {
    // Check cache for previous day before cloning
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDateString = getLocalDateKey(previousDay);
    
    // Use React Query cache to check if previous day has entries or notes for this meal type
    const previousDayQueryKey = ['entries', user?.id, previousDateString];
    const cachedPreviousDayEntries = queryClient.getQueryData<any[]>(previousDayQueryKey);
    const previousDayMetaQueryKey = ['mealtypeMeta', user?.id, previousDateString];
    const cachedPreviousDayMeta = queryClient.getQueryData<any[]>(previousDayMetaQueryKey);
    
    // Check if there's anything to copy: entries or notes
    let hasEntries = false;
    let hasNotes = false;
    
    // Check entries
    if (cachedPreviousDayEntries !== undefined) {
      if (cachedPreviousDayEntries !== null && cachedPreviousDayEntries.length > 0) {
        const mealTypeEntries = cachedPreviousDayEntries.filter(entry => 
          entry.meal_type?.toLowerCase() === mealType.toLowerCase()
        );
        hasEntries = mealTypeEntries.length > 0;
      }
    }
    
    // Check notes from meta
    if (cachedPreviousDayMeta !== undefined && cachedPreviousDayMeta !== null) {
      const mealTypeMeta = cachedPreviousDayMeta.find(meta => 
        meta.meal_type?.toLowerCase() === mealType.toLowerCase()
      );
      if (mealTypeMeta) {
        hasNotes = mealTypeMeta.note != null && mealTypeMeta.note.trim().length > 0;
      }
    }
    
    // If cache exists and there's nothing to copy, show message and skip DB call
    if (cachedPreviousDayEntries !== undefined && cachedPreviousDayMeta !== undefined) {
      if (!hasEntries && !hasNotes) {
        showAppToast(t('home.previous_day_copy.nothing_to_copy'));
        return;
      }
    }
    
    // Disable button for 3 seconds to prevent multiple clicks
    setIsTemporarilyDisabled(true);
    setTimeout(() => {
      setIsTemporarilyDisabled(false);
    }, 3000);
    
    runCopyFromYesterday(() => cloneMealTypeFromPreviousDay());
  };

  return (
    <View style={styles.copyFromYesterdayButton}>
      {isCopyingFromYesterday ? (
        <ActivityIndicator size="small" color={colors.tint} />
      ) : (
        <>
          <TouchableOpacity
            onPress={handleCopy}
            activeOpacity={0.7}
            disabled={isCopyingFromYesterday || isTemporarilyDisabled}
            {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
            {...getButtonAccessibilityProps(
              isToday 
                ? t('home.previous_day_copy.accessibility_label_yesterday', { mealType: mealTypeLabel })
                : t('home.previous_day_copy.accessibility_label_previous', { mealType: mealTypeLabel })
            )}
          >
            <IconSymbol name="doc.on.doc" size={19} color={isTemporarilyDisabled ? colors.textSecondary : colors.tint} />
          </TouchableOpacity>
          <ThemedText style={[styles.copyFromYesterdayButtonText, { color: colors.tint }]}>
            {isToday 
              ? t('home.previous_day_copy.label_yesterday')
              : t('home.previous_day_copy.label_previous')}
          </ThemedText>
        </>
      )}
    </View>
  );
}

/**
 * Format a single meal entry for display on home page meal cards
 * Manual entries (food_id is null/undefined) are formatted as "⚡Food-Name"
 * Non-manual entries use the standard format: "qty x unit food-name"
 */
function formatMealEntryLabel(entry: CalorieEntry): string {
  // Manual entries have no food_id
  if (!entry.food_id) {
    return `⚡${entry.item_name}`;
  }
  
  // Non-manual entries: "qty x unit food-name"
  const quantity = Math.round(entry.quantity) === entry.quantity 
    ? entry.quantity.toString() 
    : entry.quantity.toFixed(1);
  return `${quantity} x ${entry.unit} ${entry.item_name}`;
}

export default function FoodLogHomeScreen() {
  const { t } = useTranslation();
  const { signOut, loading, retrying, user, profile: authProfile } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [refreshing, setRefreshing] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  
  // Menu state for meal type options
  const [threeDotMealMenuVisible, setThreeDotMealMenuVisible] = useState<{ mealType: string | null }>({ mealType: null });
  
  
  // Note editor state
  const [noteEditor, setNoteEditor] = useState<{ visible: boolean; mealType: string | null }>({ visible: false, mealType: null });
  
  // Copy mealtype modal state
  const [copyMealtypeModal, setCopyMealtypeModal] = useState<{ visible: boolean; mealType: string | null }>({ visible: false, mealType: null });

  // SECURITY: Check if we're in password recovery mode and block access
  const { isPasswordRecovery } = useAuth();
  useEffect(() => {
    const inRecoveryMode = isPasswordRecovery();
    
    if (inRecoveryMode) {
      // User is in password recovery mode - redirect to reset-password page
      router.replace('/reset-password');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // Only depend on router, call isPasswordRecovery inside effect
  
  // Pull-to-refresh state for web
  const [pullToRefreshDistance, setPullToRefreshDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const pullDistance = useRef<number>(0);
  
  // Use shared date hook
  const {
    selectedDate,
    selectedDateString,
    isToday,
    today,
  } = useSelectedDate();

  const queryClient = useQueryClient();

  // Fetch mealtype meta
  const { dataByMealType } = useMealtypeMeta(selectedDateString);
  
  // Mutation for upserting mealtype meta
  const upsertMealtypeMetaMutation = useUpsertMealtypeMeta();
  
  // Mutation for copying mealtype entries
  const copyMealtypeMutation = useCopyMealtypeEntries();


  const prefetchDateData = useCallback(
    (dateString: string) => {
      if (!user?.id) return;
      const entriesKey = ['entries', user.id, dateString];
      if (!queryClient.getQueryData(entriesKey)) {
        queryClient.prefetchQuery({
          queryKey: entriesKey,
          queryFn: () => getEntriesForDate(user.id, dateString),
          staleTime: 10 * 60 * 1000,
          gcTime: 24 * 60 * 60 * 1000,
        });
      }

      const metaKey = ['mealtypeMeta', user.id, dateString];
      if (!queryClient.getQueryData(metaKey)) {
        queryClient.prefetchQuery({
          queryKey: metaKey,
          queryFn: () => getMealtypeMetaByDate(user.id!, dateString),
          staleTime: 10 * 60 * 1000,
          gcTime: 24 * 60 * 60 * 1000,
        });
      }
    },
    [queryClient, user?.id]
  );

  // Helper function to navigate with new date (updates URL param)
  const navigateWithDate = useCallback(
    (date: Date) => {
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      prefetchDateData(dateString);
      router.replace({
        pathname: '/',
        params: { date: dateString }
      });
    },
    [prefetchDateData, router]
  );

  const { data: userConfig, isLoading: userConfigLoading } = useUserConfig();

  const {
    data: calorieEntries,
    isLoading: entriesLoading,
    isFetching: entriesFetching,
    refetch: refetchEntries,
  } = useDailyEntries(selectedDateString);

  // Entries: use cache immediately
  const entries = calorieEntries ?? [];
  const showLoadingSpinner =
    entriesLoading && entries.length === 0 && calorieEntries === undefined;

  // UserConfig: use cache immediately
  const cachedUserConfig =
    userConfig ?? queryClient.getQueryData(['userConfig', user?.id]);
  const isUserConfigLoading = userConfigLoading && !cachedUserConfig;
  
  // Get effective profile (from useUserConfig hook or AuthContext fallback)
  const effectiveProfile = cachedUserConfig ?? authProfile;

  // Background prefetch for mealtype-log tab data (after Home data is ready)
  // Use default meal type 'late_night' (same as mealtype-log default)
  const defaultMealType = 'late_night';
  useEffect(() => {
    // Only wait for initial load if there's no cached data
    // If entries exist in cache, we can proceed with prefetching
    if (!user?.id) return;
    
    // Silently prefetch tab data in the background, but only if not already cached
    const frequentFoodsKey = ['frequentFoods', user.id, defaultMealType];
    if (!queryClient.getQueryData(frequentFoodsKey)) {
      queryClient.prefetchQuery({
        queryKey: frequentFoodsKey,
        queryFn: () => fetchFrequentFoods(user.id, defaultMealType),
      });
    }
    
    const recentFoodsKey = ['recentFoods', user.id, defaultMealType];
    if (!queryClient.getQueryData(recentFoodsKey)) {
      queryClient.prefetchQuery({
        queryKey: recentFoodsKey,
        queryFn: () => fetchRecentFoods(user.id, defaultMealType),
      });
    }
    
    const customFoodsKey = ['customFoods', user.id];
    if (!queryClient.getQueryData(customFoodsKey)) {
      queryClient.prefetchQuery({
        queryKey: customFoodsKey,
        queryFn: () => fetchCustomFoods(user.id),
      });
    }
    
    const bundlesKey = ['bundles', user.id];
    if (!queryClient.getQueryData(bundlesKey)) {
      queryClient.prefetchQuery({
        queryKey: bundlesKey,
        queryFn: () => fetchBundles(user.id),
      });
    }
  }, [user?.id, queryClient]);


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

  const profileNotFound = !cachedUserConfig && !isUserConfigLoading && !loading && !retrying && user;

  const showLoadingModal = !cachedUserConfig && isUserConfigLoading;

  const { dailyTotals, groupedEntries } = useMemo(() => {
    const totals = calculateDailyTotals(entries, dataByMealType);
    const grouped = groupEntriesByMealType(entries, dataByMealType);
    return { dailyTotals: totals, groupedEntries: grouped };
  }, [dataByMealType, entries, selectedDateString]);

  const proteinConsumed = Number(dailyTotals?.protein ?? 0);
  // AUTHORITATIVE: onboarding target column only (no legacy fallbacks)
  const proteinTarget = Number((effectiveProfile as any)?.protein_g_min ?? 0);

  const fiberConsumed = Number(dailyTotals?.fiber ?? 0);
  const fiberTarget = Number((effectiveProfile as any)?.fiber_g_min ?? 0);

  // DEV ONLY: bust caches once so new profile columns show up immediately
  const didInvalidateProfileQueriesRef = useRef(false);
  useEffect(() => {
    if (!__DEV__) return;
    if (didInvalidateProfileQueriesRef.current) return;
    if (!user?.id) return;
    didInvalidateProfileQueriesRef.current = true;

    // userConfig is the primary cache that backs effectiveProfile on Home
    queryClient.invalidateQueries({ queryKey: ['userConfig', user.id] });
    // userProfile is used elsewhere (onboarding/profile screens)
    queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });
  }, [queryClient, user?.id]);

  // Use meal type order from shared types
  const sortedMealTypes = MEAL_TYPE_ORDER;


  // Handlers for Notes
  const handleNotes = (mealType: string) => {
    setThreeDotMealMenuVisible({ mealType: null });
    setNoteEditor({ visible: true, mealType });
  };

  const handleNoteSave = (mealType: string, note: string | null) => {
    upsertMealtypeMetaMutation.mutate(
      {
        entryDate: selectedDateString,
        mealType,
        note,
      },
      {
        onSuccess: () => {
          setNoteEditor({ visible: false, mealType: null });
        },
        onError: (error) => {
          console.error('Error saving note:', error);
          Alert.alert(t('common.error', { defaultValue: 'Error' }), t('food.note.save_error', { defaultValue: 'Failed to save note' }));
        },
      }
    );
  };

  const handleQuickLog = (mealType: string) => {
    setThreeDotMealMenuVisible({ mealType: null });
    // Navigate to dedicated Quick Log screen
    router.push({
      pathname: '/quick-log',
      params: {
        date: selectedDateString,
        mealType: mealType,
      }
    });
  };

  const handleCopyTo = (mealType: string) => {
    setThreeDotMealMenuVisible({ mealType: null });
    setCopyMealtypeModal({ visible: true, mealType });
  };

  const handleCopyConfirm = (mealType: string, targetDate: Date, targetMealType: string, includeNotes: boolean) => {
    const targetDateString = getLocalDateKey(targetDate);
    
    // Helper to check if two dates are the same day
    const isSameDay = (date1: string, date2: string): boolean => {
      return date1 === date2;
    };
    
    // Prevent copying to the same meal type on the same date
    const sameDay = isSameDay(selectedDateString, targetDateString);
    const sameMealType = mealType.toLowerCase() === targetMealType.toLowerCase();
    
    if (sameDay && sameMealType) {
      showAppToast(
        t('food.copy.same_meal_error', {
          defaultValue: "You can't copy into the same meal. Pick another meal or date.",
        })
      );
      return; // Don't proceed with the copy
    }
    
    copyMealtypeMutation.mutate(
      {
        sourceDate: selectedDateString,
        sourceMealType: mealType,
        targetDate: targetDateString,
        targetMealType,
        includeNotes,
      },
      {
        onSuccess: (result) => {
          setCopyMealtypeModal({ visible: false, mealType: null });
          const mealTypeLabel = t(`home.meal_types.${targetMealType}`);
          const dateLabel = targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          
          // Calculate total count: entries + notes (1 if copied)
          let totalCount = result.entriesCloned;
          if (result.notesCopied) {
            totalCount += 1;
          }
          
          showAppToast(
            t('food.copy.success_toast', {
              defaultValue: '{{count}} item(s) copied to {{mealType}} on {{date}}',
              count: totalCount,
              mealType: mealTypeLabel,
              date: dateLabel,
            })
          );
        },
        onError: (error: Error) => {
          setCopyMealtypeModal({ visible: false, mealType: null });
          if (error.message === 'SAME_DATE') {
            showAppToast(t('food.copy.same_date_error', { defaultValue: 'Cannot copy to the same date and meal type' }));
          } else {
            showAppToast(t('food.copy.error_message', { defaultValue: 'Unable to copy entries. Please try again.' }));
          }
        },
      }
    );
  };

  // Construct greeting text
  const hour = new Date().getHours();
  const greetingKey = getGreetingKey(hour);
  const greeting = t(greetingKey);
  const greetingText = `${greeting}, ${effectiveProfile?.first_name || ''}!`;

  // Construct date text
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
    ...(isCurrentYear ? {} : { year: 'numeric' })
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  const dateText = isToday
    ? `${t('common.today')}, ${formattedDate}`
    : selectedDate.getTime() === yesterday.getTime()
    ? `${t('common.yesterday')}, ${formattedDate}`
    : formattedDate;

  return (
    <ThemedView style={styles.container}>
      <OfflineBanner />
      <CollapsibleModuleHeader
        greetingText={greetingText}
        dateText={dateText}
        rightAvatarUri={effectiveProfile?.avatar_url ?? undefined}
        preferredName={effectiveProfile?.first_name ?? undefined}
        rightAction={
          <DatePickerButton
            selectedDate={selectedDate}
            onDateSelect={navigateWithDate}
            today={today}
          />
        }
        goBackOneDay={() => {
          const newDate = new Date(selectedDate);
          newDate.setDate(newDate.getDate() - 1);
          navigateWithDate(newDate);
        }}
        goForwardOneDay={() => {
          if (!isToday) {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            navigateWithDate(newDate);
          }
        }}
        isToday={isToday}
        module="food"
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
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>

            {/* Daily Totals Summary */}
            <View style={[styles.dailyTotalsCard, { backgroundColor: colors.card }]}>
              <SummaryCardHeader
                titleKey="home.summary.title_other"
                icon="fork.knife"
                isLoading={showLoadingSpinner}
                rightContent={
                  entries.length > 0 ? (
                    <ThemedText style={[styles.entryCount, { color: colors.textSecondary }]}>
                      {t('home.summary.entry', { count: entries.length })}
                    </ThemedText>
                  ) : undefined
                }
                style={{ borderBottomWidth: 1, borderBottomColor: colors.separator }}
              />
            
            {(entries.length > 0 || !showLoadingSpinner) && (
              <View style={styles.dailyTotalsContent}>
                <View style={styles.dailyTotalsMainRow}>
                  {/* Total Calories - Left Side */}
                  <View style={styles.dailyTotalItem}>
                    <ThemedText style={[styles.dailyTotalLabel, { color: colors.textSecondary }]}>{t('home.summary.total_calories')}</ThemedText>
                    <ThemedText style={[styles.dailyTotalValue, { color: colors.tint }]}>
                      {dailyTotals.calories} {t('units.kcal')}
                    </ThemedText>
                  </View>

                  {/* Macro Gauge - Right Side */}
                  {(dailyTotals.protein > 0 || dailyTotals.carbs > 0 || dailyTotals.fat > 0) && (() => {
                    const totalMacros = dailyTotals.protein + dailyTotals.carbs + dailyTotals.fat;
                    const proteinFlex = totalMacros > 0 ? dailyTotals.protein : 0;
                    const carbsFlex = totalMacros > 0 ? dailyTotals.carbs : 0;
                    const fatFlex = totalMacros > 0 ? dailyTotals.fat : 0;
                    
                    const segments = [];
                    if (proteinFlex > 0) segments.push({ flex: proteinFlex, color: '#10B981' });
                    if (carbsFlex > 0) segments.push({ flex: carbsFlex, color: '#F59E0B' });
                    if (fatFlex > 0) segments.push({ flex: fatFlex, color: '#8B5CF6' });
                    
                    return (
                      <View style={styles.dailyMacrosContainer}>
                        {/* Horizontal Gauge Bar */}
                        <View style={styles.macroGaugeBar}>
                          {segments.map((segment, index) => {
                            const isFirst = index === 0;
                            const isLast = index === segments.length - 1;
                            const borderRadius = Platform.select({ web: 5, default: 4 });
                            
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.macroGaugeSegment,
                                  {
                                    flex: segment.flex,
                                    backgroundColor: segment.color,
                                    borderTopLeftRadius: isFirst ? borderRadius : 0,
                                    borderBottomLeftRadius: isFirst ? borderRadius : 0,
                                    borderTopRightRadius: isLast ? borderRadius : 0,
                                    borderBottomRightRadius: isLast ? borderRadius : 0,
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                        
                        {/* Compact Legend */}
                        <View style={styles.macroLegend}>
                          {dailyTotals.protein > 0 && (
                            <View style={styles.macroLegendItem}>
                              <View style={[styles.macroLegendDot, { backgroundColor: '#10B981' }]} />
                              <ThemedText style={[styles.macroLegendText, { color: colors.textSecondary }]}>
                                {t('home.summary.protein')} {dailyTotals.protein}{t('units.g')}
                              </ThemedText>
                            </View>
                          )}
                          {dailyTotals.carbs > 0 && (
                            <View style={styles.macroLegendItem}>
                              <View style={[styles.macroLegendDot, { backgroundColor: '#F59E0B' }]} />
                              <ThemedText style={[styles.macroLegendText, { color: colors.textSecondary }]}>
                                {t('home.summary.carbs')} {dailyTotals.carbs}{t('units.g')}
                              </ThemedText>
                            </View>
                          )}
                          {dailyTotals.fat > 0 && (
                            <View style={styles.macroLegendItem}>
                              <View style={[styles.macroLegendDot, { backgroundColor: '#8B5CF6' }]} />
                              <ThemedText style={[styles.macroLegendText, { color: colors.textSecondary }]}>
                                {t('home.summary.fat')} {dailyTotals.fat}{t('units.g')}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })()}
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
                      <ThemedText style={[styles.subFatsTitle, { color: colors.textSecondary }]}>{t('home.summary.more_details')}</ThemedText>
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
                        <ThemedText style={[styles.subFatValue, { color: colors.textSecondary }]}>
                          {dailyTotals.saturatedFat}{t('units.g')}
                        </ThemedText>
                      </View>
                      <View style={styles.subFatItem}>
                        <ThemedText style={[styles.subFatLabel, { color: colors.textSecondary }]}>{t('home.summary.trans_fat')}</ThemedText>
                        <ThemedText style={[styles.subFatValue, { color: colors.textSecondary }]}>
                          {dailyTotals.transFat}{t('units.g')}
                        </ThemedText>
                      </View>
                      <View style={styles.subFatItem}>
                        <ThemedText style={[styles.subFatLabel, { color: colors.textSecondary }]}>{t('home.summary.sugar')}</ThemedText>
                        <ThemedText style={[styles.subFatValue, { color: colors.textSecondary }]}>
                          {dailyTotals.sugar}{t('units.g')}
                        </ThemedText>
                      </View>
                      <View style={styles.subFatItem}>
                        <ThemedText style={[styles.subFatLabel, { color: colors.textSecondary }]}>{t('home.summary.sodium')}</ThemedText>
                        <ThemedText style={[styles.subFatValue, { color: colors.textSecondary }]}>
                          {dailyTotals.sodium}{t('units.mg')}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <View
              style={[
                { flexDirection: 'row' },
                // Web supports gap/columnGap reliably; native fallback uses marginRight on items
                Platform.OS === 'web' ? ({ columnGap: 10 } as any) : null,
              ]}
            >
              {/* Protein */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.background,
                  borderRadius: 16,
                  paddingVertical: 10,
                  ...(Platform.OS !== 'web' ? { marginRight: 10 } : {}),
                }}
              >
                <MacroGauge label="Protein" value={proteinConsumed} target={proteinTarget} unit="g" size="sm" />
              </View>

              {/* Fiber */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.background,
                  borderRadius: 16,
                  paddingVertical: 10,
                  ...(Platform.OS !== 'web' ? { marginRight: 10 } : {}),
                }}
              >
                <MacroGauge label="Fiber" value={fiberConsumed} target={fiberTarget} unit="g" size="sm" />
              </View>

              {/* Keep 3rd slot empty for future Carbs */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.background,
                  borderRadius: 16,
                  paddingVertical: 10,
                  opacity: 0.15,
                }}
              />
            </View>
          </View>

          {/* Today's Calorie Entries */}
          <View style={[styles.entriesSectionCard, { backgroundColor: colors.card }]}>
            <View style={styles.entriesSection}>
              {showLoadingSpinner ? (
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
                  // Check if mealtype_meta has meaningful data (notes)
                  // Only hide the "Copy from yesterday" button if there's actual data, not just an empty row
                  const meta = dataByMealType[mealType];
                  const hasNotes = meta?.note != null && meta.note.trim().length > 0;
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
                                pathname: '/(tabs)/mealtype-log',
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
                            <TouchableOpacity
                              style={[
                                styles.addFoodPrompt,
                                getMinTouchTargetStyle(),
                                Platform.OS === 'web' && getFocusStyle(colors.tint),
                              ]}
                              onPress={() => {
                                // Filter entries for this meal type and date (may be empty array if no entries)
                                const mealTypeEntries = group.entries.filter(entry => 
                                  entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                  entry.entry_date === selectedDateString
                                );
                                // Always go to mealtype-log page (whether entries exist or not)
                                router.push({
                                  pathname: '/(tabs)/mealtype-log',
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
                              <ThemedText style={[styles.addFoodPromptText, { color: colors.tint }]}>
                                {t('home.food_log.log_food_prompt')}
                              </ThemedText>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.mealGroupHeaderRight}>
                          {/* Show calories when there are entries */}
                          {group.entries.length > 0 && (
                            <TouchableOpacity
                              style={[
                                styles.mealGroupCalories,
                                getMinTouchTargetStyle(),
                                Platform.OS === 'web' && getFocusStyle(colors.tint),
                              ]}
                              onPress={() => {
                                // Filter entries for this meal type and date (may be empty array if no entries)
                                const mealTypeEntries = group.entries.filter(entry => 
                                  entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                  entry.entry_date === selectedDateString
                                );
                                // Always go to mealtype-log page (whether entries exist or not)
                                router.push({
                                  pathname: '/(tabs)/mealtype-log',
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
                              <ThemedText style={[styles.mealGroupCaloriesValue, { color: colors.tint }]}>
                                {Math.round(group.totalCalories)} {t('home.food_log.kcal')}
                              </ThemedText>
                            </TouchableOpacity>
                          )}
                          {/* 3-dot menu button */}
                          <TouchableOpacity
                            style={[
                              styles.mealMoreButton,
                              getMinTouchTargetStyle(),
                              Platform.OS === 'web' && getFocusStyle(colors.tint),
                            ]}
                            onPress={() => {
                              setThreeDotMealMenuVisible({ mealType });
                            }}
                            activeOpacity={0.7}
                            {...getButtonAccessibilityProps(
                              `More options for ${mealTypeLabel}`,
                              `Open menu for ${mealTypeLabel}`
                            )}
                          >
                            <IconSymbol name="ellipsis" size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Copy from yesterday button - only show when no entries AND no notes */}
                      {group.entries.length === 0 && !hasNotes && (
                        <View style={styles.copyFromYesterdayContainer}>
                          <MealTypeCopyButton
                            mealType={mealType}
                            mealTypeLabel={mealTypeLabel}
                            selectedDate={selectedDate}
                            isToday={isToday}
                            colors={colors}
                            t={t}
                          />
                        </View>
                      )}

                      {/* Individual Entries as Descriptions */}
                      {group.entries.length > 0 && (
                        <View style={styles.mealGroupItems}>
                          {/* Consolidated view for all entries (1 or more) */}
                          {(() => {
                            // Combine all items into one sentence
                            const consolidatedItems = group.entries
                              .map(entry => formatMealEntryLabel(entry))
                              .join(', ');
                            
                            return (
                              <TouchableOpacity
                                key={`items-${mealType}`}
                                style={[
                                  styles.mealGroupItem,
                                  getMinTouchTargetStyle(),
                                  { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
                                ]}
                                onPress={() => {
                                  // Filter entries for this meal type and date (may be empty array if no entries)
                                  const mealTypeEntries = group.entries.filter(entry => 
                                    entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                    entry.entry_date === selectedDateString
                                  );
                                  // Always go to mealtype-log page (whether entries exist or not)
                                  router.push({
                                    pathname: '/(tabs)/mealtype-log',
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
                                <View style={styles.mealGroupItemLeft}>
                                  <ThemedText 
                                    style={[styles.mealGroupItemName, { color: colors.text }]}
                                    numberOfLines={6}
                                    ellipsizeMode="tail"
                                  >
                                    {consolidatedItems}
                                  </ThemedText>
                                </View>
                              </TouchableOpacity>
                            );
                          })()}
                        </View>
                      )}


                      {/* Notes row */}
                      {dataByMealType[mealType]?.note && dataByMealType[mealType].note.trim().length > 0 && (
                        <TouchableOpacity
                          style={[
                            styles.noteRow,
                            getMinTouchTargetStyle(),
                            Platform.OS === 'web' && getFocusStyle(colors.tint),
                          ]}
                          onPress={() => {
                            setNoteEditor({ visible: true, mealType });
                          }}
                          activeOpacity={0.7}
                          {...getButtonAccessibilityProps(
                            t('food.note.edit', { defaultValue: `Edit notes for ${mealTypeLabel}`, mealType: mealTypeLabel })
                          )}
                        >
                          <ThemedText
                            style={[styles.noteRowText, { color: colors.text }]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            📝 {dataByMealType[mealType].note}
                          </ThemedText>
                        </TouchableOpacity>
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
          </DesktopPageContainer>
      </CollapsibleModuleHeader>

      {/* Meal Type Options Menu Modal */}
      <Modal
        visible={threeDotMealMenuVisible.mealType !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setThreeDotMealMenuVisible({ mealType: null })}
      >
        <TouchableOpacity
          style={[styles.threeDotMealMenuOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setThreeDotMealMenuVisible({ mealType: null })}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.threeDotMealMenuContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Close button header */}
              <View style={styles.threeDotMealMenuHeader}>
                <TouchableOpacity
                  style={[styles.threeDotMealMenuCloseButton, getMinTouchTargetStyle()]}
                  onPress={() => setThreeDotMealMenuVisible({ mealType: null })}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    t('common.close', { defaultValue: 'Close' }),
                    t('common.close_hint', { defaultValue: 'Double tap to close menu' })
                  )}
                >
                  <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {threeDotMealMenuVisible.mealType && (() => {
                // Calculate if there's anything to copy for this meal type
                const currentMealType = threeDotMealMenuVisible.mealType;
                const mealTypeEntries = groupedEntries[currentMealType as keyof typeof groupedEntries]?.entries ?? [];
                const mealMeta = dataByMealType[currentMealType];
                const hasAnythingToCopy = 
                  mealTypeEntries.length > 0 ||
                  (mealMeta?.note?.trim()?.length ?? 0) > 0;

                return (
                  <>
                    <TouchableOpacity
                      style={styles.threeDotMealMenuItem}
                      onPress={() => handleQuickLog(threeDotMealMenuVisible.mealType!)}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(
                        `⚡Quick Log for ${t(`home.meal_types.${threeDotMealMenuVisible.mealType}`)}`,
                        `Add quick log for ${t(`home.meal_types.${threeDotMealMenuVisible.mealType}`)}`
                      )}
                    >
                      <ThemedText style={[styles.threeDotMealMenuItemText, { color: colors.text }]}>
                        ⚡Quick Log
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.threeDotMealMenuItem}
                      onPress={() => {
                        if (hasAnythingToCopy) {
                          handleCopyTo(threeDotMealMenuVisible.mealType!);
                        }
                      }}
                      activeOpacity={hasAnythingToCopy ? 0.7 : 1}
                      disabled={!hasAnythingToCopy}
                      {...getButtonAccessibilityProps(
                        `Copy ${t(`home.meal_types.${threeDotMealMenuVisible.mealType}`)} to another date`,
                        `Copy ${t(`home.meal_types.${threeDotMealMenuVisible.mealType}`)} to another date`
                      )}
                    >
                      <View style={styles.threeDotMealMenuItemWithIcon}>
                        <IconSymbol 
                          name="doc.on.doc" 
                          size={16} 
                          color={hasAnythingToCopy ? colors.text : colors.textSecondary} 
                        />
                        <ThemedText 
                          style={[
                            styles.threeDotMealMenuItemText, 
                            { 
                              color: hasAnythingToCopy ? colors.text : colors.textSecondary,
                              marginLeft: Spacing.sm,
                              opacity: hasAnythingToCopy ? 1 : 0.5,
                            }
                          ]}
                        >
                          {t('food.menu.copy_to', { defaultValue: 'Copy To' })}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.threeDotMealMenuItem}
                      onPress={() => handleNotes(threeDotMealMenuVisible.mealType!)}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(
                        `Notes for ${t(`home.meal_types.${threeDotMealMenuVisible.mealType}`)}`,
                        `Add or edit notes for ${t(`home.meal_types.${threeDotMealMenuVisible.mealType}`)}`
                      )}
                    >
                      <ThemedText style={[styles.threeDotMealMenuItemText, { color: colors.text }]}>
                        📝 {t('food.menu.notes', { defaultValue: 'Notes' })}
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


      {/* Note Editor */}
      {noteEditor.mealType && (
        <NoteEditor
          visible={noteEditor.visible}
          onClose={() => setNoteEditor({ visible: false, mealType: null })}
          onSave={(note) => handleNoteSave(noteEditor.mealType!, note)}
          initialNote={dataByMealType[noteEditor.mealType]?.note ?? null}
          mealTypeLabel={t(`home.meal_types.${noteEditor.mealType}`)}
          isLoading={upsertMealtypeMetaMutation.isPending}
        />
      )}

      {/* Copy Mealtype Modal */}
      {copyMealtypeModal.mealType && (
        <CopyMealtypeModal
          visible={copyMealtypeModal.visible}
          onClose={() => setCopyMealtypeModal({ visible: false, mealType: null })}
          onConfirm={(targetDate, targetMealType, includeNotes) => handleCopyConfirm(copyMealtypeModal.mealType!, targetDate, targetMealType, includeNotes)}
          sourceDate={selectedDate}
          sourceMealType={copyMealtypeModal.mealType}
          isLoading={copyMealtypeMutation.isPending}
          title={t('food.copy.title', { defaultValue: 'Copy To' })}
          subtitle={t('food.copy.subtitle', { defaultValue: 'Choose a date and meal type to copy to.' })}
          confirmButtonText={t('food.copy.confirm', { defaultValue: 'Copy' })}
        />
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
    paddingTop: Spacing.none, // 0px - minimal gap between logo and greeting
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding
    }),
    ...(Platform.OS !== 'web' && {
      paddingBottom: 100, // Extra padding for FAB on mobile
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
  dailyTotalsCard: {
    paddingVertical: Platform.select({ web: 14, default: 12 }),
    paddingHorizontal: Spacing.lg, // Match Exercise/Meds for consistent left margin (16px)
    borderRadius: Platform.select({ web: 16, default: 14 }),
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        transition: 'box-shadow 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  dailyTotalsContent: {
    gap: 0,
  },
  dailyTotalsMainRow: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    justifyContent: 'space-between',
    alignItems: Platform.select({ web: 'flex-start', default: 'stretch' }),
    gap: Platform.select({ web: 24, default: 16 }),
  },
  dailyTotalItem: {
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: Platform.select({ web: 160, default: undefined }),
    maxWidth: Platform.select({ web: undefined, default: '100%' }),
  },
  dailyTotalLabel: {
    fontSize: Platform.select({ web: 10, default: 11 }),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '500',
    marginBottom: 6,
    lineHeight: Platform.select({ web: 14, default: 15 }),
  },
  dailyTotalValue: {
    fontSize: Platform.select({ web: 28, default: 24 }),
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: Platform.select({ web: 34, default: 30 }),
    flexShrink: 0,
  },
  dailyMacrosContainer: {
    flex: Platform.select({ web: 1, default: 0 }),
    alignItems: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    justifyContent: 'flex-start',
    width: Platform.select({ web: 'auto', default: '100%' }),
    minWidth: 0,
  },
  macroGaugeBar: {
    flexDirection: 'row',
    width: '100%',
    height: Platform.select({ web: 10, default: 8 }),
    overflow: 'hidden',
    marginBottom: 6,
  },
  macroGaugeSegment: {
    minWidth: 2,
  },
  macroLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ web: 12, default: 10 }),
    justifyContent: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    alignItems: 'center',
  },
  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  macroLegendText: {
    fontSize: Platform.select({ web: 10, default: 11 }),
    fontWeight: '500',
    lineHeight: Platform.select({ web: 14, default: 15 }),
  },
  dailyMacrosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ web: 24, default: 20 }),
    justifyContent: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    alignItems: 'flex-start',
  },
  dailyMacroItem: {
    alignItems: 'flex-start',
    minWidth: Platform.select({ web: 65, default: 70 }),
  },
  dailyMacroLabel: {
    fontSize: Platform.select({ web: 10, default: 11 }),
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: Platform.select({ web: 14, default: 15 }),
  },
  dailyMacroValue: {
    fontSize: Platform.select({ web: 16, default: 17 }),
    fontWeight: '600',
    lineHeight: Platform.select({ web: 22, default: 24 }),
  },
  subFatsSection: {
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 1,
  },
  subFatsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 0,
    paddingVertical: 0,
  },
  subFatsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subFatsTitle: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subFatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'flex-start',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  subFatItem: {
    alignItems: 'flex-start',
    minWidth: Platform.select({ web: 80, default: 70 }),
    marginVertical: 0,
    paddingVertical: 0,
  },
  subFatLabel: {
    fontSize: Platform.select({ web: 9, default: 10 }),
    fontWeight: '500',
    marginBottom: 0,
    marginTop: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subFatValue: {
    fontSize: Platform.select({ web: 12, default: 13 }),
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
    marginTop: Platform.select({ web: 0, default: 0 }),
    marginBottom: Platform.select({ web: 0, default: 0 }),
    opacity: 0.6,
  },
  mealGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Platform.select({ web: 0, default: 0 }),
    paddingHorizontal: 0,
    flexWrap: 'wrap',
    gap: Platform.select({ web: 4, default: 4 }),
  },
  mealGroupDivider: {
    height: 1,
    width: '100%',
    marginBottom: Platform.select({ web: 0, default: 0 }),
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
  copyFromYesterdayContainer: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    alignItems: 'flex-start',
  },
  copyFromYesterdayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: (44 - 16) / 2, // Ensure minimum touch target
    paddingHorizontal: 0,
    gap: Spacing.xs,
    ...getMinTouchTargetStyle(),
  },
  copyFromYesterdayButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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
    marginBottom: Platform.select({ web: 0, default: 0 }),
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
  mealMoreButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMealMenuOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMealMenuContent: {
    minWidth: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
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
  threeDotMealMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  threeDotMealMenuCloseButton: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMealMenuItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  threeDotMealMenuItemWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  threeDotMealMenuItemText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  quickLogRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: Platform.select({ web: 6, default: 8 }),
    paddingHorizontal: 0,
  },
  quickLogRowText: {
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '500',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Platform.select({ web: 0, default: 0 }),
    paddingHorizontal: 0,
    marginTop: Spacing.none,
  },
  noteRowText: {
    flex: 1,
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '400',
  },
});
