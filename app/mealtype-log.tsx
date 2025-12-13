import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, ActivityIndicator, Animated, Easing, Dimensions, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import UniversalBarcodeScanner from '@/components/UniversalBarcodeScanner';
import { FoodSearchBar } from '@/components/food-search-bar';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, CategoryColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFoodSearch } from '@/hooks/use-food-search';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import { useAuth } from '@/contexts/AuthContext';
import { useCopyFromYesterday } from '@/hooks/useCopyFromYesterday';
import { useCloneMealTypeFromPreviousDay } from '@/hooks/use-clone-meal-type-from-previous-day';
import { getCurrentDateTimeUTC, getLocalDateString, formatUTCDateTime, formatUTCDate } from '@/utils/calculations';
import { getLocalDateKey } from '@/utils/dateTime';
import { useFrequentFoods } from '@/hooks/use-frequent-foods';
import { useRecentFoods } from '@/hooks/use-recent-foods';
import { useCustomFoods } from '@/hooks/use-custom-foods';
import { useBundles } from '@/hooks/use-bundles';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { useFoodMasterByIds } from '@/hooks/use-food-master-by-ids';
import { useQueryClient } from '@tanstack/react-query';
import { validateAndNormalizeBarcode } from '@/lib/barcode';
import { supabase } from '@/lib/supabase';
import {
  isVolumeUnit,
  type FoodMaster as FoodMasterType,
  type FoodServing as FoodServingType,
} from '@/utils/nutritionMath';
import {
  getServingsForFood,
  getDefaultServingWithNutrients,
  computeNutrientsForFoodServing,
  computeNutrientsForRawQuantity,
} from '@/lib/servings';
import { getFoodMasterById } from '@/lib/services/foodMaster';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FoodSourceBadge } from '@/components/food-source-badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { NoteEditor } from '@/components/note-editor';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { useMealtypeMeta } from '@/hooks/use-mealtype-meta';
import { useUpsertMealtypeMeta } from '@/hooks/use-upsert-mealtype-meta';
import { showAppToast } from '@/components/ui/app-toast';
import { calculateMealNutritionTotals } from '@/utils/dailyTotals';
import { TabButton } from '@/components/ui/tab-button';
import { TabBar } from '@/components/ui/tab-bar';
import { AnimatedTabContent, TabKey } from '@/components/ui/animated-tab-content';
import { SegmentedTabs, type SegmentedTabItem } from '@/components/SegmentedTabs';
import { HighlightableRow } from '@/components/common/highlightable-row';
import { useNewItemHighlight } from '@/hooks/use-new-item-highlight';
import { MultiSelectItem } from '@/components/multi-select-item';
import { useMultiSelect } from '@/hooks/use-multi-select';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';
// Placeholder focus style (inline form removed; keep signature to avoid runtime errors)
const getFocusStyle = (_: any) => ({});

type CalorieEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  eaten_at: string | null;
  meal_type: string;
  item_name: string;
  food_id: string | null;
  serving_id: string | null;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Use shared types from nutritionMath (per engineering guidelines 7.4)
type FoodMaster = FoodMasterType;
type FoodServing = FoodServingType;

// Animated component for "Tap to expand" hint
const TapToExpandHint = ({ text, textColor }: { text: string; textColor: string }) => {
  const translateY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -4, // move up a bit
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0, // return to original position
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [translateY]);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <ThemedText
        style={{
          textAlign: 'center',
          color: textColor,
          fontSize: 16,
          marginRight: 2,
        }}
      >
        {text}
      </ThemedText>
    </Animated.View>
  );
};

