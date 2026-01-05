import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { Colors } from '@/constants/theme';
import { RANGES } from '@/constants/constraints';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/utils/calculations';
import { useClampedDateParam } from '@/hooks/use-clamped-date-param';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

// Weight units (for mandatory serving)
const WEIGHT_UNITS = [
  { value: 'g', label: 'Gram (g)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'lb', label: 'Pound (lb)' },
];

// Volume units (for optional serving)
const VOLUME_UNITS = [
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'fl oz', label: 'Fluid Ounce (fl oz)' },
  { value: 'cup', label: 'Cup' },
  { value: 'pint', label: 'Pint' },
  { value: 'quart', label: 'Quart' },
  { value: 'gallon', label: 'Gallon' },
  { value: 'tbsp', label: 'Tablespoon (tbsp)' },
  { value: 'tsp', label: 'Teaspoon (tsp)' },
];

// Conversion factors to grams (for weight units)
const WEIGHT_TO_GRAMS: { [key: string]: number } = {
  'g': 1,
  'kg': 1000,
  'oz': 28.3495,
  'lb': 453.592,
};

// Conversion factors to grams (for volume units - approximate, varies by substance)
// Using water density (1ml = 1g) as baseline
const VOLUME_TO_GRAMS: { [key: string]: number } = {
  'ml': 1,
  'L': 1000,
  'fl oz': 29.5735, // US fluid ounce
  'cup': 236.588, // US cup
  'pint': 473.176, // US pint
  'quart': 946.353, // US quart
  'gallon': 3785.41, // US gallon
  'tbsp': 14.7868, // US tablespoon
  'tsp': 4.92892, // US teaspoon
};

