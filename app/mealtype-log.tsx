import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Alert, ActivityIndicator, Animated, Dimensions, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { WebBarcodeScanner } from '@/components/web-barcode-scanner';
import { BarcodeFileUpload } from '@/components/barcode-file-upload';
import { useBarcodeScannerMode } from '@/hooks/use-barcode-scanner-mode';
import { FoodSearchBar } from '@/components/food-search-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFoodSearch } from '@/hooks/use-food-search';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentDateTimeUTC, getLocalDateString, formatUTCDateTime, formatUTCDate } from '@/utils/calculations';
import { useFrequentFoods } from '@/hooks/use-frequent-foods';
import { useRecentFoods } from '@/hooks/use-recent-foods';
import { useCustomFoods } from '@/hooks/use-custom-foods';
import { useBundles } from '@/hooks/use-bundles';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { useQueryClient } from '@tanstack/react-query';
import { validateAndNormalizeBarcode } from '@/lib/barcode';
import { 
  calculateNutrientsSimple, 
  calculateMasterUnitsForDisplay,
  getAllowedUnitsFor,
  isWeightUnit,
  isVolumeUnit,
  convertToMasterUnit,
  getUnitDisplayName,
  getMasterUnitsFromServingOption,
  buildServingOptions,
  getDefaultServingSelection,
  formatUnitLabel,
  formatServingLabel,
  WEIGHT_UNITS,
  VOLUME_UNITS,
  type Nutrients,
  type FoodMaster as FoodMasterType,
  type FoodServing as FoodServingType,
  type ServingOption,
} from '@/utils/nutritionMath';
import {
  getServingsForFood,
  getServingsForFoods,
  getDefaultServingForFood,
  computeNutrientsForFoodServing,
  computeNutrientsForRawQuantity,
  getDefaultServingWithNutrients,
  FOOD_SERVING_COLUMNS,
} from '@/lib/servings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { TabButton } from '@/components/ui/tab-button';
import { TabBar } from '@/components/ui/tab-bar';
import { AnimatedTabContent, TabKey } from '@/components/ui/animated-tab-content';
import { HighlightableItem } from '@/components/highlightable-item';
import { useNewItemHighlight } from '@/hooks/use-new-item-highlight';
import { MultiSelectItem } from '@/components/multi-select-item';
import { useMultiSelect } from '@/hooks/use-multi-select';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';

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
      bundle: '#F59E0B', // Orange
      manual: '#6B7280', // Dark Grey
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
      bundle: '#F59E0B', // Orange (fallback)
      manual: '#6B7280', // Dark Grey
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
      if (tabsScrollViewRef.current && contentWidth > 0) {
        // Get scroll view width by measuring
        tabsScrollViewRef.current.measure((x, y, width, height, pageX, pageY) => {
          tabsScrollViewWidthRef.current = width;
          // Check initial scroll state
          if (contentWidth > width) {
            // Can scroll right initially
            setCanScrollRight(true);
            setCanScrollLeft(false); // Start at left
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
  const mealTypeLabel = getMealTypeLabel(mealType);

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
  
  const formattedDate = formatDate(entryDate);
  
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

  // Form state
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('plate');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const unitOptions = ['g', 'oz', 'lb', 'kg', 'serving', 'cup', 'tbsp', 'tsp', 'piece', 'slice'];
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [sugar, setSugar] = useState('');
  const [sodium, setSodium] = useState('');
  const [loading, setLoading] = useState(false);
  const [macrosExpanded, setMacrosExpanded] = useState(false);
  const [fattyAcidsExpanded, setFattyAcidsExpanded] = useState(false);
  const [loadingPreference, setLoadingPreference] = useState(true);
  
  // Validation error states
  const [itemNameError, setItemNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [caloriesError, setCaloriesError] = useState('');
  const [proteinError, setProteinError] = useState('');
  const [carbsError, setCarbsError] = useState('');
  const [fatError, setFatError] = useState('');
  const [fiberError, setFiberError] = useState('');
  
  // Database constraints
  const MAX_QUANTITY = 100000; // Restrictive limit for serving size
  const MAX_CALORIES = 5000; // CHECK constraint: calories_kcal <= 5000
  const MAX_MACRO = 9999.99; // numeric(6,2)

  // Edit state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  
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
  
  // Manual entry mode (when Manual tab is active)
  const [isManualMode, setIsManualMode] = useState(false);

  // Show/hide entry details state
  const [showEntryDetails, setShowEntryDetails] = useState(true);
  const [loadingDetailsPreference, setLoadingDetailsPreference] = useState(true);
  const toggleAnimation = useRef(new Animated.Value(1)).current;

  // Meal type dropdown state
  const [showMealTypeDropdown, setShowMealTypeDropdown] = useState(false);
  const mealTypeButtonRef = useRef<View>(null);
  const [mealTypeDropdownLayout, setMealTypeDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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
        // Error loading preference - silently fail
      } finally {
        setLoadingDetailsPreference(false);
      }
    };
    loadDetailsPreference();
  }, [toggleAnimation]);

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
  }, [showEntryDetails, toggleAnimation, loadingDetailsPreference]);

  // Use React Query hook for entries (shared cache with Home screen)
  const { data: allEntriesForDay = [], isLoading: entriesLoading, isError: entriesError, refetch: refetchEntries } = useDailyEntries(entryDate);
  
  // Filter entries by current meal type (client-side filtering)
  const entries = (allEntriesForDay ?? []).filter(
    (entry) => entry.meal_type === mealType
  );
  
  // Use reusable highlight hook for newly added entries
  const {
    markAsNewlyAdded,
    isNewlyAdded,
    getAnimationValue,
    clearNewlyAdded,
  } = useNewItemHighlight(entries, (entry) => entry.id, {
    animationDelay: 150, // Slightly longer delay to ensure render completes
  });

  // Use shared food search hook (per engineering guidelines 5.1)
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    handleSearchChange,
    clearSearch,
  } = useFoodSearch();
  
  // Barcode scanning state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeScannerKey, setBarcodeScannerKey] = useState(0); // Key to force remount
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [forcePermissionCheck, setForcePermissionCheck] = useState(0);
  const [requestingPermission, setRequestingPermission] = useState(false);
  // Web-specific: track browser permission separately since expo-camera hook doesn't sync properly on mobile web
  const [webCameraPermissionGranted, setWebCameraPermissionGranted] = useState(false);
  // Web-specific: track if user manually switched to file upload mode
  const [webForceFileUpload, setWebForceFileUpload] = useState(false);
  
  // Use the barcode scanner mode hook for web platform detection
  const { 
    mode: barcodeScannerMode, 
    isChecking: isScannerModeChecking,
    cameraAvailable: webCameraAvailable,
    switchToFileUpload: switchToFileUploadMode,
    recheckCamera,
  } = useBarcodeScannerMode();
  
  // Reset file upload mode when modal closes
  
  // Reset file upload mode when modal closes
  useEffect(() => {
    if (!showBarcodeScanner) {
      setWebForceFileUpload(false);
    }
  }, [showBarcodeScanner]);
  
  // Auto-open camera when permission is granted while modal is open
  useEffect(() => {
    if (showBarcodeScanner && permission && permission.granted) {
      setScanned(false);
      setBarcodeScanning(false);
    }
  }, [showBarcodeScanner, permission]);
  
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
  const initialTab = (activeTabParam === 'custom' || activeTabParam === 'recent' || activeTabParam === 'frequent' || activeTabParam === 'bundle' || activeTabParam === 'manual')
    ? activeTabParam
    : 'frequent';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [previousTabKey, setPreviousTabKey] = useState<TabKey>(initialTab);
  const [tabContentCollapsed, setTabContentCollapsed] = useState(false);
  
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
  
  // Mass delete confirmation modal state
  const [massDeleteConfirmVisible, setMassDeleteConfirmVisible] = useState(false);
  
  // Selected food and serving state
  const [selectedFood, setSelectedFood] = useState<FoodMaster | null>(null);
  const [availableServings, setAvailableServings] = useState<ServingOption[]>([]);
  const [selectedServing, setSelectedServing] = useState<ServingOption | null>(null);
  const [showServingDropdown, setShowServingDropdown] = useState(false);
  
  // Map to store food source types (custom vs database) for entries
  const [foodSourceMap, setFoodSourceMap] = useState<{ [foodId: string]: boolean }>({});
  const [foodBrandMap, setFoodBrandMap] = useState<{ [foodId: string]: string | null }>({});
  
  // Ref for quantity input to auto-focus
  const quantityInputRef = useRef<TextInput>(null);
  
  // Ref and state for serving dropdown positioning
  const servingButtonRef = useRef<View>(null);
  const [servingDropdownLayout, setServingDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Helper function to validate numeric input (numbers and one period only)
  const validateNumericInput = (text: string): string => {
    // Remove any characters that aren't numbers or periods
    let cleaned = text.replace(/[^0-9.]/g, '');
    
    // Ensure only one period
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      // If more than one period, keep only the first one
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    return cleaned;
  };

  // Load user preference for macros and other nutrients expansion
  useEffect(() => {
    const loadPreference = async () => {
      try {
        if (Platform.OS === 'web') {
          const macrosStored = localStorage.getItem('macrosExpanded');
          if (macrosStored !== null) {
            setMacrosExpanded(macrosStored === 'true');
          }
          const fattyAcidsStored = localStorage.getItem('fattyAcidsExpanded');
          if (fattyAcidsStored !== null) {
            setFattyAcidsExpanded(fattyAcidsStored === 'true');
          }
        } else {
          const macrosStored = await SecureStore.getItemAsync('macrosExpanded');
          if (macrosStored !== null) {
            setMacrosExpanded(macrosStored === 'true');
          }
          const fattyAcidsStored = await SecureStore.getItemAsync('fattyAcidsExpanded');
          if (fattyAcidsStored !== null) {
            setFattyAcidsExpanded(fattyAcidsStored === 'true');
          }
        }
    } catch (error) {
      // Error loading preference - silently fail
    } finally {
        setLoadingPreference(false);
      }
    };
    loadPreference();
  }, []);

  const toggleMacros = async () => {
    const newValue = !macrosExpanded;
    setMacrosExpanded(newValue);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('macrosExpanded', String(newValue));
      } else {
        await SecureStore.setItemAsync('macrosExpanded', String(newValue));
      }
    } catch (error) {
      // Error saving preference - silently fail
    }
  };

  const toggleFattyAcids = async () => {
    const newValue = !fattyAcidsExpanded;
    setFattyAcidsExpanded(newValue);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('fattyAcidsExpanded', String(newValue));
      } else {
        await SecureStore.setItemAsync('fattyAcidsExpanded', String(newValue));
      }
    } catch (error) {
      // Error saving preference - silently fail
    }
  };

  // Fetch food source types and brand for entries with food_id
  // This runs whenever entries change
  useEffect(() => {
    if (!entries.length) {
      setFoodSourceMap({});
      setFoodBrandMap({});
      return;
    }

    const foodIds = [...new Set(entries.filter(e => e.food_id).map(e => e.food_id))] as string[];
    if (foodIds.length > 0) {
      supabase
        .from('food_master')
        .select('id, is_custom, brand')
        .in('id', foodIds)
        .then(({ data: foodsData, error }) => {
          if (error) {
            setFoodSourceMap({});
            setFoodBrandMap({});
            return;
          }
          if (foodsData) {
            const sourceMap: { [foodId: string]: boolean } = {};
            const brandMap: { [foodId: string]: string | null } = {};
            foodsData.forEach(food => {
              // Simple logic: if is_custom is true, mark as custom; otherwise database
              sourceMap[food.id] = food.is_custom === true;
              brandMap[food.id] = food.brand;
            });
            setFoodSourceMap(sourceMap);
            setFoodBrandMap(brandMap);
          } else {
            setFoodSourceMap({});
            setFoodBrandMap({});
          }
        })
        .catch(() => {
          setFoodSourceMap({});
          setFoodBrandMap({});
        });
    } else {
      setFoodSourceMap({});
      setFoodBrandMap({});
    }
  }, [entries]);

  // Fetch functions removed - now using React Query hooks above

  // Helper function to format bundle items as a concatenated string (just food names)
  const formatBundleItemsList = useCallback((bundle: Bundle): string => {
    if (!bundle.items || bundle.items.length === 0) {
      return '';
    }

    const foodsMap = bundle.foodsMap || new Map();

    return bundle.items
      .map((item) => {
        // Get food name
        let foodName = item.item_name || t('mealtype_log.food_log.unknown_food');
        if (item.food_id && foodsMap.has(item.food_id)) {
          foodName = foodsMap.get(item.food_id)!.name;
        }
        return foodName;
      })
      .join(', ');
  }, []);

  // Fetch bundles function removed - now using React Query hook above

  // Helper function to actually add bundle entries (extracted for reuse)
  const addBundleEntries = useCallback(async (bundle: Bundle) => {
    setLoading(true);
    try {
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
          let calories = 0;
          let protein = 0;
          let carbs = 0;
          let fat = 0;
          let fiber = 0;
          let saturatedFat = 0;
          let sugar = 0;
          let sodium = 0;
          let itemName = item.item_name || t('mealtype_log.food_log.unknown_food');

          if (item.food_id && foodsMap.has(item.food_id)) {
            const food = foodsMap.get(item.food_id)!;
            itemName = food.name;
            let multiplier = 1;

            if (item.serving_id) {
              const { data: servingData, error: servingError } = await supabase
                .from('food_servings')
                .select('weight_g, volume_ml')
                .eq('id', item.serving_id)
                .single();

              if (servingError || !servingData) {
                // Fallback to unit-based calculation
                if (item.unit === 'g' || item.unit === 'ml') {
                  multiplier = item.quantity / 100;
                } else {
                  multiplier = (item.quantity * food.serving_size) / 100;
                }
              } else {
                // Use weight_g or volume_ml from the serving
                const servingValue = servingData.weight_g ?? servingData.volume_ml ?? 0;
                multiplier = (item.quantity * servingValue) / 100;
              }
            } else {
              // Unit-based serving (1g or 1ml) or other units
              if (item.unit === 'g' || item.unit === 'ml') {
                multiplier = item.quantity / 100;
              } else {
                multiplier = (item.quantity * food.serving_size) / 100;
              }
            }

            calories = (food.calories_kcal || 0) * multiplier;
            protein = (food.protein_g || 0) * multiplier;
            carbs = (food.carbs_g || 0) * multiplier;
            fat = (food.fat_g || 0) * multiplier;
            fiber = (food.fiber_g || 0) * multiplier;
            saturatedFat = (food.saturated_fat_g || 0) * multiplier;
            sugar = (food.sugar_g || 0) * multiplier;
            sodium = (food.sodium_mg || 0) * multiplier;
          }

          // Validate quantity and unit
          const parsedQuantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || '0'));
          if (isNaN(parsedQuantity) || !isFinite(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error(`Invalid quantity for item: ${itemName}`);
          }

          if (!item.unit || typeof item.unit !== 'string') {
            throw new Error(`Invalid unit for item: ${itemName}`);
          }

          // Validate calculated values
          const validatedCalories = isNaN(calories) || !isFinite(calories) ? 0 : Math.round(calories * 100) / 100;
          const validatedProtein = (protein > 0 && isFinite(protein)) ? Math.round(protein * 100) / 100 : null;
          const validatedCarbs = (carbs > 0 && isFinite(carbs)) ? Math.round(carbs * 100) / 100 : null;
          const validatedFat = (fat > 0 && isFinite(fat)) ? Math.round(fat * 100) / 100 : null;
          const validatedFiber = (fiber > 0 && isFinite(fiber)) ? Math.round(fiber * 100) / 100 : null;
          const validatedSaturatedFat = (saturatedFat > 0 && isFinite(saturatedFat)) ? Math.round(saturatedFat * 100) / 100 : null;
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
            unit: item.unit,
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
    setBundleToAdd(null);
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

  // Move bundle up in order - removed (bundles are now read-only from React Query)
  // If reordering is needed, it should be done via mutations that update the database
  const handleMoveBundleUp = useCallback((bundleId: string) => {
    // Reordering removed - bundles are managed by React Query
  }, []);

  // Move bundle down in order - removed (bundles are now read-only from React Query)
  const handleMoveBundleDown = useCallback((bundleId: string) => {
    // Reordering removed - bundles are managed by React Query
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
  }, [activeTab, customFoodEditMode, bundleEditMode, saveCustomFoodOrder, saveBundleOrder]);

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

  // Handle edit entry - load entry data into form
  const handleEditEntry = async (entry: CalorieEntry) => {
    setEditingEntryId(entry.id);
    setIsManualMode(false); // Close manual mode when editing entry
    
    // Load basic entry data
    setItemName(entry.item_name);
    setQuantity(entry.quantity.toString());
    setUnit(entry.unit);
    setCalories(entry.calories_kcal.toString());
    setProtein(entry.protein_g?.toString() || '');
    setCarbs(entry.carbs_g?.toString() || '');
    setFat(entry.fat_g?.toString() || '');
    setFiber(entry.fiber_g?.toString() || '');
    setSaturatedFat(entry.saturated_fat_g?.toString() || '');
    setSugar(entry.sugar_g?.toString() || '');
    setSodium(entry.sodium_mg?.toString() || '');
    
    // If entry has food_id, load the food and serving data
    if (entry.food_id) {
      try {
        // Fetch food data
        const { data: foodData, error: foodError } = await supabase
          .from('food_master')
          .select('*')
          .eq('id', entry.food_id)
          .single();

        if (!foodError && foodData) {
          setSelectedFood(foodData);
          
          // Fetch servings for this food
          const { data: servingsData, error: servingsError } = await supabase
            .from('food_servings')
            .select('*')
            .eq('food_id', entry.food_id)
            .order('is_default', { ascending: false })
            .order('serving_name', { ascending: true });

          // Build serving options using the new model (spec 8.2)
          const dbServings: FoodServing[] = (!servingsError && servingsData) ? servingsData : [];
          const options = buildServingOptions(foodData, dbServings);
          setAvailableServings(options);
          
          // Select the serving that matches entry.serving_id, or use default
          if (entry.serving_id) {
            // Find the saved option that matches entry.serving_id
            const matchingOption = options.find(
              o => o.kind === 'saved' && o.serving.id === entry.serving_id
            );
            if (matchingOption) {
              setSelectedServing(matchingOption);
              calculateNutrientsFromOption(foodData, matchingOption, entry.quantity);
            } else {
              // If serving not found, use default
              const { defaultOption } = getDefaultServingSelection(foodData, dbServings);
              setSelectedServing(defaultOption);
              calculateNutrientsFromOption(foodData, defaultOption, entry.quantity);
            }
          } else {
            // No serving_id - check if unit matches a raw unit option
            const entryUnit = entry.unit?.toLowerCase();
            const rawMatch = options.find(
              o => o.kind === 'raw' && o.unit.toLowerCase() === entryUnit
            );
            if (rawMatch) {
              setSelectedServing(rawMatch);
              calculateNutrientsFromOption(foodData, rawMatch, entry.quantity);
            } else {
              // Fall back to default
              const { defaultOption } = getDefaultServingSelection(foodData, dbServings);
              setSelectedServing(defaultOption);
              calculateNutrientsFromOption(foodData, defaultOption, entry.quantity);
            }
          }
        }
      } catch (error) {
      }
    } else {
      // No food_id, so clear selected food
      setSelectedFood(null);
      setSelectedServing(null);
      setAvailableServings([]);
    }
    
    // Clear errors
    setItemNameError('');
    setQuantityError('');
    setCaloriesError('');
    
    // Auto-focus quantity input after a short delay
    setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 300);
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
    if (selectedEntryCount > 0) {
      setMassDeleteConfirmVisible(true);
    }
  }, [selectedEntryCount]);

  const handleMassDeleteConfirm = useCallback(async () => {
    setMassDeleteConfirmVisible(false);
    if (selectedEntryIds.size === 0) return;

    setLoading(true);
    try {
      // Delete all selected entries
      const entryIdsArray = Array.from(selectedEntryIds);
      const { error } = await supabase
        .from('calorie_entries')
        .delete()
        .in('id', entryIdsArray);

      if (error) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.delete_entry.failed_multiple', { error: error.message }));
        setLoading(false);
        return;
      }

      // Clear selection and refresh entries
      clearEntrySelection();
      await refetchEntries();
      Alert.alert(t('alerts.success'), t('mealtype_log.delete_entry.success_multiple', { count: selectedEntryCount, entries: selectedEntryCount === 1 ? t('mealtype_log.delete_entry.entry_singular') : t('mealtype_log.delete_entry.entry_plural') }));
    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.delete_entry.failed_multiple', { error: error?.message || t('common.unexpected_error') }));
    } finally {
      setLoading(false);
    }
  }, [selectedEntryIds, selectedEntryCount, clearEntrySelection, refetchEntries]);

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
        // If the deleted entry was being edited, clear the form
        if (editingEntryId === entryId) {
          handleCancel();
        }
        await refetchEntries();
      }
    } catch (error) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.unexpected_error'));
    }
  };

  // Clear form
  const handleCancel = () => {
    setItemName('');
    setQuantity('1');
    setUnit('plate');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setFiber('');
    setSaturatedFat('');
    setSugar('');
    setSodium('');
    setSelectedFood(null);
    setSelectedServing(null);
    setAvailableServings([]);
    setItemNameError('');
    setQuantityError('');
    setCaloriesError('');
    setEditingEntryId(null);
    setIsManualMode(false);
  };

  const saveEntry = async (showSuccessAlert = true): Promise<boolean> => {
    if (loading) {
      return false;
    }
    
    // Clear previous errors
    setItemNameError('');
    setQuantityError('');
    setCaloriesError('');
    
    let hasErrors = false;
    
    if (!itemName.trim()) {
      setItemNameError(t('mealtype_log.errors.item_name_required'));
      hasErrors = true;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      setQuantityError(t('mealtype_log.errors.quantity_required'));
      hasErrors = true;
    }

    if (!calories || calories.trim() === '' || parseFloat(calories) < 0) {
      setCaloriesError(t('mealtype_log.errors.calories_required'));
      hasErrors = true;
    }

    if (hasErrors) {
      // Show alert if validation failed
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.fix_errors'));
      return false;
    }

    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.user_not_found'));
      return false;
    }

    // Check if editing and entry still exists
    if (editingEntryId && !entries.find(e => e.id === editingEntryId)) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.entry_not_exists'));
      handleCancel();
      return false;
    }

    // Validate calculated values before saving
    const parsedQuantity = parseFloat(quantity);
    const parsedCalories = parseFloat(calories);
    
    // Check for invalid numbers
    if (isNaN(parsedQuantity) || !isFinite(parsedQuantity)) {
      setQuantityError(t('mealtype_log.errors.quantity_invalid'));
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.quantity_invalid'));
      setLoading(false);
      return false;
    }
    
    if (isNaN(parsedCalories) || !isFinite(parsedCalories)) {
      setCaloriesError(t('mealtype_log.errors.calories_invalid'));
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.calories_invalid'));
      setLoading(false);
      return false;
    }
    
    // Check for reasonable limits (database constraints)
    // Based on actual database constraints:
    // - quantity: restricted to 100,000 (more restrictive than database limit)
    // - calories_kcal: numeric(6,1) with CHECK constraint <= 5000
    // - macros: numeric(6,2) - max 9999.99
    
    if (parsedQuantity > MAX_QUANTITY) {
      const errorMsg = `Serving size cannot exceed ${MAX_QUANTITY.toLocaleString()}. Please reduce the quantity or split into multiple entries.`;
      setQuantityError(errorMsg);
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.serving_too_large', { value: parsedQuantity.toLocaleString(), max: MAX_QUANTITY.toLocaleString() }));
      setLoading(false);
      return false;
    }
    
    // CRITICAL: Check calories limit (database constraint: max 5000)
    // Use strict comparison and ensure we're checking the actual numeric value
    const caloriesValue = Number(parsedCalories);
    const maxCaloriesValue = Number(MAX_CALORIES);
    
    if (caloriesValue > maxCaloriesValue) {
      const errorMsg = `❌ Calories Limit: ${caloriesValue.toLocaleString()} kcal exceeds maximum of ${maxCaloriesValue.toLocaleString()} kcal per entry. Reduce quantity or split into ${Math.ceil(caloriesValue / maxCaloriesValue)} entries.`;
      setCaloriesError(errorMsg);
      
      const suggestedQuantity = Math.floor((maxCaloriesValue / caloriesValue) * parsedQuantity * 10) / 10;
      const alertMessage = 
        `⚠️ CALORIES LIMIT EXCEEDED\n\n` +
        `Current: ${caloriesValue.toLocaleString()} calories\n` +
        `Maximum: ${maxCaloriesValue.toLocaleString()} calories per entry\n\n` +
        `SOLUTIONS:\n` +
        `• Reduce quantity to ${suggestedQuantity} (instead of ${parsedQuantity})\n` +
        `• Split into ${Math.ceil(caloriesValue / maxCaloriesValue)} separate entries`;
      
      // Show alert immediately - call directly, no setTimeout
      Alert.alert(t('alerts.calories_limit_exceeded'), alertMessage, [
        { text: t('common.ok'), style: 'default' }
      ]);
      
      // Ensure loading is false
      setLoading(false);
      
      return false;
    }
    
    // Check macros if they exist
    if (protein && parseFloat(protein) > MAX_MACRO) {
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.protein_too_large', { max: MAX_MACRO.toLocaleString() }));
      return false;
    }
    if (carbs && parseFloat(carbs) > MAX_MACRO) {
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.carbs_too_large', { max: MAX_MACRO.toLocaleString() }));
      return false;
    }
    if (fat && parseFloat(fat) > MAX_MACRO) {
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.fat_too_large', { max: MAX_MACRO.toLocaleString() }));
      return false;
    }

    setLoading(true);
    try {
      // Store time in UTC for database (standard practice)
      // Will be converted back to user's local timezone when displayed
      const eatenAt = getCurrentDateTimeUTC();
      const dateString = entryDate;

      // Build entry data - only include fields that are allowed in calorie_entries table
      const entryData: any = {
        user_id: user.id,
        entry_date: dateString,
        eaten_at: eatenAt,
        meal_type: mealType.toLowerCase(),
        item_name: itemName.trim(), // Keep for backward compatibility
        quantity: parsedQuantity,
        unit: selectedServing?.label || unit, // Use serving label if available
        calories_kcal: parsedCalories,
        protein_g: protein && protein.trim() !== '' ? parseFloat(protein) : null,
        carbs_g: carbs && carbs.trim() !== '' ? parseFloat(carbs) : null,
        fat_g: fat && fat.trim() !== '' ? parseFloat(fat) : null,
        fiber_g: fiber && fiber.trim() !== '' ? parseFloat(fiber) : null,
      };

      // Only include food_id if food was selected from food_master (like Bundle does)
      if (selectedFood) {
        entryData.food_id = selectedFood.id;
      }
      
      // Only include serving_id if it's a saved serving from the database (not a raw unit option)
      if (selectedServing && selectedServing.kind === 'saved') {
        entryData.serving_id = selectedServing.serving.id;
      }

      // Only include saturated_fat_g if it has a value greater than 0 (match Bundle logic)
      if (saturatedFat && saturatedFat.trim() !== '') {
        const parsedSaturatedFat = parseFloat(saturatedFat);
        if (!isNaN(parsedSaturatedFat) && isFinite(parsedSaturatedFat) && parsedSaturatedFat > 0) {
          entryData.saturated_fat_g = Math.round(parsedSaturatedFat * 100) / 100;
        }
      }
      
      // Only include sugar_g if it has a value greater than 0 (match Bundle logic - don't include if 0)
      if (sugar && sugar.trim() !== '') {
        const parsedSugar = parseFloat(sugar);
        if (!isNaN(parsedSugar) && isFinite(parsedSugar) && parsedSugar > 0) {
          entryData.sugar_g = Math.round(parsedSugar * 100) / 100;
        }
      }
      
      // Only include sodium_mg if it has a value greater than 0 (match Bundle logic - don't include if 0)
      if (sodium && sodium.trim() !== '') {
        const parsedSodium = parseFloat(sodium);
        if (!isNaN(parsedSodium) && isFinite(parsedSodium) && parsedSodium > 0) {
          entryData.sodium_mg = Math.round(parsedSodium * 100) / 100;
        }
      }
      
      // Validate all macro fields
      if (protein) {
        const parsedProtein = parseFloat(protein);
        if (isNaN(parsedProtein) || !isFinite(parsedProtein)) {
          Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.protein_invalid'));
          setLoading(false);
          return false;
        }
        entryData.protein_g = parsedProtein;
      }
      if (carbs) {
        const parsedCarbs = parseFloat(carbs);
        if (isNaN(parsedCarbs) || !isFinite(parsedCarbs)) {
          Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.carbs_invalid'));
          setLoading(false);
          return false;
        }
        entryData.carbs_g = parsedCarbs;
      }
      if (fat) {
        const parsedFat = parseFloat(fat);
        if (isNaN(parsedFat) || !isFinite(parsedFat)) {
          Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.fat_invalid'));
          setLoading(false);
          return false;
        }
        entryData.fat_g = parsedFat;
      }
      if (fiber) {
        const parsedFiber = parseFloat(fiber);
        if (isNaN(parsedFiber) || !isFinite(parsedFiber)) {
          Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.fiber_invalid'));
          setLoading(false);
          return false;
        }
        entryData.fiber_g = parsedFiber;
      }

      // Final validation check before database call
      // Double-check calories limit (database constraint: max 5000)
      if (parsedCalories > 5000) {
        const errorMsg = `Calories (${parsedCalories.toLocaleString()} kcal) exceed the 5,000 kcal limit per entry. Please reduce quantity or split into multiple entries.`;
        setCaloriesError(errorMsg);
        
        const alertMessage = 
          `⚠️ Calories Limit Exceeded\n\n` +
          `This entry has ${parsedCalories.toLocaleString()} calories.\n` +
          `Maximum allowed: 5,000 calories per entry.\n\n` +
          `Solutions:\n` +
          `• Reduce the quantity\n` +
          `• Split into ${Math.ceil(parsedCalories / 5000)} separate entries`;
        
        Alert.alert(t('alerts.calories_limit_exceeded'), alertMessage);
        setLoading(false);
        return false;
      }

      // Clean entryData - remove any undefined values and ensure only valid fields are included
      // Only keep fields that are valid for calorie_entries table
      const cleanedEntryData: any = {};
      const allowedFields = [
        'user_id', 'entry_date', 'eaten_at', 'meal_type', 'item_name', 'quantity', 'unit',
        'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
        'saturated_fat_g', 'sugar_g', 'sodium_mg', 'food_id', 'serving_id'
      ];
      
      for (const key of allowedFields) {
        if (entryData.hasOwnProperty(key) && entryData[key] !== undefined) {
          cleanedEntryData[key] = entryData[key];
        }
      }


      let error;
      let result;
      if (editingEntryId) {
        // Update existing entry - use cleaned data
        const updateResult = await supabase
          .from('calorie_entries')
          .update(cleanedEntryData)
          .eq('id', editingEntryId);
        error = updateResult.error;
        result = updateResult;
      } else {
        // Insert new entry - use cleaned data
        const insertResult = await supabase
          .from('calorie_entries')
          .insert(cleanedEntryData)
          .select('id')
          .single();
        error = insertResult.error;
        result = insertResult;
        
        // Capture the newly added entry ID for highlight animation
        if (!error && insertResult.data?.id) {
          markAsNewlyAdded(insertResult.data.id);
        }
      }

      if (error) {
        // Parse error message to provide user-friendly feedback
        let errorMessage = `Failed to ${editingEntryId ? 'update' : 'save'} food entry.`;
        const errorMsg = error.message || '';
        const errorCode = error.code || '';
        const errorDetails = error.details || '';
        const errorHint = error.hint || '';
        
        // Check for common database constraint violations
        // PostgreSQL error code 23514 = check_violation
        if (errorCode === '23514' || errorMsg.includes('calories_kcal_check') || errorMsg.includes('calories_kcal') || (errorMsg.includes('check') && (errorMsg.includes('5000') || errorMsg.includes('calories')))) {
          // Specific check for calories_kcal constraint violation
          const currentCalories = parsedCalories || (entryData.calories_kcal ? parseFloat(entryData.calories_kcal.toString()) : 0);
          const suggestedQty = parsedQuantity ? Math.floor((5000 / currentCalories) * parsedQuantity * 10) / 10 : 0;
          errorMessage = `⚠️ CALORIES LIMIT EXCEEDED\n\n` +
            `Current: ${currentCalories.toLocaleString()} calories\n` +
            `Maximum: 5,000 calories per entry\n\n` +
            `SOLUTIONS:\n` +
            `• Reduce quantity to ${suggestedQty} (instead of ${parsedQuantity || 'current'})\n` +
            `• Split into ${Math.ceil(currentCalories / 5000)} separate entries`;
          setCaloriesError(`Calories (${currentCalories.toLocaleString()} kcal) exceed the 5,000 kcal limit per entry`);
          
        } else if (errorMsg.includes('numeric') || errorMsg.includes('value too large') || errorMsg.includes('out of range') || errorCode === '22003') {
          errorMessage = 'The calculated values are too large. Please reduce the quantity or split into multiple entries.';
          setQuantityError('Quantity or calculated calories exceed database limits');
          setCaloriesError('Calculated calories exceed database limits');
        } else if (errorMsg.includes('constraint') || errorMsg.includes('violates') || errorCode === '23514') {
          errorMessage = 'Invalid data detected. Please check your input values.';
          if (errorDetails) {
            errorMessage += `\n\nDetails: ${errorDetails}`;
          }
        } else if (errorMsg.includes('null value') || errorMsg.includes('not null') || errorCode === '23502') {
          errorMessage = 'Required fields are missing. Please fill in all required information.';
          if (errorDetails) {
            errorMessage += `\n\nMissing field: ${errorDetails}`;
          }
        } else if (errorMsg || errorDetails) {
          errorMessage = `${errorMessage}\n\nError: ${errorMsg || errorDetails}`;
          if (errorHint) {
            errorMessage += `\n\nHint: ${errorHint}`;
          }
        } else {
          errorMessage = `${errorMessage}\n\nPlease check your input values and try again.`;
        }
        
        // Always include full error details in console and alert for debugging
        console.error('=== FULL DATABASE ERROR ===');
        console.error('Error Object:', error);
        console.error('Cleaned Entry Data that failed:', JSON.stringify(cleanedEntryData, null, 2));
        console.error('Error Message:', errorMessage);
        
        // Show detailed error to user
        const userErrorMessage = errorMessage + 
          (errorDetails ? `\n\nTechnical Details: ${errorDetails}` : '') +
          (errorHint ? `\n\nHint: ${errorHint}` : '') +
          (errorCode ? `\n\nError Code: ${errorCode}` : '');
        
        Alert.alert(t('alerts.error_title'), userErrorMessage);
        return false;
      } else {
        // Refresh entries to show the updated/newly saved entry
        await refetchEntries();
        
        // Clear highlight state if we were editing (not adding)
        if (editingEntryId) {
          clearNewlyAdded();
        }
        // For new entries, markAsNewlyAdded was already called, and the hook will handle animation
        
        // Clear form
        handleCancel();
        if (showSuccessAlert) {
          Alert.alert(t('alerts.success'), t('mealtype_log.success.entry_saved', { action: editingEntryId ? t('mealtype_log.success.action_updated') : t('mealtype_log.success.action_saved') }));
        }
        return true;
      }
    } catch (error: any) {
      
      // Parse exception error message
      let errorMessage = 'An unexpected error occurred.';
      const errorMsg = error?.message || '';
      
      if (errorMsg.includes('numeric') || errorMsg.includes('value too large') || errorMsg.includes('out of range')) {
        errorMessage = 'The calculated values are too large. Please reduce the quantity or split into multiple entries.';
        setQuantityError('Values exceed database limits');
        setCaloriesError('Calculated calories exceed database limits');
      } else if (errorMsg) {
        errorMessage = `${errorMessage}\n\nError details: ${errorMsg}`;
      }
      
      Alert.alert(t('alerts.error_title'), errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Check calories before even calling saveEntry
      const currentCalories = parseFloat(calories);
      if (!isNaN(currentCalories) && currentCalories > 5000) {
        const errorMsg = `⚠️ CALORIES LIMIT EXCEEDED\n\n` +
          `Current: ${currentCalories.toLocaleString()} calories\n` +
          `Maximum: 5,000 calories per entry\n\n` +
          `SOLUTIONS:\n` +
          `• Reduce the quantity\n` +
          `• Split into ${Math.ceil(currentCalories / 5000)} separate entries`;
        
        setCaloriesError(`Calories (${currentCalories.toLocaleString()} kcal) exceed the 5,000 kcal limit per entry`);
        Alert.alert(t('alerts.calories_limit_exceeded'), errorMsg);
        setLoading(false);
        return;
      }
      
      const result = await saveEntry(true);
      if (!result) {
        // If saveEntry returned false, it should have shown an error
        // But if for some reason it didn't, show a generic error as safety net
        // Show a generic error message as a fallback
        Alert.alert(
          t('alerts.save_failed'), 
          t('mealtype_log.errors.save_failed_checklist') + `\n\nCurrent calories: ${currentCalories.toLocaleString()} kcal`
        );
        setLoading(false);
      }
    } catch (error: any) {
      // Catch any unexpected errors that might not be caught by saveEntry
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.save_unexpected', { error: error?.message || t('common.unexpected_error') }));
      setLoading(false);
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
  const previousActiveTab = useRef<'frequent' | 'recent' | 'custom' | 'bundle'>(initialTab);

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
  }, [activeTab, user?.id, refetchCustomFoods, refreshCustomFoodsParam, queryClient]);
  
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

  // Handle barcode scan results - auto-select food from scan
  useEffect(() => {
    const handleScannedFood = async () => {
      // Handle selectedFoodId - fetch from food_master and auto-select
      const foodId = Array.isArray(selectedFoodIdParam) ? selectedFoodIdParam[0] : selectedFoodIdParam;
      if (foodId && user?.id) {
        try {
          const { data: food, error } = await supabase
            .from('food_master')
            .select('*')
            .eq('id', foodId)
            .single();
          
          if (food && !error) {
            // Auto-select the food
            handleFoodSelect(food as FoodMaster);
          }
        } catch (err) {
          console.error('[MealTypeLog] Error fetching scanned food:', err);
        }
      }
      
      // Handle scannedFoodData - "Use Once" flow with external data (no food_master entry)
      const scannedData = Array.isArray(scannedFoodDataParam) ? scannedFoodDataParam[0] : scannedFoodDataParam;
      if (scannedData && user?.id) {
        try {
          const externalFood = JSON.parse(scannedData);
          // Create a virtual FoodMaster-like object for the entry form
          // Note: This food won't be saved to food_master - it's for one-time use
          const virtualFood: FoodMaster = {
            id: '', // Empty - indicates this is not a saved food
            name: externalFood.product_name || 'Scanned Product',
            brand: externalFood.brand || null,
            calories_kcal: externalFood.energy_kcal_100g || 0,
            protein_g: externalFood.protein_100g || 0,
            carbs_g: externalFood.carbs_100g || 0,
            fat_g: externalFood.fat_100g || 0,
            fiber_g: externalFood.fiber_100g || null,
            saturated_fat_g: externalFood.saturated_fat_100g || null,
            sugar_g: externalFood.sugars_100g || null,
            sodium_mg: externalFood.sodium_100g ? Math.round(externalFood.sodium_100g * 1000) : null,
            serving_size: 100, // External data is per 100g
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

      // Handle manualEntryData - "1-time Log (Manual)" flow
      const manualData = Array.isArray(manualEntryDataParam) ? manualEntryDataParam[0] : manualEntryDataParam;
      const shouldOpenManual = Array.isArray(openManualModeParam) ? openManualModeParam[0] === 'true' : openManualModeParam === 'true';
      
      if (manualData && shouldOpenManual && user?.id) {
        try {
          const entryData = JSON.parse(manualData);
          
          // Open manual mode
          setIsManualMode(true);
          
          // Prefill form fields
          setItemName(entryData.item_name || '');
          setQuantity(entryData.quantity?.toString() || '');
          setUnit(entryData.unit || 'g');
          setCalories(entryData.calories_kcal?.toString() || '');
          setProtein(entryData.protein_g?.toString() || '');
          setCarbs(entryData.carbs_g?.toString() || '');
          setFat(entryData.fat_g?.toString() || '');
          setFiber(entryData.fiber_g?.toString() || '');
          setSugar(entryData.sugar_g?.toString() || '');
          setSodium(entryData.sodium_mg?.toString() || '');
          
          // Clear any selected food
          setSelectedFood(null);
          
          // Set active tab to manual if not already
          if (activeTab !== 'manual') {
            setActiveTab('manual');
          }
        } catch (err) {
          console.error('[MealTypeLog] Error parsing manual entry data:', err);
        }
      }
    };

    handleScannedFood();
  }, [selectedFoodIdParam, scannedFoodDataParam, manualEntryDataParam, openManualModeParam, user?.id, activeTab]);

  // Handle openBarcodeScanner param - open scanner when navigating from scanned-item "Scan Another"
  useEffect(() => {
    const shouldOpenScanner = Array.isArray(openBarcodeScannerParam) 
      ? openBarcodeScannerParam[0] === 'true' 
      : openBarcodeScannerParam === 'true';
    
    if (shouldOpenScanner && !showBarcodeScanner) {
      setScanned(false); // Reset scanned state
      setBarcodeScanning(false); // Reset scanning state
      setShowBarcodeScanner(true);
      setBarcodeScannerKey(prev => prev + 1); // Force remount
    }
  }, [openBarcodeScannerParam, showBarcodeScanner]);

  // Real-time validation function
  const validateFields = useCallback(() => {
    // Clear previous errors
    setQuantityError('');
    setCaloriesError('');
    setProteinError('');
    setCarbsError('');
    setFatError('');
    setFiberError('');
    
    let isValid = true;
    
    // Validate quantity
    const parsedQuantity = parseFloat(quantity);
    if (!quantity || isNaN(parsedQuantity) || !isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setQuantityError('Serving size must be a valid number greater than 0');
      isValid = false;
    } else if (parsedQuantity > MAX_QUANTITY) {
      setQuantityError(`Serving size cannot exceed ${MAX_QUANTITY.toLocaleString()}. Please reduce the quantity or split into multiple entries.`);
      isValid = false;
    }
    
    // Validate calories
    const parsedCalories = parseFloat(calories);
    if (!calories || calories.trim() === '' || isNaN(parsedCalories) || !isFinite(parsedCalories) || parsedCalories < 0) {
      setCaloriesError('Calories must be a valid number');
      isValid = false;
    } else if (parsedCalories > MAX_CALORIES) {
      setCaloriesError(`Calories cannot exceed ${MAX_CALORIES.toLocaleString()} kcal per entry. Current: ${parsedCalories.toLocaleString()} kcal. Reduce quantity or split into ${Math.ceil(parsedCalories / MAX_CALORIES)} entries.`);
      isValid = false;
    }
    
    // Validate macros (if provided)
    if (protein) {
      const parsedProtein = parseFloat(protein);
      if (isNaN(parsedProtein) || !isFinite(parsedProtein)) {
        setProteinError('Protein must be a valid number');
        isValid = false;
      } else if (parsedProtein > MAX_MACRO) {
        setProteinError(`Protein cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    if (carbs) {
      const parsedCarbs = parseFloat(carbs);
      if (isNaN(parsedCarbs) || !isFinite(parsedCarbs)) {
        setCarbsError('Carbs must be a valid number');
        isValid = false;
      } else if (parsedCarbs > MAX_MACRO) {
        setCarbsError(`Carbs cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    if (fat) {
      const parsedFat = parseFloat(fat);
      if (isNaN(parsedFat) || !isFinite(parsedFat)) {
        setFatError('Fat must be a valid number');
        isValid = false;
      } else if (parsedFat > MAX_MACRO) {
        setFatError(`Fat cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    if (fiber) {
      const parsedFiber = parseFloat(fiber);
      if (isNaN(parsedFiber) || !isFinite(parsedFiber)) {
        setFiberError('Fiber must be a valid number');
        isValid = false;
      } else if (parsedFiber > MAX_MACRO) {
        setFiberError(`Fiber cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    return isValid;
  }, [quantity, calories, protein, carbs, fat, fiber, MAX_QUANTITY, MAX_CALORIES, MAX_MACRO]);
  
  // Run validation whenever values change
  useEffect(() => {
    validateFields();
  }, [quantity, calories, protein, carbs, fat, fiber]);
  
  // Check if form is valid (for Save button) - don't call validateFields to avoid infinite loop
  const isFormValid = useCallback(() => {
    if (!itemName.trim()) return false;
    
    const parsedQuantity = parseFloat(quantity);
    if (!quantity || isNaN(parsedQuantity) || !isFinite(parsedQuantity) || parsedQuantity <= 0) return false;
    if (parsedQuantity > MAX_QUANTITY) return false;
    
    const parsedCalories = parseFloat(calories);
    if (!calories || calories.trim() === '' || isNaN(parsedCalories) || !isFinite(parsedCalories) || parsedCalories < 0) return false;
    if (parsedCalories > MAX_CALORIES) return false;
    
    // Check macros if provided
    if (protein) {
      const parsedProtein = parseFloat(protein);
      if (isNaN(parsedProtein) || !isFinite(parsedProtein) || parsedProtein > MAX_MACRO) return false;
    }
    if (carbs) {
      const parsedCarbs = parseFloat(carbs);
      if (isNaN(parsedCarbs) || !isFinite(parsedCarbs) || parsedCarbs > MAX_MACRO) return false;
    }
    if (fat) {
      const parsedFat = parseFloat(fat);
      if (isNaN(parsedFat) || !isFinite(parsedFat) || parsedFat > MAX_MACRO) return false;
    }
    if (fiber) {
      const parsedFiber = parseFloat(fiber);
      if (isNaN(parsedFiber) || !isFinite(parsedFiber) || parsedFiber > MAX_MACRO) return false;
    }
    
    return true;
  }, [itemName, quantity, calories, protein, carbs, fat, fiber, MAX_QUANTITY, MAX_CALORIES, MAX_MACRO]);

  // Handle Enter key press to submit form
  const handleFormSubmit = useCallback(() => {
    if (isFormValid() && !loading) {
      handleSave();
    }
  }, [isFormValid, loading]);
  
  // Calculate nutrients from ServingOption (new model per spec 8)
  // IMPORTANT: All nutrients in food_master are stored per serving_size × serving_unit
  // Example: skim milk with serving_size=250, serving_unit="ml", calories_kcal=85
  //          means 250 ml = 85 kcal, so 1 ml = 0.34 kcal
  const calculateNutrientsFromOption = useCallback((food: FoodMaster, option: ServingOption, qty: number) => {
    let masterUnits: number;
    
    if (option.kind === 'raw') {
      // For raw unit: convert quantity from selected unit to master unit
      try {
        masterUnits = convertToMasterUnit(qty, option.unit, food);
      } catch {
        // If conversion fails (shouldn't happen with proper unit filtering), use quantity directly
        masterUnits = qty;
      }
    } else {
      // For saved servings: use the correct field based on food's base unit type
      // - Weight-based foods (g, kg, oz, lb): use weight_g only
      // - Volume-based foods (ml, L, cup, tbsp, tsp, floz): use volume_ml only
      const servingValue = isVolumeUnit(food.serving_unit)
        ? (option.serving.volume_ml ?? 0)
        : (option.serving.weight_g ?? 0);
      masterUnits = servingValue * qty;
    }
    
    // Use the centralized calculation from nutritionMath
    const nutrients = calculateNutrientsSimple(food, masterUnits);
    
    // Update state with calculated values
    setCalories(nutrients.calories_kcal.toFixed(1));
    setProtein(nutrients.protein_g != null ? nutrients.protein_g.toFixed(1) : '');
    setCarbs(nutrients.carbs_g != null ? nutrients.carbs_g.toFixed(1) : '');
    setFat(nutrients.fat_g != null ? nutrients.fat_g.toFixed(1) : '');
    setFiber(nutrients.fiber_g != null ? nutrients.fiber_g.toFixed(1) : '');
    setSaturatedFat(nutrients.saturated_fat_g != null ? nutrients.saturated_fat_g.toFixed(1) : '');
    setSugar(nutrients.sugar_g != null ? nutrients.sugar_g.toFixed(1) : '');
    setSodium(nutrients.sodium_mg != null ? nutrients.sodium_mg.toFixed(1) : '');
  }, []);
  
  // Handle calories change with validation
  const handleCaloriesChange = useCallback((text: string) => {
    setCalories(validateNumericInput(text));
  }, []);

  // Fetch servings for a selected food - uses centralized data access
  // UI dropdown still uses buildServingOptions/getDefaultServingSelection for ServingOption types
  const fetchFoodServings = useCallback(async (foodId: string, food: FoodMaster) => {
    try {
      // Use centralized data access from lib/servings.ts
      const dbServings = await getServingsForFood(foodId);
      
      // Build serving options using UI helper (for dropdown)
      const options = buildServingOptions(food, dbServings);
      setAvailableServings(options);
      
      // Get default serving selection for UI (uses ServingOption type for dropdown)
      const { quantity: defaultQty, defaultOption } = getDefaultServingSelection(food, dbServings);
      setSelectedServing(defaultOption);
      setQuantity(defaultQty.toString());
      calculateNutrientsFromOption(food, defaultOption, defaultQty);
    } catch (error) {
      // On error, still show raw unit options
      const options = buildServingOptions(food, []);
      setAvailableServings(options);
      if (options.length > 0) {
        const { quantity: defaultQty, defaultOption } = getDefaultServingSelection(food, []);
        setSelectedServing(defaultOption);
        setQuantity(defaultQty.toString());
        calculateNutrientsFromOption(food, defaultOption, defaultQty);
      }
    }
  }, []);

  // Handle food selection from search results
  const handleFoodSelect = async (food: FoodMaster) => {
    // Set selected food
    setSelectedFood(food);
    setItemName(food.name + (food.brand ? ` (${food.brand})` : ''));
    setIsManualMode(false); // Close manual mode when food is selected
    
    // Fetch servings for this food
    await fetchFoodServings(food.id, food);
    
    // Clear search using shared hook
    clearSearch();
    
    // Auto-focus quantity input after a short delay
    setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 300);
  };

  /**
   * Quick Add - adds food entry with default serving immediately
   * Uses centralized serving logic from lib/servings.ts
   */
  const handleQuickAdd = async (food: FoodMaster) => {
    if (!user?.id) return;

    try {
      // 1. Fetch food servings using centralized data access
      const servings = await getServingsForFood(food.id);

      // 2. Get default serving using centralized logic (SINGLE SOURCE OF TRUTH)
      const defaultServing = getDefaultServingForFood(food, servings);

      // 3. Calculate nutrients using centralized logic (SINGLE SOURCE OF TRUTH)
      let nutrients: Nutrients;
      if (defaultServing.serving) {
        // Use the saved serving for calculation
        nutrients = computeNutrientsForFoodServing(food, defaultServing.serving, defaultServing.quantity);
      } else {
        // Using canonical fallback - nutrients match food_master
        nutrients = computeNutrientsForRawQuantity(food, defaultServing.quantity, defaultServing.unit);
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
        quantity: defaultServing.quantity,
        unit: defaultServing.unit,
        calories_kcal: Math.round(nutrients.calories_kcal),
        protein_g: nutrients.protein_g !== null ? Math.round(nutrients.protein_g * 10) / 10 : null,
        carbs_g: nutrients.carbs_g !== null ? Math.round(nutrients.carbs_g * 10) / 10 : null,
        fat_g: nutrients.fat_g !== null ? Math.round(nutrients.fat_g * 10) / 10 : null,
        fiber_g: nutrients.fiber_g !== null ? Math.round(nutrients.fiber_g * 10) / 10 : null,
      };

      // Include serving_id if it's a saved serving
      if (defaultServing.serving) {
        entryData.serving_id = defaultServing.serving.id;
      }

      // Include optional nutrients if available
      if (nutrients.saturated_fat_g !== null && nutrients.saturated_fat_g > 0) {
        entryData.saturated_fat_g = Math.round(nutrients.saturated_fat_g * 100) / 100;
      }
      if (nutrients.sugar_g !== null && nutrients.sugar_g > 0) {
        entryData.sugar_g = Math.round(nutrients.sugar_g * 100) / 100;
      }
      if (nutrients.sodium_mg !== null && nutrients.sodium_mg > 0) {
        entryData.sodium_mg = Math.round(nutrients.sodium_mg * 100) / 100;
      }

      // 5. Insert entry
      const { error: insertError } = await supabase
        .from('calorie_entries')
        .insert(entryData);

      if (insertError) {
        console.error('Quick add insert error:', insertError);
        Alert.alert(
          t('alerts.error_title'),
          t('mealtype_log.errors.quick_add_failed', { error: insertError.message })
        );
        return;
      }

      // 6. Success! Clear search and refresh entries
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
      // Open the scanner modal first - it will handle permission requests
      setScanned(false);
      setBarcodeScanning(false);
      setShowBarcodeScanner(true);
      setBarcodeScannerKey(prev => prev + 1); // Force remount
      
      // If permission is already granted, the camera will show immediately
      // If not, the modal will show the permission request screen
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      
      Alert.alert(
        t('alerts.error_title'),
        t('mealtype_log.scanner.open_failed', { error: errorMessage }),
        [{ text: t('common.ok') }]
      );
    }
  }, []);

  // Handle barcode scan result
  const handleBarcodeScanned = useCallback(async (result: { type: string; data: string }) => {
    if (scanned || barcodeScanning) return;
    
    const { data: barcodeData } = result;
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

  // Handle serving selection per spec 8.4
  const handleServingSelect = (option: ServingOption) => {
    setSelectedServing(option);
    setShowServingDropdown(false);
    
    if (selectedFood) {
      if (option.kind === 'raw') {
        // For raw units: keep current quantity, just change unit
        const qty = parseFloat(quantity) || 1;
        calculateNutrientsFromOption(selectedFood, option, qty);
      } else {
        // For saved servings: optionally reset quantity to 1
        const qty = parseFloat(quantity) || 1;
        calculateNutrientsFromOption(selectedFood, option, qty);
      }
    }
  };

  // Handle quantity change - recalculate nutrients if food and serving are selected
  const handleQuantityChange = useCallback((text: string) => {
    const cleaned = validateNumericInput(text);
    setQuantity(cleaned);
    if (selectedFood && selectedServing && cleaned) {
      const qty = parseFloat(cleaned) || 0;
      if (qty > 0) {
        calculateNutrientsFromOption(selectedFood, selectedServing, qty);
      }
    }
  }, [selectedFood, selectedServing, calculateNutrientsFromOption]);

  // Calculate weight/volume in master units for display
  const calculatedWeight = selectedFood && selectedServing && quantity
    ? (() => {
        const qty = parseFloat(quantity || '0');
        if (selectedServing.kind === 'raw') {
          // For raw units: convert to master unit
          try {
            return convertToMasterUnit(qty, selectedServing.unit, selectedFood).toFixed(1);
          } catch {
            return qty.toFixed(1);
          }
        } else {
          // For saved servings: use volume_ml for volume-based foods, weight_g for weight-based
          const servingValue = isVolumeUnit(selectedFood.serving_unit)
            ? (selectedServing.serving.volume_ml ?? 0)
            : (selectedServing.serving.weight_g ?? 0);
          return (servingValue * qty).toFixed(1);
        }
      })()
    : '';

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
                    <ThemedText style={[styles.calendarDropdownArrow, { color: colors.icon }]}>▼</ThemedText>
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
                      <ThemedText style={[styles.calendarWeekDayText, { color: colors.icon }]}>
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
              onPress={() => router.replace({
                pathname: '/(tabs)',
                params: {
                  date: entryDate
                }
              })}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                'Go back to home',
                'Double tap to return to the home screen'
              )}
            >
              <ThemedText style={[styles.backArrow, { color: colors.tint }]}>←</ThemedText>
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <ThemedText style={[styles.mainTitle, { color: colors.text }]}>🍴 {t('mealtype_log.title')}</ThemedText>
            </View>
            <View style={styles.headerRight}>
              {editingEntryId || (!editingEntryId && selectedFood) || isManualMode ? (
                <TouchableOpacity
                  style={[
                    styles.checkmarkButton,
                    {
                      opacity: (loading || !isFormValid()) ? 0.4 : 1,
                    }
                  ]}
                  onPress={handleSave}
                  disabled={loading || !isFormValid()}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    name="checkmark" 
                    size={24} 
                    color={(loading || !isFormValid()) ? colors.icon : colors.tint}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.placeholder} />
              )}
            </View>
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
                  { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
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
            <ThemedText style={[styles.subHeaderSeparator, { color: colors.icon }]}> • </ThemedText>
            <TouchableOpacity
              style={[
                getMinTouchTargetStyle(),
                { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
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

        {/* Search Bar - Hide when editing, when food is selected, or when in manual mode */}
        {!editingEntryId && !selectedFood && !isManualMode && (
          <View style={styles.searchContainer}>
            <View style={[
              styles.searchInputWrapper,
              { 
                borderColor: colors.icon + '20', 
                backgroundColor: colors.background,
              }
            ]}>
              <IconSymbol
                name="magnifyingglass"
                size={18}
                color={colors.icon}
                style={styles.searchIconLeft}
              />
              <TextInput
                style={[
                  styles.searchInput, 
                  { 
                    color: colors.text, 
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  }
                ]}
                placeholder={t('mealtype_log.search_placeholder')}
                placeholderTextColor={colors.icon}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
                {...getInputAccessibilityProps(
                  'Search for food',
                  'Type to search for food items to add to your meal'
                )}
                {...getWebAccessibilityProps(
                  'searchbox',
                  'Search for food'
                )}
              />
              {searchLoading && (
                <ActivityIndicator 
                  size="small" 
                  color={colors.tint} 
                  style={styles.searchLoader}
                  accessible={true}
                  accessibilityLabel={t('mealtype_log.accessibility.searching')}
                />
              )}
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

            {/* Floating Search Results Overlay - positioned above tabs */}
            {showSearchResults && searchResults.length > 0 && (
              <View
                style={[
                  styles.searchResultsOverlay,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.tint + '40',
                  },
                ]}
              >
                <ScrollView
                  style={styles.searchResultsList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {searchResults.map((food, index) => (
                    <View
                      key={food.id}
                      style={[
                        styles.searchResultItemRow,
                        { 
                          borderBottomColor: colors.icon + '15',
                          backgroundColor: colors.background,
                        },
                        index === searchResults.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.searchResultTouchable}
                        onPress={() => handleFoodSelect(food)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.searchResultContent}>
                          <ThemedText style={[styles.searchResultName, { color: colors.text }]}>
                            {food.name}
                          </ThemedText>
                          {food.brand && (
                            <ThemedText style={[styles.searchResultBrand, { color: colors.icon }]}>
                              {food.brand}
                            </ThemedText>
                          )}
                          <ThemedText style={[styles.searchResultNutrition, { color: colors.icon }]}>
                            {food.defaultServingQty} {food.defaultServingUnit} • {food.defaultServingCalories} kcal
                          </ThemedText>
                        </View>
                      </TouchableOpacity>
                      {/* Quick Add Button */}
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
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Tabs - Hide when food is selected, editing, or in manual mode */}
        {!selectedFood && !editingEntryId && !isManualMode && (
          <>
            <View style={[styles.tabsContainerWrapper, { borderBottomColor: colors.icon + '15' }]} accessibilityRole="tablist">
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
                  <ThemedText style={[styles.tabsScrollArrowText, { color: colors.icon }]}>‹</ThemedText>
                </TouchableOpacity>
              )}
              
              <ScrollView 
                ref={tabsScrollViewRef}
                horizontal 
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.tabsContainer}
                style={styles.tabsScrollView}
                scrollIndicatorInsets={{ bottom: -1 }}
                onScroll={handleTabsScroll}
                onContentSizeChange={handleTabsContentSizeChange}
                scrollEventThrottle={16}
              >
                <TabBar
                  tabs={[
                    {
                      key: 'frequent',
                      label: t('mealtype_log.tabs.frequent'),
                      activeColor: getTabColor('frequent', true),
                      inactiveColor: getTabColor('frequent', false),
                      accessibilityLabel: t('mealtype_log.accessibility.frequent_tab'),
                    },
                    {
                      key: 'recent',
                      label: t('mealtype_log.tabs.recent'),
                      activeColor: getTabColor('recent', true),
                      inactiveColor: getTabColor('recent', false),
                      accessibilityLabel: t('mealtype_log.accessibility.recent_tab'),
                    },
                    {
                      key: 'custom',
                      label: t('mealtype_log.tabs.custom'),
                      activeColor: getTabColor('custom', true),
                      inactiveColor: getTabColor('custom', false),
                      accessibilityLabel: t('mealtype_log.accessibility.custom_tab'),
                    },
                    {
                      key: 'bundle',
                      label: t('mealtype_log.tabs.bundles'),
                      activeColor: getTabColor('bundle', true),
                      inactiveColor: getTabColor('bundle', false),
                      accessibilityLabel: t('mealtype_log.accessibility.bundles_tab'),
                    },
                    {
                      key: 'manual',
                      label: t('mealtype_log.tabs.manual'),
                      activeColor: getTabColor('manual', true),
                      inactiveColor: getTabColor('manual', false),
                      accessibilityLabel: t('mealtype_log.accessibility.manual_tab'),
                      renderLabel: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ThemedText style={[
                            styles.tabText,
                            { color: getTabColor('manual', activeTab === 'manual') }
                          ]}>
                            {t('mealtype_log.tabs.manual')}
                          </ThemedText>
                          <ThemedText style={[
                            styles.tabText,
                            { 
                              color: getTabColor('manual', activeTab === 'manual'),
                              fontSize: 20,
                              fontWeight: 'bold',
                              lineHeight: 20,
                              marginLeft: 4
                            }
                          ]}>
                            +
                          </ThemedText>
                        </View>
                      ),
                    },
                  ]}
                  activeKey={activeTab}
                  onTabPress={(key) => {
                    if (key === 'manual') {
                      handleTabPress('manual', () => {
                        setIsManualMode(true);
                        setSelectedFood(null);
                        setEditingEntryId(null);
                        // Clear form fields without resetting isManualMode
                        setItemName('');
                        setQuantity('1');
                        setUnit('plate');
                        setCalories('');
                        setProtein('');
                        setCarbs('');
                        setFat('');
                        setFiber('');
                        setSaturatedFat('');
                        setSugar('');
                        setSodium('');
                        setSelectedServing(null);
                        setAvailableServings([]);
                        setItemNameError('');
                        setQuantityError('');
                        setCaloriesError('');
                      });
                    } else {
                      handleTabPress(key as 'frequent' | 'recent' | 'custom' | 'bundle', () => setIsManualMode(false));
                    }
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
                  <ThemedText style={[styles.tabsScrollArrowText, { color: colors.icon }]}>›</ThemedText>
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
                  <ThemedText style={[styles.collapsedHintText, { color: colors.icon, fontSize: 11, marginRight: 6 }]}>
                    {t('mealtype_log.tap_to_expand')}
                  </ThemedText>
                  <IconSymbol
                    name="chevron.down"
                    size={14}
                    color={colors.icon}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Tab Content - Animated */}
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
                                <ThemedText style={[styles.emptyTabText, { color: colors.icon, marginTop: 8 }]}>
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
                                    const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} kcal`;
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
                                              style={[styles.searchResultNutrition, { color: colors.icon, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                              numberOfLines={1}
                                            >
                                              {rightSideText}
                                            </ThemedText>
                                          </TouchableOpacity>
                                          <View style={[styles.sourceBadge, { 
                                            backgroundColor: isCustom ? colors.tint + '20' : '#3B82F6' + '20',
                                            borderColor: isCustom ? colors.tint + '40' : '#3B82F6' + '40',
                                            marginLeft: 6
                                          }]}>
                                            <ThemedText style={[styles.sourceBadgeText, { 
                                              color: isCustom ? colors.tint : '#3B82F6'
                                            }]}>
                                              {isCustom ? 'Custom' : 'Database'}
                                            </ThemedText>
                                          </View>
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
                                <ThemedText style={[styles.emptyTabText, { color: colors.icon, marginTop: 8 }]}>
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
                                    const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} kcal`;
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
                                              style={[styles.searchResultNutrition, { color: colors.icon, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                              numberOfLines={1}
                                            >
                                              {rightSideText}
                                            </ThemedText>
                                          </TouchableOpacity>
                                          <View style={[styles.sourceBadge, { 
                                            backgroundColor: isCustom ? colors.tint + '20' : '#3B82F6' + '20',
                                            borderColor: isCustom ? colors.tint + '40' : '#3B82F6' + '40',
                                            marginLeft: 6
                                          }]}>
                                            <ThemedText style={[styles.sourceBadgeText, { 
                                              color: isCustom ? colors.tint : '#3B82F6'
                                            }]}>
                                              {isCustom ? 'Custom' : 'Database'}
                                            </ThemedText>
                                          </View>
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
                            ) : (
                              <View style={styles.emptyTabState}>
                                <ThemedText style={[styles.emptyTabText, { color: colors.icon }]}>
                                  {t('mealtype_log.recent_foods.empty')}
                                </ThemedText>
                                <ThemedText style={[styles.emptyTabSubtext, { color: colors.icon }]}>
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
                        {!searchQuery && (
                          <>
                            {/* Create New Custom Food Button */}
                            <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('custom'), borderColor: colors.icon + '20', marginBottom: customFoodsLoading || customFoods.length === 0 ? 0 : 0 }]}>
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
                                <ThemedText style={[styles.emptyTabText, { color: colors.icon, marginTop: 12 }]}>
                                  {t('mealtype_log.custom_foods.loading')}
                                </ThemedText>
                              </View>
                            ) : customFoods.length > 0 ? (
                              <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('custom'), borderColor: colors.icon + '20' }]}>
                                <ScrollView 
                                  style={styles.searchResultsList}
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
                                      const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} kcal`;
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
                                                  style={[styles.searchResultNutrition, { color: colors.icon, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
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
                                                    paddingHorizontal: 8, 
                                                    paddingVertical: 4,
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
                                                    paddingHorizontal: 8, 
                                                    paddingVertical: 4,
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
                                <ThemedText style={[styles.emptyTabText, { color: colors.icon }]}>
                                  {t('mealtype_log.custom_foods.empty')}
                                </ThemedText>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    );
                  
                  case 'bundle':
                    return (
                      <View style={styles.tabContent}>
                        {/* Create New Bundle Button */}
                        <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('bundle'), borderColor: colors.icon + '20', marginBottom: bundlesLoading || bundles.length === 0 ? 0 : 0 }]}>
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
                                  entryDate: entryDate || new Date().toISOString().split('T')[0],
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
                            <ThemedText style={[styles.emptyTabText, { color: colors.icon, marginTop: 12 }]}>
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
                                <HighlightableItem
                                  key={bundle.id}
                                  isHighlighted={isBundleNewlyAdded(bundle.id)}
                                  animationValue={getBundleAnimationValue(bundle.id)}
                                  style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                                >
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <ThemedText 
                                      style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: bundleEditMode ? 0 : 4 }]}
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                    >
                                      {bundle.name}{' '}
                                      <ThemedText style={{ color: colors.icon, fontSize: 11 }}>
                                        ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                                      </ThemedText>
                                    </ThemedText>
                                    {!bundleEditMode && (
                                      <>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                                          {bundle.totalCalories !== undefined && (
                                            <ThemedText style={[styles.searchResultNutrition, { color: colors.tint, fontSize: 12, fontWeight: '600' }]}>
                                              {bundle.totalCalories} kcal
                                            </ThemedText>
                                          )}
                                          {(bundle.totalProtein || bundle.totalCarbs || bundle.totalFat || bundle.totalFiber) && (
                                            <>
                                              <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 8 }]}>
                                                •
                                              </ThemedText>
                                              {bundle.totalProtein ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
                                                  P: {bundle.totalProtein}g
                                                </ThemedText>
                                              ) : null}
                                              {bundle.totalCarbs ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
                                                  C: {bundle.totalCarbs}g
                                                </ThemedText>
                                              ) : null}
                                              {bundle.totalFat ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
                                                  Fat: {bundle.totalFat}g
                                                </ThemedText>
                                              ) : null}
                                              {bundle.totalFiber ? (
                                                <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
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
                                      </>
                                    )}
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                                    {bundleEditMode ? (
                                      <>
                                        <TouchableOpacity
                                          style={[styles.editButton, { backgroundColor: colors.icon + '20', borderColor: colors.icon + '40', marginRight: 4, paddingHorizontal: 8, paddingVertical: 4 }]}
                                          onPress={() => handleMoveBundleUp(bundle.id)}
                                          disabled={bundles.findIndex(b => b.id === bundle.id) === 0}
                                          activeOpacity={0.7}
                                        >
                                          <Text style={[styles.editButtonText, { color: colors.text, fontSize: 14 }]}>↑</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={[styles.editButton, { backgroundColor: colors.icon + '20', borderColor: colors.icon + '40', marginRight: 6, paddingHorizontal: 8, paddingVertical: 4 }]}
                                          onPress={() => handleMoveBundleDown(bundle.id)}
                                          disabled={bundles.findIndex(b => b.id === bundle.id) === bundles.length - 1}
                                          activeOpacity={0.7}
                                        >
                                          <Text style={[styles.editButtonText, { color: colors.text, fontSize: 14 }]}>↓</Text>
                                        </TouchableOpacity>
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
                                      </>
                                    ) : (
                                      <TouchableOpacity
                                        style={{ 
                                          backgroundColor: loading ? colors.icon + '60' : colors.tint, 
                                          paddingHorizontal: 14, 
                                          paddingVertical: 8, 
                                          borderRadius: 8,
                                          opacity: loading ? 0.7 : (colorScheme === 'dark' ? 0.75 : 1),
                                          ...Platform.select({
                                            web: {
                                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                                              transition: 'all 0.2s ease',
                                              cursor: loading ? 'not-allowed' : 'pointer',
                                            },
                                            default: {
                                              shadowOffset: { width: 0, height: 4 },
                                              shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.25,
                                              shadowRadius: 8,
                                              elevation: 5,
                                            },
                                          }),
                                        }}
                                        onPress={() => {
                                          if (!loading) {
                                            handleAddBundleToMeal(bundle);
                                          }
                                        }}
                                        disabled={loading}
                                        activeOpacity={0.7}
                                        accessibilityLabel={t('mealtype_log.add_bundle.label')}
                                        accessibilityHint={t('mealtype_log.add_bundle.hint')}
                                      >
                                        <ThemedText style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                                          {t('mealtype_log.add_bundle.button')}
                                        </ThemedText>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </HighlightableItem>
                              ))}
                            </ScrollView>
                          </View>
                        ) : (
                          <View style={styles.emptyTabState}>
                            <ThemedText style={[styles.emptyTabText, { color: colors.icon }]}>
                              {t('mealtype_log.bundles.empty')}
                            </ThemedText>
                            <ThemedText style={[styles.emptyTabSubtext, { color: colors.icon }]}>
                              {t('mealtype_log.bundles.hint')}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    );
                  
                  case 'manual':
                    return null; // Manual mode is handled separately
                  
                  default:
                    return null;
                }
              }}
            />
          </>
        )}

        {/* Add/Edit Form - Show when a food is selected, when editing, or in manual mode */}
                  <View style={styles.emptyTabState}>
                    <ActivityIndicator size="small" color={colors.tint} />
                    <ThemedText style={[styles.emptyTabText, { color: colors.icon, marginTop: 8 }]}>
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
                        const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} kcal`;
                        const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                        const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                        const rightSideText = `${brandText}${nutritionInfo}`;

                        // Determine if food is custom - simple check: is_custom === true
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
                                  style={[styles.searchResultNutrition, { color: colors.icon, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                  numberOfLines={1}
                                >
                                  {rightSideText}
                                </ThemedText>
                              </TouchableOpacity>
                              <View style={[styles.sourceBadge, { 
                                backgroundColor: isCustom ? colors.tint + '20' : '#3B82F6' + '20',
                                borderColor: isCustom ? colors.tint + '40' : '#3B82F6' + '40',
                                marginLeft: 6
                              }]}>
                                <ThemedText style={[styles.sourceBadgeText, { 
                                  color: isCustom ? colors.tint : '#3B82F6'
                                }]}>
                                  {isCustom ? 'Custom' : 'Database'}
                                </ThemedText>
                              </View>
                              {/* Quick Add Button */}
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
                ) : (
                  <View style={styles.emptyTabState}>
                    <ThemedText style={[styles.emptyTabText, { color: colors.icon }]}>
                      {t('mealtype_log.recent_foods.empty')}
                    </ThemedText>
                    <ThemedText style={[styles.emptyTabSubtext, { color: colors.icon }]}>
                      {t('mealtype_log.recent_foods.hint')}
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {activeTab === 'custom' && !tabContentCollapsed && (
          <View style={styles.tabContent}>
            {/* Custom Foods Content - only show when not searching */}
            {!searchQuery && (
              <>
                {/* Create New Custom Food Button - Always visible */}
                <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('custom'), borderColor: colors.icon + '20', marginBottom: customFoodsLoading || customFoods.length === 0 ? 0 : 0 }]}>
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

                {/* Loading state or food list */}
                {customFoodsLoading ? (
                  <View style={styles.emptyTabState}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <ThemedText style={[styles.emptyTabText, { color: colors.icon, marginTop: 12 }]}>
                      {t('mealtype_log.custom_foods.loading')}
                    </ThemedText>
                  </View>
                ) : customFoods.length > 0 ? (
                  <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('custom'), borderColor: colors.icon + '20' }]}>
                    <ScrollView 
                      style={styles.searchResultsList}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {(() => {
        // Sort custom foods: newly added/edited food first, then maintain current order (from state)
        // The state already reflects the order_index order from the database
        // When in edit mode, don't re-sort - preserve the current order for reordering
        let sortedFoods;
        if (customFoodEditMode) {
          // In edit mode, maintain exact order from state (no sorting)
          sortedFoods = [...customFoods];
          // Only move newly added/edited items to top if they exist
          const newlyAddedIndex = sortedFoods.findIndex(f => f.id === newlyAddedFoodId.current || f.id === newlyEditedFoodId.current);
          if (newlyAddedIndex > 0) {
            const newlyAdded = sortedFoods.splice(newlyAddedIndex, 1)[0];
            sortedFoods.unshift(newlyAdded);
          }
        } else {
          // Not in edit mode - sort normally
          sortedFoods = [...customFoods].sort((a, b) => {
            if (newlyAddedFoodId.current === a.id || newlyEditedFoodId.current === a.id) return -1;
            if (newlyAddedFoodId.current === b.id || newlyEditedFoodId.current === b.id) return 1;
            // Maintain the current order from state (which reflects order_index)
            const indexA = customFoods.findIndex(f => f.id === a.id);
            const indexB = customFoods.findIndex(f => f.id === b.id);
            return indexA - indexB;
          });
        }
        
        return sortedFoods.map((food) => {
          const isNewlyAdded = newlyAddedFoodId.current === food.id;
          const isNewlyEdited = newlyEditedFoodId.current === food.id;
                          const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                          // Use pre-computed default serving info from centralized logic
                          const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} kcal`;
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
                                    style={[styles.searchResultNutrition, { color: colors.icon, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                                    numberOfLines={1}
                                  >
                                    {rightSideText}
                                  </ThemedText>
                                )}
                              </TouchableOpacity>
                            </View>
                            {customFoodEditMode && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                                {/* Order arrows */}
                                <TouchableOpacity
                                  style={[
                                    styles.editButton, 
                                    { 
                                      backgroundColor: colors.icon + '20', 
                                      borderColor: colors.icon + '40', 
                                      marginRight: 4, 
                                      paddingHorizontal: 8, 
                                      paddingVertical: 4,
                                      opacity: sortedFoods.findIndex(f => f.id === food.id) === 0 ? 0.5 : 1,
                                    }
                                  ]}
                                  onPress={() => {
                                    handleMoveCustomFoodUp(food.id);
                                  }}
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
                                      paddingHorizontal: 8, 
                                      paddingVertical: 4,
                                      opacity: sortedFoods.findIndex(f => f.id === food.id) === sortedFoods.length - 1 ? 0.5 : 1,
                                    }
                                  ]}
                                  onPress={() => {
                                    handleMoveCustomFoodDown(food.id);
                                  }}
                                  disabled={sortedFoods.findIndex(f => f.id === food.id) === sortedFoods.length - 1}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.editButtonText, { color: colors.text, fontSize: 14 }]}>↓</Text>
                                </TouchableOpacity>
                                {/* Delete button */}
                                <TouchableOpacity
                                  style={[styles.deleteButton, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', marginRight: 6 }]}
                                  onPress={() => {
                                    handleDeleteCustomFood(food);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                                </TouchableOpacity>
                                {/* Edit button - edit the custom food record */}
                                <TouchableOpacity
                                  style={[styles.editButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40' }]}
                                  onPress={() => {
                                    // Navigate to create-custom-food page for editing
                                    router.push({
                                      pathname: '/create-custom-food',
                                      params: {
                                        mealType: mealType || 'breakfast',
                                        entryDate: entryDate || getLocalDateString(),
                                        foodId: food.id, // Pass food ID for editing
                                      },
                                    });
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.editButtonText, { color: colors.tint }]}>✏️</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            {/* Clone button - shown in non-edit mode */}
                            {!customFoodEditMode && (
                              <>
                                <TouchableOpacity
                                  style={[styles.editButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40', marginLeft: 6 }]}
                                  onPress={() => {
                                    // Navigate to create-custom-food page for cloning
                                    router.push({
                                      pathname: '/create-custom-food',
                                      params: {
                                        mealType: mealType || 'breakfast',
                                        entryDate: entryDate || getLocalDateString(),
                                        cloneFoodId: food.id, // Pass food ID for cloning
                                      },
                                    });
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.editButtonText, { color: colors.tint }]}>⧉</Text>
                                </TouchableOpacity>
                                {/* Quick Add Button */}
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
                    <ThemedText style={[styles.emptyTabText, { color: colors.icon }]}>
                      {t('mealtype_log.custom_foods.empty')}
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </View>
        )}
        {activeTab === 'bundle' && !tabContentCollapsed && (
          <View style={styles.tabContent}>
            {/* Create New Bundle Button - Always visible */}
            <View style={[styles.searchResultsContainer, { backgroundColor: getTabListBackgroundColor('bundle'), borderColor: colors.icon + '20', marginBottom: bundlesLoading || bundles.length === 0 ? 0 : 0 }]}>
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
                      entryDate: entryDate || new Date().toISOString().split('T')[0],
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

            {/* Loading state or bundle list */}
            {bundlesLoading ? (
              <View style={styles.emptyTabState}>
                <ActivityIndicator size="large" color={colors.tint} />
                <ThemedText style={[styles.emptyTabText, { color: colors.icon, marginTop: 12 }]}>
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
                    <HighlightableItem
                      key={bundle.id}
                      isHighlighted={isBundleNewlyAdded(bundle.id)}
                      animationValue={getBundleAnimationValue(bundle.id)}
                      style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <ThemedText 
                          style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: bundleEditMode ? 0 : 4 }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {bundle.name}{' '}
                          <ThemedText style={{ color: colors.icon, fontSize: 11 }}>
                            ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                          </ThemedText>
                        </ThemedText>
                        {!bundleEditMode && (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                              {bundle.totalCalories !== undefined && (
                                <ThemedText style={[styles.searchResultNutrition, { color: colors.tint, fontSize: 12, fontWeight: '600' }]}>
                                  {bundle.totalCalories} kcal
                                </ThemedText>
                              )}
                              {(bundle.totalProtein || bundle.totalCarbs || bundle.totalFat || bundle.totalFiber) && (
                                <>
                                  <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 8 }]}>
                                    •
                                  </ThemedText>
                                  {bundle.totalProtein ? (
                                    <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
                                      P: {bundle.totalProtein}g
                                    </ThemedText>
                                  ) : null}
                                  {bundle.totalCarbs ? (
                                    <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
                                      C: {bundle.totalCarbs}g
                                    </ThemedText>
                                  ) : null}
                                  {bundle.totalFat ? (
                                    <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
                                      Fat: {bundle.totalFat}g
                                    </ThemedText>
                                  ) : null}
                                  {bundle.totalFiber ? (
                                    <ThemedText style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginLeft: 4 }]}>
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
                          </>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                        {bundleEditMode ? (
                          <>
                            {/* Order arrows */}
                            <TouchableOpacity
                              style={[styles.editButton, { backgroundColor: colors.icon + '20', borderColor: colors.icon + '40', marginRight: 4, paddingHorizontal: 8, paddingVertical: 4 }]}
                              onPress={() => handleMoveBundleUp(bundle.id)}
                              disabled={bundles.findIndex(b => b.id === bundle.id) === 0}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.editButtonText, { color: colors.text, fontSize: 14 }]}>↑</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.editButton, { backgroundColor: colors.icon + '20', borderColor: colors.icon + '40', marginRight: 6, paddingHorizontal: 8, paddingVertical: 4 }]}
                              onPress={() => handleMoveBundleDown(bundle.id)}
                              disabled={bundles.findIndex(b => b.id === bundle.id) === bundles.length - 1}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.editButtonText, { color: colors.text, fontSize: 14 }]}>↓</Text>
                            </TouchableOpacity>
                            {/* Delete button */}
                            <TouchableOpacity
                              style={[styles.deleteButton, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', marginRight: 6 }]}
                              onPress={() => {
                                handleDeleteBundle(bundle);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                            </TouchableOpacity>
                            {/* Edit button */}
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
                          </>
                        ) : (
                          /* + to Log button - only shown when not in edit mode */
                          <TouchableOpacity
                            style={{ 
                              backgroundColor: loading ? colors.icon + '60' : colors.tint, 
                              paddingHorizontal: 14, 
                              paddingVertical: 8, 
                              borderRadius: 8,
                              opacity: loading ? 0.7 : (colorScheme === 'dark' ? 0.75 : 1),
                              ...Platform.select({
                                web: {
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                                  transition: 'all 0.2s ease',
                                  cursor: loading ? 'not-allowed' : 'pointer',
                                },
                                default: {
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.25,
                                  shadowRadius: 8,
                                  elevation: 5,
                                },
                              }),
                            }}
                            onPress={() => {
                              if (!loading) {
                                handleAddBundleToMeal(bundle);
                              }
                            }}
                            disabled={loading}
                            activeOpacity={0.8}
                          >
                            {loading ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
                                + to Log
                              </ThemedText>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </HighlightableItem>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.emptyTabState}>
                <ThemedText style={[styles.emptyTabText, { color: colors.icon }]}>
                  {t('mealtype_log.bundles.empty')}
                </ThemedText>
                <ThemedText style={[styles.emptyTabSubtext, { color: colors.text, marginTop: 4 }]}>
                  <ThemedText style={{ fontWeight: '700', fontSize: 12 }}>{t('mealtype_log.bundles.example_hint')}</ThemedText>{'\n'}{t('mealtype_log.bundles.example_desc')}
                </ThemedText>
              </View>
            )}
          </View>
        )}
        {activeTab === 'manual' && !isManualMode && !tabContentCollapsed && (
          <View style={styles.tabContent}>
            <View style={styles.emptyTabState}>
              <ThemedText style={[styles.emptyTabText, { color: colors.icon }]}>
                {t('mealtype_log.manual_entry.title')}
              </ThemedText>
              <ThemedText style={[styles.emptyTabSubtext, { color: colors.icon }]}>
                {t('mealtype_log.manual_entry.hint')}
              </ThemedText>
            </View>
          </View>
        )}
          </>
        )}

        {/* Add/Edit Form - Show when a food is selected, when editing, or in manual mode */}
        {(selectedFood || editingEntryId || isManualMode) && (
          <View style={[styles.formCard, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              {selectedFood ? (
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ThemedText style={[styles.selectedFoodName, { color: colors.text }]}>
                      {selectedFood.name}{selectedFood.brand ? ` (${selectedFood.brand})` : ''}
                    </ThemedText>
                    {/* Source indicator badge - show when food is selected */}
                    {(() => {
                      // Simple check: is_custom === true
                      const isCustom = selectedFood.is_custom === true;
                      return (
                        <View style={[styles.sourceBadge, { 
                          backgroundColor: isCustom ? colors.tint + '20' : '#3B82F6' + '20',
                          borderColor: isCustom ? colors.tint + '40' : '#3B82F6' + '40',
                          marginLeft: 8
                        }]}>
                          <ThemedText style={[styles.sourceBadgeText, { 
                            color: isCustom ? colors.tint : '#3B82F6'
                          }]}>
                            {isCustom ? 'Custom' : 'Database'}
                          </ThemedText>
                        </View>
                      );
                    })()}
                  </View>
                  {/* Default serving info - uses centralized default serving logic */}
                  <ThemedText style={{ fontSize: 11, color: colors.icon, marginTop: -2 }}>
                    {quantity} × {selectedServing?.label || `${selectedFood.serving_size} ${selectedFood.serving_unit}`} = {calories || selectedFood.calories_kcal} kcal
                  </ThemedText>
                </View>
              ) : editingEntryId ? (
                <ThemedText style={[styles.selectedFoodName, { color: colors.text, flex: 1 }]}>
                  Edit Entry
                </ThemedText>
              ) : isManualMode ? (
                <ThemedText style={[styles.selectedFoodName, { color: colors.text, flex: 1 }]}>
                  Manual
                </ThemedText>
              ) : null}
              {/* Source indicator badge - show when editing or in manual mode, but not when selectedFood exists (already shown above) */}
              {(editingEntryId || isManualMode) && !selectedFood && (
                <View style={[
                  styles.sourceBadge,
                  {
                    backgroundColor: colors.icon + '20',
                    borderColor: colors.icon + '40',
                  }
                ]}>
                  <ThemedText style={[
                    styles.sourceBadgeText,
                    {
                      color: colors.icon,
                    }
                  ]}>
                    {isManualMode ? 'Manual' : 'Manual'}
                  </ThemedText>
                </View>
              )}
            </View>
            
            <View style={styles.form}>

            {/* Food Item and Calories on same line - Show when editing entry without food_id or in manual mode */}
            {((editingEntryId && !selectedFood) || isManualMode) && (
              <View style={styles.row}>
                <View style={[styles.field, { flex: 3, marginRight: 8 }]}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('mealtype_log.form.food_item_required')}</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        borderColor: itemNameError ? '#EF4444' : colors.icon + '20', 
                        color: colors.text,
                        borderRadius: 10,
                        ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                      }
                    ]}
                    placeholder={t('mealtype_log.form.food_item_placeholder')}
                    placeholderTextColor={colors.icon}
                    value={itemName}
                    onChangeText={setItemName}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
                    {...getInputAccessibilityProps(
                      'Food item name',
                      'Enter the name of the food item',
                      itemNameError || undefined,
                      true
                    )}
                    {...getWebAccessibilityProps(
                      'textbox',
                      'Food item name',
                      itemNameError ? 'item-name-error' : undefined,
                      !!itemNameError,
                      true
                    )}
                  />
                  {itemNameError ? (
                    <Text style={styles.errorText}>{itemNameError}</Text>
                  ) : null}
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('mealtype_log.form.calories_required')}</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        borderColor: caloriesError ? '#EF4444' : colors.icon + '20', 
                        color: colors.text,
                        ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                      }
                    ]}
                    placeholder="0"
                    placeholderTextColor={colors.icon}
                    value={calories}
                    onChangeText={(text) => {
                      handleCaloriesChange(text);
                    }}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
                    {...getInputAccessibilityProps(
                      'Calories',
                      'Enter the number of calories in kilocalories',
                      caloriesError || undefined,
                      true
                    )}
                    {...getWebAccessibilityProps(
                      'textbox',
                      'Calories',
                      caloriesError ? 'calories-error' : undefined,
                      !!caloriesError,
                      true
                    )}
                  />
                  {caloriesError ? (
                    <Text style={styles.errorText}>{caloriesError}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Quantity and Unit fields - Show when editing entry without food_id or in manual mode */}
            {((editingEntryId && !selectedFood) || isManualMode) && (
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('mealtype_log.form.quantity_required')}</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        borderColor: quantityError ? '#EF4444' : colors.icon + '20', 
                        color: colors.text,
                        ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                      }
                    ]}
                    placeholder="1"
                    placeholderTextColor={colors.icon}
                    value={quantity}
                    onChangeText={(text) => setQuantity(validateNumericInput(text))}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
                    {...getInputAccessibilityProps(
                      'Quantity',
                      'Enter the quantity of food',
                      quantityError || undefined,
                      true
                    )}
                    {...getWebAccessibilityProps(
                      'textbox',
                      'Quantity',
                      quantityError ? 'quantity-error' : undefined,
                      !!quantityError,
                      true
                    )}
                  />
                  {quantityError ? (
                    <Text style={styles.errorText}>{quantityError}</Text>
                  ) : null}
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('mealtype_log.form.unit')}</ThemedText>
                  <TextInput
                    style={[
                      styles.input, 
                      { 
                        borderColor: colors.icon + '20', 
                        color: colors.text,
                        ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                      }
                    ]}
                    placeholder="plate"
                    placeholderTextColor={colors.icon}
                    value={unit}
                    onChangeText={setUnit}
                    maxLength={14}
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
                    {...getInputAccessibilityProps(
                      'Unit',
                      'Enter the unit of measurement'
                    )}
                    {...getWebAccessibilityProps(
                      'textbox',
                      'Unit'
                    )}
                  />
                </View>
              </View>
            )}

            {/* Qty and Serving on the same line - inline - Only show when food is selected */}
            {selectedFood && (
              <View style={styles.field}>
              <View style={[styles.inlineRow, { alignItems: 'center', gap: 6 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ThemedText style={[styles.inlineLabel, { color: colors.text }]}>
                    Qty *
                  </ThemedText>
                  <TextInput
                    ref={quantityInputRef}
                    style={[
                      styles.inlineInput,
                      { 
                        borderColor: quantityError ? '#EF4444' : colors.icon + '30', 
                        color: colors.text,
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 4,
                        paddingVertical: 6,
                        width: 45,
                        textAlign: 'center',
                      }
                    ]}
                    placeholder="1"
                    placeholderTextColor={colors.icon}
                    value={quantity}
                    onChangeText={handleQuantityChange}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
                  />
                </View>
                
                {/* Multiplier symbol between qty and serving */}
                {selectedFood && availableServings.length > 0 && (
                  <ThemedText style={{ color: colors.icon, fontSize: 14 }}>×</ThemedText>
                )}
                
                {/* Serving Selection (if food from food_master is selected) */}
                {selectedFood && availableServings.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    {editingEntryId && (
                      <ThemedText style={[styles.inlineLabel, { color: colors.text }]}>
                        Unit
                      </ThemedText>
                    )}
                    <View
                      ref={servingButtonRef}
                      style={{ flex: 1, minWidth: 150 }}
                      onLayout={() => {
                        servingButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                          setServingDropdownLayout({ x: pageX, y: pageY + height, width, height });
                        });
                      }}
                    >
                      <TouchableOpacity
                        style={[styles.input, styles.dropdownButton, { borderColor: colors.icon + '30' }]}
                        onPress={() => {
                          servingButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                            setServingDropdownLayout({ x: pageX, y: pageY + height, width, height });
                            setShowServingDropdown(!showServingDropdown);
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <ThemedText style={[styles.dropdownButtonText, { color: colors.text }]}>
                          {selectedServing ? selectedServing.label : 'Select serving...'}
                        </ThemedText>
                        <ThemedText style={[styles.dropdownArrow, { color: colors.icon }]}>
                          ▼
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
              {quantityError ? (
                <Text style={styles.errorText}>{quantityError}</Text>
              ) : null}
            </View>
            )}

            {/* Weight/Volume and Calories on the same line - inline display */}
            {selectedFood && selectedServing && (
              <View style={styles.field}>
                <View style={styles.inlineRow}>
                  <ThemedText style={[styles.inlineLabel, { color: colors.text }]}>
                    {isVolumeUnit(selectedFood.serving_unit) ? 'Volume (ml)' : 'Weight (g)'}: <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{calculatedWeight || '0.0'}</ThemedText>
                  </ThemedText>
                  <ThemedText style={[styles.inlineLabel, { color: colors.text, marginLeft: 16 }]}>
                    Calories (kcal): <ThemedText style={[styles.inlineValue, { color: caloriesError ? '#EF4444' : colors.text }]}>{calories || '0'}</ThemedText>
                  </ThemedText>
                </View>
                {caloriesError ? (
                  <Text style={styles.errorText}>{caloriesError}</Text>
                ) : null}
              </View>
            )}

            <TouchableOpacity
              style={[styles.collapsibleHeader, { borderColor: colors.icon + '20' }]}
              onPress={toggleMacros}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.sectionTitleText, { color: colors.icon }]}>
                Macronutrients
              </ThemedText>
              <ThemedText style={[styles.expandIcon, { color: colors.icon }]}>
                {macrosExpanded ? '▲' : '▼'}
              </ThemedText>
            </TouchableOpacity>

            {macrosExpanded && (
              <View style={styles.macrosContent}>
                {selectedFood ? (
                  // Inline display for calculated values
                  <>
                    <View style={styles.inlineRow}>
                      <ThemedText style={[styles.inlineLabel, { color: colors.text }]}>
                        Protein (g): <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{protein || '0'}</ThemedText>
                      </ThemedText>
                      <ThemedText style={[styles.inlineLabel, { color: colors.text, marginLeft: 16 }]}>
                        Carbs (g): <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{carbs || '0'}</ThemedText>
                      </ThemedText>
                    </View>
                    <View style={[styles.inlineRow, { marginTop: 8 }]}>
                      <ThemedText style={[styles.inlineLabel, { color: colors.text }]}>
                        Fat (g): <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{fat || '0'}</ThemedText>
                      </ThemedText>
                      <ThemedText style={[styles.inlineLabel, { color: colors.text, marginLeft: 16 }]}>
                        Fiber (g): <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{fiber || '0'}</ThemedText>
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  // Input fields for custom entries - all 4 macros on one line
                  <View style={styles.row}>
                    <View style={[styles.field, { flex: 1, marginRight: 4 }]}>
                      <ThemedText style={[styles.label, { color: colors.text, fontSize: 12 }]}>{t('mealtype_log.form.protein')}</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor: proteinError ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={protein}
                        onChangeText={(text) => {
                          setProtein(validateNumericInput(text));
                        }}
                        keyboardType="decimal-pad"
                      />
                      {proteinError ? (
                        <Text style={styles.errorText}>{proteinError}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.field, { flex: 1, marginHorizontal: 4 }]}>
                      <ThemedText style={[styles.label, { color: colors.text, fontSize: 12 }]}>{t('mealtype_log.form.carbs')}</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor: carbsError ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={carbs}
                        onChangeText={(text) => {
                          setCarbs(validateNumericInput(text));
                        }}
                        keyboardType="decimal-pad"
                      />
                      {carbsError ? (
                        <Text style={styles.errorText}>{carbsError}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.field, { flex: 1, marginHorizontal: 4 }]}>
                      <ThemedText style={[styles.label, { color: colors.text, fontSize: 12 }]}>{t('mealtype_log.form.fat')}</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor: fatError ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={fat}
                        onChangeText={(text) => {
                          setFat(validateNumericInput(text));
                        }}
                        keyboardType="decimal-pad"
                      />
                      {fatError ? (
                        <Text style={styles.errorText}>{fatError}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: 4 }]}>
                      <ThemedText style={[styles.label, { color: colors.text, fontSize: 12 }]}>{t('mealtype_log.form.fiber')}</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor: fiberError ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={fiber}
                        onChangeText={(text) => {
                          setFiber(validateNumericInput(text));
                        }}
                        keyboardType="decimal-pad"
                      />
                      {fiberError ? (
                        <Text style={styles.errorText}>{fiberError}</Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Other Nutrients - Collapsible Section */}
            <TouchableOpacity
              style={[styles.collapsibleHeader, { borderColor: colors.icon + '20' }]}
              onPress={toggleFattyAcids}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.sectionTitleText, { color: colors.icon }]}>
                Other Nutrients
              </ThemedText>
              <ThemedText style={[styles.expandIcon, { color: colors.icon }]}>
                {fattyAcidsExpanded ? '▲' : '▼'}
              </ThemedText>
            </TouchableOpacity>

            {fattyAcidsExpanded && (
              <View style={styles.macrosContent}>
                {selectedFood ? (
                  // Inline display for calculated values - all on one line
                  <View style={styles.inlineRow}>
                    <ThemedText style={[styles.inlineLabel, { color: colors.text }]}>
                      Sat Fat (g): <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{saturatedFat || '0'}</ThemedText>
                    </ThemedText>
                    <ThemedText style={[styles.inlineLabel, { color: colors.text, marginLeft: 16 }]}>
                      Sugar (g): <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{sugar || '0'}</ThemedText>
                    </ThemedText>
                    <ThemedText style={[styles.inlineLabel, { color: colors.text, marginLeft: 16 }]}>
                      Sodium (mg): <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{sodium || '0'}</ThemedText>
                    </ThemedText>
                  </View>
                ) : (
                  // Input fields for custom entries - all in one row
                  <View style={styles.row}>
                    <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                      <ThemedText style={[styles.label, { color: colors.text }]}>{t('mealtype_log.form.saturated_fat')}</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor: colors.icon + '30', color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={saturatedFat}
                        onChangeText={(text) => setSaturatedFat(validateNumericInput(text))}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: 4, marginRight: 4 }]}>
                      <ThemedText style={[styles.label, { color: colors.text }]}>{t('mealtype_log.form.sugar')}</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor: colors.icon + '30', color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={sugar}
                        onChangeText={(text) => setSugar(validateNumericInput(text))}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                      <ThemedText style={[styles.label, { color: colors.text }]}>{t('mealtype_log.form.sodium')}</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor: colors.icon + '30', color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={sodium}
                        onChangeText={(text) => setSodium(validateNumericInput(text))}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.formActions}>
              {(editingEntryId || selectedFood || isManualMode) && (
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.icon + '30' }]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('mealtype_log.buttons.cancel')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { 
                    backgroundColor: (loading || !isFormValid()) ? colors.icon : colors.tint,
                    opacity: (loading || !isFormValid()) ? 0.5 : 1
                  },
                  (loading || !isFormValid()) && styles.saveButtonDisabled
                ]}
                onPress={handleSave}
                disabled={loading || !isFormValid()}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>
                  {loading 
                    ? (editingEntryId ? t('mealtype_log.buttons.updating') : t('mealtype_log.buttons.logging'))
                    : (editingEntryId ? t('mealtype_log.buttons.update_log') : t('mealtype_log.buttons.log_food'))
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        )}

        {/* Food Log */}
        <View style={[styles.foodLogContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.entriesSection}>
            <View style={styles.entriesHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              {t('mealtype_log.food_log.title_with_count', { count: entries.length })}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {!entriesLoading && entries.length > 0 && (
                <View style={styles.toggleContainer}>
                  <ThemedText style={[styles.toggleLabel, { color: colors.icon }]}>
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
              {!entriesLoading && entries.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setEntriesEditMode(!entriesEditMode);
                    // Clear selection when exiting edit mode
                    if (entriesEditMode) {
                      clearEntrySelection();
                    }
                  }}
                  style={[styles.deleteButton, { 
                    backgroundColor: entriesEditMode ? '#10B981' + '20' : '#EF4444' + '20', 
                    borderColor: entriesEditMode ? '#10B981' + '40' : '#EF4444' + '40' 
                  }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.deleteButtonText, { 
                    color: entriesEditMode ? '#10B981' : '#EF4444' 
                  }]}>
                    {entriesEditMode ? '✓' : '🗑️'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={[styles.foodLogDivider, { backgroundColor: colors.separator }]} />

          {/* Select All Row - Only shown in edit mode */}
          {entriesEditMode && entries.length > 0 && (
            <View style={[styles.selectAllRow, { backgroundColor: colors.background, borderBottomColor: colors.separator }]}>
              <MultiSelectItem
                isSelected={areAllEntriesSelected(entries, (entry) => entry.id)}
                onToggle={() => {
                  if (areAllEntriesSelected(entries, (entry) => entry.id)) {
                    deselectAllEntries();
                  } else {
                    selectAllEntries(entries, (entry) => entry.id);
                  }
                }}
                style={{ paddingVertical: 12, paddingHorizontal: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <ThemedText style={[styles.selectAllText, { color: colors.text }]}>
                    {t('mealtype_log.food_log.select_all')}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={handleMassDelete}
                    disabled={!hasEntrySelection}
                    style={[
                      styles.massDeleteButton,
                      {
                        backgroundColor: hasEntrySelection ? '#EF4444' + '20' : colors.icon + '30',
                        borderColor: hasEntrySelection ? '#EF4444' + '40' : colors.icon + '40',
                        opacity: hasEntrySelection ? 1 : 0.5,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.deleteButtonText, { color: hasEntrySelection ? '#EF4444' : colors.icon }]}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </MultiSelectItem>
            </View>
          )}

          {entriesLoading ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.emptyStateText, { color: colors.icon }]}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : entries.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
              <ThemedText style={[styles.emptyStateText, { color: colors.icon }]}>
                {t('mealtype_log.food_log.no_entries')}
              </ThemedText>
            </View>
          ) : (
            entries.map((entry) => {
              const isEditing = editingEntryId === entry.id;
              const entryContent = (
                <HighlightableItem
                  isHighlighted={isNewlyAdded(entry.id)}
                  animationValue={getAnimationValue(entry.id)}
                  style={[
                    styles.entryCard, 
                    { 
                      backgroundColor: 'transparent',
                      borderColor: 'transparent',
                      borderWidth: 0,
                    }
                  ]}
                >
                  <View style={styles.entryHeader}>
                    <View style={styles.entryHeaderLeft}>
                      <View style={styles.entryNameRow}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                          <TouchableOpacity
                            onPress={() => handleEditEntry(entry)}
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
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                          {entry.food_id && foodBrandMap[entry.food_id] && (
                            <ThemedText 
                              style={[styles.entrySummary, { color: colors.icon, fontSize: 11, marginLeft: 6 }]}
                              numberOfLines={1}
                            >
                              {foodBrandMap[entry.food_id]?.length > 14 
                                ? foodBrandMap[entry.food_id]!.substring(0, 14) + '...' 
                                : foodBrandMap[entry.food_id]} •{' '}
                            </ThemedText>
                          )}
                          <ThemedText style={[styles.entrySummary, { color: colors.icon, fontSize: 11 }]}>
                            {entry.quantity} x {entry.unit} •{' '}
                          </ThemedText>
                          <ThemedText style={[styles.entryCaloriesValue, { color: colors.tint, fontSize: 11, marginRight: 4 }]}>
                            {entry.calories_kcal} kcal
                          </ThemedText>
                        </View>
                      </View>
                      {showEntryDetails && (
                        <View style={styles.entryMacros}>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.icon }]}>{t('mealtype_log.macros.protein_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.protein_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.icon }]}>{t('mealtype_log.macros.carbs_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.carbs_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.icon }]}>{t('mealtype_log.macros.fat_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.fat_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.icon }]}>{t('mealtype_log.macros.fiber_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.fiber_g ?? 0}g</ThemedText>
                          </View>
                        </View>
                      )}
                      {showEntryDetails && (
                        <View style={[styles.entryMacros, { marginTop: 2 }]}>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.icon }]}>{t('mealtype_log.macros.saturated_fat_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.saturated_fat_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.icon }]}>{t('mealtype_log.macros.sugar_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.sugar_g ?? 0}g</ThemedText>
                          </View>
                          <View style={styles.entryMacroItem}>
                            <ThemedText style={[styles.entryMacroLabel, { color: colors.icon }]}>{t('mealtype_log.macros.sodium_short')}</ThemedText>
                            <ThemedText style={[styles.entryMacroValue, { color: colors.text }]}>{entry.sodium_mg ?? 0}mg</ThemedText>
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={styles.entryHeaderRight}>
                      {/* Editing badge - Show when entry is being edited */}
                      {isEditing && (
                        <View style={[
                          styles.sourceBadge,
                          {
                            backgroundColor: colors.tint + '30',
                            borderColor: colors.tint + '60',
                            marginRight: 8,
                          }
                        ]}>
                          <ThemedText style={[
                            styles.sourceBadgeText,
                            { color: colors.tint, fontWeight: '700' }
                          ]}>
                            Editing
                          </ThemedText>
                        </View>
                      )}
                      {/* Source indicator badge */}
                      {entry.food_id && (
                        <View style={[
                          styles.sourceBadge,
                          {
                            backgroundColor: foodSourceMap[entry.food_id]
                              ? colors.tint + '20' 
                              : '#3B82F6' + '20',
                            borderColor: foodSourceMap[entry.food_id]
                              ? colors.tint + '40' 
                              : '#3B82F6' + '40',
                            marginRight: 4,
                          }
                        ]}>
                          <ThemedText style={[
                            styles.sourceBadgeText,
                            {
                              color: foodSourceMap[entry.food_id]
                                ? colors.tint 
                                : '#3B82F6',
                            }
                          ]}>
                            {foodSourceMap[entry.food_id] 
                              ? (isMobileScreen ? 'C' : 'Custom')
                              : (isMobileScreen ? 'DB' : 'Database')}
                          </ThemedText>
                        </View>
                      )}
                      {!entry.food_id && (
                        <View style={[
                          styles.sourceBadge,
                          {
                            backgroundColor: colors.icon + '20',
                            borderColor: colors.icon + '40',
                            marginRight: 4,
                          }
                        ]}>
                          <ThemedText style={[
                            styles.sourceBadgeText,
                            { color: colors.icon }
                          ]}>
                            {isMobileScreen ? 'M' : 'Manual'}
                          </ThemedText>
                        </View>
                      )}
                      {!hasEntrySelection && !editingEntryId && (
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
                </HighlightableItem>
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
            })
          )}
          </View>
        </View>
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
      
      {/* Barcode Scanner Modal */}
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
          
          {/* For web, use mode detection to show camera or file upload */}
          {/* For native, use expo-camera hook permission state */}
          {(() => {
            // On web, use the barcode scanner mode hook to determine what to show
            if (Platform.OS === 'web') {
              // Determine effective mode: check if user manually switched to file upload
              const effectiveMode = webForceFileUpload ? 'file-upload' : barcodeScannerMode;
              
              // Still checking camera availability
              if (isScannerModeChecking && !webForceFileUpload) {
                return (
                  <View style={styles.scannerContent}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <ThemedText style={[styles.scannerText, { color: colors.text }]}>
                      {t('mealtype_log.scanner.checking_camera', 'Checking camera availability...')}
                    </ThemedText>
                  </View>
                );
              }
              
              // File upload mode (no camera available or user chose file upload)
              if (effectiveMode === 'file-upload') {
                return (
                  <View style={styles.scannerContent} key={`file-upload-${showBarcodeScanner}`}>
                    <BarcodeFileUpload
                      key={`barcode-upload-${barcodeScannerKey}`}
                      onBarcodeScanned={scanned ? () => {} : handleBarcodeScanned}
                      onError={(error) => {
                        console.error('File upload barcode scanner error:', error);
                      }}
                      onSwitchToCamera={webCameraAvailable ? () => {
                        setWebForceFileUpload(false);
                        recheckCamera();
                      } : undefined}
                      cameraAvailable={webCameraAvailable}
                      colors={{
                        tint: colors.tint,
                        text: colors.text,
                        background: colors.background,
                        textSecondary: colors.icon,
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
                );
              }
              
              // Camera mode
              return (
                <View style={styles.scannerContent}>
                  <WebBarcodeScanner
                    onBarcodeScanned={scanned ? () => {} : handleBarcodeScanned}
                    onPermissionGranted={() => setWebCameraPermissionGranted(true)}
                    onError={(error) => {
                      console.error('Web barcode scanner error:', error);
                    }}
                    onCameraFailed={() => {
                      setWebForceFileUpload(true);
                    }}
                    onSwitchToFileUpload={() => {
                      setWebForceFileUpload(true);
                    }}
                    colors={{
                      tint: colors.tint,
                      text: colors.text,
                      background: colors.background,
                      textSecondary: colors.icon,
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
              );
            }
            
            const hasPermission = permission?.granted;
            
            if (!permission) {
              // Native: waiting for permission hook to initialize
              return (
                <View style={styles.scannerContent}>
                  <ActivityIndicator size="large" color={colors.tint} />
                  <ThemedText style={[styles.scannerText, { color: colors.text }]}>
                    {t('mealtype_log.scanner.requesting_permission')}
                  </ThemedText>
                </View>
              );
            }
            
            if (!hasPermission) {
              // Native: Need to request permission
              return (
            <View style={styles.scannerContent}>
              <ThemedText style={[styles.scannerText, { color: colors.text }]}>
                {t('mealtype_log.scanner.permission_required')}
              </ThemedText>
              {requestingPermission && (
                <ActivityIndicator size="large" color={colors.tint} style={{ marginVertical: 20 }} />
              )}
              <TouchableOpacity
                style={[
                  styles.scannerButton, 
                  { 
                    backgroundColor: requestingPermission ? colors.icon + '40' : colors.tint,
                    opacity: requestingPermission ? 0.6 : 1
                  }
                ]}
                    onPress={async () => {
                  if (requestingPermission) {
                    return;
                  }
                  
                  setRequestingPermission(true);
                      
                    try {
                      const result = await requestPermission();
                      
                      if (!result) {
                        Alert.alert(
                          t('alerts.permission_error'),
                          t('mealtype_log.camera.permission_error'),
                          [{ text: t('common.ok') }]
                        );
                        setRequestingPermission(false);
                        return;
                      }
                      
                      if (result.granted) {
                        setForcePermissionCheck(prev => prev + 1);
                        setRequestingPermission(false);
                      } else {
                        let message = t('mealtype_log.camera.permission_required_message');
                        
                        if (result.status === 'denied') {
                          if (result.canAskAgain) {
                            message += '\n\n' + t('mealtype_log.camera.permission_required_hint_can_ask');
                          } else {
                            message += '\n\n' + t('mealtype_log.camera.permission_required_hint_settings');
                          }
                        }
                        
                        Alert.alert(
                          t('alerts.camera_permission_required'),
                          message,
                          [
                            { 
                              text: t('common.cancel'), 
                              style: 'cancel', 
                              onPress: () => setShowBarcodeScanner(false) 
                            },
                            { 
                              text: result.canAskAgain ? t('mealtype_log.scanner.try_again') : t('common.ok'),
                              onPress: () => {
                                if (!result.canAskAgain) {
                                  setShowBarcodeScanner(false);
                                }
                              }
                            }
                          ]
                        );
                        setRequestingPermission(false);
                      }
                    } catch (error: any) {
                      Alert.alert(
                        t('alerts.error_title'),
                        t('mealtype_log.camera.permission_request_failed', { error: error?.message || t('common.unexpected_error') }),
                        [{ text: t('common.ok') }]
                      );
                      setRequestingPermission(false);
                    }
                }}
                activeOpacity={0.7}
              >
                    <ThemedText style={styles.scannerButtonText}>
                      {requestingPermission ? t('mealtype_log.scanner.requesting') : t('mealtype_log.scanner.grant_permission')}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              );
            }
            
            // Native: Permission is granted - show CameraView
            return (
              <View style={styles.scannerContent}>
                <CameraView
                  style={styles.barcodeScanner}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: [
                      'ean13',
                      'ean8',
                      'upc_a',
                      'upc_e',
                      'code128',
                      'code39',
                      'code93',
                    ],
                  }}
                />
                {barcodeScanning && (
                  <View style={styles.scannerOverlay}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <ThemedText style={[styles.scannerText, { color: '#fff' }]}>
                      Processing barcode...
                    </ThemedText>
                  </View>
                )}
                <View style={styles.scannerInstructions}>
                  <ThemedText style={[styles.scannerInstructionText, { color: '#fff' }]}>
                    Position the barcode within the frame
                  </ThemedText>
                </View>
              </View>
            );
          })()}
        </ThemedView>
      </Modal>

      {/* Serving Dropdown - Rendered at root level for proper z-index */}
      {showServingDropdown && servingDropdownLayout && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowServingDropdown(false)}
          />
          <View 
            style={[
              styles.dropdown,
              styles.servingDropdown,
              {
                backgroundColor: colors.background,
                borderColor: colors.icon + '30',
                position: 'absolute',
                top: servingDropdownLayout.y,
                left: servingDropdownLayout.x,
                width: servingDropdownLayout.width,
                zIndex: 99999,
                elevation: 99999,
              }
            ]}
          >
            <ScrollView 
              style={styles.dropdownScroll} 
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {availableServings.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.dropdownItem,
                    selectedServing?.id === option.id && { backgroundColor: colors.tint + '20' },
                    { borderBottomColor: colors.icon + '15' }
                  ]}
                  onPress={() => {
                    handleServingSelect(option);
                    setShowServingDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[
                    styles.dropdownItemText,
                    { color: colors.text },
                    selectedServing?.id === option.id && { color: colors.tint, fontWeight: '600' }
                  ]}>
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}

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
    paddingHorizontal: 12,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 20,
    ...Platform.select({
      web: {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
      },
    }),
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
    alignItems: 'flex-start',
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
    alignItems: 'flex-start',
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
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
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
    borderBottomWidth: 1,
    marginBottom: 12,
    position: 'relative',
    overflow: 'visible',
  },
  tabsScrollView: {
    borderBottomWidth: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0,
    paddingRight: 40,
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
    paddingLeft: 4,
  },
  tabsScrollArrowRight: {
    right: 0,
    paddingRight: 4,
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
    paddingHorizontal: 6,
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
});
