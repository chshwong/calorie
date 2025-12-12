/**
 * QuickLogForm - Reusable component for Quick Log entry/edit form
 * 
 * Extracted from mealtype-log.tsx to be used in a dedicated screen.
 * Handles manual entry creation and editing (entries without food_id).
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { NutritionLabelLayout } from '@/components/NutritionLabelLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentDateTimeUTC } from '@/utils/calculations';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getWebAccessibilityProps,
} from '@/utils/accessibility';
import type { CalorieEntry } from '@/utils/types';
import { getEntriesForDate } from '@/lib/services/calorieEntries';
import { getPersistentCache, setPersistentCache, DEFAULT_CACHE_MAX_AGE_MS } from '@/lib/persistentCache';

type QuickLogFormProps = {
  date: string;                 // ISO date string (YYYY-MM-DD)
  mealType: string;             // meal type key (breakfast, lunch, etc.)
  quickLogId?: string;           // if present, edit mode; else create
  initialEntry?: CalorieEntry | null;
  onCancel: () => void;         // called when user taps Cancel
  onSaved: () => void;          // called after successful save/update
  registerSubmit?: (submitFn: () => void) => void; // register submit function for header button
};

// Database constraints
const MAX_QUANTITY = 100000;
const MAX_CALORIES = 10000;
const MAX_MACRO = 9999.99;
const ENTRIES_CACHE_MAX_AGE_MS = DEFAULT_CACHE_MAX_AGE_MS;

export function QuickLogForm({ date, mealType, quickLogId, initialEntry, onCancel, onSaved, registerSubmit }: QuickLogFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const itemNameInputRef = useRef<TextInput>(null);

  // Form state
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
  const [loading, setLoading] = useState(false);

  // Validation error states
  const [itemNameError, setItemNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [caloriesError, setCaloriesError] = useState('');
  const [proteinError, setProteinError] = useState('');
  const [carbsError, setCarbsError] = useState('');
  const [fatError, setFatError] = useState('');
  const [fiberError, setFiberError] = useState('');

  const effectiveDate = initialEntry?.entry_date ?? date;
  const entriesQueryKey: [string, string | undefined, string | undefined] = ['entries', user?.id, effectiveDate];

  const entriesSnapshot = useMemo(() => {
    if (!user?.id || !effectiveDate) return null;
    return getPersistentCache<CalorieEntry[]>(
      `dailyEntries:${user.id}:${effectiveDate}`,
      ENTRIES_CACHE_MAX_AGE_MS
    );
  }, [effectiveDate, user?.id]);

  const {
    data: entriesFromQuery = [],
    isSuccess: entriesLoaded,
  } = useQuery<CalorieEntry[]>({
    queryKey: entriesQueryKey,
    queryFn: () => {
      if (!user?.id || !effectiveDate) {
        throw new Error('User not authenticated');
      }
      return getEntriesForDate(user.id, effectiveDate);
    },
    enabled: !!user?.id && !!effectiveDate,
    initialData: useMemo(() => {
      const cached = queryClient.getQueryData<CalorieEntry[]>(entriesQueryKey);
      if (cached && cached.length > 0) {
        return cached;
      }
      if (initialEntry && initialEntry.entry_date === effectiveDate) {
        return [initialEntry];
      }
      if (entriesSnapshot) {
        return entriesSnapshot;
      }
      return undefined;
    }, [entriesQueryKey, initialEntry, effectiveDate, entriesSnapshot, queryClient]),
    staleTime: 15 * 60 * 1000, // 15 minutes for edit hydration
    gcTime: 180 * 24 * 60 * 60 * 1000, // ~180 days to align with persistent cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!user?.id || !effectiveDate) return;
    if (!entriesFromQuery || entriesFromQuery.length === 0) return;
    setPersistentCache(`dailyEntries:${user.id}:${effectiveDate}`, entriesFromQuery);
  }, [effectiveDate, entriesFromQuery, user?.id]);

  const entryFromQuery = useMemo(() => {
    if (!quickLogId) return null;
    return entriesFromQuery.find((entry) => entry.id === quickLogId) ?? null;
  }, [entriesFromQuery, quickLogId]);

  const hydratedEntry = entryFromQuery ?? initialEntry ?? null;
  const entryHydratedRef = useRef(false);

  useEffect(() => {
    if (entryHydratedRef.current) return;

    if (hydratedEntry) {
      // Only hydrate if it's a manual entry
      if (hydratedEntry.food_id) {
        Alert.alert(t('alerts.error_title'), t('quick_log.errors.not_quick_log_entry'));
        onCancel();
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
      setTimeout(() => {
        itemNameInputRef.current?.focus();
      }, 200);
      return;
    }

    if (!quickLogId) {
      entryHydratedRef.current = true;
      setTimeout(() => {
        itemNameInputRef.current?.focus();
      }, 200);
    }
  }, [hydratedEntry, onCancel, quickLogId, t]);

  useEffect(() => {
    if (quickLogId && entriesLoaded && !hydratedEntry) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.entry_not_exists'));
      onCancel();
    }
  }, [entriesLoaded, hydratedEntry, onCancel, quickLogId, t]);

  // Validate numeric input
  const validateNumericInput = (text: string): string => {
    // Remove any characters that aren't numbers or periods
    let cleaned = text.replace(/[^0-9.]/g, '');
    
    // Ensure only one period
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    return cleaned;
  };

  // Handle calories change with validation
  const handleCaloriesChange = useCallback((text: string) => {
    // Strip all non-digit characters (no periods allowed for calories)
    const sanitized = text.replace(/\D/g, '');
    // Limit to 4 characters
    const limited = sanitized.slice(0, 4);
    setCalories(limited);
  }, []);

  // Real-time validation
  const validateFields = useCallback(() => {
    setQuantityError('');
    setCaloriesError('');
    setProteinError('');
    setCarbsError('');
    setFatError('');
    setFiberError('');
    
    let isValid = true;
    
    const parsedQuantity = parseFloat(quantity);
    if (!quantity || isNaN(parsedQuantity) || !isFinite(parsedQuantity) || parsedQuantity <= 0) {
      isValid = false;
    } else if (parsedQuantity > MAX_QUANTITY) {
      setQuantityError(`Serving size cannot exceed ${MAX_QUANTITY.toLocaleString()}. Please reduce the quantity or split into multiple entries.`);
      isValid = false;
    }
    
    const parsedCalories = parseFloat(calories);
    if (!calories || calories.trim() === '' || isNaN(parsedCalories) || !isFinite(parsedCalories) || parsedCalories < 0) {
      isValid = false;
    } else if (parsedCalories > MAX_CALORIES) {
      setCaloriesError(t('mealtype_log.errors.calories_exceed_5000_limit'));
      isValid = false;
    }
    
    if (protein) {
      const parsedProtein = parseFloat(protein);
      if (isNaN(parsedProtein) || !isFinite(parsedProtein)) {
        setProteinError(t('mealtype_log.errors.protein_invalid'));
        isValid = false;
      } else if (parsedProtein > MAX_MACRO) {
        setProteinError(`Protein cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    if (carbs) {
      const parsedCarbs = parseFloat(carbs);
      if (isNaN(parsedCarbs) || !isFinite(parsedCarbs)) {
        setCarbsError(t('mealtype_log.errors.carbs_invalid'));
        isValid = false;
      } else if (parsedCarbs > MAX_MACRO) {
        setCarbsError(`Carbs cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    if (fat) {
      const parsedFat = parseFloat(fat);
      if (isNaN(parsedFat) || !isFinite(parsedFat)) {
        setFatError(t('mealtype_log.errors.fat_invalid'));
        isValid = false;
      } else if (parsedFat > MAX_MACRO) {
        setFatError(`Fat cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    if (fiber) {
      const parsedFiber = parseFloat(fiber);
      if (isNaN(parsedFiber) || !isFinite(parsedFiber)) {
        setFiberError(t('mealtype_log.errors.fiber_invalid'));
        isValid = false;
      } else if (parsedFiber > MAX_MACRO) {
        setFiberError(`Fiber cannot exceed ${MAX_MACRO.toLocaleString()}g`);
        isValid = false;
      }
    }
    
    return isValid;
  }, [quantity, calories, protein, carbs, fat, fiber, t]);

  // Run validation whenever values change
  useEffect(() => {
    validateFields();
  }, [validateFields]);

  // Check if form is valid
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
  }, [itemName, quantity, calories, protein, carbs, fat, fiber]);

  // Save entry
  const saveEntry = async (): Promise<boolean> => {
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
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.fix_errors'));
      return false;
    }

    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.user_not_found'));
      return false;
    }

    // Validate calculated values before saving
    const parsedQuantity = parseFloat(quantity);
    const parsedCalories = parseFloat(calories);
    
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
    
    if (parsedQuantity > MAX_QUANTITY) {
      const errorMsg = `Serving size cannot exceed ${MAX_QUANTITY.toLocaleString()}. Please reduce the quantity or split into multiple entries.`;
      setQuantityError(errorMsg);
      Alert.alert(t('alerts.validation_error'), t('mealtype_log.errors.serving_too_large', { value: parsedQuantity.toLocaleString(), max: MAX_QUANTITY.toLocaleString() }));
      setLoading(false);
      return false;
    }
    
    const caloriesValue = Number(parsedCalories);
    const maxCaloriesValue = Number(MAX_CALORIES);
    
    if (caloriesValue > maxCaloriesValue) {
      setCaloriesError(t('mealtype_log.errors.calories_exceed_5000_limit'));
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
      const eatenAt = getCurrentDateTimeUTC();
      const dateString = date;

      // Build entry data - Quick Log entries have no food_id
      const entryData: any = {
        user_id: user.id,
        entry_date: dateString,
        eaten_at: eatenAt,
        meal_type: mealType.toLowerCase(),
        item_name: itemName.trim(),
        quantity: parsedQuantity,
        unit: unit,
        calories_kcal: parsedCalories,
        protein_g: protein && protein.trim() !== '' ? parseFloat(protein) : null,
        carbs_g: carbs && carbs.trim() !== '' ? parseFloat(carbs) : null,
        fat_g: fat && fat.trim() !== '' ? parseFloat(fat) : null,
        fiber_g: fiber && fiber.trim() !== '' ? parseFloat(fiber) : null,
      };

      // Only include saturated_fat_g if it has a value greater than 0
      if (saturatedFat && saturatedFat.trim() !== '') {
        const parsedSaturatedFat = parseFloat(saturatedFat);
        if (!isNaN(parsedSaturatedFat) && isFinite(parsedSaturatedFat) && parsedSaturatedFat > 0) {
          entryData.saturated_fat_g = Math.round(parsedSaturatedFat * 100) / 100;
        }
      }
      
      // Only include trans_fat_g if it has a value greater than 0
      if (transFat && transFat.trim() !== '') {
        const parsedTransFat = parseFloat(transFat);
        if (!isNaN(parsedTransFat) && isFinite(parsedTransFat) && parsedTransFat > 0) {
          entryData.trans_fat_g = Math.round(parsedTransFat * 100) / 100;
        }
      }
      
      // Only include sugar_g if it has a value greater than 0
      if (sugar && sugar.trim() !== '') {
        const parsedSugar = parseFloat(sugar);
        if (!isNaN(parsedSugar) && isFinite(parsedSugar) && parsedSugar > 0) {
          entryData.sugar_g = Math.round(parsedSugar * 100) / 100;
        }
      }
      
      // Only include sodium_mg if it has a value greater than 0
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

      // Final validation check
      if (parsedCalories > MAX_CALORIES) {
        setCaloriesError(t('mealtype_log.errors.calories_exceed_5000_limit'));
        setLoading(false);
        return false;
      }

      // Clean entryData - remove any undefined values
      const cleanedEntryData: any = {};
      const allowedFields = [
        'user_id', 'entry_date', 'eaten_at', 'meal_type', 'item_name', 'quantity', 'unit',
        'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
        'saturated_fat_g', 'trans_fat_g', 'sugar_g', 'sodium_mg'
      ];
      
      for (const key of allowedFields) {
        if (entryData.hasOwnProperty(key) && entryData[key] !== undefined) {
          cleanedEntryData[key] = entryData[key];
        }
      }

      let error;
      if (quickLogId) {
        // Update existing entry
        const updateResult = await supabase
          .from('calorie_entries')
          .update(cleanedEntryData)
          .eq('id', quickLogId);
        error = updateResult.error;
      } else {
        // Insert new entry
        const insertResult = await supabase
          .from('calorie_entries')
          .insert(cleanedEntryData)
          .select('id')
          .single();
        error = insertResult.error;
      }

      if (error) {
        let errorMessage = `Failed to ${quickLogId ? 'update' : 'save'} food entry.`;
        const errorMsg = error.message || '';
        const errorCode = error.code || '';
        
        if (errorCode === '23514' || errorMsg.includes('calories_kcal_check') || errorMsg.includes('calories_kcal') || (errorMsg.includes('check') && (errorMsg.includes('5000') || errorMsg.includes('calories')))) {
          const currentCalories = parsedCalories || 0;
          const suggestedQty = parsedQuantity ? Math.floor((5000 / currentCalories) * parsedQuantity * 10) / 10 : 0;
          errorMessage = `⚠️ CALORIES LIMIT EXCEEDED\n\n` +
            `Current: ${currentCalories.toLocaleString()} calories\n` +
            `Maximum: 5,000 calories per entry\n\n` +
            `SOLUTIONS:\n` +
            `• Reduce quantity to ${suggestedQty} (instead of ${parsedQuantity || 'current'})\n` +
            `• Split into ${Math.ceil(currentCalories / 5000)} separate entries`;
          setCaloriesError(t('mealtype_log.errors.calories_exceed_5000_limit'));
        } else if (errorMsg.includes('numeric') || errorMsg.includes('value too large') || errorMsg.includes('out of range') || errorCode === '22003') {
          errorMessage = 'The calculated values are too large. Please reduce the quantity or split into multiple entries.';
          setQuantityError('Quantity or calculated calories exceed database limits');
          setCaloriesError('Calculated calories exceed database limits');
        } else if (errorMsg || errorCode) {
          errorMessage = `${errorMessage}\n\nError: ${errorMsg || errorCode}`;
        }
        
        Alert.alert(t('alerts.error_title'), errorMessage);
        setLoading(false);
        return false;
      } else {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['entries', user.id] });
        queryClient.invalidateQueries({ queryKey: ['entries', user.id, date] });
        
        Alert.alert(t('alerts.success'), t('mealtype_log.success.entry_saved', { 
          action: quickLogId ? t('mealtype_log.success.action_updated') : t('mealtype_log.success.action_saved') 
        }));
        
        onSaved();
        return true;
      }
    } catch (error: any) {
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
      setLoading(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (loading) {
      return;
    }

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
        
        setCaloriesError(t('mealtype_log.errors.calories_exceed_5000_limit'));
        Alert.alert(t('alerts.calories_limit_exceeded'), errorMsg);
        setLoading(false);
        return;
      }
      
      await saveEntry();
    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.save_unexpected', { error: error?.message || t('common.unexpected_error') }));
      setLoading(false);
    }
  };

  const handleFormSubmit = useCallback(() => {
    if (isFormValid() && !loading) {
      handleSave();
    }
  }, [isFormValid, loading, handleSave]);

  // Register submit function for header button
  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleFormSubmit);
    }
  }, [registerSubmit, handleFormSubmit]);

  return (
    <View style={styles.container}>
      {/* Header with title and badge */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {t('quick_log.title')}
          </ThemedText>
          <View style={[
            styles.sourceBadge,
            {
              backgroundColor: colors.icon + '20',
              borderColor: colors.icon + '40',
            }
          ]}>
            <ThemedText style={[
              styles.sourceBadgeText,
              { color: colors.icon }
            ]}>
              ⚡
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <NutritionLabelLayout
          hideServingRow={true}
          caloriesLabel="Calories *"
          titleInput={
            <View>
              <TextInput
                ref={itemNameInputRef}
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelTitleInput,
                  { 
                    borderBottomColor: itemNameError ? '#EF4444' : 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: itemNameError ? '1px solid #EF4444' : '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder={t('mealtype_log.form.food_item_placeholder')}
                placeholderTextColor={colors.textTertiary}
                value={itemName}
                maxLength={40}
                onChangeText={setItemName}
                autoCapitalize="words"
                autoFocus
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
          }
          servingQuantityInput={
            <View>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelSmallInput,
                  { 
                    borderBottomColor: quantityError ? '#EF4444' : 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: quantityError ? '1px solid #EF4444' : '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="1"
                placeholderTextColor={colors.textTertiary}
                value={quantity}
                onChangeText={(text) => setQuantity(validateNumericInput(text))}
                keyboardType="decimal-pad"
                maxLength={4}
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
          }
          servingUnitInput={
            <TextInput
              style={[
                styles.nutritionLabelInput,
                styles.nutritionLabelSmallInput,
                { 
                  borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                  borderBottomWidth: 1,
                  color: '#000000',
                  ...(Platform.OS === 'web' ? { 
                    outline: 'none',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                  } : {}),
                }
              ]}
              placeholder="⚡"
              placeholderTextColor={colors.textTertiary}
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
          }
          caloriesInput={
            <View>
              <View style={styles.nutritionLabelInputWithUnit}>
                <TextInput
                  style={[
                    styles.nutritionLabelInput,
                    styles.nutritionLabelCaloriesInput,
                    styles.nutritionLabelNumericInput,
                    { 
                      borderBottomColor: caloriesError ? '#EF4444' : 'rgba(0, 0, 0, 0.2)', 
                      borderBottomWidth: 1,
                      color: '#000000',
                      fontWeight: '700',
                      ...(Platform.OS === 'web' ? { 
                        outline: 'none',
                        borderBottom: caloriesError ? '1px solid #EF4444' : '1px solid rgba(0, 0, 0, 0.2)',
                      } : {}),
                    }
                  ]}
                  placeholder="325"
                  placeholderTextColor={colors.textTertiary}
                  value={calories}
                  onChangeText={handleCaloriesChange}
                  keyboardType="number-pad"
                  maxLength={4}
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
              </View>
              {caloriesError ? (
                <Text style={styles.errorText}>{caloriesError}</Text>
              ) : null}
            </View>
          }
          fatInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={fat}
                onChangeText={(text) => {
                  setFat(validateNumericInput(text));
                }}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Fat',
                  'Enter fat in grams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Fat'
                )}
              />
            </View>
          }
          satFatInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={saturatedFat}
                onChangeText={(text) => setSaturatedFat(validateNumericInput(text))}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Saturated fat',
                  'Enter saturated fat in grams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Saturated fat'
                )}
              />
            </View>
          }
          transFatInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={transFat}
                onChangeText={(text) => setTransFat(validateNumericInput(text))}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Trans fat',
                  'Enter trans fat in grams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Trans fat'
                )}
              />
            </View>
          }
          carbsInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={carbs}
                onChangeText={(text) => {
                  setCarbs(validateNumericInput(text));
                }}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Carbohydrate',
                  'Enter carbohydrate in grams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Carbohydrate'
                )}
              />
            </View>
          }
          fiberInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={fiber}
                onChangeText={(text) => {
                  setFiber(validateNumericInput(text));
                }}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Fiber',
                  'Enter fiber in grams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Fiber'
                )}
              />
            </View>
          }
          sugarInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={sugar}
                onChangeText={(text) => setSugar(validateNumericInput(text))}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Sugar',
                  'Enter sugar in grams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Sugar'
                )}
              />
            </View>
          }
          proteinInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={protein}
                onChangeText={(text) => {
                  setProtein(validateNumericInput(text));
                }}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Protein',
                  'Enter protein in grams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Protein'
                )}
              />
            </View>
          }
          sodiumInput={
            <View style={styles.nutritionLabelInputWithUnit}>
              <TextInput
                style={[
                  styles.nutritionLabelInput,
                  styles.nutritionLabelNutrientInput,
                  styles.nutritionLabelNumericInput,
                  { 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)', 
                    borderBottomWidth: 1,
                    color: '#000000',
                    ...(Platform.OS === 'web' ? { 
                      outline: 'none',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    } : {}),
                  }
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={sodium}
                onChangeText={(text) => setSodium(validateNumericInput(text))}
                keyboardType="decimal-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleFormSubmit}
                {...getInputAccessibilityProps(
                  'Sodium',
                  'Enter sodium in milligrams'
                )}
                {...getWebAccessibilityProps(
                  'textbox',
                  'Sodium'
                )}
              />
            </View>
          }
        />
      </View>

      {/* Buttons */}
      <View style={styles.formActions}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.icon + '30' }]}
          onPress={onCancel}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            t('mealtype_log.buttons.cancel'),
            t('quick_log.accessibility.cancel_hint')
          )}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>
            {t('mealtype_log.buttons.cancel')}
          </Text>
        </TouchableOpacity>
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
          {...getButtonAccessibilityProps(
            loading 
              ? (quickLogId ? t('mealtype_log.buttons.updating') : t('mealtype_log.buttons.logging'))
              : (quickLogId ? t('mealtype_log.buttons.update_log') : t('mealtype_log.buttons.log_food')),
            t('quick_log.accessibility.save_hint')
          )}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {quickLogId ? t('mealtype_log.buttons.update_log') : t('mealtype_log.buttons.log_food')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sourceBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    marginBottom: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
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
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  nutritionLabelInput: {
    fontSize: 14,
    paddingVertical: 4,
    paddingHorizontal: 0,
    color: '#000000',
  },
  nutritionLabelNumericInput: {
    width: 30, 
    textAlign: 'right',
  },
  nutritionLabelTitleInput: {
    fontSize: 16,
    fontWeight: '400',
  },
  nutritionLabelSmallInput: {
    fontSize: 14,
    minWidth: 40,
  },
  nutritionLabelCaloriesInput: {
    fontSize: 16,
    fontWeight: '700',
  },
  nutritionLabelNutrientInput: {
    fontSize: 14,
  },
  nutritionLabelInputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 80, // Fixed width container for input + unit (w-20 equivalent)
    gap: 4,
  },
  nutritionLabelUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
  },
});