export default function LogFoodScreen() {
  const { t } = useTranslation();
  
  // Detect if mobile screen size (for badge shortening in Food Log)
  const isMobileScreen = Dimensions.get('window').width < 768;
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  
  // Helper function to get unique shade for each tab
  const getTabColor = (tab: string, isSelected: boolean) => {
    const shades = {
      frequent: '#3B82F6', // Blue
      recent: '#10B981', // Green
      custom: '#8B5CF6', // Purple
      bundle: '#F59E0B', // Orange,
    };
    
    const baseColor = shades[tab as keyof typeof shades] || colors.tint;
    
    if (isSelected) {
      // Return the full vibrant color for selected tab
      return baseColor;
    } else {
      // Return a lighter/muted version for unselected tabs (70% opacity for better visibility)
      return baseColor + 'B3'; // ~70% opacity
    }
  };
  
  // Helper function to get light background color for tab lists
  const getTabListBackgroundColor = (tab: string) => {
    // Special handling for Bundle - use a warmer, more sophisticated color that works better in dark mode
    if (tab === 'bundle') {
      // Use a muted warm amber/terracotta tone instead of bright orange
      // Creates a sophisticated, elegant look that complements the orange label
      if (colorScheme === 'dark') {
        // In dark mode, use a warm muted amber with subtle opacity
        return '#E87E5A20'; // Warm terracotta/amber at 12.5% opacity
      } else {
        // In light mode, use a softer peach tone
        return '#FFB88520'; // Soft peach at 12.5% opacity
      }
    }
    
    const shades = {
      frequent: '#3B82F6', // Blue
      recent: '#10B981', // Green
      custom: '#8B5CF6', // Purple
      bundle: '#F59E0B', // Orange (fallback),
    };
    
    const baseColor = shades[tab as keyof typeof shades] || colors.tint;
    // Return light background color - use higher opacity in dark mode for better visibility
    // Light mode: 15% opacity, Dark mode: 30% opacity
    const opacity = colorScheme === 'dark' ? '4D' : '26'; // '4D' = ~30% opacity, '26' = ~15% opacity
    return baseColor + opacity;
  };
  
  // Handle tabs scroll to update arrow visibility
  const handleTabsScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const contentWidth = contentSize.width;
    const scrollViewWidth = layoutMeasurement.width;
    
    // Store measurements in refs for later use
    if (contentWidth > 0) tabsContentWidthRef.current = contentWidth;
    if (scrollViewWidth > 0) tabsScrollViewWidthRef.current = scrollViewWidth;
    
    // Only update if we have valid measurements
    if (contentWidth > 0 && scrollViewWidth > 0) {
      // Check if can scroll left (not at start, with small threshold)
      setCanScrollLeft(scrollX > 5);
      
      // Check if can scroll right (not at end, with small threshold)
      setCanScrollRight(scrollX + scrollViewWidth < contentWidth - 5);
    }
  };
  
  // Handle tabs content size change to check initial scroll state
  const handleTabsContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    tabsContentWidthRef.current = contentWidth;
    // Delay to ensure layout is calculated, then check scroll state
    setTimeout(() => {
      const ref = tabsScrollViewRef.current as unknown as {
        measure?: (
          cb: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void
        ) => void;
      };
      if (ref && contentWidth > 0) {
        ref.measure?.((x, y, width) => {
          tabsScrollViewWidthRef.current = width;
          if (contentWidth > width) {
            setCanScrollRight(true);
            setCanScrollLeft(false);
          } else {
            setCanScrollRight(false);
            setCanScrollLeft(false);
          }
        });
      }
    }, 150);
  }, []);
  
  // Scroll left handler
  const handleScrollLeft = () => {
    if (tabsScrollViewRef.current) {
      tabsScrollViewRef.current.scrollTo({ x: 0, animated: true });
    }
  };
  
  // Scroll right handler
  const handleScrollRight = () => {
    if (tabsScrollViewRef.current) {
      // Scroll to end
      tabsScrollViewRef.current.scrollToEnd({ animated: true });
    }
  };
  
  // Get meal type from params
  const mealTypeParam = params.mealType;
  const mealType = Array.isArray(mealTypeParam) 
    ? mealTypeParam[0] 
    : (mealTypeParam as string) || 'late_night';
  
  // Get entry date from params (in user's local timezone)
  const entryDateParam = params.entryDate;
  const entryDate = Array.isArray(entryDateParam)
    ? entryDateParam[0]
    : (entryDateParam as string) || getLocalDateString(); // Use local date, not UTC
  
  const selectedMealType = mealType;
  const selectedDateString = entryDate;
  const { dataByMealType } = useMealtypeMeta(selectedDateString);
  const upsertMealtypeMetaMutation = useUpsertMealtypeMeta();
  
  const currentMealMeta = dataByMealType?.[selectedMealType] || null;

  // Copy from yesterday hook (reuse home behaviour)
  const { isCopyingFromYesterday, runCopyFromYesterday } = useCopyFromYesterday();

  // Determine if the selected date is today (local)
  const isSelectedDateToday = useMemo(() => {
    const today = getLocalDateString();
    return selectedDateString === today;
  }, [selectedDateString]);

  // Clone entries from previous day for this meal type
  const { cloneMealTypeFromPreviousDay, isLoading: isCloningFromPreviousDay } = useCloneMealTypeFromPreviousDay({
    currentDate: new Date(selectedDateString),
    mealType: selectedMealType,
    onSuccess: async (result) => {
      // Refresh entries after copy
      await refetchEntries();
      if (result.totalCount > 0) {
        const itemsLabel = result.totalCount === 1 ? t('home.previous_day_copy.item_one') : t('home.previous_day_copy.item_other');
        showAppToast(t('home.previous_day_copy.success_message', { count: result.totalCount, items: itemsLabel }));
      }
    },
    onError: (error: Error) => {
      if (error.message === 'NOTHING_TO_COPY') {
        showAppToast(t('home.previous_day_copy.nothing_to_copy'));
        return;
      }
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

  const handleCopyFromPreviousDay = useCallback(() => {
    runCopyFromYesterday(() => cloneMealTypeFromPreviousDay());
  }, [cloneMealTypeFromPreviousDay, runCopyFromYesterday]);

  const handleEmptyQuickLog = useCallback(() => {
    router.push({
      pathname: '/quick-log',
      params: {
        date: selectedDateString,
        mealType: selectedMealType,
      },
    });
  }, [router, selectedDateString, selectedMealType]);
  
  // Handlers for Notes
  const handleNotes = () => {
    setMassDeleteMenuVisible(false);
    setNoteEditor({ visible: true });
  };

  const handleNoteSave = (note: string | null) => {
    upsertMealtypeMetaMutation.mutate(
      {
        entryDate: selectedDateString,
        mealType: selectedMealType,
        note,
      },
      {
        onSuccess: () => {
          setNoteEditor({ visible: false });
        },
        onError: (error) => {
          console.error('Error saving note:', error);
          Alert.alert(t('common.error', { defaultValue: 'Error' }), t('food.note.save_error', { defaultValue: 'Failed to save note' }));
        },
      }
    );
  };
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Initialize selectedDate from entryDate
    try {
      const date = new Date(entryDate + 'T00:00:00');
      return date;
    } catch {
      return new Date();
    }
  });
  // Calendar view month (for navigation)
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    try {
      const date = new Date(entryDate + 'T00:00:00');
      return date;
    } catch {
      return new Date();
    }
  });
  
  // Update selectedDate when entryDate changes
  useEffect(() => {
    try {
      const date = new Date(entryDate + 'T00:00:00');
      setSelectedDate(date);
    } catch {
      // Keep current selectedDate if parsing fails
    }
  }, [entryDate]);
  
  // Get preloaded entries from params (if available)
  const preloadedEntriesParam = params.preloadedEntries;
  const preloadedEntries = preloadedEntriesParam && typeof preloadedEntriesParam === 'string'
    ? (() => {
        try {
          return JSON.parse(preloadedEntriesParam) as CalorieEntry[];
        } catch (e) {
          return null;
        }
      })()
    : null;
  
  // Map meal type keys to display labels (using i18n)
  const getMealTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'breakfast': t('mealtype_log.meal_types.breakfast'),
      'lunch': t('mealtype_log.meal_types.lunch'),
      'dinner': t('mealtype_log.meal_types.dinner'),
      'afternoon_snack': t('mealtype_log.meal_types.snack'),
      'late_night': t('mealtype_log.meal_types.late_night'),
    };
    return labels[type.toLowerCase()] || t('mealtype_log.meal_types.late_night');
  };
  
  // Create mealTypeLabels object for dropdown
  const mealTypeLabels: Record<string, string> = {
    'breakfast': t('mealtype_log.meal_types.breakfast'),
    'lunch': t('mealtype_log.meal_types.lunch'),
    'dinner': t('mealtype_log.meal_types.dinner'),
    'afternoon_snack': t('mealtype_log.meal_types.snack'),
    'late_night': t('mealtype_log.meal_types.late_night'),
  };

  // Format date for display (using i18n)
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      
      // Check if it's today
      if (dateOnly.getTime() === today.getTime()) {
        return t('mealtype_log.calendar.today');
      }
      
      // Check if it's yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (dateOnly.getTime() === yesterday.getTime()) {
        return t('mealtype_log.calendar.yesterday');
      }
      
      // Format as "MMM DD, YYYY" (e.g., "Jan 15, 2024") or "MMM DD" if current year
      const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthLabel = t(`mealtype_log.calendar.months.${monthKeys[date.getMonth()]}`);
      const currentYear = new Date().getFullYear();
      const dateYear = date.getFullYear();
      if (dateYear === currentYear) {
        return `${monthLabel} ${date.getDate()}`;
      }
      return `${monthLabel} ${date.getDate()}, ${dateYear}`;
    } catch (error) {
      return dateString;
    }
  };
  
  // Get today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Function to handle date selection
  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const newDateString = `${year}-${month}-${day}`;
    
    // Navigate to the same page with new date
    router.replace({
      pathname: '/mealtype-log',
      params: {
        mealType: mealType,
        entryDate: newDateString,
        preloadedEntries: JSON.stringify([])
      }
    });
    
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

  // Loading state reused across actions (mass delete, bundle insert, etc.)
  const [loading, setLoading] = useState(false);
  
  // Delete confirmation modal state
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Bundle delete confirmation modal state
  const [bundleDeleteConfirmVisible, setBundleDeleteConfirmVisible] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<Bundle | null>(null);
  
  // Bundle add confirmation modal state
  const [bundleAddConfirmVisible, setBundleAddConfirmVisible] = useState(false);
  const [bundleToAdd, setBundleToAdd] = useState<Bundle | null>(null);
  
  // Custom food delete confirmation modal state
  const [customFoodDeleteConfirmVisible, setCustomFoodDeleteConfirmVisible] = useState(false);
  const [customFoodToDelete, setCustomFoodToDelete] = useState<FoodMaster | null>(null);
  const [bundleWarningVisible, setBundleWarningVisible] = useState(false);
  const [bundleWarningData, setBundleWarningData] = useState<{ food: FoodMaster; bundleNames: string; bundleCount: number } | null>(null);
  
  // Show/hide entry details state
  const [showEntryDetails, setShowEntryDetails] = useState(true);
  const [loadingDetailsPreference, setLoadingDetailsPreference] = useState(true);
  const toggleAnimation = useRef(new Animated.Value(1)).current;

  // Meal type dropdown state
  const [showMealTypeDropdown, setShowMealTypeDropdown] = useState(false);
  const mealTypeButtonRef = useRef<View>(null);
  const [mealTypeDropdownLayout, setMealTypeDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Track active tab position for dropdown attachment (for tab content area)
  const [activeTabLayout, setActiveTabLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const tabsContainerWrapperRef = useRef<View>(null);
  const [tabsContainerWrapperLayout, setTabsContainerWrapperLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const tabsScrollOffsetRef = useRef<number>(0);
  
  // Memoize the callback to prevent infinite loops
  const handleActiveTabLayout = useCallback((layout: { x: number; y: number; width: number; height: number } | null) => {
    if (layout) {
      // Store layout relative to the TabBar container (which is inside the ScrollView)
      // We'll account for scroll offset when positioning the dropdown
      setActiveTabLayout({
        x: layout.x,
        y: layout.y + layout.height, // Bottom of tab
        width: layout.width,
        height: layout.height,
      });
    } else {
      setActiveTabLayout(null);
    }
  }, []);

  // Use route params directly (inline form state removed)
  const activeMealType = mealType;
  const activeEntryDate = entryDate;
  const mealTypeLabel = getMealTypeLabel(activeMealType);
  const formattedDate = formatDate(activeEntryDate);

  // Load user preference for show entry details
  useEffect(() => {
    const loadDetailsPreference = async () => {
      try {
        if (Platform.OS === 'web') {
          const detailsStored = localStorage.getItem('showEntryDetails');
          if (detailsStored !== null) {
            const value = detailsStored === 'true';
            setShowEntryDetails(value);
            toggleAnimation.setValue(value ? 1 : 0);
          }
        } else {
          const detailsStored = await SecureStore.getItemAsync('showEntryDetails');
          if (detailsStored !== null) {
            const value = detailsStored === 'true';
            setShowEntryDetails(value);
            toggleAnimation.setValue(value ? 1 : 0);
          }
        }
      } catch (error) {
        // silently ignore
      } finally {
        setLoadingDetailsPreference(false);
      }
    };
    loadDetailsPreference();
  }, []);  // ← good: runs only once
    
  

  // Save preference when showEntryDetails changes
  useEffect(() => {
    if (!loadingDetailsPreference) {
      const savePreference = async () => {
        try {
          if (Platform.OS === 'web') {
            localStorage.setItem('showEntryDetails', showEntryDetails.toString());
          } else {
            await SecureStore.setItemAsync('showEntryDetails', showEntryDetails.toString());
          }
        } catch (error) {
          // Error saving preference - silently fail
        }
      };
      savePreference();
    }
  }, [showEntryDetails, loadingDetailsPreference]);

  // Animate toggle when state changes
  useEffect(() => {
    if (!loadingDetailsPreference) {
      Animated.timing(toggleAnimation, {
        toValue: showEntryDetails ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    // toggleAnimation is a ref and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEntryDetails, loadingDetailsPreference]);

  // Use React Query hook for entries (shared cache with Home screen)
  const { data: allEntriesForDay = [], isLoading: entriesLoading, isFetching: entriesFetching, isError: entriesError, refetch: refetchEntries } = useDailyEntries(entryDate);
  
  // Filter entries by current meal type (client-side filtering)
  // Memoize to prevent unnecessary re-renders and useEffect triggers
  const entries = useMemo(() => {
    return (allEntriesForDay ?? []).filter(
      (entry) => entry.meal_type === mealType
    );
  }, [allEntriesForDay, mealType]);
  
  // Calculate meal totals for nutrients (entries only)
  // This is the single source of truth for meal totals
  const mealTotals = useMemo(
    () => calculateMealNutritionTotals(entries ?? [], currentMealMeta ?? null),
    [entries, currentMealMeta]
  );

  // Calculate total cal for this meal (entries only)
  // Use mealTotals as the single source of truth
  const mealCaloriesTotal = useMemo(() => {
    return mealTotals?.kcal ?? 0;
  }, [mealTotals]);
  
  // Only show loading spinner if we're truly loading and have no cached data
  const showLoadingSpinner = entriesLoading && entries.length === 0 && allEntriesForDay === undefined;
  
  // Extract unique food IDs from entries for food master lookup
  const foodIds = useMemo(() => {
    return [...new Set(entries.filter(e => e.food_id).map(e => e.food_id))] as string[];
  }, [entries]);
  
  // Use React Query hook for food master metadata (replaces direct Supabase call)
  const { data: foodMasterData = [] } = useFoodMasterByIds(foodIds);
  
  // Use reusable highlight hook for newly added entries
  const {
    markAsNewlyAdded,
    isNewlyAdded,
    getAnimationValue,
    clearNewlyAdded,
  } = useNewItemHighlight(entries, (entry) => entry.id, {
    animationDelay: 150, // Slightly longer delay to ensure render completes
  });

  // Use food search hook (DB-only) for search dropdown (per STEP 1)
  // Note: Recent/Frequent tabs continue to use their own hooks
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    handleSearchChange,
    clearSearch,
  } = useFoodSearch({
    includeCustomFoods: true,
    userId: user?.id,
    maxResults: 20,
  });

  // Local state for keyboard navigation (highlighted index)
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Handle Enter key press - select highlighted or first result
  const handleEnterPress = useCallback((): FoodMaster | null => {
    if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
      return searchResults[highlightedIndex];
    } else if (searchResults.length > 0) {
      return searchResults[0];
    }
    return null;
  }, [highlightedIndex, searchResults]);

  // Ensure local foods loaded - no-op for DB-only search
  const ensureLocalFoodsLoaded = useCallback(() => {
    // No-op: DB-only search doesn't need to load local foods
  }, []);
  
  // Barcode scanning state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  
  // Tab state (Frequent, Recent, Custom)
  // Check if activeTab is provided in params
  const activeTabParam = params.activeTab;
  const refreshCustomFoodsParam = params.refreshCustomFoods;
  const newlyAddedFoodIdParam = params.newlyAddedFoodId;
  const newlyEditedFoodIdParam = params.newlyEditedFoodId;
  const newlyAddedBundleIdParam = params.newlyAddedBundleId;
  // Barcode scan params - for auto-selecting scanned food
  const selectedFoodIdParam = params.selectedFoodId;
  const scannedFoodDataParam = params.scannedFoodData; // JSON string for "Use Once" flow
  const manualEntryDataParam = params.manualEntryData; // JSON string for manual entry prefilling
  const openManualModeParam = params.openManualMode; // Flag to open manual mode
  const openBarcodeScannerParam = params.openBarcodeScanner; // Flag to open barcode scanner
  const openFoodSearchParam = params.openFoodSearch; // Flag to open food search expanded
  const initialTab = (activeTabParam === 'custom' || activeTabParam === 'recent' || activeTabParam === 'frequent' || activeTabParam === 'bundle')
    ? activeTabParam
    : 'frequent';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [previousTabKey, setPreviousTabKey] = useState<TabKey>(initialTab);
  // Default to collapsed state (shows tabs + "Tap to expand", hides full results list)
  // Only expand if explicitly requested via openFoodSearch param
  const shouldStartExpanded = Array.isArray(openFoodSearchParam) 
    ? openFoodSearchParam[0] === 'true' 
    : openFoodSearchParam === 'true';
  const [tabContentCollapsed, setTabContentCollapsed] = useState(!shouldStartExpanded);
  
  // Helper function to handle tab press - toggles content collapse if already active
  const handleTabPress = (tab: TabKey, additionalActions?: () => void) => {
    if (activeTab === tab) {
      // Tab is already active - toggle content collapse
      setTabContentCollapsed(!tabContentCollapsed);
    } else {
      // Different tab selected - set previous key, then set new active tab and expand content
      setPreviousTabKey(activeTab);
      setActiveTab(tab);
      setTabContentCollapsed(false);
      if (additionalActions) {
        additionalActions();
      }
    }
  };
  
  // Scroll tracking for tabs
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsScrollViewRef = useRef<ScrollView>(null);
  const tabsContentWidthRef = useRef<number>(0);
  const tabsScrollViewWidthRef = useRef<number>(0);
  
  // Use React Query hooks for tab data
  const queryClient = useQueryClient();
  const { data: customFoods = [], isLoading: customFoodsLoading, refetch: refetchCustomFoods } = useCustomFoods();
  const { data: frequentFoods = [], isLoading: frequentFoodsLoading, refetch: refetchFrequentFoods } = useFrequentFoods(mealType);
  const { data: recentFoods = [], isLoading: recentFoodsLoading, refetch: refetchRecentFoods } = useRecentFoods(mealType);
  const { data: bundles = [], isLoading: bundlesLoading, refetch: refetchBundles } = useBundles();
  
  // Refs for tracking UI state (kept for compatibility with existing code)
  const customFoodsFetched = useRef(false); // Track if we've fetched custom foods
  const lastRefreshParam = useRef<string | undefined>(undefined);
  const newlyAddedFoodId = useRef<string | undefined>(undefined); // Track which food was just added
  const newlyEditedFoodId = useRef<string | undefined>(undefined); // Track which food was just edited
  const frequentFoodsFetched = useRef(false); // Track if we've fetched frequent foods
  const recentFoodsFetched = useRef(false); // Track if we've fetched recent foods

  // Bundle types and state
  type BundleItem = {
    id: string;
    bundle_id: string;
    food_id: string | null;
    item_name: string | null;
    serving_id: string | null;
    quantity: number;
    unit: string;
    order_index: number;
  };

  type Bundle = {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
    order_index?: number;
    items?: BundleItem[];
    totalCalories?: number;
    totalProtein?: number;
    totalCarbs?: number;
    totalFat?: number;
    totalFiber?: number;
    foodsMap?: Map<string, { id: string; name: string; calories_kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; serving_size: number; serving_unit: string }>;
    servingsMap?: Map<string, { id: string; serving_name: string; weight_g: number | null; volume_ml: number | null }>;
  };

  const bundlesFetched = useRef(false);
  const bundlesFetching = useRef(false);
  const processedNewBundleIds = useRef<Set<string>>(new Set());
  const [bundleEditMode, setBundleEditMode] = useState(false);
  
  // Use reusable highlight hook for newly added bundles
  const {
    markAsNewlyAdded: markBundleAsNewlyAdded,
    isNewlyAdded: isBundleNewlyAdded,
    getAnimationValue: getBundleAnimationValue,
    clearNewlyAdded: clearNewlyAddedBundle,
  } = useNewItemHighlight(bundles, (bundle) => bundle.id);
  const [customFoodEditMode, setCustomFoodEditMode] = useState(false);
  const [entriesEditMode, setEntriesEditMode] = useState(false);
  
  // Multi-select for entries
  const {
    selectedIds: selectedEntryIds,
    isSelected: isEntrySelected,
    toggleSelection: toggleEntrySelection,
    selectAll: selectAllEntries,
    deselectAll: deselectAllEntries,
    areAllSelected: areAllEntriesSelected,
    selectedCount: selectedEntryCount,
    hasSelection: hasEntrySelection,
    clearSelection: clearEntrySelection,
  } = useMultiSelect<CalorieEntry>({ enabled: entriesEditMode });
  
  const hasAnySelection = hasEntrySelection;
  const totalSelectedItems = selectedEntryCount;
  
  // Mass delete confirmation modal state
  const [massDeleteConfirmVisible, setMassDeleteConfirmVisible] = useState(false);
  
  // 3-dot menu state
  const [massDeleteMenuVisible, setMassDeleteMenuVisible] = useState(false);
  
  // Note editor state
  const [noteEditor, setNoteEditor] = useState<{ visible: boolean }>({ visible: false });
  
  // Inline add/edit form removed; keep minimal placeholder for legacy conditional
  const editingEntryId: string | null = null;
  // Map to store food source types (custom vs database) for entries
 
  //Commented out to fix infinite loop on empty mealtype_log screen
  // replaced the below with "foodSourceMap = useMemo"
  // const [foodSourceMap, setFoodSourceMap] = useState<{ [foodId: string]: boolean }>({});
  // const [foodBrandMap, setFoodBrandMap] = useState<{ [foodId: string]: string | null }>({});
  const foodSourceMap = useMemo<{ [foodId: string]: boolean }>(() => {
    if (!foodMasterData || foodMasterData.length === 0) return {};
    const map: { [foodId: string]: boolean } = {};
    foodMasterData.forEach((food) => {
      // Simple logic: if is_custom is true, mark as custom; otherwise database
      map[food.id] = food.is_custom === true;
    });
    return map;
  }, [foodMasterData]);
  
  const foodBrandMap = useMemo<{ [foodId: string]: string | null }>(() => {
    if (!foodMasterData || foodMasterData.length === 0) return {};
    const map: { [foodId: string]: string | null } = {};
    foodMasterData.forEach((food) => {
      map[food.id] = food.brand ?? null;
    });
    return map;
  }, [foodMasterData]);

  // Build food source and brand maps from food master data
  // This runs whenever foodMasterData changes
  // commented out to fix infinite loop on empty mealtype_log screen
  // useEffect(() => {
  //   if (!foodMasterData || foodMasterData.length === 0) {
  //     setFoodSourceMap({});
  //     setFoodBrandMap({});
  //     return;
  //   }

  //   const sourceMap: { [foodId: string]: boolean } = {};
  //   const brandMap: { [foodId: string]: string | null } = {};
  //   foodMasterData.forEach(food => {
  //     // Simple logic: if is_custom is true, mark as custom; otherwise database
  //     sourceMap[food.id] = food.is_custom === true;
  //     brandMap[food.id] = food.brand;
  //   });
  //   setFoodSourceMap(sourceMap);
  //   setFoodBrandMap(brandMap);
  // }, [foodMasterData]);

  // Fetch functions removed - now using React Query hooks above

  // Helper function to format bundle items as a concatenated string (just food names)
  const formatBundleItemsList = useCallback((bundle: Bundle): string => {
    if (!bundle.items || bundle.items.length === 0) {
      return '';
    }

    // Handle case where foodsMap might be a plain object (from React Query cache serialization)
    // instead of a Map instance
    let foodsMap: Map<string, { id: string; name: string; calories_kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; serving_size: number; serving_unit: string }>;
    if (bundle.foodsMap instanceof Map) {
      foodsMap = bundle.foodsMap;
    } else if (bundle.foodsMap && typeof bundle.foodsMap === 'object') {
      // Convert plain object to Map
      foodsMap = new Map(Object.entries(bundle.foodsMap));
    } else {
      foodsMap = new Map();
    }

    const items = bundle.items ?? [];
    return items
      .map((item) => {
        let foodName = item.item_name || t('mealtype_log.food_log.unknown_food');
        if (item.food_id && foodsMap.has(item.food_id)) {
          const food = foodsMap.get(item.food_id);
          if (food) {
            foodName = food.name;
          }
        }
        return foodName;
      })
      .join(', ');
  }, [t]);

  // Fetch bundles function removed - now using React Query hook above

  // Helper function to actually add bundle entries (extracted for reuse)
  const addBundleEntries = useCallback(async (bundle: Bundle) => {
    if (!bundle.items?.length || !user?.id) return;
    setLoading(true);
    try {
      const servingsCache = new Map<string, FoodServing[]>();
      const getServingsForFoodCached = async (foodId: string) => {
        if (servingsCache.has(foodId)) return servingsCache.get(foodId)!;
        const list = await getServingsForFood(foodId);
        servingsCache.set(foodId, list);
        return list;
      };

      // Fetch food details for all items
      const foodIds = bundle.items
        .filter(item => item.food_id)
        .map(item => item.food_id!);
      
      const { data: foodsData, error: foodsError } = foodIds.length > 0
        ? await supabase
            .from('food_master')
            .select('*')
            .in('id', foodIds)
        : { data: [], error: null };

      if (foodsError) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.fetch_failed', { error: foodsError.message }));
        setLoading(false);
        return;
      }

      const foodsMap = new Map((foodsData || []).map(food => [food.id, food]));

      // Prepare entries to insert
      const entriesToInsert = await Promise.all(
        bundle.items.map(async (item) => {
          let itemName = item.item_name || t('mealtype_log.food_log.unknown_food');

          // Validate quantity and unit early
          const parsedQuantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || '0'));
          if (isNaN(parsedQuantity) || !isFinite(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error(`Invalid quantity for item: ${itemName}`);
          }

          const resolvedUnit = item.unit && typeof item.unit === 'string' ? item.unit : 'g';

          // Default nutrient values
          let calories = 0;
          let protein = 0;
          let carbs = 0;
          let fat = 0;
          let fiber = 0;
          let saturatedFat = 0;
          let transFat = 0;
          let sugar = 0;
          let sodium = 0;

          if (item.food_id && foodsMap.has(item.food_id)) {
            const food = foodsMap.get(item.food_id)!;
            itemName = food.name;

            const servings = await getServingsForFoodCached(food.id);
            const servingId = item.serving_id ?? null;
            const serving = servingId ? servings.find((s) => s.id === servingId) : null;

            const nutrients = serving
              ? computeNutrientsForFoodServing(food, serving, parsedQuantity)
              : computeNutrientsForRawQuantity(food, parsedQuantity, resolvedUnit);

            calories = nutrients.calories_kcal || 0;
            protein = nutrients.protein_g || 0;
            carbs = nutrients.carbs_g || 0;
            fat = nutrients.fat_g || 0;
            fiber = nutrients.fiber_g || 0;
            saturatedFat = (nutrients as any).saturated_fat_g || 0;
            transFat = (nutrients as any).trans_fat_g || 0;
            sugar = nutrients.sugar_g || 0;
            sodium = nutrients.sodium_mg || 0;
          }

          const validatedCalories = isNaN(calories) || !isFinite(calories) ? 0 : Math.round(calories * 100) / 100;
          const validatedProtein = (protein > 0 && isFinite(protein)) ? Math.round(protein * 100) / 100 : null;
          const validatedCarbs = (carbs > 0 && isFinite(carbs)) ? Math.round(carbs * 100) / 100 : null;
          const validatedFat = (fat > 0 && isFinite(fat)) ? Math.round(fat * 100) / 100 : null;
          const validatedFiber = (fiber > 0 && isFinite(fiber)) ? Math.round(fiber * 100) / 100 : null;
          const validatedSaturatedFat = (saturatedFat > 0 && isFinite(saturatedFat)) ? Math.round(saturatedFat * 100) / 100 : null;
          const validatedTransFat = (transFat > 0 && isFinite(transFat)) ? Math.round(transFat * 100) / 100 : null;
          const validatedSugar = (sugar > 0 && isFinite(sugar)) ? Math.round(sugar * 100) / 100 : null;
          const validatedSodium = (sodium > 0 && isFinite(sodium)) ? Math.round(sodium * 100) / 100 : null;

          // Build entry data similar to saveEntry function
          const entryData: any = {
            user_id: user.id,
            entry_date: entryDate,
            eaten_at: null,
            meal_type: mealType.toLowerCase(),
            item_name: itemName.trim(),
            quantity: parsedQuantity,
            unit: resolvedUnit,
            calories_kcal: validatedCalories,
            protein_g: validatedProtein,
            carbs_g: validatedCarbs,
            fat_g: validatedFat,
            fiber_g: validatedFiber,
          };

          // Only include food_id if it exists (like in saveEntry)
          if (item.food_id) {
            entryData.food_id = item.food_id;
          }

          // Only include serving_id if it exists (like in saveEntry)
          if (item.serving_id) {
            entryData.serving_id = item.serving_id;
          }

          // Only include fat detail fields if they have values greater than 0
          if (validatedSaturatedFat !== null) {
            entryData.saturated_fat_g = validatedSaturatedFat;
          }
          if (validatedTransFat !== null) {
            entryData.trans_fat_g = validatedTransFat;
          }

          // Only include sugar_g if it has a value greater than 0
          if (validatedSugar !== null) {
            entryData.sugar_g = validatedSugar;
          }

          // Only include sodium_mg if it has a value greater than 0
          if (validatedSodium !== null) {
            entryData.sodium_mg = validatedSodium;
          }

          return entryData;
        })
      );

      // Validate entries before inserting
      if (entriesToInsert.length === 0) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.no_valid_entries'));
        setLoading(false);
        return;
      }

      // Insert all entries
      const { data: insertedData, error: insertError } = await supabase
        .from('calorie_entries')
        .insert(entriesToInsert)
        .select('id');

      if (insertError) {
        // Show detailed error message
        const errorDetails = insertError.details || insertError.hint || '';
        const errorMessage = t('mealtype_log.bundles.add_failed', { error: `${insertError.message}${errorDetails ? `\n\nDetails: ${errorDetails}` : ''}` });
        Alert.alert(t('alerts.error_title'), errorMessage);
        setLoading(false);
        return;
      }

      // Verify entries were inserted
      if (!insertedData || insertedData.length === 0) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.no_entries_added'));
        setLoading(false);
        return;
      }

      // Mark all newly added entries for highlight animation
      insertedData.forEach((entry) => {
        if (entry.id) {
          markAsNewlyAdded(entry.id);
        }
      });

      // Refresh entries - ensure we wait for it to complete
      // Force a fresh fetch to ensure we get the latest data
      await refetchEntries();
      
      // Double-check: fetch again after a brief moment to ensure consistency
      await new Promise(resolve => setTimeout(resolve, 200));
      await refetchEntries();
      
      // Show success message after entries are refreshed
      Alert.alert(t('alerts.success'), t('mealtype_log.bundles.added_success', { name: bundle.name, mealType: mealTypeLabel }));
    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.bundles.add_failed', { error: error?.message || t('common.unexpected_error') }));
    } finally {
      setLoading(false);
    }
  }, [user?.id, entryDate, mealType, mealTypeLabel, refetchEntries, markAsNewlyAdded]);

  // Add bundle to meal (create all entries at once) - with confirmation prompt
  const handleAddBundleToMeal = useCallback((bundle: Bundle) => {
    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.user_not_authenticated'));
      return;
    }

    if (!bundle.items || bundle.items.length === 0) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.bundles.empty_invalid'));
      return;
    }

    // Show confirmation modal
    setBundleToAdd(bundle);
    setBundleAddConfirmVisible(true);
  }, [user?.id]);

  const handleBundleAddConfirm = useCallback(async () => {
    if (bundleToAdd) {
      setBundleAddConfirmVisible(false);
      await addBundleEntries(bundleToAdd);
      setBundleToAdd(null);
    }
  }, [bundleToAdd, addBundleEntries]);

  const handleBundleAddCancel = useCallback(() => {
    setBundleAddConfirmVisible(false);
    // Don't clear bundleToAdd immediately to avoid showing generic message flash
    // It will be cleared when a new bundle is selected or component unmounts
  }, []);

  // Delete bundle
  const handleDeleteBundle = useCallback((bundle: Bundle) => {
    setBundleToDelete(bundle);
    setBundleDeleteConfirmVisible(true);
  }, []);

  const handleBundleDeleteConfirm = useCallback(async () => {
    if (bundleToDelete) {
      setBundleDeleteConfirmVisible(false);
      const { error } = await supabase
        .from('bundles')
        .delete()
        .eq('id', bundleToDelete.id);

      if (error) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.bundles.delete_failed', { error: error.message }));
      } else {
        // Invalidate bundles query to refetch
        queryClient.invalidateQueries({ queryKey: ['bundles', user?.id] });
      }
      setBundleToDelete(null);
    }
  }, [bundleToDelete, queryClient, user?.id]);

  const handleBundleDeleteCancel = useCallback(() => {
    setBundleDeleteConfirmVisible(false);
    setBundleToDelete(null);
  }, []);

  // Save bundle order to database
  const saveBundleOrder = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Update order_index for all bundles based on their current position
      const updates = bundles.map((bundle, index) => 
        supabase
          .from('bundles')
          .update({ order_index: index })
          .eq('id', bundle.id)
      );

      await Promise.all(updates);
    } catch (error) {
      // Silently fail - order will be preserved in local state
    }
  }, [bundles, user?.id]);

  // Exit edit mode and save order
  const handleExitBundleEditMode = useCallback(async () => {
    await saveBundleOrder();
    setBundleEditMode(false);
  }, [saveBundleOrder]);

  // Move custom food up in order - removed (custom foods are now read-only from React Query)
  // If reordering is needed, it should be done via mutations that update the database
  const handleMoveCustomFoodUp = useCallback((foodId: string) => {
    // Reordering removed - custom foods are managed by React Query
  }, []);

  // Move custom food down in order - removed (custom foods are now read-only from React Query)
  const handleMoveCustomFoodDown = useCallback((foodId: string) => {
    // Reordering removed - custom foods are managed by React Query
  }, []);

  // Save custom food order to database
  const saveCustomFoodOrder = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Update order_index for all custom foods based on their current position
      // Note: This assumes food_master table has an order_index column for custom foods
      const updates = customFoods.map((food, index) => 
        supabase
          .from('food_master')
          .update({ order_index: index })
          .eq('id', food.id)
          .eq('owner_user_id', user.id)
      );

      await Promise.all(updates);
    } catch (error) {
      // Silently fail - order will be preserved in local state
    }
  }, [customFoods, user?.id]);

  // Exit custom food edit mode and save order
  const handleExitCustomFoodEditMode = useCallback(async () => {
    await saveCustomFoodOrder();
    setCustomFoodEditMode(false);
  }, [saveCustomFoodOrder]);

  // Exit edit mode when switching tabs
  useEffect(() => {
    // Exit custom food edit mode when switching away from custom tab
    if (activeTab !== 'custom' && customFoodEditMode) {
      saveCustomFoodOrder();
      setCustomFoodEditMode(false);
    }
    // Exit bundle edit mode when switching away from bundle tab
    if (activeTab !== 'bundle' && bundleEditMode) {
      saveBundleOrder();
      setBundleEditMode(false);
    }
    // Only depend on activeTab - callbacks are stable and don't need to be in deps
    // States we're modifying (customFoodEditMode, bundleEditMode) are checked inside, not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Preloaded entries are no longer needed - React Query handles caching
  // Entries now come from useDailyEntries hook which shares cache with Home screen

  // Refresh entries when page comes into focus (only when navigating from another screen)
  // React Query will use cached data if available, or refetch if stale
  const isInitialMount = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      // Only refresh when coming back to the page from another screen (not when switching tabs)
      // React Query will check if data is stale and refetch if needed
      if (user?.id) {
        const timer = setTimeout(() => {
          refetchEntries();
        }, 600);
        return () => clearTimeout(timer);
      }
    }, [user?.id, refetchEntries])
  );


  // Also check on focus if we need to refresh custom foods (when coming back from create page)
  const customFoodsFocusMount = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (customFoodsFocusMount.current) {
        customFoodsFocusMount.current = false;
        return;
      }
      
      // Check for refresh param when screen comes into focus
      const currentRefreshParam = Array.isArray(refreshCustomFoodsParam) ? refreshCustomFoodsParam[0] : refreshCustomFoodsParam;
      
      // If we have a new refresh param and custom tab is active, refresh immediately
      if (currentRefreshParam && currentRefreshParam !== lastRefreshParam.current && activeTab === 'custom' && user?.id && customFoodsFetched.current) {
        // Refresh immediately when coming into focus with refresh param
        refetchCustomFoods();
        lastRefreshParam.current = currentRefreshParam;
      }
    }, [refreshCustomFoodsParam, activeTab, user?.id, refetchCustomFoods])
  );

  // Track when frequent foods tab is first accessed (for UI state tracking)
  useEffect(() => {
    if (activeTab === 'frequent' && user?.id && !frequentFoodsFetched.current) {
      frequentFoodsFetched.current = true;
    }
    previousActiveTab.current = activeTab;
  }, [activeTab, user?.id]);

  // Refresh frequent foods when page comes into focus and frequent tab is active
  // Only refresh if data was already fetched (to avoid double-fetch on initial load)
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'frequent' && user?.id && frequentFoodsFetched.current) {
        // Minimal delay to ensure database writes are committed
        const timer = setTimeout(() => {
          refetchFrequentFoods();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [activeTab, user?.id, refetchFrequentFoods])
  );

  // Track when recent foods tab is first accessed (for UI state tracking)
  useEffect(() => {
    if (activeTab === 'recent' && user?.id && !recentFoodsFetched.current) {
      recentFoodsFetched.current = true;
    }
    previousActiveTab.current = activeTab;
  }, [activeTab, user?.id]);

  // Track when bundles tab is first accessed (for UI state tracking)
  useEffect(() => {
    if (activeTab === 'bundle' && user?.id && !bundlesFetched.current && !newlyAddedBundleIdParam) {
      bundlesFetched.current = true;
    }
    previousActiveTab.current = activeTab;
  }, [activeTab, user?.id, newlyAddedBundleIdParam]);

  // Handle newly added bundle ID from create-bundle page
  // Check both URL params and sessionStorage (for web)
  useEffect(() => {
    let bundleId: string | undefined;
    
    // First check URL params
    const paramBundleId = Array.isArray(newlyAddedBundleIdParam) 
      ? newlyAddedBundleIdParam[0] 
      : newlyAddedBundleIdParam;
    
    if (paramBundleId && typeof paramBundleId === 'string') {
      bundleId = paramBundleId;
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Check sessionStorage as fallback
      const storedId = sessionStorage.getItem('newlyAddedBundleId');
      if (storedId) {
        bundleId = storedId;
        // Clear it immediately to prevent re-processing
        sessionStorage.removeItem('newlyAddedBundleId');
      }
    }
    
    // Only process if we have a bundle ID, are on bundle tab, and haven't processed this ID yet
    if (bundleId && activeTab === 'bundle' && !processedNewBundleIds.current.has(bundleId)) {
      // Mark this bundle ID as processed to prevent re-processing
      processedNewBundleIds.current.add(bundleId);
      
      // Mark the bundle as newly added for highlight animation
      markBundleAsNewlyAdded(bundleId);
      
      // Ensure bundlesFetched is set so useFocusEffect doesn't also trigger
      bundlesFetched.current = true;
      
      // Refresh bundles to show the new one
      queryClient.invalidateQueries({ queryKey: ['bundles', user?.id] });
    }
  }, [newlyAddedBundleIdParam, activeTab, markBundleAsNewlyAdded, queryClient, user?.id]);

  // Refresh bundles when page comes into focus and bundle tab is active
  // Skip if we just handled a newlyAddedBundleIdParam (to avoid double fetch)
  // Also skip if we're currently fetching to prevent loops
  useFocusEffect(
    useCallback(() => {
      const bundleId = Array.isArray(newlyAddedBundleIdParam) 
        ? newlyAddedBundleIdParam[0] 
        : newlyAddedBundleIdParam;
      const hasNewBundleParam = bundleId && typeof bundleId === 'string';
      
      if (activeTab === 'bundle' && user?.id && bundlesFetched.current && !hasNewBundleParam) {
        const timer = setTimeout(() => {
          refetchBundles();
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [activeTab, user?.id, refetchBundles, newlyAddedBundleIdParam])
  );

  // Refresh recent foods when page comes into focus and recent tab is active
  // Only refresh if data was already fetched (to avoid double-fetch on initial load)
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'recent' && user?.id && recentFoodsFetched.current) {
        // Minimal delay to ensure database writes are committed
        const timer = setTimeout(() => {
          refetchRecentFoods();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [activeTab, user?.id, refetchRecentFoods])
  );

  const FOOD_DATA_STALE_MS = 30 * 60 * 1000; // 30 minutes
  const FOOD_DATA_CACHE_MS = 180 * 24 * 60 * 60 * 1000; // ~180 days for stable metadata

  const mergeEntryIntoCache = useCallback(
    (entry: CalorieEntry) => {
      if (!user?.id) return;
      const cacheKey: [string, string, string] = ['entries', user.id, entry.entry_date];
      queryClient.setQueryData<CalorieEntry[]>(cacheKey, (existing) => {
        if (!existing || existing.length === 0) {
          return [entry];
        }
        const hasEntry = existing.some((e) => e.id === entry.id);
        if (hasEntry) {
          return existing.map((e) => (e.id === entry.id ? entry : e));
        }
        return [...existing, entry];
      });
    },
    [queryClient, user?.id]
  );

  // Handle edit entry - navigate to dedicated edit screens
  const handleEditEntry = async (entry: CalorieEntry) => {
    const entryPayload = JSON.stringify(entry);

    // Seed the entries cache so the edit screen renders immediately, even offline
    mergeEntryIntoCache(entry);

    if (!entry.food_id) {
      router.push({
        pathname: '/quick-log',
        params: {
          date: entry.entry_date || entryDate,
          mealType: entry.meal_type || mealType,
          quickLogId: entry.id,
          entryPayload,
        },
      });
      return;
    }

    // Prefetch dependent data so the food-edit screen can hydrate instantly
    const foodId = entry.food_id;
    queryClient.prefetchQuery({
      queryKey: ['foodMasterFull', foodId],
      queryFn: () => getFoodMasterById(foodId),
      staleTime: FOOD_DATA_STALE_MS,
      gcTime: FOOD_DATA_CACHE_MS,
    });
    queryClient.prefetchQuery({
      queryKey: ['foodServings', foodId],
      queryFn: () => getServingsForFood(foodId),
      staleTime: FOOD_DATA_STALE_MS,
      gcTime: FOOD_DATA_CACHE_MS,
    });

    router.push({
      pathname: '/food-edit',
      params: {
        entryId: entry.id,
        date: entry.entry_date || entryDate,
        mealType: entry.meal_type || mealType,
        entryPayload,
      },
    });
  };

  const handleDelete = (entryId: string, entryName: string) => {
    setEntryToDelete({ id: entryId, name: entryName });
    setDeleteConfirmVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (entryToDelete) {
      setDeleteConfirmVisible(false);
      await deleteEntry(entryToDelete.id);
      setEntryToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmVisible(false);
    setEntryToDelete(null);
  };


  // Mass delete handlers
  const handleMassDelete = useCallback(() => {
    if (totalSelectedItems > 0) {
      setMassDeleteConfirmVisible(true);
    }
  }, [totalSelectedItems]);

  const handleMassDeleteConfirm = useCallback(async () => {
    setMassDeleteConfirmVisible(false);

    // If no entries selected, nothing to do
    if (selectedEntryIds.size === 0) return;

    setLoading(true);
    try {
      // Delete all selected calorie_entries
      if (selectedEntryIds.size > 0) {
        const entryIdsArray = Array.from(selectedEntryIds);
        const { error } = await supabase
          .from('calorie_entries')
          .delete()
          .in('id', entryIdsArray);

        if (error) {
          Alert.alert(
            t('alerts.error_title'),
            t('mealtype_log.delete_entry.failed_multiple', {
              error: error.message,
            })
          );
          setLoading(false);
          return;
        }
      }

      // Clear all selections and refresh entries
      clearEntrySelection();
      setEntriesEditMode(false);
      await refetchEntries();

      Alert.alert(
        t('alerts.success'),
        t('mealtype_log.delete_entry.success_multiple', {
          count: totalSelectedItems,
          entries:
            totalSelectedItems === 1
              ? t('mealtype_log.delete_entry.entry_singular')
              : t('mealtype_log.delete_entry.entry_plural'),
        })
      );
    } catch (error: any) {
      Alert.alert(
        t('alerts.error_title'),
        t('mealtype_log.delete_entry.failed_multiple', {
          error: error?.message || t('common.unexpected_error'),
        })
      );
    } finally {
      setLoading(false);
    }
  }, [
    selectedEntryIds,
    clearEntrySelection,
    refetchEntries,
    t,
    totalSelectedItems,
  ]);

  const handleMassDeleteCancel = useCallback(() => {
    setMassDeleteConfirmVisible(false);
  }, []);

  const deleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('calorie_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.delete_entry.failed', { error: error.message }));
      } else {
        await refetchEntries();
      }
    } catch (error) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.unexpected_error'));
    }
  };

  // Delete custom food - check for bundle references first
  const handleDeleteCustomFood = async (food: FoodMaster) => {
    if (!user?.id) return;

    // Check if food is referenced in any bundle items
    const { getBundleItemReferencesForFood } = await import('@/lib/services/bundleItems');
    const bundleReferences = await getBundleItemReferencesForFood(user.id, food.id);

    if (bundleReferences.length > 0) {
      // Food is referenced in bundles - format bundle names (truncate to 10 chars each)
      const truncatedBundleNames = bundleReferences.map(ref => {
        const name = ref.bundle_name;
        return name.length > 10 ? `${name.substring(0, 10)}...` : name;
      }).join(', ');
      
      setBundleWarningData({ 
        food, 
        bundleNames: truncatedBundleNames,
        bundleCount: bundleReferences.length 
      });
      setBundleWarningVisible(true);
    } else {
      // No bundle references - proceed with normal confirmation
      setCustomFoodToDelete(food);
      setCustomFoodDeleteConfirmVisible(true);
    }
  };

  // Handle bundle warning confirmation - proceed to delete confirmation
  const handleBundleWarningConfirm = () => {
    if (bundleWarningData) {
      setBundleWarningVisible(false);
      setCustomFoodToDelete(bundleWarningData.food);
      setCustomFoodDeleteConfirmVisible(true);
      setBundleWarningData(null);
    }
  };

  // Handle bundle warning cancellation
  const handleBundleWarningCancel = () => {
    setBundleWarningVisible(false);
    setBundleWarningData(null);
  };

  const handleCustomFoodDeleteConfirm = async () => {
    if (customFoodToDelete) {
      setCustomFoodDeleteConfirmVisible(false);
      await deleteCustomFood(customFoodToDelete);
      setCustomFoodToDelete(null);
    }
  };

  const handleCustomFoodDeleteCancel = () => {
    setCustomFoodDeleteConfirmVisible(false);
    setCustomFoodToDelete(null);
  };

  // Actual delete operation
  const deleteCustomFood = async (food: FoodMaster) => {
    try {
      // First, update all calorie_entries that reference this food to set food_id = NULL
      // This prevents orphaned references while preserving the entry data
      const { error: entriesError } = await supabase
        .from('calorie_entries')
        .update({ food_id: null })
        .eq('food_id', food.id);

      if (entriesError) {
        throw entriesError;
      }

      // Delete bundle_items that reference this food (as warned to user)
      const { error: bundleItemsError } = await supabase
        .from('bundle_items')
        .delete()
        .eq('food_id', food.id);

      if (bundleItemsError) {
        throw bundleItemsError;
      }

      // Delete from food_servings (foreign key constraint)
      const { error: servingsError } = await supabase
        .from('food_servings')
        .delete()
        .eq('food_id', food.id);

      if (servingsError) {
        throw servingsError;
      }

      // Delete from food_master
      const { error: foodError } = await supabase
        .from('food_master')
        .delete()
        .eq('id', food.id)
        .eq('owner_user_id', user?.id);

      if (foodError) {
        throw foodError;
      }

      // Refresh the custom foods list
      queryClient.invalidateQueries({ queryKey: ['customFoods', user?.id] });
      // Keep fetched flag true since we just refreshed
      shouldRefreshCustomFoods.current = false;
    } catch (error: any) {
      const errorMessage = `Failed to delete custom food: ${error.message || 'Unknown error'}`;
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert(t('alerts.error_title'), errorMessage);
      }
    }
  };

  // Track if we need to refresh custom foods (set to true after create/delete operations)
  const shouldRefreshCustomFoods = useRef(false);
  const previousActiveTab = useRef<TabKey>(initialTab);

  // Clear "just added/edited" labels when switching away from custom tab
  useEffect(() => {
    if (activeTab !== 'custom') {
      newlyAddedFoodId.current = undefined;
      newlyEditedFoodId.current = undefined;
    }
  }, [activeTab]);

  // Fetch custom foods only once when custom tab is first selected
  // Will be refreshed explicitly when food is added/deleted
  useEffect(() => {
    if (activeTab === 'custom' && user?.id) {
      const currentRefreshParam = Array.isArray(refreshCustomFoodsParam) ? refreshCustomFoodsParam[0] : refreshCustomFoodsParam;
      
      // Check if we have a refresh param (coming from create page)
      const shouldRefreshFromCreate = currentRefreshParam && currentRefreshParam !== lastRefreshParam.current;
      
      // Track when custom tab is first accessed
      if (!customFoodsFetched.current) {
        customFoodsFetched.current = true;
        if (currentRefreshParam) {
          lastRefreshParam.current = currentRefreshParam;
        }
      } else if (shouldRefreshCustomFoods.current) {
        // Refresh if explicitly needed (after delete)
        queryClient.invalidateQueries({ queryKey: ['customFoods', user?.id] });
        shouldRefreshCustomFoods.current = false;
      } else if (shouldRefreshFromCreate && customFoodsFetched.current) {
        // Refresh when coming back from create page (detected by refreshCustomFoods param)
        // Refresh immediately without delay
        refetchCustomFoods();
        lastRefreshParam.current = currentRefreshParam;
      }
    }
    
    // Update previous tab
    previousActiveTab.current = activeTab;
    // queryClient and refetchCustomFoods are stable from React Query, but we'll be explicit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id, refreshCustomFoodsParam]);
  
  // Also check refresh param separately to catch it even if activeTab hasn't changed
  // This is the primary mechanism for detecting when we come back from create page
  useEffect(() => {
    if (user?.id) {
      const currentRefreshParam = Array.isArray(refreshCustomFoodsParam) ? refreshCustomFoodsParam[0] : refreshCustomFoodsParam;
      const currentNewlyAddedId = Array.isArray(newlyAddedFoodIdParam) ? newlyAddedFoodIdParam[0] : newlyAddedFoodIdParam;
      const currentNewlyEditedId = Array.isArray(newlyEditedFoodIdParam) ? newlyEditedFoodIdParam[0] : newlyEditedFoodIdParam;
      
      // If we have a new refresh param, it means we're coming back from create/edit page
      if (currentRefreshParam && currentRefreshParam !== lastRefreshParam.current) {
        // Set active tab to custom if not already
        if (activeTab !== 'custom') {
          setActiveTab('custom');
        }
        
        // Track the newly added or edited food ID
        if (currentNewlyAddedId) {
          newlyAddedFoodId.current = currentNewlyAddedId;
          newlyEditedFoodId.current = undefined; // Clear edited if adding
        }
        if (currentNewlyEditedId) {
          newlyEditedFoodId.current = currentNewlyEditedId;
          newlyAddedFoodId.current = undefined; // Clear added if editing
        }
        
        // Refresh immediately if we've fetched before, or mark as fetched for first time
        if (customFoodsFetched.current) {
          refetchCustomFoods();
        } else {
          // First time - mark as fetched (React Query will fetch automatically)
          customFoodsFetched.current = true;
        }
        
        // Update last refresh param
        lastRefreshParam.current = currentRefreshParam;
      }
    }
  }, [refreshCustomFoodsParam, newlyAddedFoodIdParam, user?.id, activeTab, refetchCustomFoods]);

  // Handle barcode scan results - route to quick-log or keep legacy flows
  useEffect(() => {
    const handleScannedFood = async () => {
      // Handle manualEntryData - "1-time Log (Manual)" flow → quick-log
      const manualData = Array.isArray(manualEntryDataParam) ? manualEntryDataParam[0] : manualEntryDataParam;
      const shouldOpenManual = Array.isArray(openManualModeParam) ? openManualModeParam[0] === 'true' : openManualModeParam === 'true';
      
      if (shouldOpenManual && user?.id) {
        router.push({
          pathname: '/quick-log',
          params: {
            date: entryDate,
            mealType: mealType,
            ...(manualData ? { manualData } : {}),
          },
        });
        return;
      }

      // Legacy scanned food selection now routes to food-edit create flow
      const foodId = Array.isArray(selectedFoodIdParam) ? selectedFoodIdParam[0] : selectedFoodIdParam;
      if (foodId && user?.id) {
        try {
          const { data: food, error } = await supabase
            .from('food_master')
            .select('*')
            .eq('id', foodId)
            .single();
          
          if (food && !error) {
            handleFoodSelect(food as FoodMaster);
          }
        } catch (err) {
          console.error('[MealTypeLog] Error fetching scanned food:', err);
        }
      }

      // External scanned data (use once) → still navigate to food-edit create flow with a virtual food?
      const scannedData = Array.isArray(scannedFoodDataParam) ? scannedFoodDataParam[0] : scannedFoodDataParam;
      if (scannedData && user?.id) {
        try {
          const externalFood = JSON.parse(scannedData);
          const virtualFood: FoodMaster = {
            id: '',
            name: externalFood.product_name || 'Scanned Product',
            brand: externalFood.brand || null,
            calories_kcal: externalFood.energy_kcal_100g || 0,
            protein_g: externalFood.protein_100g || 0,
            carbs_g: externalFood.carbs_100g || 0,
            fat_g: externalFood.fat_100g || 0,
            fiber_g: externalFood.fiber_100g || null,
            saturated_fat_g: externalFood.saturated_fat_100g || null,
            trans_fat_g: externalFood.trans_fat_100g || null,
            sugar_g: externalFood.sugars_100g || null,
            sodium_mg: externalFood.sodium_100g ? Math.round(externalFood.sodium_100g * 1000) : null,
            serving_size: 100,
            serving_unit: 'g',
            source: 'openfoodfacts',
            is_custom: false,
            barcode: externalFood.barcode || null,
          };
          handleFoodSelect(virtualFood);
        } catch (err) {
          console.error('[MealTypeLog] Error parsing scanned food data:', err);
        }
      }
    };

    handleScannedFood();
  }, [selectedFoodIdParam, scannedFoodDataParam, manualEntryDataParam, openManualModeParam, user?.id, activeTab]);

  // Handle openBarcodeScanner param - open scanner when navigating from scanned-item "Scan Another"
  // Use a ref to ensure we only trigger once, even on re-renders
  const hasAutoOpenedScanner = useRef(false);
  useEffect(() => {
    const shouldOpenScanner = Array.isArray(openBarcodeScannerParam) 
      ? openBarcodeScannerParam[0] === 'true' 
      : openBarcodeScannerParam === 'true';
    
    if (shouldOpenScanner && !showBarcodeScanner && !hasAutoOpenedScanner.current) {
      setScanned(false); // Reset scanned state
      setBarcodeScanning(false); // Reset scanning state
      setShowBarcodeScanner(true);
      hasAutoOpenedScanner.current = true; // Mark as consumed
    }
  }, [openBarcodeScannerParam, showBarcodeScanner]);

  // Inline add/edit form is removed; quantities and servings are now handled in dedicated quick-log/food-edit screens.

  // Handle food selection from search results/lists → open food-edit create flow
  const handleFoodSelect = async (food: FoodMaster | EnhancedFoodItem) => {
    clearSearch();
    router.push({
      pathname: '/food-edit',
      params: {
        foodId: food.id,
        date: entryDate,
        mealType: mealType || 'breakfast',
      },
    });
  };

  /**
   * Quick Add - adds food entry with default serving immediately
   * Uses centralized serving logic from lib/servings.ts
   * For Recent items: uses recent_serving if available (from EnhancedFoodItem)
   * For other items: uses default serving
   */
  const handleQuickAdd = async (food: FoodMaster | EnhancedFoodItem, latestEntry?: CalorieEntry) => {
    if (!user?.id) return;

    const enhanced = food as EnhancedFoodItem;

    let displayServing: { quantity: number; unit: string } | null = null;

    // Prefer recent_serving when available (for RECENT items)
    if (enhanced && enhanced.recent_serving) {
      displayServing = {
        quantity: enhanced.recent_serving.quantity,
        unit: enhanced.recent_serving.unit,
      };
    } else if (
      enhanced &&
      typeof enhanced.serving_size === 'number' &&
      enhanced.serving_unit
    ) {
      // Fallback: use whatever the search row is displaying
      displayServing = {
        quantity: enhanced.serving_size,
        unit: enhanced.serving_unit,
      };
    }

    try {
      // Fetch servings once and derive defaults up front
      const servings = await getServingsForFood(food.id);
      const { defaultServing, nutrients: defaultNutrients } = getDefaultServingWithNutrients(food, servings);

      let servingQuantity: number = defaultServing.quantity;
      let servingUnit: string = defaultServing.unit;
      let servingId: string | null = defaultServing.serving?.id || null;
      let nutrients = defaultNutrients;

      // Check if this is an EnhancedFoodItem with recent_serving
      const enhancedFood = food as EnhancedFoodItem;
      if (enhancedFood.recent_serving) {
        // Recent item: use recent_serving (last-used serving size)
        servingQuantity = enhancedFood.recent_serving.quantity;
        servingUnit = enhancedFood.recent_serving.unit;
        
        // Find matching saved serving if present
        const matchingServing = servings.find(s => 
          s.serving_name && (
            s.serving_name.includes(`${servingQuantity} ${servingUnit}`) ||
            (s.weight_g && servingUnit === 'g' && Math.abs(s.weight_g - servingQuantity) < 0.01) ||
            (s.volume_ml && servingUnit === 'ml' && Math.abs(s.volume_ml - servingQuantity) < 0.01)
          )
        );
        
        if (matchingServing) {
          servingId = matchingServing.id;
        }
      } else if (latestEntry) {
        // Fallback: Recent tab with latestEntry (for compatibility)
        servingQuantity = latestEntry.quantity;
        servingUnit = latestEntry.unit;
        servingId = latestEntry.serving_id || null;
        
        // Try to confirm saved serving
        const savedServing = servingId ? servings.find(s => s.id === servingId) : null;
        if (savedServing) {
          servingId = savedServing.id;
        }
      }

      // 4. Prepare entry data
      const eatenAt = getCurrentDateTimeUTC();
      const dateString = entryDate;

      const entryData: any = {
        user_id: user.id,
        entry_date: dateString,
        eaten_at: eatenAt,
        meal_type: mealType.toLowerCase(),
        item_name: food.name + (food.brand ? ` (${food.brand})` : ''),
        food_id: food.id,
        quantity: servingQuantity,
        unit: servingUnit,
        calories_kcal: Math.round(nutrients.calories_kcal),
        protein_g: nutrients.protein_g !== null ? Math.round(nutrients.protein_g * 10) / 10 : null,
        carbs_g: nutrients.carbs_g !== null ? Math.round(nutrients.carbs_g * 10) / 10 : null,
        fat_g: nutrients.fat_g !== null ? Math.round(nutrients.fat_g * 10) / 10 : null,
        fiber_g: nutrients.fiber_g !== null ? Math.round(nutrients.fiber_g * 10) / 10 : null,
      };

      // Include serving_id if it's a saved serving
      if (servingId) {
        entryData.serving_id = servingId;
      }

      // Include optional nutrients if available
      if (nutrients.saturated_fat_g !== null && nutrients.saturated_fat_g > 0) {
        entryData.saturated_fat_g = Math.round(nutrients.saturated_fat_g * 100) / 100;
      }
      if ((nutrients as any).trans_fat_g !== null && (nutrients as any).trans_fat_g > 0) {
        entryData.trans_fat_g = Math.round((nutrients as any).trans_fat_g * 100) / 100;
      }
      if (nutrients.sugar_g !== null && nutrients.sugar_g > 0) {
        entryData.sugar_g = Math.round(nutrients.sugar_g * 100) / 100;
      }
      if (nutrients.sodium_mg !== null && nutrients.sodium_mg > 0) {
        entryData.sodium_mg = Math.round(nutrients.sodium_mg * 100) / 100;
      }

      // 5. Insert entry
      const { data: insertResult, error: insertError } = await supabase
        .from('calorie_entries')
        .insert(entryData)
        .select('id')
        .single();

      if (insertError) {
        console.error('Quick add insert error:', insertError);
        Alert.alert(
          t('alerts.error_title'),
          t('mealtype_log.errors.quick_add_failed', { error: insertError.message })
        );
        return;
      }

      // 6. Mark as newly added for highlight animation
      if (insertResult?.id) {
        markAsNewlyAdded(insertResult.id);
      }

      // 7. Success! Clear search and refresh entries
      clearSearch();
      await refetchEntries();

      // Show brief success feedback - meal type label for display
      const mealTypeLabel = t(`mealtype_log.meal_types.${mealType.toLowerCase()}`);
      Alert.alert(
        t('common.success'),
        t('mealtype_log.quick_add_success', { foodName: food.name, mealType: mealTypeLabel })
      );

    } catch (error: any) {
      console.error('Quick add error:', error);
      Alert.alert(
        t('alerts.error_title'),
        t('mealtype_log.errors.quick_add_failed', { error: error?.message || 'Unknown error' })
      );
    }
  };

  // Handle barcode scan button press
  const handleBarcodeScanPress = useCallback(async () => {
    try {
      // Open the scanner modal - UniversalBarcodeScanner will handle everything
      setScanned(false);
      setBarcodeScanning(false);
      setShowBarcodeScanner(true);
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      
      Alert.alert(
        t('alerts.error_title'),
        t('mealtype_log.scanner.open_failed', { error: errorMessage }),
        [{ text: t('common.ok') }]
      );
    }
  }, []);

  // Handle barcode scan result - UniversalBarcodeScanner passes code as string
  const handleBarcodeScanned = useCallback(async (code: string) => {
    if (scanned || barcodeScanning) return;
    
    const barcodeData = code?.trim();
    if (!barcodeData) return;
    
    setScanned(true);
    setBarcodeScanning(true);
    
    try {
      // Step 1: Validate and normalize the barcode (must be 12 or 13 digits)
      const validationResult = validateAndNormalizeBarcode(barcodeData);

      if (!validationResult.isValid) {
        // Invalid barcode format - show error with options
        Alert.alert(
          t('scanned_item.invalid_barcode_title', 'Invalid Barcode'),
          t('scanned_item.invalid_barcode_message', { 
            error: validationResult.error,
            code: barcodeData 
          }),
          [
            { 
              text: t('common.go_back', 'Go Back'), 
              style: 'cancel', 
              onPress: () => {
                setShowBarcodeScanner(false);
                setScanned(false);
                setBarcodeScanning(false);
              }
            },
            {
              text: t('mealtype_log.scanner.try_again', 'Try Again'), 
              onPress: () => {
                setScanned(false);
                setBarcodeScanning(false);
              }
            }
          ]
        );
        return;
      }

      // Step 2: Barcode is valid - close scanner and navigate to scanned-item page
      const normalizedCode = validationResult.normalizedCode!;
      
      // Close the scanner modal
      setShowBarcodeScanner(false);
      setScanned(false);
      setBarcodeScanning(false);
      
      // Navigate to the scanned-item page with the normalized barcode
      router.push({
        pathname: '/scanned-item',
        params: {
          barcode: normalizedCode,
          mealType: mealType || 'breakfast',
          entryDate: entryDate || getLocalDateString(),
        },
      });
      
    } catch (error: any) {
      console.error('Barcode scan error:', error);
      Alert.alert(
        t('alerts.error_title'),
        t('mealtype_log.scanner.scan_error', { error: error.message || t('common.unexpected_error') }),
        [
          { text: t('common.go_back', 'Go Back'), style: 'cancel', onPress: () => {
            setShowBarcodeScanner(false);
            setScanned(false);
            setBarcodeScanning(false);
          }},
          { 
            text: t('mealtype_log.scanner.try_again', 'Try Again'), 
            onPress: () => {
              setScanned(false);
              setBarcodeScanning(false);
            }
          }
        ]
      );
    } finally {
      setBarcodeScanning(false);
    }
  }, [scanned, barcodeScanning, mealType, entryDate, router, t]);

  return (
    <ThemedView style={styles.container}>
      {/* Date Picker Modal - Outside ScrollView for proper overlay */}
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
          style={styles.datePickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
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
                  onPress={() => setShowDatePicker(false)}
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
                          setSelectedDate(newDate);
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
                  onPress={() => setShowDatePicker(false)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.datePickerCancelButtonText, { color: colors.tint }]}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.datePickerOkButton, { backgroundColor: colors.tint }]}
                  onPress={() => {
                    handleDateSelect(selectedDate);
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

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DesktopPageContainer>
          {/* Header */}
          <View style={styles.headerContainer}>
          {/* First Line: Back Arrow, Diary Title, Empty Right */}
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={[
                styles.backArrowButton,
                getMinTouchTargetStyle(),
                { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
              ]}
              onPress={() => {
                router.back();
              }}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                'Go back',
                'Double tap to go back'
              )}
            >
              <ThemedText style={[styles.backArrow, { color: colors.tint }]}>←</ThemedText>
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <ThemedText style={[styles.mainTitle, { color: colors.text }]}>🍴 {t('mealtype_log.title')}</ThemedText>
            </View>
            <View style={styles.headerRight} />
          </View>
          
          {/* Second Line: Meal Type and Date - Centered */}
          <View style={styles.headerBottom}>
            <View
              ref={mealTypeButtonRef}
              onLayout={() => {
                mealTypeButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                  setMealTypeDropdownLayout({ x: pageX, y: pageY + height, width, height });
                });
              }}
            >
              <TouchableOpacity
                style={[
                  getMinTouchTargetStyle(),
                  { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                ]}
                onPress={() => {
                  mealTypeButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                    setMealTypeDropdownLayout({ x: pageX, y: pageY + height, width, height });
                    setShowMealTypeDropdown(!showMealTypeDropdown);
                  });
                }}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  `Change meal type, currently ${mealTypeLabel}`,
                  'Double tap to change meal type'
                )}
              >
                <ThemedText style={[styles.subHeaderMealType, { color: colors.tint }]}>{mealTypeLabel} ▼</ThemedText>
              </TouchableOpacity>
            </View>
            <ThemedText style={[styles.subHeaderSeparator, { color: colors.textSecondary }]}> • </ThemedText>
            <TouchableOpacity
              style={[
                getMinTouchTargetStyle(),
                { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
              ]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                `Change date, currently ${formattedDate}`,
                'Double tap to change the date'
              )}
            >
              <ThemedText style={[styles.subHeaderDate, { color: colors.tint }]}>{formattedDate}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {true && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBarWrapper}>
              <FoodSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                onEnterPress={() => {
                  const selected = handleEnterPress();
                  if (selected) {
                    handleFoodSelect(selected);
                  }
                  return selected;
                }}
                onClearSearch={clearSearch}
                onSetShowSearchResults={setShowSearchResults}
                onEnsureLocalFoodsLoaded={ensureLocalFoodsLoaded}
                searchResults={searchResults}
                searchLoading={searchLoading}
                showSearchResults={showSearchResults}
                onSelectFood={handleFoodSelect}
                placeholder={t('mealtype_log.search_placeholder')}
                colors={colors}
                onQuickAdd={(food) => {
                  handleQuickAdd(food);
                }}
                quickAddLabel={t('mealtype_log.quick_add')}
                highlightedIndex={highlightedIndex}
                onHighlightChange={setHighlightedIndex}
              />
            </View>
            <TouchableOpacity
              style={[styles.barcodeButton, { 
                backgroundColor: colors.tint + '15', 
                borderColor: colors.tint + '40',
              }]}
              onPress={handleBarcodeScanPress}
              onPressIn={() => {}}
              onPressOut={() => {}}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              {...getButtonAccessibilityProps(
                'Scan barcode',
                'Double tap to scan a barcode'
              )}
            >
              <IconSymbol 
                name="barcode.viewfinder" 
                size={24} 
                color={colors.tint}
                accessibilityLabel={t('mealtype_log.accessibility.scan_barcode')}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        {true && (
          <>
              <View 
                ref={tabsContainerWrapperRef}
               style={[styles.tabsContainerWrapper, { flexDirection: 'row', alignItems: 'center' }]}
              onLayout={() => {
                tabsContainerWrapperRef.current?.measure((x, y, width, height, pageX, pageY) => {
                  setTabsContainerWrapperLayout({ x: pageX, y: pageY, width, height });
                });
              }}
            >
              {/* Left arrow */}
              {canScrollLeft && (
                <TouchableOpacity
                  style={[styles.tabsScrollArrow, styles.tabsScrollArrowLeft, { backgroundColor: colors.background }]}
                  onPress={handleScrollLeft}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    'Scroll tabs left',
                    'Double tap to scroll tabs to the left'
                  )}
                >
                  <ThemedText style={[styles.tabsScrollArrowText, { color: colors.textSecondary }]}>‹</ThemedText>
                </TouchableOpacity>
              )}
              
              <ScrollView 
                ref={tabsScrollViewRef}
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.tabsContainer, { flexGrow: 1, alignItems: 'center', paddingLeft: 36, paddingRight: 36 }]}
                style={styles.tabsScrollView}
                scrollIndicatorInsets={{ bottom: -1 }}
                onScroll={(e) => {
                  handleTabsScroll(e);
                  const scrollX = e.nativeEvent.contentOffset?.x || 0;
                  tabsScrollOffsetRef.current = scrollX;
                }}
                onContentSizeChange={handleTabsContentSizeChange}
                scrollEventThrottle={16}
              >
                <SegmentedTabs
                  items={[
                    {
                      key: 'frequent',
                      label: t('mealtype_log.tabs.frequent'),
                      accessibilityLabel: t('mealtype_log.accessibility.frequent_tab'),
                      themeColor: CategoryColors.frequent,
                      themeFillColor: getTabListBackgroundColor('frequent'),
                    },
                    {
                      key: 'recent',
                      label: t('mealtype_log.tabs.recent'),
                      accessibilityLabel: t('mealtype_log.accessibility.recent_tab'),
                      themeColor: CategoryColors.recent,
                      themeFillColor: getTabListBackgroundColor('recent'),
                    },
                    {
                      key: 'custom',
                      label: t('mealtype_log.tabs.custom'),
                      accessibilityLabel: t('mealtype_log.accessibility.custom_tab'),
                      themeColor: CategoryColors.custom,
                      themeFillColor: getTabListBackgroundColor('custom'),
                    },
          {
            key: 'bundle',
            label: t('mealtype_log.tabs.bundles'),
            accessibilityLabel: t('mealtype_log.accessibility.bundles_tab'),
            themeColor: CategoryColors.bundle,
            themeFillColor: getTabListBackgroundColor('bundle'),
          },
          {
            key: 'manual',
            label: '⚡Quick Log',
            accessibilityLabel: t('mealtype_log.accessibility.manual_tab'),
            themeColor: colors.tint,
            themeFillColor: colors.tint + '10',
          },
                  ]}
                  activeKey={activeTab}
                  onChange={(key) => {
          if (key === 'manual') {
            router.push({
              pathname: '/quick-log',
              params: {
                date: entryDate,
                mealType: mealType,
              },
            });
            return;
          }
          handleTabPress(key as TabKey);
                  }}
                  onActiveTabLayout={handleActiveTabLayout}
                  style={{ marginHorizontal: Spacing.sm, marginTop: Spacing.xs }}
                />
              </ScrollView>
              
              {/* Right arrow */}
              {canScrollRight && (
                <TouchableOpacity
                  style={[styles.tabsScrollArrow, styles.tabsScrollArrowRight, { backgroundColor: colors.background }]}
                  onPress={handleScrollRight}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    'Scroll tabs right',
                    'Double tap to scroll tabs to the right'
                  )}
                >
                  <ThemedText style={[styles.tabsScrollArrowText, { color: colors.textSecondary }]}>›</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Collapsed Content Hint - Show when content is collapsed */}
            {tabContentCollapsed && (
              <TouchableOpacity
                onPress={() => setTabContentCollapsed(false)}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.5,
                }}
                accessibilityLabel={t('mealtype_log.expand_content')}
                accessibilityHint={t('mealtype_log.expand_content_hint')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TapToExpandHint text={t('mealtype_log.tap_to_expand')} textColor={colors.textSecondary} />
                  <IconSymbol
                    name="chevron.down"
                    size={14}
                    color={colors.icon}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Tab Content - Animated with attached popover styling */}
            {!tabContentCollapsed && activeTabLayout ? (
              <View style={{ position: 'relative', marginTop: Spacing.xs }}>
                {/* Connector pill - horizontal bridge between tab and dropdown */}
                <View
                  style={[
                    {
                      position: 'absolute',
                      top: -6, // Overlap bottom of tab
                      left: activeTabLayout.x - tabsScrollOffsetRef.current + activeTabLayout.width / 2 - 13, // Centered horizontally on active tab (width 26 / 2 = 13)
                      width: 26,
                      height: 11,
                      borderRadius: 999,
                      backgroundColor: getTabListBackgroundColor(activeTab), // Match the dropdown background
                      zIndex: 1001,
                    }
                  ]}
                />
                {/* Wrapper for tab content with attached popover styling - full width, matches inner list styling */}
                <View
                  style={[
                    {
                      backgroundColor: getTabListBackgroundColor(activeTab), // Match the list background color
                      borderColor: colors.icon + '20',
                      borderWidth: 1,
                      borderRadius: 12, // Match searchResultsContainer borderRadius
                      left: 0,
                      right: 0,
                      overflow: 'hidden',
                      ...Platform.select({
                        ios: {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.1,
                          shadowRadius: 12,
                        },
                        android: {
                          elevation: 4,
                        },
                        web: {
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                        },
                      }),
                    },
                  ]}
                >
                  <AnimatedTabContent
                    activeKey={activeTab}
                    previousKey={previousTabKey}
                    isExpanded={!tabContentCollapsed}
                    renderContent={(key: TabKey) => {
                // Render content for each tab using cached data only
                switch (key) {
                  case 'frequent':
                    return (
                      <View style={styles.tabContent}>
                        {!searchQuery && (
                          <>
                            {frequentFoodsLoading ? (
                              <View style={styles.emptyTabState}>
                                <ActivityIndicator size="small" color={colors.tint} />
                                <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 8 }]}>
                                  {t('mealtype_log.frequent_foods.loading')}
                                </ThemedText>
                              </View>
                            ) : frequentFoods.length > 0 ? (
                              <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                                <ScrollView 
                                  style={[styles.searchResultsList, { backgroundColor: 'transparent' }]}
                                  nestedScrollEnabled
                                  keyboardShouldPersistTaps="handled"
                                >
                                  {frequentFoods.map((food) => {
                                    const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                                    const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} cal`;
                                    const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                                    const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                                    const rightSideText = `${brandText}${nutritionInfo}`;
                                    const isCustom = food.is_custom === true;

                                    return (
                                      <View
                                        key={food.id}
                                        style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                                      >
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                          <TouchableOpacity
                                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
                                            onPress={() => handleFoodSelect(food)}
                                            activeOpacity={0.7}
                                          >
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
                                              <ThemedText 
                                                style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                              >
                                                {truncatedName}
                                              </ThemedText>
                                              <FoodSourceBadge
                                                isCustom={isCustom}
                                                colors={colors}
                                                marginLeft={6}
                                                containerStyle={{ marginRight: 0 }}
                                              />
                                            </View>
                                            <ThemedText 
                                              style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                              numberOfLines={1}
                                            >
                                              {rightSideText}
                                            </ThemedText>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                                            onPress={() => handleQuickAdd(food)}
                                            activeOpacity={0.7}
                                            accessibilityLabel={t('mealtype_log.quick_add')}
                                            accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                                          >
                                            <IconSymbol
                                              name="plus.circle.fill"
                                              size={22}
                                              color={colors.tint}
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </ScrollView>
                              </View>
                            ) : null}
                          </>
                        )}
                      </View>
                    );
                  
                  case 'recent':
                    return (
                      <View style={styles.tabContent}>
                        {!searchQuery && (
                          <>
                            {recentFoodsLoading ? (
                              <View style={styles.emptyTabState}>
                                <ActivityIndicator size="small" color={colors.tint} />
                                <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 8 }]}>
                                  {t('mealtype_log.recent_foods.loading')}
                                </ThemedText>
                              </View>
                            ) : recentFoods.length > 0 ? (
                              <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                                <ScrollView 
                                  style={[styles.searchResultsList, { backgroundColor: 'transparent' }]}
                                  nestedScrollEnabled
                                  keyboardShouldPersistTaps="handled"
                                >
                                  {recentFoods.map((food) => {
                                    const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                                    // Recent tab: Always use latest entry serving info for display
                                    // Fallback to default only in edge case where latestEntry is missing
                                    const servingQty = food.latestEntry ? food.latestServingQty : food.defaultServingQty;
                                    const servingUnit = food.latestEntry ? food.latestServingUnit : food.defaultServingUnit;
                                    const servingCalories = food.latestEntry ? food.latestServingCalories : food.defaultServingCalories;
                                    const nutritionInfo = `${servingQty} ${servingUnit} • ${servingCalories} cal`;
                                    const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                                    const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                                    const rightSideText = `${brandText}${nutritionInfo}`;
                                    const isCustom = food.is_custom === true;

                                    return (
                                      <View
                                        key={food.id}
                                        style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                                      >
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                          <TouchableOpacity
                                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
                                            onPress={() => handleFoodSelect(food)}
                                            activeOpacity={0.7}
                                          >
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
                                              <ThemedText 
                                                style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                              >
                                                {truncatedName}
                                              </ThemedText>
                                              <FoodSourceBadge
                                                isCustom={isCustom}
                                                colors={colors}
                                                marginLeft={6}
                                                containerStyle={{ marginRight: 0 }}
                                              />
                                            </View>
                                            <ThemedText 
                                              style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                              numberOfLines={1}
                                            >
                                              {rightSideText}
                                            </ThemedText>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                                            onPress={() => handleQuickAdd(food, food.latestEntry || undefined)}
                                            activeOpacity={0.7}
                                            accessibilityLabel={t('mealtype_log.quick_add')}
                                            accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                                          >
                                            <IconSymbol
                                              name="plus.circle.fill"
                                              size={22}
                                              color={colors.tint}
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </ScrollView>
                              </View>
                            ) : (
                              <View style={styles.emptyTabState}>
                                <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                                  {t('mealtype_log.recent_foods.empty')}
                                </ThemedText>
                                <ThemedText style={[styles.emptyTabSubtext, { color: colors.textSecondary }]}>
                                  {t('mealtype_log.recent_foods.hint')}
                                </ThemedText>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    );
                  
                  case 'custom':
                    return (
                      <View style={styles.tabContent}>
                        {/* Create New Custom Food Button (always visible) */}
                        <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: customFoodsLoading || customFoods.length === 0 ? 0 : 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                          <TouchableOpacity
                            style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15', backgroundColor: colors.tint + '10' }]}
                            onPress={() => {
                              router.push({
                                pathname: '/create-custom-food',
                                params: {
                                  mealType: mealType || 'breakfast',
                                  entryDate: entryDate || getLocalDateString(),
                                },
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.searchResultContent, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
                              <ThemedText style={[styles.searchResultName, { color: colors.tint, fontWeight: '700', flex: 1 }]}>
                                {t('mealtype_log.custom_foods.create_new')}
                              </ThemedText>
                              {customFoods.length > 0 && (
                                <TouchableOpacity
                                  onPress={() => {
                                    if (customFoodEditMode) {
                                      handleExitCustomFoodEditMode();
                                    } else {
                                      setCustomFoodEditMode(true);
                                    }
                                  }}
                                  style={[styles.editButton, { 
                                    backgroundColor: customFoodEditMode ? '#10B981' + '20' : colors.tint + '20', 
                                    borderColor: customFoodEditMode ? '#10B981' + '40' : colors.tint + '40' 
                                  }]}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.editButtonText, { 
                                    color: customFoodEditMode ? '#10B981' : colors.tint 
                                  }]}>
                                    {customFoodEditMode ? '✓' : '✏️'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </TouchableOpacity>
                        </View>

                        {customFoodsLoading ? (
                          <View style={styles.emptyTabState}>
                            <ActivityIndicator size="large" color={colors.tint} />
                            <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 12 }]}>
                              {t('mealtype_log.custom_foods.loading')}
                            </ThemedText>
                          </View>
                        ) : customFoods.length > 0 ? (
                          <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                            <ScrollView 
                              style={[styles.searchResultsList, { backgroundColor: 'transparent' }]}
                              nestedScrollEnabled
                              keyboardShouldPersistTaps="handled"
                            >
                              {(() => {
                                let sortedFoods;
                                if (customFoodEditMode) {
                                  sortedFoods = [...customFoods];
                                  const newlyAddedIndex = sortedFoods.findIndex(f => f.id === newlyAddedFoodId.current || f.id === newlyEditedFoodId.current);
                                  if (newlyAddedIndex > 0) {
                                    const newlyAdded = sortedFoods.splice(newlyAddedIndex, 1)[0];
                                    sortedFoods.unshift(newlyAdded);
                                  }
                                } else {
                                  sortedFoods = [...customFoods].sort((a, b) => {
                                    if (newlyAddedFoodId.current === a.id || newlyEditedFoodId.current === a.id) return -1;
                                    if (newlyAddedFoodId.current === b.id || newlyEditedFoodId.current === b.id) return 1;
                                    const indexA = customFoods.findIndex(f => f.id === a.id);
                                    const indexB = customFoods.findIndex(f => f.id === b.id);
                                    return indexA - indexB;
                                  });
                                }
                                
                                return sortedFoods.map((food) => {
                                  const isNewlyAdded = newlyAddedFoodId.current === food.id;
                                  const isNewlyEdited = newlyEditedFoodId.current === food.id;
                                  const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                                  const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} cal`;
                                  const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                                  const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                                  const rightSideText = `${brandText}${nutritionInfo}`;
                                  
                                  return (
                                    <View
                                      key={food.id}
                                      style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                                    >
                                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                        <TouchableOpacity
                                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, opacity: customFoodEditMode ? 0.6 : 1 }}
                                          onPress={() => {
                                            if (!customFoodEditMode) {
                                              handleFoodSelect(food);
                                            }
                                          }}
                                          disabled={customFoodEditMode}
                                          activeOpacity={0.7}
                                        >
                                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                            <ThemedText 
                                              style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                                              numberOfLines={1}
                                              ellipsizeMode="tail"
                                            >
                                              {truncatedName}
                                            </ThemedText>
                                            {isNewlyAdded && (
                                              <View style={[styles.justAddedBadge, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40' }]}>
                                                <ThemedText style={[styles.justAddedText, { color: colors.tint }]}>
                                                  just added
                                                </ThemedText>
                                              </View>
                                            )}
                                            {isNewlyEdited && (
                                              <View style={[styles.justAddedBadge, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40' }]}>
                                                <ThemedText style={[styles.justAddedText, { color: colors.tint }]}>
                                                  just edited
                                                </ThemedText>
                                              </View>
                                            )}
                                          </View>
                                          {!customFoodEditMode && (
                                            <ThemedText 
                                              style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                              numberOfLines={1}
                                            >
                                              {rightSideText}
                                            </ThemedText>
                                          )}
                                        </TouchableOpacity>
                                      </View>
                                      {customFoodEditMode && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                                          <TouchableOpacity
                                            style={[
                                              styles.editButton, 
                                              { 
                                                backgroundColor: colors.icon + '20', 
                                                borderColor: colors.icon + '40', 
                                                marginRight: 4, 
                                                opacity: sortedFoods.findIndex(f => f.id === food.id) === 0 ? 0.5 : 1,
                                              }
                                            ]}
                                            onPress={() => handleMoveCustomFoodUp(food.id)}
                                            disabled={sortedFoods.findIndex(f => f.id === food.id) === 0}
                                            activeOpacity={0.7}
                                          >
                                            <Text style={[styles.editButtonText, { color: colors.text, fontSize: 14 }]}>↑</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={[
                                              styles.editButton, 
                                              { 
                                                backgroundColor: colors.icon + '20', 
                                                borderColor: colors.icon + '40', 
                                                marginRight: 6, 
                                                opacity: sortedFoods.findIndex(f => f.id === food.id) === sortedFoods.length - 1 ? 0.5 : 1,
                                              }
                                            ]}
                                            onPress={() => handleMoveCustomFoodDown(food.id)}
                                            disabled={sortedFoods.findIndex(f => f.id === food.id) === sortedFoods.length - 1}
                                            activeOpacity={0.7}
                                          >
                                            <Text style={[styles.editButtonText, { color: colors.text, fontSize: 14 }]}>↓</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={[styles.deleteButton, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', marginRight: 6 }]}
                                            onPress={() => handleDeleteCustomFood(food)}
                                            activeOpacity={0.7}
                                          >
                                            <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={[styles.editButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40' }]}
                                            onPress={() => {
                                              router.push({
                                                pathname: '/create-custom-food',
                                                params: {
                                                  mealType: mealType || 'breakfast',
                                                  entryDate: entryDate || getLocalDateString(),
                                                  foodId: food.id,
                                                },
                                              });
                                            }}
                                            activeOpacity={0.7}
                                          >
                                            <Text style={[styles.editButtonText, { color: colors.tint }]}>✏️</Text>
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                      {!customFoodEditMode && (
                                        <>
                                          <TouchableOpacity
                                            style={[styles.editButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40', marginLeft: 6 }]}
                                            onPress={() => {
                                              router.push({
                                                pathname: '/create-custom-food',
                                                params: {
                                                  mealType: mealType || 'breakfast',
                                                  entryDate: entryDate || getLocalDateString(),
                                                  cloneFoodId: food.id,
                                                },
                                              });
                                            }}
                                            activeOpacity={0.7}
                                          >
                                            <Text style={[styles.editButtonText, { color: colors.tint }]}>⧉</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                                            onPress={() => handleQuickAdd(food)}
                                            activeOpacity={0.7}
                                            accessibilityLabel={t('mealtype_log.quick_add')}
                                            accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                                          >
                                            <IconSymbol
                                              name="plus.circle.fill"
                                              size={22}
                                              color={colors.tint}
                                            />
                                          </TouchableOpacity>
                                        </>
                                      )}
                                    </View>
                                  );
                                });
                              })()}
                            </ScrollView>
                          </View>
                        ) : (
                          <View style={styles.emptyTabState}>
                            <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                              {t('mealtype_log.custom_foods.empty')}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    );
                  
                  case 'bundle':
                    return (
                      <View style={styles.tabContent}>
                        {/* Create New Bundle Button */}
                        <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: bundlesLoading || bundles.length === 0 ? 0 : 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                          <TouchableOpacity
                            style={[
                              styles.searchResultItem, 
                              { 
                                borderBottomColor: colors.icon + '15', 
                                backgroundColor: bundles.length >= 20 ? colors.icon + '20' : colors.tint + '10',
                                opacity: bundles.length >= 20 ? 0.6 : 1,
                              }
                            ]}
                            onPress={() => {
                              if (bundles.length >= 20) {
                                Alert.alert(t('alerts.limit_reached'), t('mealtype_log.bundles.limit_reached'));
                                return;
                              }
                              router.push({
                                pathname: '/create-bundle',
                                params: {
                                  mealType: mealType || 'breakfast',
                                  entryDate: entryDate || getLocalDateKey(new Date()),
                                },
                              });
                            }}
                            disabled={bundles.length >= 20}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.searchResultContent, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
                              <ThemedText style={[
                                styles.searchResultName, 
                                { 
                                  color: bundles.length >= 20 ? colors.icon : colors.tint, 
                                  fontWeight: '700',
                                  flex: 1,
                                }
                              ]}>
                                {t('mealtype_log.bundles.create_new')}{' '}
                                <ThemedText style={{
                                  fontWeight: '400',
                                  fontSize: 13,
                                  color: bundles.length >= 20 ? colors.icon + '80' : colors.tint + 'CC',
                                }}>
                                  {t('mealtype_log.bundles.bundles_count', { count: bundles.length })}
                                </ThemedText>
                              </ThemedText>
                              {bundles.length > 0 && (
                                <TouchableOpacity
                                  onPress={() => {
                                    if (bundleEditMode) {
                                      handleExitBundleEditMode();
                                    } else {
                                      setBundleEditMode(true);
                                    }
                                  }}
                                  style={[styles.editButton, { 
                                    backgroundColor: bundleEditMode ? '#10B981' + '20' : colors.tint + '20', 
                                    borderColor: bundleEditMode ? '#10B981' + '40' : colors.tint + '40' 
                                  }]}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.editButtonText, { 
                                    color: bundleEditMode ? '#10B981' : colors.tint 
                                  }]}>
                                    {bundleEditMode ? '✓' : '✏️'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </TouchableOpacity>
                        </View>

                        {bundlesLoading ? (
                          <View style={styles.emptyTabState}>
                            <ActivityIndicator size="large" color={colors.tint} />
                            <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 12 }]}>
                              {t('mealtype_log.bundles.loading')}
                            </ThemedText>
                          </View>
                        ) : bundles.length > 0 ? (
                          <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                            <ScrollView 
                              style={[styles.searchResultsList, { backgroundColor: 'transparent' }]}
                              nestedScrollEnabled
                              keyboardShouldPersistTaps="handled"
                            >
                              {bundles.map((bundle) => (
                                <HighlightableRow
                                  key={bundle.id}
                                  isNew={isBundleNewlyAdded(bundle.id)}
                                  style={StyleSheet.flatten([styles.searchResultItem, { borderBottomColor: colors.icon + '15' }])}
                                >
                                  {!bundleEditMode ? (
                                    <TouchableOpacity
                                      style={[
                                        { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
                                        getMinTouchTargetStyle(),
                                        { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
                                      ]}
                                      onPress={() => {
                                        if (!loading) {
                                          handleAddBundleToMeal(bundle);
                                        }
                                      }}
                                      disabled={loading}
                                      activeOpacity={0.7}
                                      {...getButtonAccessibilityProps(
                                        t('mealtype_log.add_bundle.label'),
                                        t('mealtype_log.add_bundle.hint')
                                      )}
                                      {...(Platform.OS === 'web' ? getWebAccessibilityProps(
                                        'button',
                                        t('mealtype_log.add_bundle.label'),
                                        `add-bundle-${bundle.id}`
                                      ) : {})}
                                    >
                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <ThemedText 
                                          style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: 4 }]}
                                          numberOfLines={1}
                                          ellipsizeMode="tail"
                                        >
                                          {bundle.name}{' '}
                                          <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }}>
                                            ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                                          </ThemedText>
                                        </ThemedText>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                                          {bundle.totalCalories !== undefined && (
                                            <ThemedText style={[styles.searchResultNutrition, { color: colors.tint, fontSize: 12, fontWeight: '600' }]}>
                                              {bundle.totalCalories} cal
                                            </ThemedText>
                                          )}
                                          {(bundle.totalProtein || bundle.totalCarbs || bundle.totalFat || bundle.totalFiber) && (
                                            <>
                                              <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 8 }]}>
                                                •
                                              </ThemedText>
                                              {bundle.totalProtein ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                  P: {bundle.totalProtein}g
                                                </ThemedText>
                                              ) : null}
                                              {bundle.totalCarbs ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                  C: {bundle.totalCarbs}g
                                                </ThemedText>
                                              ) : null}
                                              {bundle.totalFat ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                  Fat: {bundle.totalFat}g
                                                </ThemedText>
                                              ) : null}
                                              {bundle.totalFiber ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                  Fib: {bundle.totalFiber}g
                                                </ThemedText>
                                              ) : null}
                                            </>
                                          )}
                                        </View>
                                        <ThemedText 
                                          style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginTop: 2 }]}
                                          numberOfLines={3}
                                          ellipsizeMode="tail"
                                        >
                                          {formatBundleItemsList(bundle)}
                                        </ThemedText>
                                      </View>
                                    </TouchableOpacity>
                                  ) : (
                                    <>
                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <ThemedText 
                                          style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: 0 }]}
                                          numberOfLines={1}
                                          ellipsizeMode="tail"
                                        >
                                          {bundle.name}{' '}
                                          <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }}>
                                            ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                                          </ThemedText>
                                        </ThemedText>
                                      </View>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
