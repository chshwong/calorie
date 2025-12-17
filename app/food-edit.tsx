import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { NutritionLabelLayout } from '@/components/NutritionLabelLayout';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CalorieEntry } from '@/utils/types';
import { getCurrentDateTimeUTC, getLocalDateString } from '@/utils/calculations';
import {
  calculateNutrientsSimple,
  convertToMasterUnit,
  isVolumeUnit,
  buildServingOptions,
  getDefaultServingSelection,
  type FoodMaster,
  type FoodServing,
  type ServingOption,
} from '@/utils/nutritionMath';
import { getServingsForFood } from '@/lib/servings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEntriesForDate } from '@/lib/services/calorieEntries';
import { getFoodMasterById } from '@/lib/services/foodMaster';
import { getPersistentCache, setPersistentCache } from '@/lib/persistentCache';

// Hide default Expo Router header; we render our own in-screen header
export const options = {
  headerShown: false,
};

type FoodEditRouteParams = {
  entryId?: string; // edit mode
  foodId?: string;  // create mode
  date?: string;
  mealType?: string;
  entryPayload?: string;
};

const MAX_QUANTITY = 100000;
const MAX_CALORIES = 10000;
const MAX_MACRO = 9999.99;
const ENTRY_STALE_MS = 15 * 60 * 1000; // 15 minutes
const LONG_CACHE_MS = 180 * 24 * 60 * 60 * 1000; // ~180 days for stable by-id data

