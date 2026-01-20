import { MacroCompositionDonutChart } from '@/components/charts/MacroCompositionDonutChart';
import { FoodSearchBar } from '@/components/food-search-bar';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { EmptyEntriesState } from '@/components/mealtype/EmptyEntriesState';
import { EntryCard } from '@/components/mealtype/EntryCard';
import { FoodLogMenuModal } from '@/components/mealtype/FoodLogMenuModal';
import { MealTotals } from '@/components/mealtype/MealTotals';
import { styles } from '@/components/mealtype/mealtype-log-screen.styles';
import { MealTypeLogHeader } from '@/components/mealtype/MealTypeLogHeader';
import { BundlesTab } from '@/components/mealtype/tabs/BundlesTab';
import { CustomFoodsTab } from '@/components/mealtype/tabs/CustomFoodsTab';
import { FrequentFoodsTab } from '@/components/mealtype/tabs/FrequentFoodsTab';
import { QuickLogLanding } from '@/components/mealtype/tabs/QuickLogLanding';
import { RecentFoodsTab } from '@/components/mealtype/tabs/RecentFoodsTab';
import { MultiSelectItem } from '@/components/multi-select-item';
import { NoteEditor } from '@/components/note-editor';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedTabContent, TabKey } from '@/components/ui/animated-tab-content';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { showAppToast } from '@/components/ui/app-toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TapToExpandHint } from '@/components/ui/tap-to-expand-hint';
import UniversalBarcodeScanner from '@/components/UniversalBarcodeScanner';
import { getTabColor, getTabListBackgroundColor } from '@/constants/mealtype-ui-helpers';
import { CategoryColors, Colors, Layout, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isTourCompleted } from '@/features/tour/storage';
import { useTour } from '@/features/tour/TourProvider';
import { V1_MEALTYPELOG_TOUR_STEPS } from '@/features/tour/tourSteps';
import { useTourAnchor } from '@/features/tour/useTourAnchor';
import { useAddBundleToMeal } from '@/hooks/use-add-bundle-to-meal';
import { useBundles } from '@/hooks/use-bundles';
import { useClampedDateParam } from '@/hooks/use-clamped-date-param';
import { useCloneMealTypeFromPreviousDay } from '@/hooks/use-clone-meal-type-from-previous-day';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCustomFoods } from '@/hooks/use-custom-foods';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { useEntryDetailsPreference } from '@/hooks/use-entry-details-preference';
import { useFoodMasterByIds } from '@/hooks/use-food-master-by-ids';
import { useFoodSearch } from '@/hooks/use-food-search';
import { useFrequentFoods } from '@/hooks/use-frequent-foods';
import { useMealtypeMeta } from '@/hooks/use-mealtype-meta';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { useNewItemHighlight } from '@/hooks/use-new-item-highlight';
import { useRecentFoods } from '@/hooks/use-recent-foods';
import { useTabScrollState } from '@/hooks/use-tab-scroll-state';
import { useUpsertMealtypeMeta } from '@/hooks/use-upsert-mealtype-meta';
import { useCopyFromYesterday } from '@/hooks/useCopyFromYesterday';
import { validateAndNormalizeBarcode } from '@/lib/barcode';
import { invalidateDailySumConsumedRangesForDate } from '@/lib/services/consumed/invalidateDailySumConsumedRanges';
import {
  computeNutrientsForFoodServing,
  computeNutrientsForRawQuantity,
  getDefaultServingWithNutrients,
  getServingsForFood,
  type FoodNutrients,
} from '@/lib/servings';
import { supabase } from '@/lib/supabase';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import { computeAvoScore, type AvoScoreInput } from '@/utils/avoScore';
import { getCurrentDateTimeUTC, getLocalDateString } from '@/utils/calculations';
import { calculateMealNutritionTotals } from '@/utils/dailyTotals';
import { getLocalDateKey } from '@/utils/dateTime';
import { formatDate, getMealTypeLabel, getMealTypeLabels } from '@/utils/formatters';
import {
  type FoodMaster
} from '@/utils/nutritionMath';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function LogFoodScreen() {
  const { t } = useTranslation();
  
  // Detect if mobile screen size (for badge shortening in Food Log)
  const isMobileScreen = Dimensions.get('window').width < 768;
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const footerHeight = Layout.bottomTabBarHeight + (Platform.OS === 'web' ? 0 : Math.max(insets.bottom, 0));

  // Tour: Mealtype Log
  const {
    activeTourId,
    startTour,
    registerOnStepChange,
    requestRemeasure,
  } = useTour();

  const tourRootRef = useTourAnchor('mealtype.root');
  const tourSearchBarRef = useTourAnchor('mealtype.searchBar');
  const tourBarcodeBtnRef = useTourAnchor('mealtype.barcodeBtn');
  const tourTabsAndListRef = useTourAnchor('mealtype.tabsAndList');
  const tourCustomExpandedRef = useTourAnchor('mealtype.customTabExpanded');
  const tourBundlesExpandedRef = useTourAnchor('mealtype.bundlesTabExpanded');
  const tourQuickLogTabRef = useTourAnchor('mealtype.quickLogTab');
  const tourFoodLogSectionRef = useTourAnchor('mealtype.foodLogSection');

  // Refs for individual tab buttons (for precise "scroll into view" during tour)
  const frequentTabBtnRef = useRef<any>(null);
  const recentTabBtnRef = useRef<any>(null);
  const customTabBtnRef = useRef<any>(null);
  const bundleTabBtnRef = useRef<any>(null);

  const isCheckingMealtypeTourRef = useRef(false);
  
  // Helper functions moved to @/constants/mealtype-ui-helpers.ts
  // Wrapper functions to maintain component API
  const getTabColorLocal = useCallback((tab: string, isSelected: boolean) => {
    return getTabColor(tab, isSelected, colors.tint);
  }, [colors.tint]);
  
  const getTabListBackgroundColorLocal = useCallback((tab: string) => {
    return getTabListBackgroundColor(tab, colorScheme, colors.tint);
  }, [colorScheme, colors.tint]);
  
  // Tab scroll state managed by custom hook
  const {
    tabsScrollViewRef,
    tabsContentWidthRef,
    tabsScrollViewWidthRef,
    tabsScrollOffsetRef,
    canScrollLeft,
    canScrollRight,
    handleTabsScroll,
    handleTabsContentSizeChange,
    handleScrollLeft,
    handleScrollRight,
  } = useTabScrollState();
  
  // Get meal type from params
  const mealTypeParam = params.mealType;
  const mealType = Array.isArray(mealTypeParam) 
    ? mealTypeParam[0] 
    : (mealTypeParam as string) || 'dinner';
  
  // Get entry date from params (in user's local timezone)
  const entryDateParam = params.entryDate;
  const { dateKey: entryDate, minDate, today } = useClampedDateParam({ paramKey: 'entryDate' });
  
  const selectedMealType = mealType;
  const selectedDateString = entryDate;
  const { dataByMealType } = useMealtypeMeta(selectedDateString);
  const upsertMealtypeMetaMutation = useUpsertMealtypeMeta();
  
  const currentMealMeta = dataByMealType?.[selectedMealType] || null;
  
  // Handlers for Notes
  const handleNotes = () => {
    setActiveModal(null);
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
          Alert.alert(t('common.error'), t('food.note.save_error'));
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
  
  // Update selectedDate when entryDate changes
  useEffect(() => {
    try {
      const date = new Date(entryDate + 'T00:00:00');
      setSelectedDate(date);
    } catch {
      // Keep current selectedDate if parsing fails
    }
  }, [entryDate]);

  // Formatter functions moved to @/utils/formatters.ts
  // Wrapper functions to maintain component API with translation function
  const getMealTypeLabelLocal = useCallback((type: string) => {
    return getMealTypeLabel(type, t);
  }, [t]);
  
  const mealTypeLabels = useMemo(() => getMealTypeLabels(t), [t]);
  
  const formatDateLocal = useCallback((dateString: string) => {
    return formatDate(dateString, t);
  }, [t]);
  
  // `today` and `minDate` come from useClampedDateParam (device timezone).
  
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
      }
    });
    
    setShowDatePicker(false);
  };


  // Edit state (now handled via navigation to /food-edit or /quick-log)

  // Loading state for async operations (mass delete, bundle operations, etc.)
  const [loading, setLoading] = useState(false);
  
  // Consolidated modal state
  type ModalType = 'delete_entry' | 'delete_bundle' | 'delete_custom' | 'mass_delete' | 'menu' | 'add_bundle' | 'bundle_warning' | null;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  
  // Modal data states
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [bundleToDelete, setBundleToDelete] = useState<Bundle | null>(null);
  const [bundleToAdd, setBundleToAdd] = useState<Bundle | null>(null);
  const [customFoodToDelete, setCustomFoodToDelete] = useState<FoodMaster | null>(null);
  const [bundleWarningData, setBundleWarningData] = useState<{ food: FoodMaster; bundleNames: string; bundleCount: number } | null>(null);
  
  // Entry details preference managed by custom hook
  const { showEntryDetails, setShowEntryDetails, toggleAnimation, loading: loadingDetailsPreference } = useEntryDetailsPreference();


  // Meal type dropdown state
  const [showMealTypeDropdown, setShowMealTypeDropdown] = useState(false);
  const mealTypeButtonRef = useRef<View>(null);
  const [mealTypeDropdownLayout, setMealTypeDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Track active tab position for dropdown attachment (for tab content area)
  const [activeTabLayout, setActiveTabLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Memoize the callback to prevent infinite loops
  const handleActiveTabLayout = useCallback((layout: { x: number; y: number; width: number; height: number } | null) => {
    if (layout) {
      // Store layout relative to the tab container (which is inside the ScrollView)
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
  const mealTypeLabel = getMealTypeLabelLocal(activeMealType);
  const formattedDate = formatDateLocal(activeEntryDate);

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
        // Loading handled by hook
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

  // Calculate AvoScore from meal totals
  const avo = useMemo(() => {
    if (!mealTotals || mealTotals.kcal === 0) {
      return { score: 50, grade: 'C' as const, reasons: ['avo_score.reasons.no_macro_data'] };
    }

    const avoInput: AvoScoreInput = {
      calories: mealTotals.kcal,
      carbG: mealTotals.carbs_g ?? 0,
      fiberG: mealTotals.fiber_g ?? 0,
      proteinG: mealTotals.protein_g ?? 0,
      fatG: mealTotals.fat_g ?? 0,
      sugarG: mealTotals.sugar_g ?? 0,
      sodiumMg: mealTotals.sodium_mg ?? 0,
      satFatG: mealTotals.saturated_fat_g ?? 0,
      transFatG: mealTotals.trans_fat_g ?? 0,
    };

    return computeAvoScore(avoInput);
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

  // Use hook for adding bundle entries to meal
  const { loading: bundleLoading, addBundleEntries } = useAddBundleToMeal({
    userId: user?.id,
    entryDate: activeEntryDate,
    mealType: activeMealType,
    markAsNewlyAdded,
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
  const initialTab = (activeTabParam === 'custom' || activeTabParam === 'recent' || activeTabParam === 'frequent' || activeTabParam === 'bundle' || activeTabParam === 'quick-log')
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
  const COLLAPSED_HEIGHT = 140;
  
  // Helper function to handle tab press - toggles content collapse if already active
  const handleTabPress = (tab: 'frequent' | 'recent' | 'custom' | 'bundle' | 'quick-log', additionalActions?: () => void) => {
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

  const handleQuickLogTabPress = () => {
    handleTabPress('quick-log', () => scrollTabIntoView('quick-log'));
  };

  // Tour: step-driven UI helpers for tabs
  const scrollTabIntoView = useCallback(
    (tab: TabKey) => {
      const sv = tabsScrollViewRef.current;
      if (!sv) return;

      const tabRef =
        tab === 'frequent'
          ? frequentTabBtnRef
          : tab === 'recent'
            ? recentTabBtnRef
            : tab === 'custom'
              ? customTabBtnRef
              : tab === 'bundle'
                ? bundleTabBtnRef
                : tab === 'quick-log'
                  ? (tourQuickLogTabRef as any)
                  : null;

      if (!tabRef?.current) return;

      const currentOffset = tabsScrollOffsetRef.current ?? 0;
      const pad = 12;

      const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

      // Use window measurements to avoid brittle measureLayout node-handle gymnastics on ScrollView.
      sv.measureInWindow((svX, _svY, svW) => {
        tabRef.current?.measureInWindow((tabX: number, _tabY: number, tabW: number) => {
          const leftBound = svX + pad;
          const rightBound = svX + svW - pad;

          let nextOffset = currentOffset;
          if (tabX < leftBound) {
            nextOffset = currentOffset - (leftBound - tabX);
          } else if (tabX + tabW > rightBound) {
            nextOffset = currentOffset + (tabX + tabW - rightBound);
          } else {
            return; // already fully visible
          }

          const maxOffset = Math.max(
            0,
            (tabsContentWidthRef.current || 0) - (tabsScrollViewWidthRef.current || 0)
          );
          nextOffset = clamp(nextOffset, 0, maxOffset);
          sv.scrollTo({ x: nextOffset, animated: true });
        });
      });
    },
    [
      tabsContentWidthRef,
      tabsScrollOffsetRef,
      tabsScrollViewRef,
      tabsScrollViewWidthRef,
      tourQuickLogTabRef,
    ]
  );

  const setTabForTour = useCallback(
    (tab: TabKey, opts?: { expand?: boolean; scroll?: 'left' | 'right' }) => {
      // Keep signature stable, but prefer precise scrolling so we don't overshoot and hide labels.
      scrollTabIntoView(tab);

      if (tab === 'manual') {
        // Do not auto-navigate during tour; we only spotlight the tab.
        if (opts?.expand === true) setTabContentCollapsed(false);
        return;
      }

      if (activeTab !== tab) {
        setPreviousTabKey(activeTab);
        setActiveTab(tab);
      }
      if (opts?.expand === true) setTabContentCollapsed(false);
    },
    [activeTab, scrollTabIntoView]
  );

  // Auto-start Mealtype Log tour on entry (per-user, per-device), if not completed.
  // Important: re-check on focus so a Settings "Restart Tour Guide" takes effect without a full refresh.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      if (activeTourId) return; // don't fight a running tour
      if (isCheckingMealtypeTourRef.current) return;
      isCheckingMealtypeTourRef.current = true;

      let cancelled = false;
      (async () => {
        try {
          const completed = await isTourCompleted('V1_MealtypeLogTour', userId);
          if (cancelled || completed) return;
          await startTour('V1_MealtypeLogTour', V1_MEALTYPELOG_TOUR_STEPS);
        } catch {
          // never block screen render for tour
        } finally {
          isCheckingMealtypeTourRef.current = false;
        }
      })();

      return () => {
        cancelled = true;
        isCheckingMealtypeTourRef.current = false;
      };
    }, [activeTourId, startTour, userId])
  );

  // Drive UI on specific tour steps (select tabs / expand lists), then re-measure.
  useEffect(() => {
    const unsubscribe = registerOnStepChange((tourId, step, idx) => {
      if (tourId !== 'V1_MealtypeLogTour') return;

      if (step.id === 'mt-frequent') {
        setTabForTour('frequent', { expand: true, scroll: 'left' });
        setTimeout(() => requestRemeasure(), 200);
        return;
      }

      if (step.id === 'mt-custom') {
        setTabForTour('custom', { expand: true, scroll: 'right' });
        setTimeout(() => requestRemeasure(), 200);
        return;
      }

      if (step.id === 'mt-bundles') {
        setTabForTour('bundle', { expand: true, scroll: 'right' });
        setTimeout(() => requestRemeasure(), 200);
        return;
      }

      if (step.id === 'mt-quicklog') {
        // Do not navigate; just ensure the tab is visible.
        setTabForTour('manual', { scroll: 'right' });
        setTimeout(() => requestRemeasure(), 200);
      }
    });

    return unsubscribe;
  }, [registerOnStepChange, requestRemeasure, setTabForTour]);
  
  
  // Use React Query hooks for tab data
  const queryClient = useQueryClient();
  
  // Determine if selected date is today (reuse existing today variable)
  const selectedDateOnly = new Date(selectedDate);
  selectedDateOnly.setHours(0, 0, 0, 0);
  const todayForComparison = new Date();
  todayForComparison.setHours(0, 0, 0, 0);
  const isSelectedDateToday = selectedDateOnly.getTime() === todayForComparison.getTime();

  // Setup copy from yesterday hooks
  const { isCopyingFromYesterday, runCopyFromYesterday } = useCopyFromYesterday();
  
  const { cloneMealTypeFromPreviousDay } = useCloneMealTypeFromPreviousDay({
    currentDate: selectedDate,
    mealType: selectedMealType,
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

  // Handle copy from yesterday/previous day
  const handleCopyFromPreviousDay = useCallback(() => {
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
          entry.meal_type?.toLowerCase() === selectedMealType.toLowerCase()
        );
        hasEntries = mealTypeEntries.length > 0;
      }
    }
    
    // Check notes from meta
    if (cachedPreviousDayMeta !== undefined && cachedPreviousDayMeta !== null) {
      const mealTypeMeta = cachedPreviousDayMeta.find(meta => 
        meta.meal_type?.toLowerCase() === selectedMealType.toLowerCase()
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
    
    runCopyFromYesterday(() => cloneMealTypeFromPreviousDay());
  }, [selectedDate, selectedMealType, user?.id, queryClient, runCopyFromYesterday, cloneMealTypeFromPreviousDay, t]);
  
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
  const processedNewBundleIds = useRef<Set<string>>(new Set());
  const [bundleEditMode, setBundleEditMode] = useState(false);
  
  // Use reusable highlight hook for newly added bundles
  const {
    markAsNewlyAdded: markBundleAsNewlyAdded,
    isNewlyAdded: isBundleNewlyAdded,
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
  
  // 3-dot menu state
  
  // Note editor state
  const [noteEditor, setNoteEditor] = useState<{ visible: boolean }>({ visible: false });
  
  
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
  

  


  // Legacy form state removed - food source/brand maps now use useMemo (see above)

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

    return bundle.items
      .map((item) => {
        // Get food name
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
  // Bundle addition logic extracted to useAddBundleToMeal hook

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
    setActiveModal('add_bundle');
  }, [user?.id]);

  const handleBundleAddConfirm = useCallback(async () => {
    if (bundleToAdd) {
      setActiveModal(null);
      await addBundleEntries(bundleToAdd);
      setBundleToAdd(null);
    }
  }, [bundleToAdd, addBundleEntries]);

  const handleBundleAddCancel = useCallback(() => {
    setActiveModal(null);
    // Don't clear bundleToAdd immediately to avoid showing generic message flash
    // It will be cleared when a new bundle is selected or component unmounts
  }, []);

  // Delete bundle
  const handleDeleteBundle = useCallback((bundle: Bundle) => {
    setBundleToDelete(bundle);
    setActiveModal('delete_bundle');
  }, []);

  const handleBundleDeleteConfirm = useCallback(async () => {
    if (bundleToDelete) {
      setActiveModal(null);
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
    setActiveModal(null);
    setBundleToDelete(null);
  }, []);

  // Bundle reordering removed - bundles are read-only from React Query
  // No-op functions for tab component compatibility
  const handleMoveBundleUp = () => {};
  const handleMoveBundleDown = () => {};

  // Custom food reordering removed - custom foods are read-only from React Query
  // No-op functions for tab component compatibility
  const handleMoveCustomFoodUp = () => {};
  const handleMoveCustomFoodDown = () => {};

  // Exit edit mode when switching tabs
  useEffect(() => {
    // Exit custom food edit mode when switching away from custom tab
    if (activeTab !== 'custom' && customFoodEditMode) {
      setCustomFoodEditMode(false);
    }
    // Exit bundle edit mode when switching away from bundle tab
    if (activeTab !== 'bundle' && bundleEditMode) {
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
  }, [activeTab, user?.id]);

  // Track when bundles tab is first accessed (for UI state tracking)
  useEffect(() => {
    if (activeTab === 'bundle' && user?.id && !bundlesFetched.current && !newlyAddedBundleIdParam) {
      bundlesFetched.current = true;
    }
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

  // Handle edit entry - navigate to dedicated edit screens
  const handleEditEntry = async (entry: CalorieEntry) => {
    if (!entry.food_id) {
      router.push({
        pathname: '/quick-log',
        params: {
          date: entryDate,
          mealType: mealType,
          quickLogId: entry.id,
        },
      });
      return;
    }

    router.push({
      pathname: '/food-edit',
      params: {
        entryId: entry.id,
        date: entryDate,
        mealType: mealType,
      },
    });
  };

  const handleDelete = (entryId: string, entryName: string) => {
    setEntryToDelete({ id: entryId, name: entryName });
    setActiveModal('delete_entry');
  };

  const handleDeleteConfirm = async () => {
    if (entryToDelete) {
      setActiveModal(null);
      await deleteEntry(entryToDelete.id);
      setEntryToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setActiveModal(null);
    setEntryToDelete(null);
  };


  // Mass delete handlers
  const handleMassDelete = useCallback(() => {
    if (totalSelectedItems > 0) {
      setActiveModal('mass_delete');
    }
  }, [totalSelectedItems]);

  const handleMassDeleteConfirm = useCallback(async () => {
    setActiveModal(null);

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
      // Exit edit mode to show three-dot menu instead of checkmark
      setEntriesEditMode(false);
      await refetchEntries();

      // daily_sum_consumed is maintained by DB triggers; invalidate dashboard range caches for this day.
      if (user?.id) {
        invalidateDailySumConsumedRangesForDate(queryClient, user.id, entryDate);
      }

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
    setEntriesEditMode,
    refetchEntries,
    t,
    totalSelectedItems,
  ]);

  const handleMassDeleteCancel = useCallback(() => {
    setActiveModal(null);
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

        // daily_sum_consumed is maintained by DB triggers; invalidate dashboard range caches for this day.
        if (user?.id) {
          invalidateDailySumConsumedRangesForDate(queryClient, user.id, entryDate);
        }
      }
    } catch (error) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.unexpected_error'));
    }
  };

  // Legacy form state removed - saveEntry function no longer needed
  // Entry creation/editing now handled via /food-edit and /quick-log screens



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
      setActiveModal('bundle_warning');
    } else {
      // No bundle references - proceed with normal confirmation
      setCustomFoodToDelete(food);
      setActiveModal('delete_custom');
    }
  };

  // Handle bundle warning confirmation - proceed to delete confirmation
  const handleBundleWarningConfirm = () => {
    if (bundleWarningData) {
      setActiveModal(null);
      setCustomFoodToDelete(bundleWarningData.food);
      setActiveModal('delete_custom');
      setBundleWarningData(null);
    }
  };

  // Handle bundle warning cancellation
  const handleBundleWarningCancel = () => {
    setActiveModal(null);
    setBundleWarningData(null);
  };

  const handleCustomFoodDeleteConfirm = async () => {
    if (customFoodToDelete) {
      setActiveModal(null);
      await deleteCustomFood(customFoodToDelete);
      setCustomFoodToDelete(null);
    }
  };

  const handleCustomFoodDeleteCancel = () => {
    setActiveModal(null);
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
    } catch (error: any) {
      const errorMessage = `Failed to delete custom food: ${error.message || 'Unknown error'}`;
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert(t('alerts.error_title'), errorMessage);
      }
    }
  };

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
      } else if (shouldRefreshFromCreate && customFoodsFetched.current) {
        // Refresh when coming back from create page (detected by refreshCustomFoods param)
        // Refresh immediately without delay
        refetchCustomFoods();
        lastRefreshParam.current = currentRefreshParam;
      }
    }
    
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

  // Ref guards to prevent double navigation/processing
  const hasProcessedSelectedFoodIdRef = useRef<string | null>(null);
  const hasProcessedScannedDataRef = useRef<string | null>(null);
  const hasProcessedManualDataRef = useRef<string | null>(null);

  // Handle barcode scan results - route to quick-log or keep legacy flows
  useEffect(() => {
    const handleScannedFood = async () => {
      // Handle manualEntryData - "1-time Log (Manual)" flow → quick-log
      const manualData = Array.isArray(manualEntryDataParam) ? manualEntryDataParam[0] : manualEntryDataParam;
      const shouldOpenManual = Array.isArray(openManualModeParam) ? openManualModeParam[0] === 'true' : openManualModeParam === 'true';
      
      if (shouldOpenManual && user?.id && manualData && hasProcessedManualDataRef.current !== manualData) {
        hasProcessedManualDataRef.current = manualData;
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
      if (foodId && user?.id && hasProcessedSelectedFoodIdRef.current !== foodId) {
        hasProcessedSelectedFoodIdRef.current = foodId;
        try {
          const { data: food, error } = await supabase
            .from('food_master')
            .select('*')
            .eq('id', foodId)
            .single();
          
          if (food && !error) {
            handleFoodSelect(food as FoodMaster);
            // Clear the param after processing to prevent re-trigger
            router.setParams({ selectedFoodId: undefined });
          }
        } catch (err) {
          console.error('[MealTypeLog] Error fetching scanned food:', err);
          // Reset on error so user can retry
          hasProcessedSelectedFoodIdRef.current = null;
        }
      }

      // External scanned data (use once) → still navigate to food-edit create flow with a virtual food?
      const scannedData = Array.isArray(scannedFoodDataParam) ? scannedFoodDataParam[0] : scannedFoodDataParam;
      if (scannedData && user?.id && hasProcessedScannedDataRef.current !== scannedData) {
        hasProcessedScannedDataRef.current = scannedData;
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
          // Clear the param after processing to prevent re-trigger
          router.setParams({ scannedFoodData: undefined });
        } catch (err) {
          console.error('[MealTypeLog] Error parsing scanned food data:', err);
          // Reset on error so user can retry
          hasProcessedScannedDataRef.current = null;
        }
      }
    };

    handleScannedFood();
  }, [selectedFoodIdParam, scannedFoodDataParam, manualEntryDataParam, openManualModeParam, user?.id, activeTab, entryDate, mealType, router]);

  // Handle openBarcodeScanner param - open scanner when navigating from Big "+" or scanned-item "Scan Another"
  // Use focus-based trigger for reliable behavior on web
  const hasAutoOpenedScanner = useRef(false);

  // Reset ref on every focus so repeated taps from Big "+" work even if already opened once
  useFocusEffect(
    useCallback(() => {
      // Every time screen focuses, allow a new auto-open if param arrives again
      hasAutoOpenedScanner.current = false;
    }, [])
  );

  // Auto-open scanner when param is present and screen is focused
  useFocusEffect(
    useCallback(() => {
      const raw = openBarcodeScannerParam;
      const shouldOpenScanner = Array.isArray(raw) ? raw[0] === 'true' : raw === 'true';

      if (!shouldOpenScanner) return;
      if (hasAutoOpenedScanner.current) return;

      hasAutoOpenedScanner.current = true;

      setScanned(false);
      setBarcodeScanning(false);
      setShowBarcodeScanner(true);

      // Consume the param so it doesn't get stuck or re-open on refresh/back
      router.setParams({ openBarcodeScanner: undefined });
    }, [openBarcodeScannerParam, router])
  );

  // Legacy form state removed - validateFields function no longer needed
  

  

  // Legacy form state removed - fetchFoodServings function no longer needed
  // Food selection now navigates to /food-edit screen

  // Handle food selection from search results/lists → open food-edit create flow
  // Ref guard to prevent double navigation to food-edit
  const hasNavigatedToFoodEditRef = useRef<string | null>(null);

  // Reset ref on every focus so repeated taps work even if already navigated once
  useFocusEffect(
    useCallback(() => {
      // Every time screen focuses, allow a new navigation if the same food is clicked again
      hasNavigatedToFoodEditRef.current = null;
    }, [])
  );

  const handleFoodSelect = async (food: FoodMaster | EnhancedFoodItem) => {
    // Prevent double navigation - check if we've already navigated for this food
    const foodId = food.id || '';
    if (hasNavigatedToFoodEditRef.current === foodId) {
      return;
    }
    hasNavigatedToFoodEditRef.current = foodId;
    
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

    try {
      let servingQuantity: number;
      let servingUnit: string;
      let servingId: string | null = null;
      let nutrients: FoodNutrients;

      // Check if this is an EnhancedFoodItem with recent_serving
      const enhancedFood = food as EnhancedFoodItem;
      if (enhancedFood.recent_serving) {
        // Recent item: use recent_serving (last-used serving size)
        servingQuantity = enhancedFood.recent_serving.quantity;
        servingUnit = enhancedFood.recent_serving.unit;
        
        // Calculate nutrients based on recent serving
        // Fetch servings to find matching serving if it was a saved serving
        const servings = await getServingsForFood(food.id);
        const matchingServing = servings.find(s => 
          s.serving_name && (
            s.serving_name.includes(`${servingQuantity} ${servingUnit}`) ||
            (s.weight_g && servingUnit === 'g' && Math.abs(s.weight_g - servingQuantity) < 0.01) ||
            (s.volume_ml && servingUnit === 'ml' && Math.abs(s.volume_ml - servingQuantity) < 0.01)
          )
        );
        
        if (matchingServing) {
          servingId = matchingServing.id;
          nutrients = computeNutrientsForFoodServing(food, matchingServing, servingQuantity);
        } else {
          // Using raw quantity/unit - calculate from food_master
          nutrients = computeNutrientsForRawQuantity(food, servingQuantity, servingUnit);
        }
      } else if (latestEntry) {
        // Fallback: Recent tab with latestEntry (for compatibility)
        servingQuantity = latestEntry.quantity;
        servingUnit = latestEntry.unit;
        servingId = latestEntry.serving_id || null;
        
        // Calculate nutrients based on the latest entry's portion
        const servings = await getServingsForFood(food.id);
        const savedServing = servingId ? servings.find(s => s.id === servingId) : null;
        
        if (savedServing) {
          nutrients = computeNutrientsForFoodServing(food, savedServing, servingQuantity);
        } else {
          nutrients = computeNutrientsForRawQuantity(food, servingQuantity, servingUnit);
        }
      } else {
        // Other tabs / search results: use the SAME default serving as the search dropdown
        // 1. Fetch food servings using centralized data access
        const servings = await getServingsForFood(food.id);

        // 2. Use getDefaultServingWithNutrients so Quick Add matches search results exactly
        const { defaultServing, nutrients: defaultNutrients } = getDefaultServingWithNutrients(food, servings);

        servingQuantity = defaultServing.quantity;
        servingUnit = defaultServing.unit;
        servingId = defaultServing.serving?.id || null;

        // 3. Use the nutrients returned from the centralized helper (single source of truth)
        nutrients = defaultNutrients;
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
      if (nutrients.trans_fat_g !== null && nutrients.trans_fat_g > 0) {
        entryData.trans_fat_g = Math.round(nutrients.trans_fat_g * 100) / 100;
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

      // daily_sum_consumed is maintained by DB triggers; invalidate dashboard range caches for this day.
      invalidateDailySumConsumedRangesForDate(queryClient, user.id, entryDate);

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

  // Handle Quick Log navigation
  const handleQuickLog = useCallback(() => {
    router.push({
      pathname: '/quick-log',
      params: {
        date: entryDate,
        mealType: mealType,
      }
    });
  }, [router, entryDate, mealType]);

  const handleAiCamera = useCallback(() => {
    router.push({
      pathname: '/quick-log',
      params: {
        date: entryDate,
        mealType: mealType,
        tab: 'ai',
      }
    });
  }, [router, entryDate, mealType]);

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



  // Render function for tab content - consolidated to avoid duplication
  const renderTabContent = useCallback((key: TabKey, useTabBackgroundColor: boolean) => {
    switch (key) {
      case 'frequent':
        return (
          <FrequentFoodsTab
            frequentFoods={frequentFoods}
            frequentFoodsLoading={frequentFoodsLoading}
            searchQuery={searchQuery}
            colors={colors}
            t={t}
            onFoodSelect={handleFoodSelect}
            onQuickAdd={handleQuickAdd}
            styles={styles}
            useTabBackgroundColor={useTabBackgroundColor}
            {...(useTabBackgroundColor && { getTabListBackgroundColor: getTabListBackgroundColorLocal })}
          />
        );
      
      case 'recent':
        return (
          <RecentFoodsTab
            recentFoods={recentFoods}
            recentFoodsLoading={recentFoodsLoading}
            searchQuery={searchQuery}
            colors={colors}
            t={t}
            onFoodSelect={handleFoodSelect}
            onQuickAdd={handleQuickAdd}
            styles={styles}
            useTabBackgroundColor={useTabBackgroundColor}
            {...(useTabBackgroundColor && { getTabListBackgroundColor: getTabListBackgroundColorLocal })}
          />
        );
      
      case 'custom':
        return (
          <View ref={tourCustomExpandedRef as any}>
            <CustomFoodsTab
              customFoods={customFoods}
              customFoodsLoading={customFoodsLoading}
              searchQuery={searchQuery}
              colors={colors}
              t={t}
              onFoodSelect={handleFoodSelect}
              onQuickAdd={handleQuickAdd}
              onQuickLogTabPress={handleQuickLogTabPress}
              onDelete={handleDeleteCustomFood}
              editMode={customFoodEditMode}
              onToggleEditMode={() => {
                setCustomFoodEditMode(!customFoodEditMode);
              }}
              newlyAddedFoodId={newlyAddedFoodId}
              newlyEditedFoodId={newlyEditedFoodId}
              mealType={mealType}
              entryDate={entryDate}
              styles={styles}
            />
          </View>
        );
      
      case 'bundle':
        return (
          <View ref={tourBundlesExpandedRef as any}>
            <BundlesTab
              bundles={bundles}
              bundlesLoading={bundlesLoading}
              searchQuery={searchQuery}
              colors={colors}
              t={t}
              onAddBundle={handleAddBundleToMeal}
              onDelete={handleDeleteBundle}
              formatBundleItemsList={formatBundleItemsList}
              isBundleNewlyAdded={isBundleNewlyAdded}
              editMode={bundleEditMode}
              onToggleEditMode={() => {
                setBundleEditMode(!bundleEditMode);
              }}
              loading={bundleLoading}
              mealType={mealType}
              entryDate={entryDate}
              styles={styles}
              useTabBackgroundColor={useTabBackgroundColor}
              {...(useTabBackgroundColor && { getTabListBackgroundColor: getTabListBackgroundColorLocal })}
              onQuickLogTabPress={handleQuickLogTabPress}
            />
          </View>
        );
      
      case 'quick-log':
        return (
          <QuickLogLanding
            entryDate={entryDate}
            mealType={mealType}
            colors={colors}
            t={t}
          />
        );
      
      default:
        return null;
    }
  }, [
    frequentFoods,
    frequentFoodsLoading,
    recentFoods,
    recentFoodsLoading,
    customFoods,
    customFoodsLoading,
    bundles,
    bundlesLoading,
    searchQuery,
    colors,
    t,
    handleFoodSelect,
    handleQuickAdd,
    handleDeleteCustomFood,
    customFoodEditMode,
    setCustomFoodEditMode,
    newlyAddedFoodId,
    newlyEditedFoodId,
    mealType,
    entryDate,
    handleAddBundleToMeal,
    handleDeleteBundle,
    formatBundleItemsList,
    isBundleNewlyAdded,
    bundleEditMode,
    setBundleEditMode,
    loading,
    getTabListBackgroundColorLocal,
  ]);

  return (
    <ThemedView style={styles.container}>
      {/* Tour: full-page anchor excluding global footer */}
      <View
        ref={tourRootRef as any}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: footerHeight,
        }}
      />
      {/* Date Picker Modal */}
      <AppDatePicker
        value={selectedDate}
        onChange={(date) => {
          setSelectedDate(date);
          handleDateSelect(date);
        }}
        minimumDate={minDate}
        maximumDate={today}
        showTodayButton={true}
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title={t('home.date_picker.title')}
        accentColor={colors.tint}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <DesktopPageContainer>
          {/* Header */}
          <MealTypeLogHeader
            mealTypeLabel={mealTypeLabel}
            formattedDate={formattedDate}
            onMealTypePress={() => {
              setShowMealTypeDropdown(!showMealTypeDropdown);
            }}
            onDatePress={() => setShowDatePicker(true)}
            mealTypeButtonRef={mealTypeButtonRef}
            onMealTypeLayout={(layout) => setMealTypeDropdownLayout(layout)}
            colors={colors}
            t={t}
            styles={styles}
          />

        {/* Search Bar */}
        <View style={styles.searchContainer}>
            <View ref={tourSearchBarRef as any} style={styles.searchBarWrapper}>
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
                onBarcodePress={handleBarcodeScanPress}
                onAiPress={handleAiCamera}
              />
            </View>
          </View>

        {/* Tabs */}
        <View ref={tourTabsAndListRef as any} style={{ width: '100%' }}>
            <View style={styles.tabsContainerWrapper}>
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
                contentContainerStyle={[styles.tabsContainer, { flexGrow: 1 }]}
                style={styles.tabsScrollView}
                scrollIndicatorInsets={{ bottom: -1 }}
                onScroll={handleTabsScroll}
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
                      themeFillColor: getTabListBackgroundColorLocal('frequent'),
                    },
                    {
                      key: 'recent',
                      label: t('mealtype_log.tabs.recent'),
                      accessibilityLabel: t('mealtype_log.accessibility.recent_tab'),
                      themeColor: CategoryColors.recent,
                      themeFillColor: getTabListBackgroundColorLocal('recent'),
                    },
                    {
                      key: 'custom',
                      label: t('mealtype_log.tabs.custom'),
                      accessibilityLabel: t('mealtype_log.accessibility.custom_tab'),
                      themeColor: CategoryColors.custom,
                      themeFillColor: getTabListBackgroundColorLocal('custom'),
                    },
                    {
                      key: 'bundle',
                      label: t('mealtype_log.tabs.bundles'),
                      accessibilityLabel: t('mealtype_log.accessibility.bundles_tab'),
                      themeColor: CategoryColors.bundle,
                      themeFillColor: getTabListBackgroundColorLocal('bundle'),
                    },
                    {
                      key: 'quick-log',
                      label: t('mealtype_log.tabs.quick_log', '⚡Quick Log'),
                      accessibilityLabel: t('mealtype_log.accessibility.quick_log_tab', 'Quick Log tab'),
                      themeColor: CategoryColors.manual,
                      themeFillColor: getTabListBackgroundColorLocal('quick-log'),
                    },
                  ]}
                  activeKey={activeTab}
                  onChange={(key) => {
                    handleTabPress(key as 'frequent' | 'recent' | 'custom' | 'bundle' | 'quick-log');
                  }}
                  onActiveTabLayout={handleActiveTabLayout}
                  style={{ marginHorizontal: Spacing.sm, marginTop: Spacing.xs }}
                  tabRefs={{
                    frequent: frequentTabBtnRef,
                    recent: recentTabBtnRef,
                    custom: customTabBtnRef,
                    bundle: bundleTabBtnRef,
                    'quick-log': tourQuickLogTabRef,
                  }}
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

            <View>
              <View
                style={[
                  tabContentCollapsed
                    ? {
                        maxHeight: COLLAPSED_HEIGHT,
                        overflow: 'hidden',
                      }
                    : null,
                ]}
              >
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
                          backgroundColor: getTabListBackgroundColorLocal(activeTab), // Match the dropdown background
                          zIndex: 1001,
                        }
                      ]}
                    />
                    {/* Wrapper for tab content with attached popover styling - full width, matches inner list styling */}
                    <View
                      style={[
                        {
                          backgroundColor: getTabListBackgroundColorLocal(activeTab), // Match the list background color
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
                        collapsedHeight={COLLAPSED_HEIGHT}
                        renderContent={(key: TabKey) => renderTabContent(key, false)}
                      />
                    </View>
                  </View>
                ) : (
                  <AnimatedTabContent
                    activeKey={activeTab}
                    previousKey={previousTabKey}
                    isExpanded={!tabContentCollapsed}
                    collapsedHeight={COLLAPSED_HEIGHT}
                    renderContent={(key: TabKey) => renderTabContent(key, true)}
                  />
                )}
              </View>

              {/* Collapsed Content Hint - anchored below clipped content */}
              <TouchableOpacity
                onPress={() => setTabContentCollapsed(false)}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: tabContentCollapsed ? 0.5 : 0,
                  marginTop: 8,
                }}
                pointerEvents={tabContentCollapsed ? 'auto' : 'none'}
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
            </View>
          </View>

        {/* Food Log */}
        <View ref={tourFoodLogSectionRef as any} style={[styles.foodLogContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.entriesSection}>
            <View style={styles.entriesHeader}>
              {/* Left: Label + Item Count */}
              <View style={styles.entriesHeaderLeft}>
                <ThemedText style={[styles.foodLogTitle, { color: colors.text }]}>
                  {t('mealtype_log.food_log.title')}
                </ThemedText>
                <ThemedText style={[styles.foodLogItemCount, { color: colors.textMuted }]}>
                  {entries.length} {entries.length === 1 ? t('mealtype_log.food_log.item_one') : t('mealtype_log.food_log.item_other')}
                </ThemedText>
              </View>

              {/* Center/Mid-right: Calories */}
              <View style={styles.entriesHeaderCenter}>
                <ThemedText style={[styles.foodLogCalories, { color: colors.tint }]}>
                  {Math.round(mealCaloriesTotal).toLocaleString('en-US')} {t('home.food_log.kcal')}
                </ThemedText>
              </View>

              {/* Right: Controls */}
              <View style={styles.entriesHeaderRight}>
                {!showLoadingSpinner && entries.length > 0 && (
                  <View style={styles.detailsToggleStack}>
                    <ThemedText style={[styles.detailsToggleLabelSmall, { color: colors.textSecondary }]}>
                      {t('mealtype_log.food_log.details')}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => setShowEntryDetails(!showEntryDetails)}
                      activeOpacity={0.8}
                      accessibilityRole="switch"
                      accessibilityLabel={t('mealtype_log.food_log.details')}
                      accessibilityHint={showEntryDetails 
                        ? t('mealtype_log.food_log.details') + ' enabled. Double tap to disable.'
                        : t('mealtype_log.food_log.details') + ' disabled. Double tap to enable.'}
                      accessibilityState={{ checked: showEntryDetails }}
                      style={styles.toggleHitSlopWrapper}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Animated.View
                        style={[
                          styles.toggleTrackSmall,
                          { backgroundColor: showEntryDetails ? colors.tint : colors.icon + '40' },
                        ]}
                      >
                        <Animated.View
                          style={[
                            styles.toggleThumbSmall,
                            {
                              backgroundColor: colors.textInverse,
                              transform: [
                                {
                                  translateX: toggleAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 16],
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
                        setActiveModal('menu');
                      }
                    }}
                    style={[
                      styles.threeDotMenuButton,
                      getMinTouchTargetStyle(),
                    ]}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(
                      entriesEditMode 
                        ? t('mealtype_log.food_log.exit_selection_mode')
                        : t('mealtype_log.food_log.more_options'),
                      entriesEditMode
                        ? t('mealtype_log.food_log.exit_selection_mode_hint')
                        : t('mealtype_log.food_log.more_options_hint')
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
              ]}
              onPress={() => {
                setNoteEditor({ visible: true });
              }}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                t('food.note.edit', { mealType: t(`home.meal_types.${selectedMealType}`) })
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
            <MealTotals mealTotals={mealTotals} colors={colors} styles={styles} />
          )}

          {/* Select All Row - Only shown in edit mode */}
          {entriesEditMode && entries.length > 0 && (() => {
            const allEntriesSelected = areAllEntriesSelected(entries, (entry) => entry.id);
            return (
              <View
                style={[
                  styles.selectAllRow,
                  { backgroundColor: colors.background, borderBottomColor: colors.separator },
                ]}
              >
                <MultiSelectItem
                  isSelected={allEntriesSelected}
                  onToggle={() => {
                    if (allEntriesSelected) {
                      // Deselect everything
                      deselectAllEntries();
                    } else {
                      // Select all entries
                      selectAllEntries(entries, (entry) => entry.id);
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
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        paddingHorizontal: 0,
                        paddingVertical: 0,
                        minWidth: 0,
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
            );
          })()}

          {showLoadingSpinner ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : entries.length === 0 ? (
            <EmptyEntriesState
              onScanPress={handleBarcodeScanPress}
              onCopyFromYesterday={handleCopyFromPreviousDay}
              onQuickLog={handleQuickLog}
              onAiCamera={handleAiCamera}
              isCopying={isCopyingFromYesterday}
              isToday={isSelectedDateToday}
              mealTypeLabel={getMealTypeLabelLocal(selectedMealType)}
              colors={colors}
              t={t}
              styles={styles}
            />
          ) : (
            <>
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  foodSourceMap={foodSourceMap}
                  showEntryDetails={showEntryDetails}
                  onEdit={handleEditEntry}
                  onDelete={handleDelete}
                  isSelected={isEntrySelected(entry.id)}
                  onToggleSelection={() => toggleEntrySelection(entry.id)}
                  isNewlyAdded={isNewlyAdded(entry.id)}
                  hasAnySelection={hasAnySelection}
                  entriesEditMode={entriesEditMode}
                  colors={colors}
                  t={t}
                  styles={styles}
                />
              ))}
            </>
          )}
          </View>

          {/* AvoScore Donut Chart - Only shown when there are entries and meal totals */}
          {entries.length > 0 && mealTotals && mealTotals.kcal > 0 && (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.md + 20 }}>
              <MacroCompositionDonutChart
                gramsCarbTotal={mealTotals.carbs_g ?? 0}
                gramsFiber={mealTotals.fiber_g ?? 0}
                gramsProtein={mealTotals.protein_g ?? 0}
                gramsFat={mealTotals.fat_g ?? 0}
                size={220}
                showGrams={true}
                centerGrade={avo.grade}
                centerLabel="avo_score.label"
                centerReasons={avo.reasons}
              />
            </View>
          )}
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
        visible={activeModal === 'delete_entry'}
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
        visible={activeModal === 'delete_bundle'}
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
        visible={activeModal === 'bundle_warning'}
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
        visible={activeModal === 'delete_custom'}
        title={t('mealtype_log.delete_custom_food.title')}
        message={customFoodToDelete ? t('mealtype_log.delete_custom_food.message', { name: customFoodToDelete.name }) : t('mealtype_log.delete_custom_food.message_generic')}
        confirmText={t('mealtype_log.delete_custom_food.confirm')}
        cancelText={t('mealtype_log.delete_custom_food.cancel')}
        onConfirm={handleCustomFoodDeleteConfirm}
        onCancel={handleCustomFoodDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />

      <ConfirmModal
        visible={activeModal === 'add_bundle'}
        title={t('mealtype_log.add_bundle.title')}
        message={bundleToAdd ? t('mealtype_log.add_bundle.message', { count: bundleToAdd.items?.length || 0, name: bundleToAdd.name }) : t('mealtype_log.add_bundle.message_generic')}
        confirmText={t('mealtype_log.add_bundle.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleBundleAddConfirm}
        onCancel={handleBundleAddCancel}
      />

      <ConfirmModal
        visible={activeModal === 'mass_delete'}
        title={t('mealtype_log.mass_delete.title')}
        message={t('mealtype_log.mass_delete.message', { count: selectedEntryCount, items: selectedEntryCount === 1 ? t('mealtype_log.mass_delete.item_singular') : t('mealtype_log.mass_delete.item_plural') })}
        confirmText={t('mealtype_log.delete_entry.confirm')}
        cancelText={t('mealtype_log.mass_delete.cancel_no')}
        onConfirm={handleMassDeleteConfirm}
        onCancel={handleMassDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />


      {/* Three Dot Menu Modal */}
      <FoodLogMenuModal
        visible={activeModal === 'menu'}
        onClose={() => setActiveModal(null)}
        onQuickLog={() => {
          setActiveModal(null);
          router.push({
            pathname: '/quick-log',
            params: {
              date: entryDate,
              mealType: mealType,
            }
          });
        }}
        onNotes={handleNotes}
        onMassDelete={() => {
          if (entries.length > 0) {
            setActiveModal(null);
            setEntriesEditMode(true);
          }
        }}
        hasEntries={entries.length > 0}
        mealTypeLabel={t(`home.meal_types.${selectedMealType}`)}
        colors={colors}
        t={t}
        styles={styles}
      />


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