<TouchableOpacity
                                          style={[styles.deleteButton, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', marginRight: 6 }]}
                                          onPress={() => handleDeleteBundle(bundle)}
                                          activeOpacity={0.7}
                                        >
                                          <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={[styles.editButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40', marginRight: 6 }]}
                                          onPress={() => {
                                            router.push({
                                              pathname: '/create-bundle',
                                              params: {
                                                mealType: mealType || 'breakfast',
                                                entryDate: entryDate || getLocalDateString(),
                                                bundleId: bundle.id,
                                              },
                                            });
                                          }}
                                          activeOpacity={0.7}
                                        >
                                          <Text style={[styles.editButtonText, { color: colors.tint }]}>✏️</Text>
                                        </TouchableOpacity>
                                      </View>
                                    </>
                                  )}
                                </HighlightableRow>
                              ))}
                            </ScrollView>
                          </View>
                        ) : (
                          <View style={styles.emptyTabState}>
                            <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                              {t('mealtype_log.bundles.empty')}
                            </ThemedText>
                            <ThemedText style={[styles.emptyTabSubtext, { color: colors.textSecondary }]}>
                              {t('mealtype_log.bundles.hint')}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    );
                  
                  default:
                    return null;
                }
              }}
                  />
                </View>
              </View>
            ) : (
              <AnimatedTabContent
                activeKey={activeTab}
                previousKey={previousTabKey}
                isExpanded={!tabContentCollapsed}
                renderContent={(key: TabKey) => {
                  // Render content for each tab using cached data only
                  switch (key) {
                    case 'frequent':
                      return (
                        <View style={styles.tabContent}>
                          {!searchQuery && (
                            <>
                              {frequentFoodsLoading ? (
                                <View style={styles.emptyTabState}>
                                  <ActivityIndicator size="small" color={colors.tint} />
                                  <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 8 }]}>
                                    {t('mealtype_log.frequent_foods.loading')}
                                  </ThemedText>
                                </View>
                              ) : frequentFoods.length > 0 ? (
                                <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('frequent'), borderColor: colors.icon + '20' }]}>
                                  <ScrollView 
                                    style={styles.searchResultsList}
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                  >
                                    {frequentFoods.map((food) => {
                                      const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                                      const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} cal`;
                                      const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                                      const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                                      const rightSideText = `${brandText}${nutritionInfo}`;
                                      const isCustom = food.is_custom === true;

                                      return (
                                        <View
                                          key={food.id}
                                          style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                                        >
                                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                            <TouchableOpacity
                                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
                                              onPress={() => handleFoodSelect(food)}
                                              activeOpacity={0.7}
                                            >
                                              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                                <ThemedText 
                                                  style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                                                  numberOfLines={1}
                                                  ellipsizeMode="tail"
                                                >
                                                  {truncatedName}
                                                </ThemedText>
                                              </View>
                                              <ThemedText 
                                                style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                                numberOfLines={1}
                                              >
                                                {rightSideText}
                                              </ThemedText>
                                            </TouchableOpacity>
                                            <FoodSourceBadge
                                              isCustom={isCustom}
                                              colors={colors}
                                              marginLeft={6}
                                            />
                                            <TouchableOpacity
                                              style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                                              onPress={() => handleQuickAdd(food)}
                                              activeOpacity={0.7}
                                              accessibilityLabel={t('mealtype_log.quick_add')}
                                              accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                                            >
                                              <IconSymbol
                                                name="plus.circle.fill"
                                                size={22}
                                                color={colors.tint}
                                              />
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              ) : null}
                            </>
                          )}
                        </View>
                      );
                    
                    case 'recent':
                      return (
                        <View style={styles.tabContent}>
                          {!searchQuery && (
                            <>
                              {recentFoodsLoading ? (
                                <View style={styles.emptyTabState}>
                                  <ActivityIndicator size="small" color={colors.tint} />
                                  <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 8 }]}>
                                    {t('mealtype_log.recent_foods.loading')}
                                  </ThemedText>
                                </View>
                              ) : recentFoods.length > 0 ? (
                                <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('recent'), borderColor: colors.icon + '20' }]}>
                                  <ScrollView 
                                    style={styles.searchResultsList}
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                  >
                                    {recentFoods.map((food) => {
                                      const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                                      const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} cal`;
                                      const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                                      const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                                      const rightSideText = `${brandText}${nutritionInfo}`;
                                      const isCustom = food.is_custom === true;

                                      return (
                                        <View
                                          key={food.id}
                                          style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                                        >
                                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                            <TouchableOpacity
                                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
                                              onPress={() => handleFoodSelect(food)}
                                              activeOpacity={0.7}
                                            >
                                              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                                <ThemedText 
                                                  style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                                                  numberOfLines={1}
                                                  ellipsizeMode="tail"
                                                >
                                                  {truncatedName}
                                                </ThemedText>
                                              </View>
                                              <ThemedText 
                                                style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                                numberOfLines={1}
                                              >
                                                {rightSideText}
                                              </ThemedText>
                                            </TouchableOpacity>
                                            <FoodSourceBadge
                                              isCustom={isCustom}
                                              colors={colors}
                                              marginLeft={6}
                                            />
                                            <TouchableOpacity
                                              style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                                              onPress={() => handleQuickAdd(food)}
                                              activeOpacity={0.7}
                                              accessibilityLabel={t('mealtype_log.quick_add')}
                                              accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                                            >
                                              <IconSymbol
                                                name="plus.circle.fill"
                                                size={22}
                                                color={colors.tint}
                                              />
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              ) : null}
                            </>
                          )}
                        </View>
                      );
                    
                    case 'custom':
                      return (
                        <View style={styles.tabContent}>
                          {/* Create New Custom Food Button (always visible) */}
                          <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: customFoodsLoading || customFoods.length === 0 ? 0 : 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                          <TouchableOpacity
                            style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15', backgroundColor: colors.tint + '10' }]}
                            onPress={() => {
                              router.push({
                                pathname: '/create-custom-food',
                                params: {
                                  mealType: mealType || 'breakfast',
                                  entryDate: entryDate || getLocalDateString(),
                                },
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.searchResultContent, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
                              <ThemedText style={[styles.searchResultName, { color: colors.tint, fontWeight: '700', flex: 1 }]}>
                                {t('mealtype_log.custom_foods.create_new')}
                              </ThemedText>
                              {customFoods.length > 0 && (
                                <TouchableOpacity
                                  onPress={() => {
                                    if (customFoodEditMode) {
                                      handleExitCustomFoodEditMode();
                                    } else {
                                      setCustomFoodEditMode(true);
                                    }
                                  }}
                                  style={[styles.editButton, { 
                                    backgroundColor: customFoodEditMode ? '#10B981' + '20' : colors.tint + '20', 
                                    borderColor: customFoodEditMode ? '#10B981' + '40' : colors.tint + '40' 
                                  }]}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.editButtonText, { 
                                    color: customFoodEditMode ? '#10B981' : colors.tint 
                                  }]}>
                                    {customFoodEditMode ? '✓' : '✏️'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </TouchableOpacity>
                          </View>

                          {customFoodsLoading ? (
                            <View style={styles.emptyTabState}>
                              <ActivityIndicator size="small" color={colors.tint} />
                              <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 8 }]}>
                                {t('mealtype_log.custom_foods.loading')}
                              </ThemedText>
                            </View>
                          ) : customFoods.length > 0 ? (
                            <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
                              <ScrollView 
                                style={[styles.searchResultsList, { backgroundColor: 'transparent' }]}
                                nestedScrollEnabled
                                keyboardShouldPersistTaps="handled"
                              >
                                {customFoods.map((food) => {
                                  const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                                  const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} cal`;
                                  const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                                  const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                                  const rightSideText = `${brandText}${nutritionInfo}`;
                                  const isCustom = food.is_custom === true;

                                  return (
                                    <View
                                      key={food.id}
                                      style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                                    >
                                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                                        <TouchableOpacity
                                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, opacity: customFoodEditMode ? 0.6 : 1 }}
                                          onPress={() => {
                                            if (!customFoodEditMode) {
                                              handleFoodSelect(food);
                                            }
                                          }}
                                          disabled={customFoodEditMode}
                                          activeOpacity={0.7}
                                        >
                                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
                                            <ThemedText 
                                              style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                                              numberOfLines={1}
                                              ellipsizeMode="tail"
                                            >
                                              {truncatedName}
                                            </ThemedText>
                                            <FoodSourceBadge
                                              isCustom={isCustom}
                                              colors={colors}
                                              marginLeft={6}
                                              containerStyle={{ marginRight: 0 }}
                                            />
                                          </View>
                                          <ThemedText 
                                            style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                            numberOfLines={1}
                                          >
                                            {rightSideText}
                                          </ThemedText>
                                        </TouchableOpacity>
                                            {customFoodEditMode ? (
                                              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                                                <TouchableOpacity
                                                  style={[styles.deleteButton, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', marginRight: 6 }]}
                                                  onPress={() => handleDeleteCustomFood(food)}
                                                  activeOpacity={0.7}
                                                >
                                                  <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                  style={[styles.editButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40' }]}
                                                  onPress={() => {
                                                    router.push({
                                                      pathname: '/create-custom-food',
                                                      params: {
                                                        mealType: mealType || 'breakfast',
                                                        entryDate: entryDate || getLocalDateString(),
                                                        foodId: food.id,
                                                      },
                                                    });
                                                  }}
                                                  activeOpacity={0.7}
                                                >
                                                  <Text style={[styles.editButtonText, { color: colors.tint }]}>✏️</Text>
                                                </TouchableOpacity>
                                              </View>
                                            ) : (
                                              <TouchableOpacity
                                                style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                                                onPress={() => handleQuickAdd(food)}
                                                activeOpacity={0.7}
                                                accessibilityLabel={t('mealtype_log.quick_add')}
                                                accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                                              >
                                                <IconSymbol
                                                  name="plus.circle.fill"
                                                  size={22}
                                                  color={colors.tint}
                                                />
                                              </TouchableOpacity>
                                            )}
                                      </View>
                                    </View>
                                  );
                                })}
                              </ScrollView>
                            </View>
                          ) : (
                            <View style={styles.emptyTabState}>
                              <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                                {t('mealtype_log.custom_foods.empty')}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      );
                    
                    case 'bundle':
                      return (
                        <View style={styles.tabContent}>
                          {!searchQuery && (
                            <>
                              <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('bundle'), borderColor: colors.icon + '20', marginBottom: 8 }]}>
                                <TouchableOpacity
                                  onPress={() => {
                                    router.push({
                                      pathname: '/create-bundle',
                                      params: {
                                        mealType: mealType || 'breakfast',
                                        entryDate: entryDate || getLocalDateString(),
                                      },
                                    });
                                  }}
                                  disabled={bundles.length >= 20}
                                  activeOpacity={0.7}
                                >
                                  <View style={[styles.searchResultContent, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
                                    <ThemedText style={[
                                      styles.searchResultName, 
                                      { 
                                        color: bundles.length >= 20 ? colors.icon : colors.tint, 
                                        fontWeight: '700',
                                        flex: 1,
                                      }
                                    ]}>
                                      {t('mealtype_log.bundles.create_new')}{' '}
                                      <ThemedText style={{
                                        fontWeight: '400',
                                        fontSize: 13,
                                        color: bundles.length >= 20 ? colors.icon + '80' : colors.tint + 'CC',
                                      }}>
                                        {t('mealtype_log.bundles.bundles_count', { count: bundles.length })}
                                      </ThemedText>
                                    </ThemedText>
                                    {bundles.length > 0 && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          if (bundleEditMode) {
                                            handleExitBundleEditMode();
                                          } else {
                                            setBundleEditMode(true);
                                          }
                                        }}
                                        style={[styles.editButton, { 
                                          backgroundColor: bundleEditMode ? '#10B981' + '20' : colors.tint + '20', 
                                          borderColor: bundleEditMode ? '#10B981' + '40' : colors.tint + '40' 
                                        }]}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={[styles.editButtonText, { 
                                          color: bundleEditMode ? '#10B981' : colors.tint 
                                        }]}>
                                          {bundleEditMode ? '✓' : '✏️'}
                                        </Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </TouchableOpacity>
                              </View>

                              {bundlesLoading ? (
                                <View style={styles.emptyTabState}>
                                  <ActivityIndicator size="large" color={colors.tint} />
                                  <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 12 }]}>
                                    {t('mealtype_log.bundles.loading')}
                                  </ThemedText>
                                </View>
                              ) : bundles.length > 0 ? (
                                <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('bundle'), borderColor: colors.icon + '20' }]}>
                                  <ScrollView 
                                    style={styles.searchResultsList}
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                  >
                                    {bundles.map((bundle) => (
                                      <HighlightableRow
                                        key={bundle.id}
                                        isNew={isBundleNewlyAdded(bundle.id)}
                                        style={StyleSheet.flatten([styles.searchResultItem, { borderBottomColor: colors.icon + '15' }])}
                                      >
                                        {!bundleEditMode ? (
                                          <TouchableOpacity
                                            style={[
                                              { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
                                              getMinTouchTargetStyle(),
                                              { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
                                            ]}
                                            onPress={() => {
                                              if (!loading) {
                                                handleAddBundleToMeal(bundle);
                                              }
                                            }}
                                            disabled={loading}
                                            activeOpacity={0.7}
                                            {...getButtonAccessibilityProps(
                                              t('mealtype_log.add_bundle.label'),
                                              t('mealtype_log.add_bundle.hint')
                                            )}
                                            {...(Platform.OS === 'web' ? getWebAccessibilityProps(
                                              'button',
                                              t('mealtype_log.add_bundle.label'),
                                              `add-bundle-${bundle.id}`
                                            ) : {})}
                                          >
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                              <ThemedText 
                                                style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: 4 }]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                              >
                                                {bundle.name}{' '}
                                                <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }}>
                                                  ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                                                </ThemedText>
                                              </ThemedText>
                                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                                                {bundle.totalCalories !== undefined && (
                                                  <ThemedText style={[styles.searchResultNutrition, { color: colors.tint, fontSize: 12, fontWeight: '600' }]}>
                                                    {bundle.totalCalories} cal
                                                  </ThemedText>
                                                )}
                                                {(bundle.totalProtein || bundle.totalCarbs || bundle.totalFat || bundle.totalFiber) && (
                                                  <>
                                                    <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 8 }]}>
                                                      •
                                                    </ThemedText>
                                                    {bundle.totalProtein ? (
                                                      <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                        P: {bundle.totalProtein}g
                                                      </ThemedText>
                                                    ) : null}
                                                    {bundle.totalCarbs ? (
                                                      <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                        C: {bundle.totalCarbs}g
                                                      </ThemedText>
                                                    ) : null}
                                                    {bundle.totalFat ? (
                                                      <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                        Fat: {bundle.totalFat}g
                                                      </ThemedText>
                                                    ) : null}
                                                    {bundle.totalFiber ? (
                                                      <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                                        Fib: {bundle.totalFiber}g
                                                      </ThemedText>
                                                    ) : null}
                                                  </>
                                                )}
                                              </View>
                                              <ThemedText 
                                                style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginTop: 2 }]}
                                                numberOfLines={3}
                                                ellipsizeMode="tail"
                                              >
                                                {formatBundleItemsList(bundle)}
                                              </ThemedText>
                                            </View>
                                          </TouchableOpacity>
                                        ) : (
                                          <>
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                              <ThemedText 
                                                style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: 0 }]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                              >
                                                {bundle.name}{' '}
                                                <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }}>
                                                  ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                                                </ThemedText>
                                              </ThemedText>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
<TouchableOpacity
                                                style={[styles.deleteButton, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', marginRight: 6 }]}
                                                onPress={() => handleDeleteBundle(bundle)}
                                                activeOpacity={0.7}
                                              >
                                                <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                                              </TouchableOpacity>
                                              <TouchableOpacity
                                                style={[styles.editButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40', marginRight: 6 }]}
                                                onPress={() => {
                                                  router.push({
                                                    pathname: '/create-bundle',
                                                    params: {
                                                      mealType: mealType || 'breakfast',
                                                      entryDate: entryDate || getLocalDateString(),
                                                      bundleId: bundle.id,
                                                    },
                                                  });
                                                }}
                                                activeOpacity={0.7}
                                              >
                                                <Text style={[styles.editButtonText, { color: colors.tint }]}>✏️</Text>
                                              </TouchableOpacity>
                                            </View>
                                          </>
                                        )}
                                      </HighlightableRow>
                                    ))}
                                  </ScrollView>
                                </View>
                              ) : (
                                <View style={styles.emptyTabState}>
                                  <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                                    {t('mealtype_log.bundles.empty')}
                                  </ThemedText>
                                  <ThemedText style={[styles.emptyTabSubtext, { color: colors.textSecondary }]}>
                                    {t('mealtype_log.bundles.hint')}
                                  </ThemedText>
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      );
                    
                    default:
                      return null;
                  }
                }}
              />
            )}
          </>
        )}

        {/* Food Log */}
        <View style={[styles.foodLogContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.entriesSection}>
            <View style={styles.entriesHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              {t('mealtype_log.food_log.title_with_count', { count: entries.length })}
            </ThemedText>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                {` \u00B7 `}
              </ThemedText>
              <ThemedText style={[styles.sectionTitle, { color: colors.tint, fontWeight: '400' }]}>
                {`${mealCaloriesTotal} ${t('home.food_log.kcal')}`}
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {!showLoadingSpinner && entries.length > 0 && (
                <View style={styles.toggleContainer}>
                  <ThemedText style={[styles.toggleLabel, { color: colors.textSecondary }]}>
                    {t('mealtype_log.food_log.details')}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setShowEntryDetails(!showEntryDetails)}
                    activeOpacity={0.8}
                  >
                    <Animated.View
                      style={[
                        styles.toggleTrack,
                        {
                          backgroundColor: showEntryDetails ? colors.tint : colors.icon + '40',
                        },
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.toggleThumb,
                          {
                            backgroundColor: '#fff',
                            transform: [
                              {
                                translateX: toggleAnimation.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 20],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              )}
              {!showLoadingSpinner && (
                <TouchableOpacity
                  onPress={() => {
                    if (entriesEditMode) {
                      // Exit edit mode
                      setEntriesEditMode(false);
                      clearEntrySelection();
                    } else {
                      // Open menu
                      setMassDeleteMenuVisible(true);
                    }
                  }}
                  style={[
                    styles.massDeleteMenuButton,
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    entriesEditMode 
                      ? t('mealtype_log.food_log.exit_selection_mode', { defaultValue: 'Exit selection mode' })
                      : t('mealtype_log.food_log.more_options', { defaultValue: 'More options' }),
                    entriesEditMode
                      ? t('mealtype_log.food_log.exit_selection_mode_hint', { defaultValue: 'Double tap to exit selection mode' })
                      : t('mealtype_log.food_log.more_options_hint', { defaultValue: 'Double tap to open menu' })
                  )}
                >
                  {entriesEditMode ? (
                    <IconSymbol name="checkmark" size={20} color={colors.tint} />
                  ) : (
                    <IconSymbol name="ellipsis" size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
          {/* Notes row */}
          {currentMealMeta?.note && currentMealMeta.note.trim().length > 0 && (
            <TouchableOpacity
              style={[
                styles.noteRow,
                getMinTouchTargetStyle(),
                Platform.OS === 'web' && getFocusStyle(colors.tint),
              ]}
              onPress={() => {
                setNoteEditor({ visible: true });
              }}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                t('food.note.edit', { defaultValue: `Edit notes for ${t(`home.meal_types.${selectedMealType}`)}`, mealType: t(`home.meal_types.${selectedMealType}`) })
              )}
            >
              <ThemedText
                style={[styles.noteRowText, { color: colors.text }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                📝 {currentMealMeta.note}
              </ThemedText>
            </TouchableOpacity>
          )}
          <View style={[styles.foodLogDivider, { backgroundColor: colors.separator }]} />

          {/* Meal Totals - Only shown when Details toggle is ON and there are entries */}
          {showEntryDetails && mealTotals && (mealTotals.kcal > 0 || (entries?.length ?? 0) > 0) && (
            <View style={[styles.mealTotalsContainer, { backgroundColor: colors.tintLight }]}>
              <ThemedText style={[styles.mealTotalsLine, { color: colors.text }]}>
                {`Total · Pro `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.protein_g ?? 0}g</ThemedText>
                {`  Carb `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.carbs_g ?? 0}g</ThemedText>
                {`  Fat `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.fat_g ?? 0}g</ThemedText>
                {`  Fib `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.fiber_g ?? 0}g</ThemedText>
              </ThemedText>
              <ThemedText style={[styles.mealTotalsLine, { color: colors.text }]}>
                {`Sat Fat `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.saturated_fat_g ?? 0}g</ThemedText>
                {`  Trans Fat `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.trans_fat_g ?? 0}g</ThemedText>
                {`  Sugar `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.sugar_g ?? 0}g</ThemedText>
                {`  Sodium `}
                <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.sodium_mg ?? 0}mg</ThemedText>
              </ThemedText>
            </View>
          )}

          {/* Select All Row - Only shown in edit mode */}
          {entriesEditMode && entries.length > 0 && (
            <View
              style={[
                styles.selectAllRow,
                { backgroundColor: colors.background, borderBottomColor: colors.separator },
              ]}
            >
              <MultiSelectItem
                isSelected={areAllEntriesSelected(entries as CalorieEntry[], (entry) => entry.id)}
                onToggle={() => {
                  const allEntriesSelected = areAllEntriesSelected(entries as CalorieEntry[], (entry) => entry.id);

                  if (allEntriesSelected) {
                    // Deselect everything
                    deselectAllEntries();
                  } else {
                    // Select all entries
                    selectAllEntries(entries as CalorieEntry[], (entry) => entry.id);
                  }
                }}
                style={{ paddingVertical: 12, paddingHorizontal: 16 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flex: 1,
                  }}
                >
                  <ThemedText style={[styles.selectAllText, { color: colors.text }]}>
                    {t('mealtype_log.food_log.select_all')}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={handleMassDelete}
                    disabled={!hasAnySelection}
                    style={[
                      styles.massDeleteButton,
                      {
                        backgroundColor: hasAnySelection ? '#EF4444' + '20' : colors.icon + '30',
                        borderColor: hasAnySelection ? '#EF4444' + '40' : colors.icon + '40',
                        opacity: hasAnySelection ? 1 : 0.5,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.deleteButtonText,
                        { color: hasAnySelection ? '#EF4444' : colors.icon },
                      ]}
                    >
                      🗑️
                    </Text>
                  </TouchableOpacity>
                </View>
              </MultiSelectItem>
            </View>
          )}

          {showLoadingSpinner ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : entries.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
              <View style={{ alignItems: 'center' }}>
                <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary, fontWeight: '600' }]}>
                  Log your first entry for this meal!
                </ThemedText>
                <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary, marginTop: 2 }]}>
                  Search for your food above.
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[styles.barcodeButton, { 
                  backgroundColor: colors.tint + '15', 
                  borderColor: colors.tint + '40',
                  marginTop: 16,
                  flexDirection: 'row',
                  gap: 8,
                }]}
                onPress={handleBarcodeScanPress}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                {...getButtonAccessibilityProps(
                  'Scan barcode',
                  'Double tap to scan a barcode'
                )}
              >
                <IconSymbol 
                  name="barcode.viewfinder" 
                  size={24} 
                  color={colors.tint}
                  accessibilityLabel={t('mealtype_log.accessibility.scan_barcode')}
                />
                <ThemedText style={[styles.emptyStateText, { color: colors.tint }]}>
                  {t('mealtype_log.scanner.title', 'Scan Barcode')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.barcodeButton,
                  {
                    backgroundColor: colors.tint + '12',
                    borderColor: colors.tint + '30',
                    marginTop: 12,
                    flexDirection: 'row',
                    gap: 8,
                  },
                ]}
                onPress={handleCopyFromPreviousDay}
                activeOpacity={0.7}
                disabled={isCopyingFromYesterday || isCloningFromPreviousDay}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol
                  name="doc.on.doc"
                  size={20}
                  color={colors.tint}
                  decorative={true}
                />
                <ThemedText style={[styles.emptyStateText, { color: colors.tint }]}>
                  {isSelectedDateToday ? 'Copy from yesterday' : 'Copy from previous day'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.barcodeButton,
                  {
                    backgroundColor: colors.tint + '12',
                    borderColor: colors.tint + '30',
                    marginTop: 12,
                    flexDirection: 'row',
                    gap: 8,
                  },
                ]}
                onPress={handleEmptyQuickLog}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol
                  name="bolt.fill"
                  size={20}
                  color={colors.tint}
                  decorative={true}
                />
                <ThemedText style={[styles.emptyStateText, { color: colors.tint }]}>
                  ⚡ Quick Log
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {entries.map((entry) => {
              const entryContent = (
              <HighlightableRow
                isNew={isNewlyAdded(entry.id)}
                style={StyleSheet.flatten([
                  styles.entryCard, 
                  { 
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    borderWidth: 0,
                  }
                ])}
              >
                  <View style={styles.entryHeader}>
                    <View style={styles.entryHeaderLeft}>
                      <View style={styles.entryNameRow}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
                          <TouchableOpacity
                            onPress={() => handleEditEntry(entry as CalorieEntry)}
                            activeOpacity={0.7}
                            style={[
                              styles.entryItemNameButton,
                              { flexShrink: 1, minWidth: 0 },
                              getMinTouchTargetStyle(),
                              { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
                            ]}
                            {...getButtonAccessibilityProps(
                              `Edit ${entry.item_name}`,
                              'Double tap to edit this food entry'
                            )}
                            {...(Platform.OS === 'web' ? getWebAccessibilityProps(
                              'button',
                              `Edit ${entry.item_name}`,
                              `edit-entry-${entry.id}`
                            ) : {})}
                          >
                            <ThemedText 
                              style={[styles.entryItemName, { color: colors.text, flexShrink: 1 }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {entry.item_name}
                            </ThemedText>
                          </TouchableOpacity>
                          {/* Source indicator badge - moved to left side */}
                          {entry.food_id && (
                            <FoodSourceBadge
                              isCustom={foodSourceMap[entry.food_id] === true}
                              colors={colors}
                              marginLeft={6}
                              containerStyle={{ marginRight: 0 }}
                            />
                          )}
                          {!entry.food_id && (
                            <View style={[
                              styles.sourceBadge,
                              {
                                backgroundColor: colors.icon + '20',
                                borderColor: colors.icon + '40',
                                marginLeft: 6,
                                marginRight: 0,
                              }
                            ]}>
                              <ThemedText style={[
                                styles.sourceBadgeText,
                                { color: colors.icon }
                              ]}>
                                ⚡
                              </ThemedText>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                          {/* Only show quantity x unit for non-manual entries */}
                          {entry.food_id && (
                            <ThemedText style={[styles.entrySummary, { color: colors.textSecondary, fontSize: 11 }]}>
                              {entry.quantity} x {entry.unit}
                            </ThemedText>
                          )}
                        </View>
                      </View>
                      {showEntryDetails && (
                        <TouchableOpacity
                          onPress={() => handleEditEntry(entry as CalorieEntry)}
                          activeOpacity={0.7}
                          disabled={false}
                          style={styles.entryMacros}
                        >
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.protein_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.protein_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.carbs_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.carbs_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.fat_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.fat_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.fiber_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.fiber_g ?? 0}g</ThemedText>
                          </View>
                        </TouchableOpacity>
                      )}
                      {showEntryDetails && (
                        <TouchableOpacity
                          onPress={() => handleEditEntry(entry as CalorieEntry)}
                          activeOpacity={0.7}
                          disabled={false}
                          style={[styles.entryMacros, { marginTop: 2 }]}
                        >
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.saturated_fat_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.saturated_fat_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.trans_fat_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.trans_fat_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.sugar_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.sugar_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.textSecondary }]}>{t('mealtype_log.macros.sodium_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.sodium_mg ?? 0}mg</ThemedText>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.entryHeaderRight}>
                      {/* Kcal value */}
                      {(() => {
                        const displayCalories = entry?.calories_kcal ?? 0;
                        return (
                      <ThemedText style={[styles.entryCaloriesValue, { color: colors.tint, fontSize: 11, marginRight: 4 }]}>
                        {displayCalories} cal
                      </ThemedText>
                        );
                      })()}
                      {!hasAnySelection && (
                        <TouchableOpacity
                          style={[styles.deleteButton, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40' }]}
                          onPress={() => handleDelete(entry.id, entry.item_name)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </HighlightableRow>
              );
              
              // Wrap with MultiSelectItem if in edit mode
              if (entriesEditMode) {
                return (
                  <MultiSelectItem
                    key={entry.id}
                    isSelected={isEntrySelected(entry.id)}
                    onToggle={() => toggleEntrySelection(entry.id)}
                  >
                    {entryContent}
                  </MultiSelectItem>
                );
              }
              
              return <React.Fragment key={entry.id}>{entryContent}</React.Fragment>;
            })}
            </>
          )}
          </View>
        </View>
        </DesktopPageContainer>
      </ScrollView>
      
      {/* Meal Type Dropdown - Rendered at root level for proper z-index */}
      {showMealTypeDropdown && mealTypeDropdownLayout && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowMealTypeDropdown(false)}
          />
          <View 
            style={[
              styles.mealTypeDropdown,
              {
                backgroundColor: colors.background,
                borderColor: colors.icon + '30',
                position: 'absolute',
                top: mealTypeDropdownLayout.y,
                left: mealTypeDropdownLayout.x,
                minWidth: mealTypeDropdownLayout.width,
                zIndex: 99999,
                elevation: 99999,
                shadowColor: colors.text,
              }
            ]}
          >
            {Object.entries(mealTypeLabels).map(([key, label], index, array) => (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  setShowMealTypeDropdown(false);
                  router.replace({
                    pathname: '/mealtype-log',
                    params: {
                      mealType: key,
                      entryDate: entryDate || getLocalDateString(),
                    },
                  });
                }}
                style={[
                  styles.mealTypeDropdownItem,
                  { 
                    backgroundColor: mealType.toLowerCase() === key ? colors.tint + '20' : 'transparent',
                    borderBottomWidth: index < array.length - 1 ? 1 : 0,
                    borderBottomColor: colors.icon + '15',
                  }
                ]}
                activeOpacity={0.7}
              >
                <ThemedText style={[
                  styles.mealTypeDropdownText,
                  { 
                    color: mealType.toLowerCase() === key ? colors.tint : colors.text,
                    fontWeight: mealType.toLowerCase() === key ? '600' : '400',
                  }
                ]}>
                  {label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      
      {/* Barcode Scanner Modal - Always rendered unconditionally, visibility controlled by showBarcodeScanner state */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowBarcodeScanner(false);
          setScanned(false);
          setBarcodeScanning(false);
        }}
      >
        <ThemedView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity
              style={styles.scannerCloseButton}
              onPress={() => {
                setShowBarcodeScanner(false);
                setScanned(false);
                setBarcodeScanning(false);
              }}
              activeOpacity={0.7}
            >
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            <ThemedText style={[styles.scannerTitle, { color: colors.text }]}>
              {t('mealtype_log.scanner.title')}
            </ThemedText>
            <View style={styles.scannerCloseButton} />
          </View>
          
          <View style={styles.scannerContent}>
            {/* UniversalBarcodeScanner always receives the same props regardless of entries.length */}
            <UniversalBarcodeScanner
              mealType={mealType}
              entryDate={entryDate}
              onClose={() => {
                setShowBarcodeScanner(false);
                setScanned(false);
                setBarcodeScanning(false);
              }}
            />
            {barcodeScanning && (
              <View style={styles.scannerOverlay}>
                <ActivityIndicator size="large" color={colors.tint} />
                <ThemedText style={[styles.scannerText, { color: '#fff' }]}>
                  {t('mealtype_log.scanner.processing', 'Processing barcode...')}
                </ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
      </Modal>

      {/* Delete Entry Confirmation Modal */}
      <ConfirmModal
        visible={deleteConfirmVisible}
        title={t('mealtype_log.delete_entry.title')}
        message={entryToDelete ? t('mealtype_log.delete_entry.message', { name: entryToDelete.name }) : t('mealtype_log.delete_entry.message_generic')}
        confirmText={t('mealtype_log.delete_entry.confirm')}
        cancelText={t('mealtype_log.delete_entry.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />

      {/* Delete Bundle Confirmation Modal */}
      <ConfirmModal
        visible={bundleDeleteConfirmVisible}
        title={t('mealtype_log.delete_bundle.title')}
        message={bundleToDelete ? t('mealtype_log.delete_bundle.message', { name: bundleToDelete.name }) : t('mealtype_log.delete_bundle.message_generic')}
        confirmText={t('mealtype_log.delete_entry.confirm')}
        cancelText={t('mealtype_log.delete_entry.cancel')}
        onConfirm={handleBundleDeleteConfirm}
        onCancel={handleBundleDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />

      {/* Bundle Warning Modal - shown before delete confirmation if food is in bundles */}
      <ConfirmModal
        visible={bundleWarningVisible}
        title={t('mealtype_log.delete_custom_food.bundle_warning_title')}
        message={bundleWarningData ? t('mealtype_log.delete_custom_food.message_with_bundles', {
          bundleCount: bundleWarningData.bundleCount,
          bundleNames: bundleWarningData.bundleNames,
        }) : ''}
        confirmText={t('mealtype_log.delete_custom_food.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleBundleWarningConfirm}
        onCancel={handleBundleWarningCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />

      {/* Delete Custom Food Confirmation Modal */}
      <ConfirmModal
        visible={customFoodDeleteConfirmVisible}
        title={t('mealtype_log.delete_custom_food.title')}
        message={customFoodToDelete ? t('mealtype_log.delete_custom_food.message', { name: customFoodToDelete.name }) : t('mealtype_log.delete_custom_food.message_generic')}
        confirmText={t('mealtype_log.delete_custom_food.confirm')}
        cancelText={t('mealtype_log.delete_custom_food.cancel')}
        onConfirm={handleCustomFoodDeleteConfirm}
        onCancel={handleCustomFoodDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />

      <ConfirmModal
        visible={bundleAddConfirmVisible}
        title={t('mealtype_log.add_bundle.title')}
        message={bundleToAdd ? t('mealtype_log.add_bundle.message', { count: bundleToAdd.items?.length || 0, name: bundleToAdd.name }) : t('mealtype_log.add_bundle.message_generic')}
        confirmText={t('mealtype_log.add_bundle.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleBundleAddConfirm}
        onCancel={handleBundleAddCancel}
      />

      <ConfirmModal
        visible={massDeleteConfirmVisible}
        title={t('mealtype_log.mass_delete.title')}
        message={t('mealtype_log.mass_delete.message', { count: selectedEntryCount, items: selectedEntryCount === 1 ? t('mealtype_log.mass_delete.item_singular') : t('mealtype_log.mass_delete.item_plural') })}
        confirmText={t('mealtype_log.delete_entry.confirm')}
        cancelText={t('mealtype_log.mass_delete.cancel_no')}
        onConfirm={handleMassDeleteConfirm}
        onCancel={handleMassDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />


      {/* Mass Delete Menu Modal */}
      <Modal
        visible={massDeleteMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMassDeleteMenuVisible(false)}
      >
        <TouchableOpacity
          style={[styles.massDeleteMenuOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setMassDeleteMenuVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.massDeleteMenuContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Close button header */}
              <View style={styles.massDeleteMenuHeader}>
                <TouchableOpacity
                  style={[styles.massDeleteMenuCloseButton, getMinTouchTargetStyle()]}
                  onPress={() => setMassDeleteMenuVisible(false)}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    t('common.close', { defaultValue: 'Close' }),
                    t('common.close_hint', { defaultValue: 'Double tap to close menu' })
                  )}
                >
                  <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.massDeleteMenuItem}
                onPress={() => {
                  setMassDeleteMenuVisible(false);
                  // Navigate to dedicated Quick Log screen
                  router.push({
                    pathname: '/quick-log',
                    params: {
                      date: entryDate,
                      mealType: mealType,
                    }
                  });
                }}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  `⚡Quick Log for ${t(`home.meal_types.${selectedMealType}`)}`,
                  `Add quick log for ${t(`home.meal_types.${selectedMealType}`)}`
                )}
              >
                <ThemedText style={[styles.massDeleteMenuItemText, { color: colors.text }]}>
                  ⚡Quick Log
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.massDeleteMenuItem}
                onPress={handleNotes}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  `Notes for ${t(`home.meal_types.${selectedMealType}`)}`,
                  `Add or edit notes for ${t(`home.meal_types.${selectedMealType}`)}`
                )}
              >
                <ThemedText style={[styles.massDeleteMenuItemText, { color: colors.text }]}>
                  📝 {t('food.menu.notes', { defaultValue: 'Notes' })}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.massDeleteMenuItem}
                onPress={() => {
                  if (entries.length > 0) {
                    setMassDeleteMenuVisible(false);
                    setEntriesEditMode(true);
                  }
                }}
                activeOpacity={entries.length > 0 ? 0.7 : 1}
                disabled={entries.length === 0}
                {...getButtonAccessibilityProps(
                  t('mealtype_log.food_log.mass_delete', { defaultValue: 'Mass Delete' }),
                  entries.length > 0
                    ? t('mealtype_log.food_log.mass_delete_hint', { defaultValue: 'Double tap to enter mass delete mode' })
                    : t('mealtype_log.food_log.mass_delete_disabled_hint', { defaultValue: 'Mass delete is not available when there are no entries' })
                )}
              >
                <ThemedText style={[
                  styles.massDeleteMenuItemText, 
                  { 
                    color: entries.length > 0 ? colors.text : colors.textSecondary,
                    opacity: entries.length > 0 ? 1 : 0.5,
                  }
                ]}>
                  🗑️ {t('mealtype_log.food_log.mass_delete', { defaultValue: 'Mass Delete' })}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


      {/* Note Editor */}
      {noteEditor.visible && (
        <NoteEditor
          visible={noteEditor.visible}
          onClose={() => setNoteEditor({ visible: false })}
          onSave={handleNoteSave}
          initialNote={currentMealMeta?.note ?? null}
          mealTypeLabel={t(`home.meal_types.${selectedMealType}`)}
          isLoading={upsertMealtypeMetaMutation.isPending}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dropdownBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 20,
    // DesktopPageContainer handles horizontal padding and max-width
  },
  headerContainer: {
    marginBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backArrowButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32,
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  headerRight: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderMealType: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  subHeaderSeparator: {
    fontSize: 13,
    opacity: 0.5,
    lineHeight: 20,
    marginHorizontal: 6,
  },
  subHeaderDate: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  placeholder: {
    width: 48,
    height: 48,
  },
  checkmarkButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealTypeDropdown: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
    minWidth: 140,
  },
  mealTypeDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  mealTypeDropdownText: {
    fontSize: 16,
  },
  mealTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  mealTypeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  formCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  selectedFoodName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  form: {
    gap: 12,
  },
  field: {
    marginBottom: 4,
  },
  fieldWithDropdown: {
    position: 'relative',
    zIndex: 10000,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.9,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
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
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  lockedHint: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  inlineLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  inlineValue: {
    fontSize: 14,
    fontWeight: '400',
  },
  inlineInput: {
    fontSize: 14,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 34, // Match inlineInput height (paddingVertical: 6 * 2 + fontSize: 14 + line spacing)
  },
  dropdownButtonText: {
    fontSize: 16,
  },
  dropdownArrow: {
    fontSize: 10,
    opacity: 0.6,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 10000,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
      },
    }),
  },
  servingDropdown: {
    zIndex: 10000,
    opacity: 1,
    elevation: 10,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 0,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  expandIcon: {
    fontSize: 12,
    opacity: 0.7,
  },
  macrosContent: {
    marginTop: 6,
    gap: 12,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  cancelButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  nutritionLabelInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 2,
    margin: 0,
    fontSize: 12,
    textAlign: 'right',
    minWidth: 50,
  },
  nutritionLabelTitleInput: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'left',
    paddingVertical: 4,
    paddingHorizontal: 0,
    minWidth: '100%',
  },
  nutritionLabelSmallInput: {
    fontSize: 12,
    textAlign: 'left',
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  nutritionLabelCaloriesInput: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  nutritionLabelNutrientInput: {
    fontSize: 12,
    textAlign: 'right',
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 25,
  },
  nutritionLabelInputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutritionLabelUnit: {
    fontSize: 12,
    color: '#000000',
    marginLeft: 4,
  },
  foodLogContainer: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginTop: 12,
    marginBottom: 0,
  },
  entriesSection: {
    marginTop: 0,
  },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  foodLogDivider: {
    height: 1,
    width: '100%',
    marginBottom: 12,
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  emptyState: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    fontSize: 14,
    opacity: 0.7,
  },
  entryCard: {
    paddingVertical: Platform.select({ web: 4, default: 6 }),
    paddingHorizontal: 0,
    marginBottom: 0,
    width: '100%',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
    paddingHorizontal: 0,
    width: '100%',
  },
  entryHeaderLeft: {
    flex: 1,
    marginRight: 4,
  },
  entryHeaderRight: {
    marginLeft: 4,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    zIndex: 10,
  },
  entryNameRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  entryItemName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
  },
  entryItemNameButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderRadius: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, outline 0.15s ease',
      },
    }),
  },
  entrySummary: {
    fontSize: 12,
    opacity: 1.0,
    flexShrink: 0,
  },
  entryCaloriesValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  entryMacros: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginLeft: 8,
    marginTop: 4,
  },
  entryMacroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  entryMacroLabel: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 1.0,
  },
  entryMacroValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  mealTotalsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 6,
    borderRadius: 8,
  },
  mealTotalsLine: {
    fontSize: 13,
    fontWeight: '500',
  },
  editButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 0,
    minHeight: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
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
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 0,
    minHeight: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
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
  deleteButtonText: {
    fontSize: 16,
  },
  searchBarWrapper: {
    flex: 1,
    marginRight: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    position: 'relative',
    zIndex: 1000,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  searchIconLeft: {
    marginRight: 8,
  },
  searchResultsOverlay: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1.5,
    borderRadius: 12,
    maxHeight: 300,
    overflow: 'hidden',
    zIndex: 9999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  searchLoader: {
    marginLeft: 8,
    right: 12,
    top: 12,
  },
  barcodeButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease',
        zIndex: 100,
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 10,
      },
    }),
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  scannerCloseButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scannerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  barcodeScanner: {
    flex: 1,
    width: '100%',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scannerText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scannerButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  scannerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerInstructions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  scannerInstructionText: {
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabsContainerWrapper: {
    position: 'relative',
    overflow: 'visible',
    marginBottom: Spacing.xs, // Minimal spacing - tightened from 12
  },
  tabsScrollView: {
    borderBottomWidth: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0,
  },
  tabsFadeOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    opacity: 0.95,
    pointerEvents: 'none',
    ...Platform.select({
      web: {
        background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.95))',
      },
    }),
  },
  tabsScrollArrow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'background-color 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
      },
    }),
  },
  tabsScrollArrowLeft: {
    left: 0,
    paddingLeft: 0,
    paddingVertical: 0,
  },
  tabsScrollArrowRight: {
    right: 0,
    paddingRight: 0,
    paddingVertical: 0,
  },
  tabsScrollArrowText: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minWidth: 80,
    borderRadius: 8,
    marginHorizontal: 2,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease, border-bottom-width 0.2s ease',
      },
    }),
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabContent: {
    minHeight: 200,
  },
  collapsedHintText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  emptyTabState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTabText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyTabSubtext: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.5,
    marginTop: 4,
  },
  createCustomButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  createCustomButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultsContainer: {
    borderRadius: 12,
    maxHeight: 300,
    marginBottom: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  searchResultTouchable: {
    flex: 1,
    paddingVertical: 4,
  },
  searchResultItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  quickAddButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  searchResultContent: {
    gap: 4,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultBrand: {
    fontSize: 13,
    opacity: 0.7,
  },
  searchResultNutrition: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  searchResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchResultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  searchResultTime: {
    fontSize: 11,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  frequencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  frequencyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  justAddedBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    marginLeft: 4,
  },
  justAddedText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sourceBadge: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    marginLeft: 8,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  selectAllRow: {
    borderBottomWidth: 1,
    paddingVertical: 0,
  },
  selectAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  massDeleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  massDeleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  massDeleteMenuButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  massDeleteMenuOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  massDeleteMenuContent: {
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
  massDeleteMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  massDeleteMenuCloseButton: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  massDeleteMenuItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  massDeleteMenuItemText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Platform.select({ web: 0, default: 0 }),
    paddingHorizontal: 0,
    marginTop: -8,
    marginBottom: 4,
  },
  noteRowText: {
    flex: 1,
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '400',
  },
});