export default function CreateCustomFoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Get meal type and entry date from params (for navigation back)
  const mealType = params.mealType as string || 'breakfast';
  const entryDateParam = params.entryDate as string | undefined;
  const { dateKey: entryDate } = useClampedDateParam({ paramKey: 'entryDate' });
  const foodId = params.foodId as string | undefined;
  const cloneFoodId = params.cloneFoodId as string | undefined;
  const isEditing = !!foodId; // Only true if editing (not cloning)

  // Form state
  const [foodName, setFoodName] = useState('');
  const [brand, setBrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFood, setLoadingFood] = useState(false);

  // Serving type toggle (default: weight-based)
  const [servingType, setServingType] = useState<'weight' | 'volume'>('weight');
  const isWeightBased = servingType === 'weight';

  // Weight-based serving fields
  const [weightQuantity, setWeightQuantity] = useState('100'); // Default to 100g
  const [weightUnit, setWeightUnit] = useState('g');
  const [weightCalories, setWeightCalories] = useState('0');
  const [weightProtein, setWeightProtein] = useState('');
  const [weightCarbs, setWeightCarbs] = useState('');
  const [weightFat, setWeightFat] = useState('');
  const [weightFiber, setWeightFiber] = useState('');
  const [weightSaturatedFat, setWeightSaturatedFat] = useState('');
  const [weightTransFat, setWeightTransFat] = useState('');
  const [weightSugar, setWeightSugar] = useState('');
  const [weightSodium, setWeightSodium] = useState('');

  // Volume-based serving fields
  const [volumeQuantity, setVolumeQuantity] = useState('1');
  const [volumeUnit, setVolumeUnit] = useState('ml');
  const [volumeCalories, setVolumeCalories] = useState('0');

  // Dropdown states
  const [showWeightUnitDropdown, setShowWeightUnitDropdown] = useState(false);
  const [showVolumeUnitDropdown, setShowVolumeUnitDropdown] = useState(false);
  
  // Refs and layout for dropdown positioning
  const weightUnitButtonRef = useRef<View>(null);
  const volumeUnitButtonRef = useRef<View>(null);
  const [weightUnitDropdownLayout, setWeightUnitDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [volumeUnitDropdownLayout, setVolumeUnitDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Validation constants
  const MAX_NAME_LENGTH = 50;
  const MAX_BRAND_LENGTH = 30;
  const MAX_QUANTITY = 100000;
  const MAX_CALORIES = RANGES.CALORIES_KCAL.MAX;
  const MAX_MACRO = 2000;

  // Clear foodName error on mount to ensure clean start (no initial error message)
  useEffect(() => {
    setErrors(prev => {
      if (prev.foodName) {
        const newErrors = { ...prev };
        delete newErrors.foodName;
        return newErrors;
      }
      return prev;
    });
  }, []); // Only run on mount

  // Load food data for editing
  useEffect(() => {
    if (foodId && user?.id) {
      loadFoodForEditing();
    } else if (cloneFoodId && user?.id) {
      loadFoodForCloning();
    }
  }, [foodId, cloneFoodId, user?.id]);

  const loadFoodForEditing = async () => {
    if (!foodId || !user?.id) return;

    setLoadingFood(true);
    try {
      // Fetch food data
      const { data: foodData, error: foodError } = await supabase
        .from('food_master')
        .select('*')
        .eq('id', foodId)
        .eq('owner_user_id', user.id)
        .single();

      if (foodError || !foodData) {
        Alert.alert(t('alerts.error_title'), t('create_custom_food.errors.load_failed'));
        router.back();
        return;
      }

      // Populate form with food data
      setFoodName(foodData.name);
      setBrand(foodData.brand || '');

      // Use serving_size and serving_unit directly from food_master
      // Note: Custom foods store serving info in food_master, not in food_servings
      const servingSize = foodData.serving_size;
      const servingUnit = foodData.serving_unit || 'g';
      
        // Determine if this is weight-based or volume-based
        const isWeightUnit = WEIGHT_UNITS.some(u => u.value === servingUnit);
        setServingType(isWeightUnit ? 'weight' : 'volume');
        
        if (isWeightUnit) {
          setWeightQuantity(servingSize.toString());
          setWeightUnit(servingUnit);
          const caloriesForServing = foodData.calories_kcal;
          setWeightCalories(caloriesForServing > 0 ? caloriesForServing.toFixed(1) : '0');
        } else {
          setVolumeQuantity(servingSize.toString());
          setVolumeUnit(servingUnit);
          const caloriesForServing = foodData.calories_kcal;
          setVolumeCalories(caloriesForServing > 0 ? caloriesForServing.toFixed(1) : '0');
        }

      const proteinForServing = foodData.protein_g || 0;
      setWeightProtein(proteinForServing > 0 ? proteinForServing.toFixed(1) : '');

      const carbsForServing = foodData.carbs_g || 0;
      setWeightCarbs(carbsForServing > 0 ? carbsForServing.toFixed(1) : '');

      const fatForServing = foodData.fat_g || 0;
      setWeightFat(fatForServing > 0 ? fatForServing.toFixed(1) : '');

      const fiberForServing = foodData.fiber_g || 0;
      setWeightFiber(fiberForServing > 0 ? fiberForServing.toFixed(1) : '');

      const satFatForServing = foodData.saturated_fat_g || 0;
      setWeightSaturatedFat(satFatForServing > 0 ? satFatForServing.toFixed(1) : '');

      const transFatForServing = foodData.trans_fat_g || 0;
      setWeightTransFat(transFatForServing > 0 ? transFatForServing.toFixed(1) : '');

      const sugarForServing = foodData.sugar_g || 0;
      setWeightSugar(sugarForServing > 0 ? sugarForServing.toFixed(1) : '');

      const sodiumForServing = foodData.sodium_mg || 0;
      setWeightSodium(sodiumForServing > 0 ? sodiumForServing.toFixed(1) : '');

    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('create_custom_food.errors.load_error', { error: error.message || t('common.unexpected_error') }));
      router.back();
    } finally {
      setLoadingFood(false);
    }
  };

  const loadFoodForCloning = async () => {
    if (!cloneFoodId || !user?.id) return;

    setLoadingFood(true);
    try {
      // Fetch food data (can be from any user since we're cloning)
      const { data: foodData, error: foodError } = await supabase
        .from('food_master')
        .select('*')
        .eq('id', cloneFoodId)
        .single();

      if (foodError || !foodData) {
        Alert.alert(t('alerts.error_title'), t('create_custom_food.errors.clone_load_failed'));
        router.back();
        return;
      }

      // Populate form with food data (same as editing, but we're creating a new food)
      // Add "Copy of " prefix and truncate if needed
      const copyPrefix = 'Copy of ';
      const originalName = foodData.name;
      const newName = copyPrefix + originalName;
      // Truncate if exceeds MAX_NAME_LENGTH
      const truncatedName = newName.length > MAX_NAME_LENGTH 
        ? copyPrefix + originalName.substring(0, MAX_NAME_LENGTH - copyPrefix.length)
        : newName;
      setFoodName(truncatedName);
      setBrand(foodData.brand || '');

      // Check if this is a custom food (uses food_master directly) or standard food (uses food_servings)
      // For custom foods created with new logic, we use food_master directly
      // For standard foods, we try to use food_servings first
      
      let hasSetFromServings = false;
      
      // Try to fetch servings to get the default serving (for standard foods)
      const { data: servingsData } = await supabase
        .from('food_servings')
        .select('*')
        .eq('food_id', cloneFoodId)
        .eq('is_default', true)
        .single();

      if (servingsData) {
        hasSetFromServings = true;
        // Parse serving name to get quantity and unit (e.g., "100 g" -> 100, "g")
        const servingMatch = servingsData.serving_name.match(/^([\d.]+)\s*(.+)$/);
        if (servingMatch) {
          setWeightQuantity(servingMatch[1]);
          setWeightUnit(servingMatch[2].trim());
        } else {
          // Fallback: use weight_g or volume_ml from serving
          const servingValue = servingsData.weight_g ?? servingsData.volume_ml ?? 0;
          setWeightQuantity(servingValue.toString());
          setWeightUnit('g');
        }

        // Calculate values for the serving size
        const servingGrams = servingsData.weight_g ?? servingsData.volume_ml ?? 0;
        const caloriesForServing = (foodData.calories_kcal / 100) * servingGrams;
        setWeightCalories(caloriesForServing.toFixed(1));

        // Set macronutrients (same for both weight and volume)
        const proteinForServing = foodData.protein_g ? (foodData.protein_g / 100) * servingGrams : 0;
        setWeightProtein(proteinForServing > 0 ? proteinForServing.toFixed(1) : '');

        const carbsForServing = foodData.carbs_g ? (foodData.carbs_g / 100) * servingGrams : 0;
        setWeightCarbs(carbsForServing > 0 ? carbsForServing.toFixed(1) : '');

        const fatForServing = foodData.fat_g ? (foodData.fat_g / 100) * servingGrams : 0;
        setWeightFat(fatForServing > 0 ? fatForServing.toFixed(1) : '');

        const fiberForServing = foodData.fiber_g ? (foodData.fiber_g / 100) * servingGrams : 0;
        setWeightFiber(fiberForServing > 0 ? fiberForServing.toFixed(1) : '');

        const satFatForServing = foodData.saturated_fat_g ? (foodData.saturated_fat_g / 100) * servingGrams : 0;
        setWeightSaturatedFat(satFatForServing > 0 ? satFatForServing.toFixed(1) : '');

        const transFatForServing = foodData.trans_fat_g ? (foodData.trans_fat_g / 100) * servingGrams : 0;
        setWeightTransFat(transFatForServing > 0 ? transFatForServing.toFixed(1) : '');

        const sugarForServing = foodData.sugar_g ? (foodData.sugar_g / 100) * servingGrams : 0;
        setWeightSugar(sugarForServing > 0 ? sugarForServing.toFixed(1) : '');

        const sodiumForServing = foodData.sodium_mg ? (foodData.sodium_mg / 100) * servingGrams : 0;
        setWeightSodium(sodiumForServing > 0 ? sodiumForServing.toFixed(1) : '');
      }
      
      // If no food_servings found, use food_master directly (for custom foods)
      if (!hasSetFromServings) {
        const servingSize = foodData.serving_size;
        const servingUnit = foodData.serving_unit || 'g';
        
        // Determine if this is weight-based or volume-based
        const isWeightUnit = WEIGHT_UNITS.some(u => u.value === servingUnit);
        setServingType(isWeightUnit ? 'weight' : 'volume');
        
        if (isWeightUnit) {
          setWeightQuantity(servingSize.toString());
          setWeightUnit(servingUnit);
          const caloriesForServing = foodData.calories_kcal;
          setWeightCalories(caloriesForServing > 0 ? caloriesForServing.toFixed(1) : '0');
        } else {
          setVolumeQuantity(servingSize.toString());
          setVolumeUnit(servingUnit);
          const caloriesForServing = foodData.calories_kcal;
          setVolumeCalories(caloriesForServing > 0 ? caloriesForServing.toFixed(1) : '0');
        }

        const proteinForServing = foodData.protein_g || 0;
        setWeightProtein(proteinForServing > 0 ? proteinForServing.toFixed(1) : '');

        const carbsForServing = foodData.carbs_g || 0;
        setWeightCarbs(carbsForServing > 0 ? carbsForServing.toFixed(1) : '');

        const fatForServing = foodData.fat_g || 0;
        setWeightFat(fatForServing > 0 ? fatForServing.toFixed(1) : '');

        const fiberForServing = foodData.fiber_g || 0;
        setWeightFiber(fiberForServing > 0 ? fiberForServing.toFixed(1) : '');

        const satFatForServing = foodData.saturated_fat_g || 0;
        setWeightSaturatedFat(satFatForServing > 0 ? satFatForServing.toFixed(1) : '');

        const transFatForServing = foodData.trans_fat_g || 0;
        setWeightTransFat(transFatForServing > 0 ? transFatForServing.toFixed(1) : '');

        const sugarForServing = foodData.sugar_g || 0;
        setWeightSugar(sugarForServing > 0 ? sugarForServing.toFixed(1) : '');

        const sodiumForServing = foodData.sodium_mg || 0;
        setWeightSodium(sodiumForServing > 0 ? sodiumForServing.toFixed(1) : '');
      }

    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('create_custom_food.errors.load_error', { error: error.message || t('common.unexpected_error') }));
      router.back();
    } finally {
      setLoadingFood(false);
    }
  };

  // Helper: keep only digits/one dot, cap at 4 digits before and 2 after decimal
  const formatNumberInput = (text: string): string => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const [rawInt = '', rawFrac = ''] = cleaned.split('.');

    const intPart = rawInt.slice(0, 4);
    const fracPart = rawFrac.slice(0, 2);

    if (cleaned.includes('.')) {
      return `${intPart || '0'}${fracPart ? `.${fracPart}` : '.'}`;
    }

    return intPart;
  };

  // Calculate grams from weight unit
  const calculateWeightGrams = (quantity: number, unit: string): number => {
    const factor = WEIGHT_TO_GRAMS[unit] || 1;
    return quantity * factor;
  };

  // Calculate grams from volume unit (approximate, using water density)
  const calculateVolumeGrams = (quantity: number, unit: string): number => {
    const factor = VOLUME_TO_GRAMS[unit] || 1;
    return quantity * factor;
  };

  // Real-time validation function (excludes foodName to avoid showing errors initially)
  const validateFields = () => {
    const newErrors: { [key: string]: string } = {};
    
    // Don't validate food name in real-time - only validate on submit
    // This allows the field to start clean with character count
    
    // Validate brand
    if (brand && brand.length > MAX_BRAND_LENGTH) {
      newErrors.brand = t('create_custom_food.validation.brand_too_long', { max: MAX_BRAND_LENGTH, current: brand.length });
    }
    
    // Validate based on serving type
    if (isWeightBased) {
      // Validate weight quantity
      const parsedWeightQuantity = parseFloat(weightQuantity);
      if (!weightQuantity || isNaN(parsedWeightQuantity) || !isFinite(parsedWeightQuantity) || parsedWeightQuantity <= 0) {
        newErrors.weightQuantity = t('create_custom_food.validation.quantity_required');
      } else if (parsedWeightQuantity > MAX_QUANTITY) {
        newErrors.weightQuantity = t('create_custom_food.validation.quantity_exceeds_limit', { max: MAX_QUANTITY.toLocaleString() });
      }
      
      // Validate weight calories
      const parsedWeightCalories = parseFloat(weightCalories);
      if (!weightCalories || weightCalories.trim() === '' || isNaN(parsedWeightCalories) || !isFinite(parsedWeightCalories) || parsedWeightCalories < 0) {
        newErrors.weightCalories = t('create_custom_food.validation.calories_required');
      } else if (parsedWeightCalories > MAX_CALORIES) {
        newErrors.weightCalories = t('create_custom_food.validation.calories_exceeds_limit', { max: MAX_CALORIES.toLocaleString(), current: parsedWeightCalories.toLocaleString() });
      }
    } else {
      // Validate volume quantity
      const parsedVolumeQuantity = parseFloat(volumeQuantity);
      if (!volumeQuantity || isNaN(parsedVolumeQuantity) || !isFinite(parsedVolumeQuantity) || parsedVolumeQuantity <= 0) {
        newErrors.volumeQuantity = t('create_custom_food.validation.volume_quantity_required');
      } else if (parsedVolumeQuantity > MAX_QUANTITY) {
        newErrors.volumeQuantity = t('create_custom_food.validation.volume_quantity_exceeds_limit', { max: MAX_QUANTITY.toLocaleString() });
      }
      
      // Validate volume calories
      const parsedVolumeCalories = parseFloat(volumeCalories);
      if (!volumeCalories || volumeCalories.trim() === '' || isNaN(parsedVolumeCalories) || !isFinite(parsedVolumeCalories) || parsedVolumeCalories < 0) {
        newErrors.volumeCalories = t('create_custom_food.validation.volume_calories_required');
      } else if (parsedVolumeCalories > MAX_CALORIES) {
        newErrors.volumeCalories = t('create_custom_food.validation.volume_calories_exceeds_limit', { max: MAX_CALORIES.toLocaleString(), current: parsedVolumeCalories.toLocaleString() });
      }
    }
    
    // Validate macros (if provided)
    if (weightProtein) {
      const parsedProtein = parseFloat(weightProtein);
      if (isNaN(parsedProtein) || !isFinite(parsedProtein)) {
        newErrors.weightProtein = t('create_custom_food.validation.protein_invalid');
      } else if (parsedProtein > MAX_MACRO) {
        newErrors.weightProtein = t('create_custom_food.validation.protein_exceeds_limit', { max: MAX_MACRO.toLocaleString() });
      }
    }
    
    if (weightCarbs) {
      const parsedCarbs = parseFloat(weightCarbs);
      if (isNaN(parsedCarbs) || !isFinite(parsedCarbs)) {
        newErrors.weightCarbs = t('create_custom_food.validation.carbs_invalid');
      } else if (parsedCarbs > MAX_MACRO) {
        newErrors.weightCarbs = t('create_custom_food.validation.carbs_exceeds_limit', { max: MAX_MACRO.toLocaleString() });
      }
    }
    
    if (weightFat) {
      const parsedFat = parseFloat(weightFat);
      if (isNaN(parsedFat) || !isFinite(parsedFat)) {
        newErrors.weightFat = t('create_custom_food.validation.fat_invalid');
      } else if (parsedFat > MAX_MACRO) {
        newErrors.weightFat = t('create_custom_food.validation.fat_exceeds_limit', { max: MAX_MACRO.toLocaleString() });
      }
    }
    
    if (weightFiber) {
      const parsedFiber = parseFloat(weightFiber);
      if (isNaN(parsedFiber) || !isFinite(parsedFiber)) {
        newErrors.weightFiber = t('create_custom_food.validation.fiber_invalid');
      } else if (parsedFiber > MAX_MACRO) {
        newErrors.weightFiber = t('create_custom_food.validation.fiber_exceeds_limit', { max: MAX_MACRO.toLocaleString() });
      }
    }
    
    // Validate fatty acids (if provided)
    if (weightSaturatedFat) {
      const parsedSaturatedFat = parseFloat(weightSaturatedFat);
      if (isNaN(parsedSaturatedFat) || !isFinite(parsedSaturatedFat)) {
        newErrors.weightSaturatedFat = t('create_custom_food.validation.saturated_fat_invalid');
      } else if (parsedSaturatedFat > MAX_MACRO) {
        newErrors.weightSaturatedFat = t('create_custom_food.validation.saturated_fat_exceeds_limit', { max: MAX_MACRO.toLocaleString() });
      }
    }
    if (weightTransFat) {
      const parsedTransFat = parseFloat(weightTransFat);
      if (isNaN(parsedTransFat) || !isFinite(parsedTransFat)) {
        newErrors.weightTransFat = t('create_custom_food.validation.trans_fat_invalid');
      } else if (parsedTransFat > MAX_MACRO) {
        newErrors.weightTransFat = t('create_custom_food.validation.trans_fat_exceeds_limit', { max: MAX_MACRO.toLocaleString() });
      }
    }
    
    if (weightSugar) {
      const parsedSugar = parseFloat(weightSugar);
      if (isNaN(parsedSugar) || !isFinite(parsedSugar)) {
        newErrors.weightSugar = t('create_custom_food.validation.sugar_invalid');
      } else if (parsedSugar > MAX_MACRO) {
        newErrors.weightSugar = t('create_custom_food.validation.sugar_exceeds_limit', { max: MAX_MACRO.toLocaleString() });
      }
    }
    
    if (weightSodium) {
      const parsedSodium = parseFloat(weightSodium);
      if (isNaN(parsedSodium) || !isFinite(parsedSodium)) {
        newErrors.weightSodium = t('create_custom_food.validation.sodium_invalid');
      } else if (parsedSodium > 10000) {
        newErrors.weightSodium = t('create_custom_food.validation.sodium_exceeds_limit', { max: '10,000' });
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Run validation whenever values change (excluding foodName to avoid showing errors initially)
  useEffect(() => {
    validateFields();
  }, [brand, weightQuantity, weightCalories, volumeQuantity, volumeCalories, weightProtein, weightCarbs, weightFat, weightFiber, weightSaturatedFat, weightTransFat, weightSugar, weightSodium, isWeightBased]);
  
  // Check if form is valid (for Save button) - don't call validateFields to avoid infinite loop
  const isFormValid = () => {
    if (!foodName.trim()) return false;
    if (foodName.length > MAX_NAME_LENGTH) return false;
    if (brand && brand.length > MAX_BRAND_LENGTH) return false;
    
    if (isWeightBased) {
      const parsedWeightQuantity = parseFloat(weightQuantity);
      if (!weightQuantity || isNaN(parsedWeightQuantity) || !isFinite(parsedWeightQuantity) || parsedWeightQuantity <= 0) return false;
      if (parsedWeightQuantity > MAX_QUANTITY) return false;
      
      const parsedWeightCalories = parseFloat(weightCalories);
      if (!weightCalories || weightCalories.trim() === '' || isNaN(parsedWeightCalories) || !isFinite(parsedWeightCalories) || parsedWeightCalories < 0) return false;
      if (parsedWeightCalories > MAX_CALORIES) return false;
    } else {
      const parsedVolumeQuantity = parseFloat(volumeQuantity);
      if (!volumeQuantity || isNaN(parsedVolumeQuantity) || !isFinite(parsedVolumeQuantity) || parsedVolumeQuantity <= 0) return false;
      if (parsedVolumeQuantity > MAX_QUANTITY) return false;
      
      const parsedVolumeCalories = parseFloat(volumeCalories);
      if (!volumeCalories || volumeCalories.trim() === '' || isNaN(parsedVolumeCalories) || !isFinite(parsedVolumeCalories) || parsedVolumeCalories < 0) return false;
      if (parsedVolumeCalories > MAX_CALORIES) return false;
    }
    
    // Check macros
    if (weightProtein) {
      const parsedProtein = parseFloat(weightProtein);
      if (isNaN(parsedProtein) || !isFinite(parsedProtein) || parsedProtein > MAX_MACRO) return false;
    }
    if (weightCarbs) {
      const parsedCarbs = parseFloat(weightCarbs);
      if (isNaN(parsedCarbs) || !isFinite(parsedCarbs) || parsedCarbs > MAX_MACRO) return false;
    }
    if (weightFat) {
      const parsedFat = parseFloat(weightFat);
      if (isNaN(parsedFat) || !isFinite(parsedFat) || parsedFat > MAX_MACRO) return false;
    }
    if (weightFiber) {
      const parsedFiber = parseFloat(weightFiber);
      if (isNaN(parsedFiber) || !isFinite(parsedFiber) || parsedFiber > MAX_MACRO) return false;
    }
    if (weightSaturatedFat) {
      const parsedSaturatedFat = parseFloat(weightSaturatedFat);
      if (isNaN(parsedSaturatedFat) || !isFinite(parsedSaturatedFat) || parsedSaturatedFat > MAX_MACRO) return false;
    }
    if (weightTransFat) {
      const parsedTransFat = parseFloat(weightTransFat);
      if (isNaN(parsedTransFat) || !isFinite(parsedTransFat) || parsedTransFat > MAX_MACRO) return false;
    }
    if (weightSugar) {
      const parsedSugar = parseFloat(weightSugar);
      if (isNaN(parsedSugar) || !isFinite(parsedSugar) || parsedSugar > MAX_MACRO) return false;
    }
    if (weightSodium) {
      const parsedSodium = parseFloat(weightSodium);
      if (isNaN(parsedSodium) || !isFinite(parsedSodium) || parsedSodium > 10000) return false;
    }
    
    return true;
  };
  
  // Validate form - returns errors object (for async validation like duplicate check)
  const validateForm = async (): Promise<{ isValid: boolean; errors: { [key: string]: string } }> => {
    const newErrors: { [key: string]: string } = { ...errors };

    if (!foodName.trim()) {
      newErrors.foodName = t('create_custom_food.validation.name_required');
    } else if (foodName.length > MAX_NAME_LENGTH) {
      newErrors.foodName = t('create_custom_food.validation.name_too_long', { max: MAX_NAME_LENGTH, current: foodName.length });
    } else {
      // Check for duplicate Name+brand combination (only when creating, not editing)
      if (!isEditing && user?.id) {
        const nameTrimmed = foodName.trim();
        const brandTrimmed = brand.trim() || null;
        
        let query = supabase
          .from('food_master')
          .select('id')
          .eq('owner_user_id', user.id)
          .eq('is_custom', true)
          .eq('name', nameTrimmed);
        
        if (brandTrimmed) {
          query = query.eq('brand', brandTrimmed);
        } else {
          query = query.is('brand', null);
        }
        
        const { data: existingFoods, error: checkError } = await query;
        
        if (!checkError && existingFoods && existingFoods.length > 0) {
          newErrors.foodName = brandTrimmed 
            ? t('create_custom_food.validation.duplicate_name_brand', { brand: brandTrimmed })
            : t('create_custom_food.validation.duplicate_name');
        }
      }
    }

    // Validate based on serving type
    if (isWeightBased) {
      if (!weightQuantity || isNaN(parseFloat(weightQuantity)) || parseFloat(weightQuantity) <= 0) {
        newErrors.weightQuantity = t('create_custom_food.validation.quantity_required');
      } else if (parseFloat(weightQuantity) > MAX_QUANTITY) {
        newErrors.weightQuantity = t('create_custom_food.validation.quantity_exceeds_limit', { max: MAX_QUANTITY.toLocaleString() });
      }

      if (!weightCalories || isNaN(parseFloat(weightCalories)) || parseFloat(weightCalories) < 0) {
        newErrors.weightCalories = t('create_custom_food.validation.calories_required');
      } else if (parseFloat(weightCalories) > MAX_CALORIES) {
        newErrors.weightCalories = t('create_custom_food.validation.calories_exceeds_limit', { max: MAX_CALORIES.toLocaleString(), current: parseFloat(weightCalories).toLocaleString() });
      }
    } else {
      if (!volumeQuantity || isNaN(parseFloat(volumeQuantity)) || parseFloat(volumeQuantity) <= 0) {
        newErrors.volumeQuantity = t('create_custom_food.validation.volume_quantity_required');
      } else if (parseFloat(volumeQuantity) > MAX_QUANTITY) {
        newErrors.volumeQuantity = t('create_custom_food.validation.volume_quantity_exceeds_limit', { max: MAX_QUANTITY.toLocaleString() });
      }

      if (!volumeCalories || isNaN(parseFloat(volumeCalories)) || parseFloat(volumeCalories) < 0) {
        newErrors.volumeCalories = t('create_custom_food.validation.volume_calories_required');
      } else if (parseFloat(volumeCalories) > MAX_CALORIES) {
        newErrors.volumeCalories = t('create_custom_food.validation.volume_calories_exceeds_limit', { max: MAX_CALORIES.toLocaleString(), current: parseFloat(volumeCalories).toLocaleString() });
      }
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  // Handle save
  const handleSave = async () => {
    // Prevent multiple submissions
    if (loading) {
      return;
    }

    // Close any open dropdowns
    setShowWeightUnitDropdown(false);
    setShowVolumeUnitDropdown(false);

    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('create_custom_food.errors.not_logged_in'));
      return;
    }

    // Set loading early to prevent multiple submissions
    setLoading(true);

    const validation = await validateForm();

    if (!validation.isValid) {
      // Show first error
      const firstErrorKey = Object.keys(validation.errors)[0];
      if (firstErrorKey) {
        Alert.alert(t('alerts.validation_error'), `${t('create_custom_food.validation.fix_errors')}\n\n${validation.errors[firstErrorKey]}`);
      } else {
        Alert.alert(t('alerts.validation_error'), t('create_custom_food.validation.fix_errors'));
      }
      setLoading(false);
      return;
    }

    // Check custom food limit when creating new food (not editing)
    // Note: Cloning also creates a new food, so it's subject to the limit
    if (!isEditing && user?.id) {
      const { count, error: countError } = await supabase
        .from('food_master')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
        .eq('is_custom', true);

      if (!countError && count !== null && count >= 50) {
        Alert.alert(
          t('create_custom_food.errors.limit_reached_title'),
          t('create_custom_food.errors.limit_reached_message')
        );
        setLoading(false);
        return;
      }
    }

    try {
      // Get values based on serving type
      const quantity = isWeightBased ? parseFloat(weightQuantity) : parseFloat(volumeQuantity);
      const unit = isWeightBased ? weightUnit : volumeUnit;
      const calories = isWeightBased ? parseFloat(weightCalories) : parseFloat(volumeCalories);

      // Validate
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error(t('create_custom_food.validation.invalid_serving_quantity', { value: quantity }));
      }

      if (isNaN(calories) || calories < 0) {
        throw new Error(t('create_custom_food.validation.invalid_calories', { value: calories }));
      }

      // For custom foods, store values directly for the serving_size
      // serving_size and serving_unit represent the user's input (e.g., 1 oz, 100 g, 250 ml)
      // Nutrients are stored per serving_size × serving_unit
      const foodUpdateData = {
        name: foodName.trim(),
        brand: brand.trim() || null,
        serving_size: quantity,   // Store the user's quantity directly
        serving_unit: unit,      // Store the user's unit directly
        calories_kcal: calories, // Store directly for serving_size
        protein_g: weightProtein ? parseFloat(weightProtein) : null,
        carbs_g: weightCarbs ? parseFloat(weightCarbs) : null,
        fat_g: weightFat ? parseFloat(weightFat) : null,
        fiber_g: weightFiber ? parseFloat(weightFiber) : null,
        saturated_fat_g: weightSaturatedFat ? parseFloat(weightSaturatedFat) : null,
        trans_fat_g: weightTransFat ? parseFloat(weightTransFat) : null,
        sugar_g: weightSugar ? parseFloat(weightSugar) : null,
        sodium_mg: weightSodium ? parseFloat(weightSodium) : null,
      };

      let foodData;

      if (isEditing && foodId) {
        // Update existing food
        const { data: updatedFood, error: foodError } = await supabase
          .from('food_master')
          .update(foodUpdateData)
          .eq('id', foodId)
          .eq('owner_user_id', user.id)
          .select()
          .single();

        if (foodError) {
          throw new Error(t('create_custom_food.errors.update_failed', { error: foodError.message || JSON.stringify(foodError) }));
        }

        if (!updatedFood) {
          throw new Error(t('create_custom_food.errors.update_no_data'));
        }

        foodData = updatedFood;
      } else {
        // Create new food
        // When cloning, explicitly exclude barcode (set to null)
        const { data: newFood, error: foodError } = await supabase
          .from('food_master')
          .insert({
            ...foodUpdateData,
            barcode: null, // Explicitly set barcode to null when creating/cloning
            is_custom: true,
            owner_user_id: user.id,
            source: 'user_created',
          })
          .select()
          .single();

        if (foodError) {
          throw new Error(t('create_custom_food.errors.create_failed', { error: foodError.message || JSON.stringify(foodError) }));
        }

        if (!newFood) {
          throw new Error(t('create_custom_food.errors.create_no_data'));
        }

        foodData = newFood;
      }

      // Note: No food_servings records are created for custom foods
      // The serving info is stored directly in food_master (serving_size, serving_unit)
      
      // Invalidate custom foods cache immediately so it appears right away
      queryClient.invalidateQueries({ queryKey: ['customFoods', user.id] });
      
      // Navigate back to mealtype-log page with custom tab selected
      // Use push instead of replace to ensure params are updated
      router.push({
        pathname: '/(tabs)/mealtype-log',
        params: {
          mealType,
          entryDate,
          activeTab: 'custom',
          refreshCustomFoods: Date.now().toString(), // Force refresh detection
          ...(isEditing 
            ? { newlyEditedFoodId: foodData.id } // Pass the ID of the edited food
            : { newlyAddedFoodId: foodData.id }  // Pass the ID of the newly created food
          ),
        },
      });
    } catch (error: any) {
      let errorMessage = t('create_custom_food.errors.save_failed');
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error_description) {
        errorMessage = error.error_description;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = String(error);
        }
      }
      
      Alert.alert(t('alerts.error_title'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while loading food data for editing
  if (loadingFood) {
    return (
      <View style={{ flex: 1 }}>
        <BlockingBrandedLoader enabled={true} timeoutMs={5000} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          // Close dropdowns when scrolling
          setShowWeightUnitDropdown(false);
          setShowVolumeUnitDropdown(false);
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.backButton,
              getMinTouchTargetStyle(),
              { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
            ]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              'Go back',
              'Double tap to go back'
            )}
          >
            <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>←</ThemedText>
          </TouchableOpacity>
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {isEditing ? t('create_custom_food.title_edit') : (cloneFoodId ? t('create_custom_food.title_clone') : t('create_custom_food.title_create'))}
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.checkmarkButton,
              getMinTouchTargetStyle(),
              {
                opacity: (loading || !isFormValid()) ? 0.4 : 1,
                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})
              }
            ]}
            onPress={(e) => {
              e?.stopPropagation?.();
              handleSave();
            }}
            disabled={loading || !isFormValid()}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              'Save',
              'Double tap to save'
            )}
          >
            <IconSymbol 
              name="checkmark" 
              size={24} 
              color={(loading || !isFormValid()) ? colors.icon : colors.tint}
            />
          </TouchableOpacity>
        </View>

        {/* Step 1: Your Food's Name */}
        <View style={[styles.requiredSection, { backgroundColor: colors.background, borderColor: colors.tint + '30' }]}>
          <View style={styles.sectionContent}>
            <ThemedText style={[styles.stepTitle, { color: colors.text }]}>
              {t('create_custom_food.step1_title')}
            </ThemedText>
            
            {/* Food Name */}
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.required_section.food_name_label')}</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: errors.foodName ? '#EF4444' : colors.icon + '30', color: colors.text }
                ]}
                placeholder={t('create_custom_food.required_section.food_name_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={foodName}
                onChangeText={(text) => {
                  if (text.length <= MAX_NAME_LENGTH) {
                    setFoodName(text);
                    // Clear foodName error when user starts typing
                    if (errors.foodName) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.foodName;
                        return newErrors;
                      });
                    }
                  }
                }}
                maxLength={MAX_NAME_LENGTH}
                autoCapitalize="words"
              />
              {errors.foodName ? (
                <Text style={styles.errorText}>{errors.foodName}</Text>
              ) : (
                <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
                  {t('create_custom_food.characters_count', { count: foodName.length, max: MAX_NAME_LENGTH })}
                </ThemedText>
              )}
            </View>

            {/* Serving Type Toggle */}
            <View style={styles.field}>
              <SegmentedToggle
                options={[
                  { key: 'weight', label: t('create_custom_food.serving_type_toggle.weight_based') },
                  { key: 'volume', label: t('create_custom_food.serving_type_toggle.volume_based') },
                ]}
                value={servingType}
                onChange={setServingType}
              />
            </View>

            {/* Weight-Based Serving Fields */}
            {isWeightBased && (
              <View style={styles.field}>
                <View style={styles.inlineRow}>
                  <View style={{ flex: 1, marginRight: 4 }}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.weight_serving.quantity_label')}</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        { borderColor: errors.weightQuantity ? '#EF4444' : colors.icon + '30', color: colors.text }
                      ]}
                      placeholder={t('create_custom_food.weight_serving.quantity_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={weightQuantity}
                      onChangeText={(text) => {
                        setWeightQuantity(formatNumberInput(text));
                      }}
                      keyboardType="decimal-pad"
                    />
                    {errors.weightQuantity && <Text style={styles.errorText}>{errors.weightQuantity}</Text>}
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 4 }}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.weight_serving.unit_label')}</ThemedText>
                    <View
                      ref={weightUnitButtonRef}
                      onLayout={() => {
                        weightUnitButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                          setWeightUnitDropdownLayout({ x: pageX, y: pageY + height, width, height });
                        });
                      }}
                    >
                      <TouchableOpacity
                        style={[styles.input, styles.dropdownButton, { borderColor: colors.icon + '30' }]}
                        onPress={() => {
                          weightUnitButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                            setWeightUnitDropdownLayout({ x: pageX, y: pageY + height, width, height });
                            setShowWeightUnitDropdown(!showWeightUnitDropdown);
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <ThemedText style={[styles.dropdownButtonText, { color: colors.text }]}>
                          {WEIGHT_UNITS.find(u => u.value === weightUnit)?.label || weightUnit}
                        </ThemedText>
                        <ThemedText style={[styles.dropdownArrow, { color: colors.textSecondary }]}>▼</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 4 }}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.weight_serving.calories_label')}</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        { borderColor: errors.weightCalories ? '#EF4444' : colors.icon + '30', color: colors.text }
                      ]}
                      placeholder={t('create_custom_food.weight_serving.calories_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={weightCalories}
                      onChangeText={(text) => {
                        setWeightCalories(formatNumberInput(text));
                      }}
                      keyboardType="decimal-pad"
                    />
                    {errors.weightCalories && <Text style={styles.errorText}>{errors.weightCalories}</Text>}
                  </View>
                </View>
              </View>
            )}

            {/* Volume-Based Serving Fields */}
            {!isWeightBased && (
              <View style={styles.field}>
                <View style={styles.inlineRow}>
                  <View style={{ flex: 1, marginRight: 4 }}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.volume_serving.quantity_label')}</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        { borderColor: errors.volumeQuantity ? '#EF4444' : colors.icon + '30', color: colors.text }
                      ]}
                      placeholder={t('create_custom_food.volume_serving.quantity_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={volumeQuantity}
                      onChangeText={(text) => {
                        setVolumeQuantity(formatNumberInput(text));
                      }}
                      keyboardType="decimal-pad"
                    />
                    {errors.volumeQuantity && <Text style={styles.errorText}>{errors.volumeQuantity}</Text>}
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 4 }}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.volume_serving.unit_label')}</ThemedText>
                    <View
                      ref={volumeUnitButtonRef}
                      onLayout={() => {
                        volumeUnitButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                          setVolumeUnitDropdownLayout({ x: pageX, y: pageY + height, width, height });
                        });
                      }}
                    >
                      <TouchableOpacity
                        style={[styles.input, styles.dropdownButton, { borderColor: colors.icon + '30' }]}
                        onPress={() => {
                          volumeUnitButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                            setVolumeUnitDropdownLayout({ x: pageX, y: pageY + height, width, height });
                            setShowVolumeUnitDropdown(!showVolumeUnitDropdown);
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <ThemedText style={[styles.dropdownButtonText, { color: colors.text }]}>
                          {VOLUME_UNITS.find(u => u.value === volumeUnit)?.label || volumeUnit}
                        </ThemedText>
                        <ThemedText style={[styles.dropdownArrow, { color: colors.textSecondary }]}>▼</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 4 }}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.volume_serving.calories_label')}</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        { borderColor: errors.volumeCalories ? '#EF4444' : colors.icon + '30', color: colors.text }
                      ]}
                      placeholder={t('create_custom_food.volume_serving.calories_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={volumeCalories}
                      onChangeText={(text) => {
                        setVolumeCalories(formatNumberInput(text));
                      }}
                      keyboardType="decimal-pad"
                    />
                    {errors.volumeCalories && <Text style={styles.errorText}>{errors.volumeCalories}</Text>}
                  </View>
                </View>
              </View>
            )}

            {/* Macronutrients */}
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.macronutrients.title')}</ThemedText>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1, marginRight: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.macronutrients.protein')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightProtein ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightProtein}
                    onChangeText={(text) => setWeightProtein(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightProtein && <Text style={styles.errorText}>{errors.weightProtein}</Text>}
                </View>
                <View style={[styles.field, { flex: 1, marginHorizontal: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.macronutrients.carbs')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightCarbs ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightCarbs}
                    onChangeText={(text) => setWeightCarbs(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightCarbs && <Text style={styles.errorText}>{errors.weightCarbs}</Text>}
                </View>
                <View style={[styles.field, { flex: 1, marginHorizontal: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.macronutrients.fat')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightFat ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightFat}
                    onChangeText={(text) => setWeightFat(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightFat && <Text style={styles.errorText}>{errors.weightFat}</Text>}
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.macronutrients.fiber')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightFiber ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightFiber}
                    onChangeText={(text) => setWeightFiber(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightFiber && <Text style={styles.errorText}>{errors.weightFiber}</Text>}
                </View>
              </View>
            </View>

            {/* Other Nutrients (Optional) */}
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.other_nutrients.title')}</ThemedText>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1, marginRight: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.other_nutrients.saturated_fat')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightSaturatedFat ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightSaturatedFat}
                    onChangeText={(text) => setWeightSaturatedFat(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightSaturatedFat && <Text style={styles.errorText}>{errors.weightSaturatedFat}</Text>}
                </View>
                <View style={[styles.field, { flex: 1, marginHorizontal: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.other_nutrients.trans_fat')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightTransFat ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightTransFat}
                    onChangeText={(text) => setWeightTransFat(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightTransFat && <Text style={styles.errorText}>{errors.weightTransFat}</Text>}
                </View>
                <View style={[styles.field, { flex: 1, marginHorizontal: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.other_nutrients.sugar')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightSugar ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightSugar}
                    onChangeText={(text) => setWeightSugar(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightSugar && <Text style={styles.errorText}>{errors.weightSugar}</Text>}
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: 4 }]}>
                  <ThemedText style={[styles.subLabel, { color: colors.text }]}>{t('create_custom_food.other_nutrients.sodium')}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: errors.weightSodium ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                    placeholder={t('create_custom_food.other_nutrients.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={weightSodium}
                    onChangeText={(text) => setWeightSodium(formatNumberInput(text))}
                    keyboardType="decimal-pad"
                  />
                  {errors.weightSodium && <Text style={styles.errorText}>{errors.weightSodium}</Text>}
                </View>
              </View>
            </View>

            {/* Brand (Optional) */}
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: colors.text }]}>{t('create_custom_food.optional_section.brand_label')}</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: errors.brand ? '#EF4444' : colors.icon + '30', color: colors.text }]}
                placeholder={t('create_custom_food.optional_section.brand_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={brand}
                onChangeText={setBrand}
                maxLength={MAX_BRAND_LENGTH}
                autoCapitalize="words"
              />
              {errors.brand && <Text style={styles.errorText}>{errors.brand}</Text>}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={[styles.formActions, { zIndex: 1 }]}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.icon + '30' }]}
            onPress={() => {
              setShowWeightUnitDropdown(false);
              setShowVolumeUnitDropdown(false);
              router.back();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('create_custom_food.buttons.cancel')}</Text>
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
            onPress={(e) => {
              e?.stopPropagation?.();
              handleSave();
            }}
            disabled={loading || !isFormValid()}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>
              {loading 
                ? (isEditing ? t('create_custom_food.buttons.updating') : cloneFoodId ? t('create_custom_food.buttons.cloning') : t('create_custom_food.buttons.creating')) 
                : (isEditing ? t('create_custom_food.buttons.update') : cloneFoodId ? t('create_custom_food.buttons.clone') : t('create_custom_food.buttons.create'))}
            </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Weight Unit Dropdown - Rendered at root level for proper z-index */}
      {showWeightUnitDropdown && weightUnitDropdownLayout && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowWeightUnitDropdown(false)}
          />
          <View 
            style={[
              styles.dropdown,
              {
                backgroundColor: colors.background,
                borderColor: colors.icon + '30',
                position: 'absolute',
                top: weightUnitDropdownLayout.y,
                left: weightUnitDropdownLayout.x,
                width: weightUnitDropdownLayout.width,
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
              {WEIGHT_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  style={[
                    styles.dropdownItem,
                    weightUnit === unit.value && { backgroundColor: colors.tint + '20' },
                    { borderBottomColor: colors.icon + '15' }
                  ]}
                  onPress={() => {
                    setWeightUnit(unit.value);
                    setShowWeightUnitDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[
                    styles.dropdownItemText,
                    { color: colors.text },
                    weightUnit === unit.value && { color: colors.tint, fontWeight: '600' }
                  ]}>
                    {unit.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
      
      {/* Volume Unit Dropdown - Rendered at root level for proper z-index */}
      {showVolumeUnitDropdown && volumeUnitDropdownLayout && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowVolumeUnitDropdown(false)}
          />
          <View 
            style={[
              styles.dropdown,
              {
                backgroundColor: colors.background,
                borderColor: colors.icon + '30',
                position: 'absolute',
                top: volumeUnitDropdownLayout.y,
                left: volumeUnitDropdownLayout.x,
                width: volumeUnitDropdownLayout.width,
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
              {VOLUME_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  style={[
                    styles.dropdownItem,
                    volumeUnit === unit.value && { backgroundColor: colors.tint + '20' },
                    { borderBottomColor: colors.icon + '15' }
                  ]}
                  onPress={() => {
                    setVolumeUnit(unit.value);
                    setShowVolumeUnitDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[
                    styles.dropdownItemText,
                    { color: colors.text },
                    volumeUnit === unit.value && { color: colors.tint, fontWeight: '600' }
                  ]}>
                    {unit.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 12,
    paddingBottom: 32,
    ...Platform.select({
      web: {
        paddingLeft: 16,
        paddingRight: 16,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 0,
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
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: -0.3,
    flex: 1,
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
  requiredSection: {
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  optionalSection: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionHeaderSubtitle: {
    fontSize: 11,
    opacity: 0.7,
  },
  sectionContent: {
    padding: 8,
  },
  subSection: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  subSectionDescription: {
    fontSize: 11,
    marginBottom: 4,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  field: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
    opacity: 0.9,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 2,
    marginLeft: 2,
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  hint: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 34, // Match TextInput height (paddingVertical: 5 * 2 + fontSize: 14 + line spacing)
  },
  dropdownButtonText: {
    fontSize: 14,
  },
  dropdownArrow: {
    fontSize: 10,
    opacity: 0.6,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    }),
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 14,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
});