export default function FoodEditScreen() {
  const params = useLocalSearchParams<FoodEditRouteParams>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  const entryId = (Array.isArray(params.entryId) ? params.entryId[0] : params.entryId) as string | undefined;
  const foodIdParam = (Array.isArray(params.foodId) ? params.foodId[0] : params.foodId) as string | undefined;
  const entryDateParam = (Array.isArray(params.date) ? params.date[0] : params.date) as string | undefined;
  const mealTypeParam = (Array.isArray(params.mealType) ? params.mealType[0] : params.mealType) as string | undefined;
  const entryPayloadParam = Array.isArray(params.entryPayload) ? params.entryPayload[0] : params.entryPayload;

  const initialEntry = useMemo<CalorieEntry | null>(() => {
    if (!entryPayloadParam) return null;
    try {
      return JSON.parse(entryPayloadParam) as CalorieEntry;
    } catch (error) {
      console.warn('Failed to parse entry payload for food-edit:', error);
      return null;
    }
  }, [entryPayloadParam]);

  const entryDateFallback = entryDateParam ?? initialEntry?.entry_date ?? getLocalDateString();
  const mealTypeFallback = mealTypeParam ?? initialEntry?.meal_type ?? 'breakfast';
  const foodId = foodIdParam;

  const [entryDate, setEntryDate] = useState(entryDateFallback);
  const [mealType, setMealType] = useState(mealTypeFallback);

  const mode: 'edit' | 'create' = entryId ? 'edit' : 'create';
  const isCreateMode = mode === 'create';

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('⚡');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [transFat, setTransFat] = useState('');
  const [sugar, setSugar] = useState('');
  const [sodium, setSodium] = useState('');

  const [itemNameError, setItemNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [caloriesError, setCaloriesError] = useState('');

  const [selectedFood, setSelectedFood] = useState<FoodMaster | null>(null);
  const [availableServings, setAvailableServings] = useState<ServingOption[]>([]);
  const [selectedServing, setSelectedServing] = useState<ServingOption | null>(null);
  const [servingPickerVisible, setServingPickerVisible] = useState(false);
  const servingButtonRef = useRef<View>(null);
  const quantityInputRef = useRef<TextInput>(null);
  const [servingDropdownLayout, setServingDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const entryHydratedRef = useRef(false);
  const foodHydratedRef = useRef(false);
  const isSavingRef = useRef(false); // Guard to prevent double save execution

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(mode === 'create');

  useEffect(() => {
    if (!user?.id || !initialEntry) return;
    const cacheKey: [string, string, string] = ['entries', user.id, initialEntry.entry_date];
    queryClient.setQueryData<CalorieEntry[]>(cacheKey, (existing) => {
      if (!existing || existing.length === 0) {
        return [initialEntry];
      }
      const hasEntry = existing.some((entry) => entry.id === initialEntry.id);
      if (hasEntry) {
        return existing.map((entry) => (entry.id === initialEntry.id ? initialEntry : entry));
      }
      return [...existing, initialEntry];
    });
  }, [initialEntry, queryClient, user?.id]);

  const entriesQueryKey: [string, string | undefined, string] = ['entries', user?.id, entryDate];
  const entriesSnapshot = useMemo(() => {
    if (!user?.id || !entryDate) return null;
    return getPersistentCache<CalorieEntry[]>(
      `dailyEntries:${user.id}:${entryDate}`,
      LONG_CACHE_MS
    );
  }, [entryDate, user?.id]);
  const {
    data: entriesFromQuery = [],
    isSuccess: entriesLoaded,
  } = useQuery<CalorieEntry[]>({
    queryKey: entriesQueryKey,
    queryFn: () => {
      if (!user?.id || !entryDate) {
        throw new Error('User not authenticated');
      }
      return getEntriesForDate(user.id, entryDate);
    },
    enabled: !!user?.id && !!entryDate,
    initialData: useMemo(() => {
      const cached = queryClient.getQueryData<CalorieEntry[]>(entriesQueryKey);
      if (cached && cached.length > 0) {
        return cached;
      }
      if (initialEntry && initialEntry.entry_date === entryDate) {
        return [initialEntry];
      }
      if (entriesSnapshot) {
        return entriesSnapshot;
      }
      return undefined;
    }, [entriesQueryKey, initialEntry, entryDate, entriesSnapshot, queryClient]),
    staleTime: ENTRY_STALE_MS,
    gcTime: LONG_CACHE_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!user?.id || !entryDate) return;
    if (!entriesFromQuery || entriesFromQuery.length === 0) return;
    setPersistentCache(`dailyEntries:${user.id}:${entryDate}`, entriesFromQuery);
  }, [entriesFromQuery, entryDate, user?.id]);

  const entryFromQuery = useMemo(() => {
    if (!entryId) return null;
    return entriesFromQuery.find((entry) => entry.id === entryId) ?? null;
  }, [entriesFromQuery, entryId]);

  const targetFoodId = useMemo(() => {
    if (entryFromQuery?.food_id) return entryFromQuery.food_id;
    if (initialEntry?.food_id) return initialEntry.food_id;
    return foodId ?? null;
  }, [entryFromQuery?.food_id, foodId, initialEntry?.food_id]);

  const {
    data: foodMasterData = null,
  } = useQuery<FoodMaster | null>({
    queryKey: ['foodMasterFull', targetFoodId],
    queryFn: () => (targetFoodId ? getFoodMasterById(targetFoodId) : Promise.resolve(null)),
    enabled: !!targetFoodId,
    initialData: () => {
      if (!targetFoodId) return undefined;
      const cached = queryClient.getQueryData<FoodMaster>(['foodMasterFull', targetFoodId]);
      if (cached) return cached;
      const persisted = getPersistentCache<FoodMaster>(`foodMasterFull:${targetFoodId}`, LONG_CACHE_MS);
      return persisted ?? undefined;
    },
    staleTime: ENTRY_STALE_MS,
    gcTime: LONG_CACHE_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!targetFoodId || !foodMasterData) return;
    setPersistentCache(`foodMasterFull:${targetFoodId}`, foodMasterData);
  }, [foodMasterData, targetFoodId]);

  const {
    data: servingsData = [],
  } = useQuery<FoodServing[]>({
    queryKey: ['foodServings', targetFoodId],
    queryFn: () => (targetFoodId ? getServingsForFood(targetFoodId) : Promise.resolve([])),
    enabled: !!targetFoodId,
    initialData: () => {
      if (!targetFoodId) return undefined;
      const cached = queryClient.getQueryData<FoodServing[]>(['foodServings', targetFoodId]);
      if (cached && cached.length > 0) {
        return cached;
      }
      const persisted = getPersistentCache<FoodServing[]>(`foodServings:${targetFoodId}`, LONG_CACHE_MS);
      return persisted ?? undefined;
    },
    staleTime: ENTRY_STALE_MS,
    gcTime: LONG_CACHE_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!targetFoodId || !servingsData) return;
    setPersistentCache(`foodServings:${targetFoodId}`, servingsData);
  }, [servingsData, targetFoodId]);

  const formatDateLabel = useCallback(
    (dateString: string) => {
      try {
        const date = new Date(dateString + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        if (dateOnly.getTime() === today.getTime()) {
          return t('mealtype_log.calendar.today');
        }

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateOnly.getTime() === yesterday.getTime()) {
          return t('mealtype_log.calendar.yesterday');
        }

        const monthNames = [
          t('mealtype_log.calendar.months.jan'),
          t('mealtype_log.calendar.months.feb'),
          t('mealtype_log.calendar.months.mar'),
          t('mealtype_log.calendar.months.apr'),
          t('mealtype_log.calendar.months.may'),
          t('mealtype_log.calendar.months.jun'),
          t('mealtype_log.calendar.months.jul'),
          t('mealtype_log.calendar.months.aug'),
          t('mealtype_log.calendar.months.sep'),
          t('mealtype_log.calendar.months.oct'),
          t('mealtype_log.calendar.months.nov'),
          t('mealtype_log.calendar.months.dec'),
        ];
        const month = monthNames[date.getMonth()];
        const day = date.getDate();
        return `${month} ${day}`;
      } catch {
        return dateString;
      }
    },
    [t]
  );

  const mealTypeLabel = useMemo(() => {
    const labels: Record<string, string> = {
      breakfast: t('mealtype_log.meal_types.breakfast'),
      lunch: t('mealtype_log.meal_types.lunch'),
      dinner: t('mealtype_log.meal_types.dinner'),
      afternoon_snack: t('mealtype_log.meal_types.snack'),
      late_night: t('mealtype_log.meal_types.late_night'),
    };
    return labels[(mealType || '').toLowerCase()] || mealType || '';
  }, [mealType, t]);

  const dateLabel = entryDate ? formatDateLabel(entryDate) : '';

  const validateNumericInput = useCallback((text: string): string => {
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  }, []);

  const hydratedEntry = entryFromQuery ?? initialEntry;

  useEffect(() => {
    if (entryHydratedRef.current || mode === 'create') return;

    if (entryId && entriesLoaded && !hydratedEntry) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.entry_not_exists'));
      router.back();
      return;
    }

    if (!hydratedEntry) return;

    setEntryDate(hydratedEntry.entry_date);
    setMealType(hydratedEntry.meal_type);

    if (!hydratedEntry.food_id) {
      router.replace({
        pathname: '/quick-log',
        params: {
          quickLogId: hydratedEntry.id,
          date: hydratedEntry.entry_date,
          mealType: hydratedEntry.meal_type,
        },
      });
      return;
    }

    setItemName(hydratedEntry.item_name);
    setQuantity(hydratedEntry.quantity.toString());
    setUnit(hydratedEntry.unit);
    setCalories(hydratedEntry.calories_kcal.toString());
    setProtein(hydratedEntry.protein_g?.toString() || '');
    setCarbs(hydratedEntry.carbs_g?.toString() || '');
    setFat(hydratedEntry.fat_g?.toString() || '');
    setFiber(hydratedEntry.fiber_g?.toString() || '');
    setSaturatedFat(hydratedEntry.saturated_fat_g?.toString() || '');
    setTransFat(hydratedEntry.trans_fat_g?.toString() || '');
    setSugar(hydratedEntry.sugar_g?.toString() || '');
    setSodium(hydratedEntry.sodium_mg?.toString() || '');

    entryHydratedRef.current = true;
    setInitializing(false);
  }, [entriesLoaded, entryId, hydratedEntry, mode, router, t]);

  const calculateNutrientsFromOption = useCallback((food: FoodMaster, option: ServingOption, qty: number) => {
    let masterUnits = 0;
    if (option.kind === 'raw') {
      try {
        masterUnits = convertToMasterUnit(qty, option.unit, food);
      } catch {
        masterUnits = qty;
      }
    } else {
      const servingValue = isVolumeUnit(food.serving_unit)
        ? (option.serving.volume_ml ?? 0)
        : (option.serving.weight_g ?? 0);
      masterUnits = servingValue * qty;
    }

    const nutrients = calculateNutrientsSimple(food, masterUnits);
    setCalories(nutrients.calories_kcal.toFixed(1));
    setProtein(nutrients.protein_g != null ? nutrients.protein_g.toFixed(1) : '');
    setCarbs(nutrients.carbs_g != null ? nutrients.carbs_g.toFixed(1) : '');
    setFat(nutrients.fat_g != null ? nutrients.fat_g.toFixed(1) : '');
    setFiber(nutrients.fiber_g != null ? nutrients.fiber_g.toFixed(1) : '');
    setSaturatedFat(nutrients.saturated_fat_g != null ? nutrients.saturated_fat_g.toFixed(1) : '');
    const transFatValue = (nutrients as any).trans_fat_g ?? (nutrients as any).transFat_g;
    setTransFat(transFatValue != null ? transFatValue.toFixed(1) : '');
    setSugar(nutrients.sugar_g != null ? nutrients.sugar_g.toFixed(1) : '');
    setSodium(nutrients.sodium_mg != null ? nutrients.sodium_mg.toFixed(1) : '');
  }, []);

  const handleServingSelect = useCallback(
    (option: ServingOption) => {
      setSelectedServing(option);
      setServingPickerVisible(false);
      if (selectedFood) {
        const qty = parseFloat(quantity) || 1;
        calculateNutrientsFromOption(selectedFood, option, qty);
      }
    },
    [calculateNutrientsFromOption, quantity, selectedFood]
  );

  const handleCaloriesChange = useCallback((text: string) => {
    const sanitized = text.replace(/\D/g, '');
    const limited = sanitized.slice(0, 5);
    setCalories(limited);
  }, []);

  const handleQuantityChange = useCallback(
    (text: string) => {
      const cleaned = validateNumericInput(text);
      setQuantity(cleaned);
      if (selectedFood && selectedServing && cleaned) {
        const qty = parseFloat(cleaned) || 0;
        if (qty > 0) {
          calculateNutrientsFromOption(selectedFood, selectedServing, qty);
        }
      }
    },
    [calculateNutrientsFromOption, selectedFood, selectedServing, validateNumericInput]
  );

  const initializeFromFoodMaster = useCallback(
    async (targetFoodId: string, date: string, targetMealType: string) => {
      try {
        setLoading(true);
        const foodData = await getFoodMasterById(targetFoodId);

        if (!foodData) {
          Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.food_not_found'));
          router.back();
          return;
        }

        setSelectedFood(foodData);
        setItemName(foodData.name + (foodData.brand ? ` (${foodData.brand})` : ''));
        setEntryDate(date);
        setMealType(targetMealType);

        const dbServings = await getServingsForFood(targetFoodId);
        const options = buildServingOptions(foodData, dbServings);
        setAvailableServings(options);

        const { quantity: defaultQty, defaultOption } = getDefaultServingSelection(foodData, dbServings);
        const appliedQty = defaultQty || 1;
        const appliedOption = defaultOption || options[0] || null;

        setQuantity(appliedQty.toString());
        if (appliedOption?.kind === 'raw') {
          setUnit(appliedOption.unit);
        } else if (appliedOption?.kind === 'saved') {
          setUnit(appliedOption.label || foodData.serving_unit || 'g');
        } else {
          setUnit(foodData.serving_unit || 'g');
        }
        setSelectedServing(appliedOption || null);

        if (appliedOption) {
          calculateNutrientsFromOption(foodData, appliedOption, appliedQty);
        } else {
          const baseQty = foodData.serving_size || 1;
          setQuantity(baseQty.toString());
          setUnit(foodData.serving_unit || 'g');
          calculateNutrientsFromOption(foodData, { kind: 'raw', unit: foodData.serving_unit || 'g' } as any, baseQty);
        }
      } catch (error: any) {
        Alert.alert(t('alerts.error_title'), error?.message || t('common.unexpected_error'));
        router.back();
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    },
    [calculateNutrientsFromOption, router, t]
  );

  useEffect(() => {
    if (mode === 'create') return;
    if (foodHydratedRef.current) return;
    if (!hydratedEntry || !foodMasterData) return;

    const dbServings = servingsData ?? [];
    const options = buildServingOptions(foodMasterData, dbServings);
    setSelectedFood(foodMasterData);
    setAvailableServings(options);

    let servingMatched = false;

    if (hydratedEntry.serving_id) {
      const matchingOption = options.find(
        (option) => option.kind === 'saved' && option.serving.id === hydratedEntry.serving_id
      );
      if (matchingOption) {
        setSelectedServing(matchingOption);
        calculateNutrientsFromOption(foodMasterData, matchingOption, hydratedEntry.quantity);
        servingMatched = true;
      } else {
        const fallbackServing = dbServings.find((s) => s.id === hydratedEntry.serving_id);
        if (fallbackServing) {
          const mergedOptions = buildServingOptions(foodMasterData, [...dbServings, fallbackServing]);
          setAvailableServings(mergedOptions);
          const mergedMatch = mergedOptions.find(
            (option) => option.kind === 'saved' && option.serving.id === fallbackServing.id
          );
          if (mergedMatch) {
            setSelectedServing(mergedMatch);
            calculateNutrientsFromOption(foodMasterData, mergedMatch, hydratedEntry.quantity);
            servingMatched = true;
          }
        }
      }
    }

    if (!servingMatched && hydratedEntry.unit) {
      const entryUnit = hydratedEntry.unit.trim().toLowerCase();
      const savedMatch = options.find(
        (option) => option.kind === 'saved' && option.label.toLowerCase() === entryUnit
      );
      if (savedMatch) {
        setSelectedServing(savedMatch);
        calculateNutrientsFromOption(foodMasterData, savedMatch, hydratedEntry.quantity);
        servingMatched = true;
      } else {
        const rawMatch = options.find(
          (option) => option.kind === 'raw' && option.unit.toLowerCase() === entryUnit
        );
        if (rawMatch) {
          setSelectedServing(rawMatch);
          calculateNutrientsFromOption(foodMasterData, rawMatch, hydratedEntry.quantity);
          servingMatched = true;
        }
      }
    }

    if (!servingMatched) {
      const { quantity: defaultQty, defaultOption } = getDefaultServingSelection(foodMasterData, dbServings);
      const appliedQty = defaultQty || hydratedEntry.quantity || 1;
      const appliedOption = defaultOption || options[0] || null;
      setSelectedServing(appliedOption || null);
      if (appliedOption) {
        calculateNutrientsFromOption(foodMasterData, appliedOption, appliedQty);
      }
    }

    foodHydratedRef.current = true;
    setInitializing(false);
  }, [
    calculateNutrientsFromOption,
    foodMasterData,
    hydratedEntry,
    mode,
    servingsData,
  ]);

  useEffect(() => {
    const load = async () => {
      if (mode === 'create' && foodId) {
        await initializeFromFoodMaster(foodId, entryDateFallback, mealTypeFallback);
      }
    };

    load();
  }, [entryDateFallback, foodId, initializeFromFoodMaster, mealTypeFallback, mode]);

  // Always focus quantity when the screen is ready
  useEffect(() => {
    if (!initializing) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 300);
    }
  }, [initializing]);

  const isFormValid = useCallback(() => {
    return itemName.trim().length > 0 && quantity && parseFloat(quantity) > 0 && calories && parseFloat(calories) >= 0;
  }, [calories, itemName, quantity]);

  // Safe navigation helper: go back if possible, else navigate to mealtype-log
  const goBackSafely = useCallback((fallbackParams?: { entryDate?: string; mealType?: string }) => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: '/(tabs)/mealtype-log',
      params: {
        entryDate: fallbackParams?.entryDate ?? getLocalDateString(),
        mealType: fallbackParams?.mealType ?? 'dinner',
        preloadedEntries: JSON.stringify([]),
      },
    });
  }, [router]);

  const handleSaveEntry = useCallback(async () => {
    // Prevent double execution with ref guard (faster than state)
    if (isSavingRef.current || loading) {
      return;
    }
    isSavingRef.current = true;

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
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.fix_errors'));
      return;
    }

    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.user_not_found'));
      return;
    }

    const parsedQuantity = parseFloat(quantity);
    const parsedCalories = parseFloat(calories);

    if (isNaN(parsedQuantity) || !isFinite(parsedQuantity)) {
      setQuantityError(t('mealtype_log.errors.quantity_invalid'));
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.quantity_invalid'));
      return;
    }

    if (isNaN(parsedCalories) || !isFinite(parsedCalories)) {
      setCaloriesError(t('mealtype_log.errors.calories_invalid'));
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.calories_invalid'));
      return;
    }

    // Enforce 5,000 calorie limit (match Quick Log behavior)
    if (parsedCalories > 5000) {
      const errorMsg = `⚠️ CALORIES LIMIT EXCEEDED\n\n` +
        `Current: ${parsedCalories.toLocaleString()} calories\n` +
        `Maximum: 5,000 calories per entry\n\n` +
        `SOLUTIONS:\n` +
        `• Reduce the quantity\n` +
        `• Split into ${Math.ceil(parsedCalories / 5000)} separate entries`;

      setCaloriesError(t('mealtype_log.errors.calories_exceed_5000_limit'));
      Alert.alert(t('alerts.calories_limit_exceeded'), errorMsg);
      return;
    }

    if (parsedQuantity > MAX_QUANTITY) {
      const errorMsg = `Serving size cannot exceed ${MAX_QUANTITY.toLocaleString()}.`;
      setQuantityError(errorMsg);
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.serving_too_large', { value: parsedQuantity.toLocaleString(), max: MAX_QUANTITY.toLocaleString() }));
      return;
    }

    if (parsedCalories > MAX_CALORIES) {
      const errorMsg = 'Cannot exceed 10,000 cal per entry.';
      setCaloriesError(errorMsg);
      return;
    }

    if (protein && parseFloat(protein) > MAX_MACRO) {
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.protein_too_large', { max: MAX_MACRO.toLocaleString() }));
      return;
    }
    if (carbs && parseFloat(carbs) > MAX_MACRO) {
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.carbs_too_large', { max: MAX_MACRO.toLocaleString() }));
      return;
    }
    if (fat && parseFloat(fat) > MAX_MACRO) {
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.fat_too_large', { max: MAX_MACRO.toLocaleString() }));
      return;
    }

    setLoading(true);
    try {
      const dateString = entryDate || entryDateParam || '';
      const eatenAt = getCurrentDateTimeUTC();

      const entryData: Record<string, any> = {
        entry_date: dateString,
        meal_type: (mealType || mealTypeParam || '').toLowerCase(),
        item_name: itemName.trim(),
        quantity: parsedQuantity,
        unit: selectedServing?.label || unit,
        calories_kcal: parsedCalories,
        protein_g: protein && protein.trim() !== '' ? parseFloat(protein) : null,
        carbs_g: carbs && carbs.trim() !== '' ? parseFloat(carbs) : null,
        fat_g: fat && fat.trim() !== '' ? parseFloat(fat) : null,
        fiber_g: fiber && fiber.trim() !== '' ? parseFloat(fiber) : null,
        eaten_at: eatenAt,
      };

      if (selectedFood) {
        entryData.food_id = selectedFood.id;
      }
      if (selectedServing && selectedServing.kind === 'saved') {
        entryData.serving_id = selectedServing.serving.id;
      }

      if (saturatedFat && saturatedFat.trim() !== '') {
        const parsed = parseFloat(saturatedFat);
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          entryData.saturated_fat_g = Math.round(parsed * 100) / 100;
        }
      }
      if (transFat && transFat.trim() !== '') {
        const parsed = parseFloat(transFat);
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          entryData.trans_fat_g = Math.round(parsed * 100) / 100;
        }
      }
      if (sugar && sugar.trim() !== '') {
        const parsed = parseFloat(sugar);
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          entryData.sugar_g = Math.round(parsed * 100) / 100;
        }
      }
      if (sodium && sodium.trim() !== '') {
        const parsed = parseFloat(sodium);
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          entryData.sodium_mg = Math.round(parsed * 100) / 100;
        }
      }

    const cleanedEntryData: Record<string, any> = {};
      const allowedFields = [
        'entry_date',
        'meal_type',
        'item_name',
        'quantity',
        'unit',
        'calories_kcal',
        'protein_g',
        'carbs_g',
        'fat_g',
        'fiber_g',
        'saturated_fat_g',
        'trans_fat_g',
        'sugar_g',
        'sodium_mg',
        'food_id',
        'serving_id',
        'eaten_at',
      ];

      for (const key of allowedFields) {
        if (entryData.hasOwnProperty(key) && entryData[key] !== undefined) {
          cleanedEntryData[key] = entryData[key];
        }
      }

    let error;
    if (mode === 'edit' && entryId) {
      const updateResult = await supabase
        .from('calorie_entries')
        .update(cleanedEntryData)
        .eq('id', entryId)
        .eq('user_id', user.id);
      error = updateResult.error;
    } else if (mode === 'create' && foodId) {
      const insertResult = await supabase
        .from('calorie_entries')
        .insert({ ...cleanedEntryData, user_id: user.id })
        .select('id')
        .single();
      error = insertResult.error;
    }

    if (error) {
      console.error('Food edit save error', error);
      Alert.alert(t('alerts.error_title'), error.message || t('common.unexpected_error'));
      isSavingRef.current = false; // Reset on error
      setLoading(false);
      return;
    }

    if (entryDate || entryDateParam) {
      queryClient.invalidateQueries({
        queryKey: ['entries', user.id, entryDate || entryDateParam],
      });
    }

    // Use safe navigation: go back if possible, else navigate to mealtype-log
    goBackSafely({ entryDate: entryDate || entryDateParam, mealType: mealType || mealTypeParam });
    // Note: Don't reset isSavingRef here since we're navigating away
    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), error?.message || t('common.unexpected_error'));
      isSavingRef.current = false; // Reset on error
    } finally {
      setLoading(false);
      // Only reset if we're not navigating away (error case)
      if (isSavingRef.current) {
        // If we reach here without navigating, something went wrong - reset
        isSavingRef.current = false;
      }
    }
  }, [
    calories,
    carbs,
    entryDate,
    entryDateParam,
    entryId,
    fat,
    fiber,
    goBackSafely,
    itemName,
    mealType,
    mealTypeParam,
    protein,
    queryClient,
    router,
    saturatedFat,
    selectedFood,
    selectedServing,
    sodium,
    sugar,
    t,
    transFat,
    unit,
    user?.id,
    quantity,
    loading,
  ]);

  if (initializing) {
    return (
      <DesktopPageContainer>
        <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.tint} />
        </ThemedView>
      </DesktopPageContainer>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DesktopPageContainer>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>←</ThemedText>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <ThemedText style={[styles.title, { color: colors.text }]}>
              {t('quick_log.header_title')}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              {mealTypeLabel} · {dateLabel}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.checkmarkButton}
            onPress={handleSaveEntry}
            activeOpacity={0.7}
          >
            <IconSymbol
              name="checkmark"
              size={24}
              color={colors.tint}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.centeredContainer, { maxWidth: isDesktop ? 520 : '100%' }]}>
            <View style={styles.formHeader}>
              <ThemedText style={[styles.formTitle, { color: colors.text }]}>
                {isCreateMode ? 'What did you eat?' : 'Edit Food Log'}
              </ThemedText>
            </View>
            <NutritionLabelLayout
              hideServingRow={false}
              titleLabel="Food"
              titleInput={
                <ThemedText style={styles.nutritionValueText}>
                  {itemName || '-'}
                </ThemedText>
              }
              servingQuantityInput={
                <TextInput
                  ref={quantityInputRef}
                  style={[styles.nutritionLabelInput, styles.nutritionLabelSmallInput, { borderColor: quantityError ? '#EF4444' : '#000000' }]}
                  value={quantity}
                  onChangeText={handleQuantityChange}
                  keyboardType="numeric"
                  maxLength={4}
                  returnKeyType="done"
                />
              }
              servingUnitInput={
                <TouchableOpacity
                  ref={servingButtonRef}
                  style={[styles.servingUnitButton, { borderColor: '#000000' }]}
                  onPress={() => {
                    servingButtonRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                      setServingDropdownLayout({ x, y, width, height });
                      setServingPickerVisible(true);
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.servingUnitText}>
                    {selectedServing ? selectedServing.label : unit}
                  </ThemedText>
                </TouchableOpacity>
              }
              caloriesInput={
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText style={styles.nutritionValueText}>
                    {calories || '0'}
                  </ThemedText>
                  {caloriesError ? (
                    <ThemedText style={styles.errorText}>
                      {caloriesError}
                    </ThemedText>
                  ) : null}
                </View>
              }
              fatInput={
                <ThemedText style={styles.nutritionValueText}>
                  {fat || '0'}
                </ThemedText>
              }
              satFatInput={
                <ThemedText style={styles.nutritionValueText}>
                  {saturatedFat || '0'}
                </ThemedText>
              }
              transFatInput={
                <ThemedText style={styles.nutritionValueText}>
                  {transFat || '0'}
                </ThemedText>
              }
              carbsInput={
                <ThemedText style={styles.nutritionValueText}>
                  {carbs || '0'}
                </ThemedText>
              }
              fiberInput={
                <ThemedText style={styles.nutritionValueText}>
                  {fiber || '0'}
                </ThemedText>
              }
              sugarInput={
                <ThemedText style={styles.nutritionValueText}>
                  {sugar || '0'}
                </ThemedText>
              }
              proteinInput={
                <ThemedText style={styles.nutritionValueText}>
                  {protein || '0'}
                </ThemedText>
              }
              sodiumInput={
                <ThemedText style={styles.nutritionValueText}>
                  {sodium || '0'}
                </ThemedText>
              }
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.icon + '30' }]}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.cancelButtonText, { color: colors.text }]}>
                  {t('mealtype_log.buttons.cancel')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: loading || !isFormValid() ? colors.icon : colors.tint,
                    opacity: loading || !isFormValid() ? 0.5 : 1,
                  },
                ]}
                onPress={handleSaveEntry}
                disabled={loading || !isFormValid()}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>
                    {isCreateMode ? 'Log New' : t('mealtype_log.buttons.update_log')}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Modal
          visible={servingPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setServingPickerVisible(false)}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setServingPickerVisible(false)} />
          <View
            style={[
              styles.dropdownContainer,
              {
                backgroundColor: colors.background,
                top: servingDropdownLayout ? servingDropdownLayout.y + servingDropdownLayout.height + 4 : undefined,
                left: servingDropdownLayout ? servingDropdownLayout.x : undefined,
                width: servingDropdownLayout ? servingDropdownLayout.width : undefined,
              },
            ]}
          >
            <ScrollView>
              {availableServings.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.modalItem}
                  onPress={() => handleServingSelect(option)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={{ color: colors.text }}>
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </ThemedView>
      </DesktopPageContainer>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: Spacing.md,
    minHeight: 64,
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 2,
    opacity: 0.7,
  },
  checkmarkButton: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 4,
  },
  centeredContainer: {
    width: '100%',
  },
  formHeader: {
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  nutritionLabelInput: {
    fontSize: 16,
    paddingVertical: 4,
    paddingHorizontal: 0,
    color: '#000000',
    borderBottomWidth: 1,
  },
  nutritionLabelTitleInput: {
    fontSize: 18,
    fontWeight: '400',
  },
  nutritionLabelSmallInput: {
    fontSize: 16,
    minWidth: 40,
  },
  nutritionLabelCaloriesInput: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 60,
  },
  nutritionLabelNutrientInput: {
    fontSize: 16,
  },
  nutritionLabelNumericInput: {
    width: 30,
    textAlign: 'right',
  },
  nutritionLabelInputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 80,
    gap: 4,
  },
  nutritionLabelUnit: {
    fontSize: 16,
    fontWeight: '400',
  },
  nutritionValueText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 40,
  },
  servingUnitButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 4,
  },
  servingUnitText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000055',
  },
  modalContent: {
    position: 'absolute',
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  dropdownContainer: {
    position: 'absolute',
    borderRadius: 12,
    paddingVertical: 8,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#00000020',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
  },
  errorText: {
    color: '#EF4444',
    marginTop: 8,
    fontSize: 14,
  },
});

