import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Alert, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { FoodSearchBar } from '@/components/food-search-bar';
import { Colors } from '@/constants/theme';
import { TEXT_LIMITS } from '@/constants/constraints';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFoodSearch } from '@/hooks/use-food-search';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  calculateNutrientsSimple,
  getMasterUnitsFromServingOption,
  buildServingOptions,
  getDefaultServingSelection,
  type Nutrients,
  type FoodMaster,
  type FoodServing,
  type ServingOption,
} from '@/utils/nutritionMath';
import {
  getServingsForFood,
  getDefaultServingForFood,
  computeNutrientsForFoodServing,
} from '@/lib/servings';

type BundleItem = {
  id: string;
  bundle_id?: string;
  food_id: string | null;
  item_name: string | null;
  serving_id: string | null;
  quantity: number;
  /** Raw user input for quantity (keeps intermediate states like "1.") */
  quantityInput: string;
  unit: string;
  order_index: number;
  food?: FoodMaster;
  serving?: ServingOption;
  availableServings?: ServingOption[];
  calculatedNutrition?: Nutrients;
};

function sanitizeOneDecimalQuantityInput(raw: string): string {
  // Allow: empty (so user can delete), digits, and at most one '.' with at most 1 decimal digit
  const t = raw.replace(',', '.'); // helpful for some keyboards/locales

  // Keep only digits and dots
  const filtered = t.replace(/[^0-9.]/g, '');
  if (filtered.length === 0) return '';

  // If it starts with '.', prefix '0'
  const normalizedLeading = filtered.startsWith('.') ? `0${filtered}` : filtered;

  // Keep only first '.'
  const firstDot = normalizedLeading.indexOf('.');
  if (firstDot === -1) return normalizedLeading;

  const intPart = normalizedLeading.slice(0, firstDot);
  const rest = normalizedLeading.slice(firstDot + 1).replace(/\./g, ''); // remove extra dots
  return rest.length > 0 ? `${intPart}.${rest}` : `${intPart}.`;
}

function parseQuantityOrZero(input: string): number {
  const n = Number.parseFloat(input);
  return Number.isFinite(n) ? n : 0;
}

export default function CreateBundleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const { t } = useTranslation();

  const bundleId = params.bundleId as string | undefined;
  const isEditing = !!bundleId;

  // Validation limits (same as entry creation)
  const MAX_QUANTITY = 100000;
  const MAX_CALORIES = 5000;

  // Form state
  const [bundleName, setBundleName] = useState('');
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBundle, setLoadingBundle] = useState(false);
  
  // Bundle item delete confirmation modal state
  const [itemDeleteConfirmVisible, setItemDeleteConfirmVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Per-item serving dropdown state
  const [activeServingDropdownId, setActiveServingDropdownId] = useState<string | null>(null);
  const [servingDropdownLayout, setServingDropdownLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const servingButtonRefs = useRef<Map<string, View>>(new Map());
  
  // Per-item quantity input refs for auto-focus
  const quantityInputRefs = useRef<Map<string, TextInput>>(new Map());
  const [newlyAddedItemId, setNewlyAddedItemId] = useState<string | null>(null);

  // Load bundle for editing
  useEffect(() => {
    if (bundleId && user?.id) {
      loadBundleForEditing();
    }
  }, [bundleId, user?.id]);

  // Auto-focus on quantity input when a new item is added
  useEffect(() => {
    if (newlyAddedItemId) {
      // Small delay to ensure the input is rendered
      const timer = setTimeout(() => {
        const inputRef = quantityInputRefs.current.get(newlyAddedItemId);
        if (inputRef) {
          inputRef.focus();
        }
        setNewlyAddedItemId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [newlyAddedItemId]);

  const loadBundleForEditing = async () => {
    if (!bundleId || !user?.id) return;

    setLoadingBundle(true);
    try {
      // Fetch bundle
      const { data: bundleData, error: bundleError } = await supabase
        .from('bundles')
        .select('*')
        .eq('id', bundleId)
        .eq('user_id', user.id)
        .single();

      if (bundleError || !bundleData) {
        Alert.alert(t('alerts.error_title'), t('create_bundle.errors.load_bundle_failed'));
        router.back();
        return;
      }

      setBundleName(bundleData.name);

      // Fetch bundle items
      const { data: itemsData, error: itemsError } = await supabase
        .from('bundle_items')
        .select('*')
        .eq('bundle_id', bundleId)
        .order('order_index', { ascending: true });

      if (itemsError) {
        Alert.alert(t('alerts.error_title'), t('create_bundle.errors.load_items_failed'));
        return;
      }

      // Fetch food details for items with food_id
      const foodIds = (itemsData || [])
        .filter(item => item.food_id)
        .map(item => item.food_id!);

      const { data: foodsData } = foodIds.length > 0
        ? await supabase
            .from('food_master')
            .select('*')
            .in('id', foodIds)
        : { data: [] };

      const foodsMap = new Map((foodsData || []).map(food => [food.id, food]));

      // Fetch servings for items with serving_id
      const servingIds = (itemsData || [])
        .filter(item => item.serving_id)
        .map(item => item.serving_id!);

      const { data: servingsData } = servingIds.length > 0
        ? await supabase
            .from('food_servings')
            .select('*')
            .in('id', servingIds)
        : { data: [] };

      const servingsMap = new Map((servingsData || []).map(serving => [serving.id, serving]));

      // Combine items with food and serving data and calculate nutrition
      // Also load available servings for each food
      const itemsWithDetails: BundleItem[] = await Promise.all(
        (itemsData || []).map(async (item, index) => {
          const food = item.food_id ? foodsMap.get(item.food_id) : undefined;
          const savedServing = item.serving_id ? servingsMap.get(item.serving_id) : undefined;
          
          // Load available servings for this food using the new model
          let availableServings: ServingOption[] = [];
          let selectedServing: ServingOption | undefined;
          
          if (food) {
            availableServings = await loadServingsForFood(food);
            
            // Find the matching serving option in the available options
            if (item.serving_id && savedServing) {
              // It's a saved serving - find it in the list
              selectedServing = availableServings.find(
                (o) => o.kind === 'saved' && o.serving.id === item.serving_id
              );
            } else if (item.unit) {
              // It's a raw unit - find it in the list
              selectedServing = availableServings.find(
                (o) => o.kind === 'raw' && o.unit.toLowerCase() === item.unit.toLowerCase()
              );
            }
            
            // Fallback to first option if not found
            if (!selectedServing && availableServings.length > 0) {
              selectedServing = availableServings[0];
            }
          }
          
          const bundleItem: BundleItem = {
            ...item,
            food,
            serving: selectedServing,
            availableServings,
            order_index: index,
            quantityInput: String(item.quantity ?? 0),
          };
          return calculateItemNutritionSync(bundleItem);
        })
      );

      setBundleItems(itemsWithDetails);
    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('create_bundle.errors.load_bundle_error', { error: error?.message || t('common.unexpected_error') }));
    } finally {
      setLoadingBundle(false);
    }
  };

  // Use shared food search hook (per engineering guidelines 5.1)
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    handleSearchChange,
    clearSearch,
  } = useFoodSearch({
    includeCustomFoods: true,
    userId: user?.id,
  });

  // Handle food selection from search results - immediately add to bundle
  // Uses centralized serving logic from lib/servings.ts
  const handleSelectFoodFromSearch = async (food: FoodMaster) => {
    // Fetch servings using centralized data access
    const dbServings = await getServingsForFood(food.id);
    
    // Build serving options for UI dropdown
    const options = buildServingOptions(food, dbServings);
    
    // Get default serving selection for UI
    const { quantity: defaultQty, defaultOption } = getDefaultServingSelection(food, dbServings);
    
    // Determine serving_id and unit for storage
    const servingId = defaultOption.kind === 'saved' ? defaultOption.serving.id : null;
    const unit = defaultOption.kind === 'raw' ? defaultOption.unit : defaultOption.serving.serving_name;
    
    // Create new bundle item
    const newItemId = `temp-${Date.now()}`;
    const newItem: BundleItem = {
      id: newItemId,
      food_id: food.id,
      item_name: null,
      serving_id: servingId,
      quantity: defaultQty,
      quantityInput: String(defaultQty),
      unit: unit,
      order_index: bundleItems.length,
      food: food,
      serving: defaultOption,
      availableServings: options,
    };
    
    // Calculate nutrition and add to list
    const itemWithNutrition = calculateItemNutritionSync(newItem);
    setBundleItems([...bundleItems, itemWithNutrition]);
    
    // Set newly added item ID to trigger auto-focus on quantity field
    setNewlyAddedItemId(newItemId);
    
    // Clear search using shared hook
    clearSearch();
  };

  // Load servings for a food and return them (used when loading bundle for editing)
  // Uses centralized data access from lib/servings.ts
  const loadServingsForFood = async (food: FoodMaster): Promise<ServingOption[]> => {
    const dbServings = await getServingsForFood(food.id);
    return buildServingOptions(food, dbServings);
  };

  // Calculate nutrition for a bundle item (synchronous version)
  // Uses shared utility from nutritionMath.ts
  const calculateItemNutritionSync = (item: BundleItem): BundleItem => {
    if (!item.food_id || !item.food || !item.serving) {
      return item;
    }

    // Use shared utility for master units calculation
    const masterUnits = getMasterUnitsFromServingOption(item.serving, item.quantity, item.food);
    const nutrients = calculateNutrientsSimple(item.food, masterUnits);
    
    return {
      ...item,
      calculatedNutrition: nutrients,
    };
  };

  // Handle inline quantity change for a bundle item
  const handleItemQuantityChange = useCallback((itemId: string, newQuantity: string) => {
    const sanitized = sanitizeOneDecimalQuantityInput(newQuantity);
    const parsedQuantity = parseQuantityOrZero(sanitized);
    
    setBundleItems(prevItems => 
      prevItems.map(item => {
        if (item.id !== itemId) return item;
        
        const updatedItem = {
          ...item,
          quantity: parsedQuantity,
          quantityInput: sanitized,
        };
        
        return calculateItemNutritionSync(updatedItem);
      })
    );
  }, []);

  // Normalize quantity when leaving the field (clamp and remove trailing '.')
  const handleItemQuantityBlur = useCallback((itemId: string) => {
    setBundleItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== itemId) return item;

        const trimmed = item.quantityInput.trim();
        const withoutTrailingDot = trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
        const sanitized = sanitizeOneDecimalQuantityInput(withoutTrailingDot);
        let parsed = parseQuantityOrZero(sanitized);

        // Clamp to reasonable bounds
        if (parsed < 0) parsed = 0;
        if (parsed > MAX_QUANTITY) parsed = MAX_QUANTITY;

        const finalInput = sanitized.length > 0 ? sanitizeOneDecimalQuantityInput(String(parsed)) : '';

        const updatedItem = {
          ...item,
          quantity: parsed,
          quantityInput: finalInput,
        };

        return calculateItemNutritionSync(updatedItem);
      })
    );
  }, []);

  // Handle inline serving change for a bundle item
  const handleItemServingChange = useCallback((itemId: string, newServing: ServingOption) => {
    setBundleItems(prevItems => 
      prevItems.map(item => {
        if (item.id !== itemId) return item;
        
        // Determine serving_id and unit for storage
        const servingId = newServing.kind === 'saved' ? newServing.serving.id : null;
        const unit = newServing.kind === 'raw' ? newServing.unit : newServing.serving.serving_name;
        
        const updatedItem = {
          ...item,
          serving: newServing,
          serving_id: servingId,
          unit: unit,
        };
        
        return calculateItemNutritionSync(updatedItem);
      })
    );
    
    // Close the dropdown
    setActiveServingDropdownId(null);
  }, []);

  // Calculate nutrition for a bundle item (async version for loading)
  const calculateItemNutrition = useCallback(async (item: BundleItem): Promise<BundleItem> => {
    return calculateItemNutritionSync(item);
  }, []);

  const handleRemoveItem = (itemId: string) => {
    const item = bundleItems.find(i => i.id === itemId);
    if (!item) return;

    const itemName = item.food?.name || item.item_name || 'this item';
    
    // Show confirmation modal
    setItemToDelete({ id: itemId, name: itemName });
    setItemDeleteConfirmVisible(true);
  };

  const handleItemDeleteConfirm = () => {
    if (itemToDelete) {
      setBundleItems(bundleItems.filter(item => item.id !== itemToDelete.id).map((item, index) => ({
        ...item,
        order_index: index,
      })));
      setItemDeleteConfirmVisible(false);
      setItemToDelete(null);
    }
  };

  const handleItemDeleteCancel = () => {
    setItemDeleteConfirmVisible(false);
    setItemToDelete(null);
  };

  const handleSaveBundle = async () => {
    // Prevent multiple submissions
    if (loading) {
      return;
    }

    if (!bundleName.trim()) {
      Alert.alert(t('alerts.error_title'), t('create_bundle.errors.enter_bundle_name'));
      return;
    }

    if (bundleName.length > 40) {
      Alert.alert(t('alerts.error_title'), t('create_bundle.errors.bundle_name_too_long'));
      return;
    }

    if (bundleItems.length < 2) {
      Alert.alert(t('alerts.error_title'), t('create_bundle.errors.add_at_least_two_foods'));
      return;
    }

    // Set loading early to prevent multiple submissions
    setLoading(true);

    // Check bundle limit when creating new bundle (not editing)
    if (!isEditing && user?.id) {
      const { count, error: countError } = await supabase
        .from('bundles')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!countError && count !== null && count >= 20) {
        Alert.alert(
          t('create_bundle.errors.bundle_limit_reached_title'),
          t('create_bundle.errors.bundle_limit_reached_message')
        );
        setLoading(false);
        return;
      }
    }
    try {
      let finalBundleId = bundleId;
      
      if (isEditing && bundleId) {
        // Update existing bundle
        const { error: updateError } = await supabase
          .from('bundles')
          .update({ name: bundleName.trim() })
          .eq('id', bundleId);

        if (updateError) {
          Alert.alert(t('alerts.error_title'), t('create_bundle.errors.update_bundle_failed', { error: updateError.message }));
          setLoading(false);
          return;
        }

        // Delete existing items
        await supabase
          .from('bundle_items')
          .delete()
          .eq('bundle_id', bundleId);
      } else {
        // Create new bundle
        const { data: newBundle, error: createError } = await supabase
          .from('bundles')
          .insert({
            user_id: user!.id,
            name: bundleName.trim(),
          })
          .select()
          .single();

        if (createError || !newBundle) {
          Alert.alert(t('alerts.error_title'), t('create_bundle.errors.create_bundle_failed', { error: createError?.message || t('common.unexpected_error') }));
          setLoading(false);
          return;
        }

        finalBundleId = newBundle.id;
      }

      // Insert bundle items
      const itemsToInsert = bundleItems.map((item, index) => ({
        bundle_id: finalBundleId,
        food_id: item.food_id,
        item_name: item.item_name,
        serving_id: item.serving_id,
        quantity: item.quantity,
        unit: item.unit,
        order_index: index,
      }));

      const { error: itemsError } = await supabase
        .from('bundle_items')
        .insert(itemsToInsert);

      if (itemsError) {
        Alert.alert(t('alerts.error_title'), t('create_bundle.errors.save_items_failed', { error: itemsError.message }));
        setLoading(false);
        return;
      }

      // Navigate back after successful save
      // If creating a new bundle, pass the bundle ID so it can be highlighted
      if (!isEditing && finalBundleId) {
        // Store the newly added bundle ID in sessionStorage (web) or AsyncStorage (native)
        // This avoids param-based navigation issues that can cause infinite loops
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          sessionStorage.setItem('newlyAddedBundleId', finalBundleId);
        }
        
        // Navigate back - the focus effect will handle refreshing and highlighting
        router.back();
      } else {
        router.back();
      }
    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('create_bundle.errors.save_bundle_failed', { error: error?.message || t('common.unexpected_error') }));
      setLoading(false);
    }
  };


  if (loadingBundle) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('create_bundle.loading')}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>←</ThemedText>
            </TouchableOpacity>
            <ThemedText style={[styles.title, { color: colors.text }]}>
              {isEditing ? t('create_bundle.title_edit') : t('create_bundle.title_create')}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.checkmarkButton,
                {
                  opacity: (bundleName.trim().length >= 1 && bundleItems.length >= 2 && !loading) ? 1 : 0.4,
                }
              ]}
              onPress={handleSaveBundle}
              disabled={loading || bundleName.trim().length < 1 || bundleItems.length < 2}
              activeOpacity={0.7}
            >
              <IconSymbol 
                name="checkmark" 
                size={24} 
                color={(bundleName.trim().length >= 1 && bundleItems.length >= 2 && !loading) ? colors.tint : colors.icon}
              />
            </TouchableOpacity>
          </View>

        {/* Bundle Name */}
        <View style={styles.stepSection}>
          <ThemedText style={[styles.stepLabel, { color: colors.tint, marginBottom: 8 }]}>{t('create_bundle.step1_title')}</ThemedText>
        </View>
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { borderColor: colors.icon + '30', color: colors.text, backgroundColor: colors.background }]}
            value={bundleName}
            onChangeText={(text) => {
              if (text.length <= TEXT_LIMITS.BUNDLES_NAME.MAX_LEN) {
                setBundleName(text);
              }
            }}
            placeholder={t('create_bundle.bundle_name_placeholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={TEXT_LIMITS.BUNDLES_NAME.MAX_LEN}
          />
        </View>
        <ThemedText style={[styles.helperText, { color: colors.textSecondary, marginBottom: 12 }]}>
          {t('create_bundle.characters_count', { count: bundleName.length })}
        </ThemedText>

        {/* Search Bar */}
        <View style={styles.stepSection}>
          <ThemedText style={[styles.stepLabel, { color: colors.tint, marginBottom: 8 }]}>
            {t('create_bundle.step2_title')}
          </ThemedText>
        </View>
        
        {/* Shared FoodSearchBar component (per engineering guidelines 5.1) */}
        <FoodSearchBar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          searchResults={searchResults}
          searchLoading={searchLoading}
          showSearchResults={showSearchResults}
          onSelectFood={handleSelectFoodFromSearch}
          placeholder={t('create_bundle.search_placeholder')}
          colors={colors}
        />

        {/* Bundle Items List - Above search bar */}
        {bundleItems.length > 0 && (
          <View style={styles.bundleItemsSection}>
            {bundleItems.map((item) => (
              <View
                key={item.id}
                style={[styles.bundleItemRow, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}
              >
                {/* Food Name (read-only) */}
                <View style={styles.bundleItemFoodName}>
                  <ThemedText 
                    style={[styles.bundleItemFoodText, { color: colors.text }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.food?.name || item.item_name || t('create_bundle.unknown_item')}
                  </ThemedText>
                  {item.food?.brand && (
                    <ThemedText 
                      style={[styles.bundleItemBrand, { color: colors.icon }]}
                      numberOfLines={1}
                    >
                      {item.food.brand}
                    </ThemedText>
                  )}
                </View>
                
                {/* Quantity Input */}
                <View style={styles.bundleItemQuantity}>
                  <TextInput
                    ref={(ref) => {
                      if (ref) quantityInputRefs.current.set(item.id, ref);
                    }}
                    style={[styles.bundleItemInput, { color: colors.text, borderColor: colors.icon + '40' }]}
                    value={item.quantityInput}
                    onChangeText={(text) => handleItemQuantityChange(item.id, text)}
                    onBlur={() => handleItemQuantityBlur(item.id)}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                
                {/* Serving Dropdown */}
                <View style={styles.bundleItemServing}>
                  <View
                    ref={(ref) => {
                      if (ref) servingButtonRefs.current.set(item.id, ref);
                    }}
                  >
                    <TouchableOpacity
                      style={[styles.bundleItemDropdown, { borderColor: colors.icon + '40' }]}
                      onPress={() => {
                        const ref = servingButtonRefs.current.get(item.id);
                        ref?.measure((x, y, width, height, pageX, pageY) => {
                          setServingDropdownLayout({ x: pageX, y: pageY + height, width, height });
                          setActiveServingDropdownId(activeServingDropdownId === item.id ? null : item.id);
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText 
                        style={[styles.bundleItemDropdownText, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {item.serving?.label || item.unit}
                      </ThemedText>
                      <ThemedText style={[styles.dropdownArrow, { color: colors.textSecondary }]}>▼</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Total cal (read-only) */}
                <View style={styles.bundleItemKcal}>
                  <ThemedText style={[styles.bundleItemKcalText, { color: colors.tint }]}>
                    {Math.round(item.calculatedNutrition?.calories_kcal || 0)}
                  </ThemedText>
                  <ThemedText style={[styles.bundleItemKcalUnit, { color: colors.textSecondary }]}>{t('units.kcal')}</ThemedText>
                </View>
                
                {/* Delete Button */}
                <TouchableOpacity
                  style={[styles.bundleItemDelete, { backgroundColor: '#EF4444' + '20' }]}
                  onPress={() => handleRemoveItem(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#EF4444', fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Nutrient Summary */}
        {bundleItems.length > 0 && (() => {
          // Calculate totals from all bundle items
          const totals = bundleItems.reduce((acc, item) => {
            if (item.calculatedNutrition) {
              acc.calories += item.calculatedNutrition.calories_kcal || 0;
              acc.protein += item.calculatedNutrition.protein_g || 0;
              acc.carbs += item.calculatedNutrition.carbs_g || 0;
              acc.fat += item.calculatedNutrition.fat_g || 0;
              acc.fiber += item.calculatedNutrition.fiber_g || 0;
              acc.saturatedFat += item.calculatedNutrition.saturated_fat_g || 0;
              acc.sugar += item.calculatedNutrition.sugar_g || 0;
              acc.sodium += item.calculatedNutrition.sodium_mg || 0;
            }
            return acc;
          }, {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            saturatedFat: 0,
            sugar: 0,
            sodium: 0,
          });

          return (
            <View style={[styles.summaryCard, { backgroundColor: colors.background, borderColor: colors.tint + '30' }]}>
              <ThemedText style={[styles.summaryTitle, { color: colors.text }]}>
                {t('create_bundle.bundle_summary_title')}
              </ThemedText>
              <View style={styles.summaryContent}>
                <View style={styles.summaryCalories}>
                  <ThemedText style={[styles.summaryCaloriesValue, { color: colors.tint }]}>
                    {Math.round(totals.calories)}
                  </ThemedText>
                  <ThemedText style={[styles.summaryCaloriesLabel, { color: colors.textSecondary }]}>
                    {t('units.kcal')}
                  </ThemedText>
                </View>
                <View style={styles.summaryMacros}>
                  {totals.protein > 0 && (
                    <View style={styles.summaryMacroItem}>
                      <ThemedText style={[styles.summaryMacroLabel, { color: colors.textSecondary }]}>{t('create_bundle.macros.protein')}</ThemedText>
                      <ThemedText style={[styles.summaryMacroValue, { color: colors.text }]}>
                        {Math.round(totals.protein * 10) / 10}g
                      </ThemedText>
                    </View>
                  )}
                  {totals.carbs > 0 && (
                    <View style={styles.summaryMacroItem}>
                      <ThemedText style={[styles.summaryMacroLabel, { color: colors.textSecondary }]}>{t('create_bundle.macros.carbs')}</ThemedText>
                      <ThemedText style={[styles.summaryMacroValue, { color: colors.text }]}>
                        {Math.round(totals.carbs * 10) / 10}g
                      </ThemedText>
                    </View>
                  )}
                  {totals.fat > 0 && (
                    <View style={styles.summaryMacroItem}>
                      <ThemedText style={[styles.summaryMacroLabel, { color: colors.textSecondary }]}>{t('create_bundle.macros.fat')}</ThemedText>
                      <ThemedText style={[styles.summaryMacroValue, { color: colors.text }]}>
                        {Math.round(totals.fat * 10) / 10}g
                      </ThemedText>
                    </View>
                  )}
                  {totals.fiber > 0 && (
                    <View style={styles.summaryMacroItem}>
                      <ThemedText style={[styles.summaryMacroLabel, { color: colors.textSecondary }]}>{t('create_bundle.macros.fiber')}</ThemedText>
                      <ThemedText style={[styles.summaryMacroValue, { color: colors.text }]}>
                        {Math.round(totals.fiber * 10) / 10}g
                      </ThemedText>
                    </View>
                  )}
                </View>
                {((totals.saturatedFat > 0) || (totals.sugar > 0) || (totals.sodium > 0)) && (
                  <View style={[styles.summaryMacros, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.icon + '30' }]}>
                    {totals.saturatedFat > 0 && (
                      <View style={styles.summaryMacroItem}>
                        <ThemedText style={[styles.summaryMacroLabel, { color: colors.textSecondary, fontSize: 11 }]}>{t('create_bundle.macros.saturated_fat_short')}</ThemedText>
                        <ThemedText style={[styles.summaryMacroValue, { color: colors.text, fontSize: 11 }]}>
                          {Math.round(totals.saturatedFat * 10) / 10}g
                        </ThemedText>
                      </View>
                    )}
                    {totals.sugar > 0 && (
                      <View style={styles.summaryMacroItem}>
                        <ThemedText style={[styles.summaryMacroLabel, { color: colors.textSecondary, fontSize: 11 }]}>{t('create_bundle.macros.sugar_short')}</ThemedText>
                        <ThemedText style={[styles.summaryMacroValue, { color: colors.text, fontSize: 11 }]}>
                          {Math.round(totals.sugar * 10) / 10}g
                        </ThemedText>
                      </View>
                    )}
                    {totals.sodium > 0 && (
                      <View style={styles.summaryMacroItem}>
                        <ThemedText style={[styles.summaryMacroLabel, { color: colors.textSecondary, fontSize: 11 }]}>{t('create_bundle.macros.sodium_short')}</ThemedText>
                        <ThemedText style={[styles.summaryMacroValue, { color: colors.text, fontSize: 11 }]}>
                          {Math.round(totals.sodium * 10) / 10}mg
                        </ThemedText>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* Save and Cancel Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.background, borderColor: colors.icon + '30' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.cancelButtonText, { color: colors.text }]}>{t('create_bundle.cancel_button')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton, 
              { 
                backgroundColor: (bundleName.trim().length >= 1 && bundleItems.length >= 2) ? colors.tint : colors.icon + '40',
                opacity: (bundleName.trim().length >= 1 && bundleItems.length >= 2) ? 1 : 0.6,
              }
            ]}
            onPress={handleSaveBundle}
            disabled={loading || bundleName.trim().length < 1 || bundleItems.length < 2}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>
                {isEditing ? t('create_bundle.update_button') : t('create_bundle.create_button')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bundle Item Delete Confirmation Modal */}
      <ConfirmModal
        visible={itemDeleteConfirmVisible}
        title={t('create_bundle.remove_item_title')}
        message={itemToDelete ? t('create_bundle.remove_item_message', { name: itemToDelete.name }) : t('create_bundle.remove_item_message_generic')}
        confirmText={t('create_bundle.remove_button')}
        cancelText={t('common.cancel')}
        onConfirm={handleItemDeleteConfirm}
        onCancel={handleItemDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />

      {/* Serving Dropdown - Rendered at root level for proper z-index */}
      {activeServingDropdownId && servingDropdownLayout && (() => {
        const activeItem = bundleItems.find(item => item.id === activeServingDropdownId);
        const servings = activeItem?.availableServings || [];
        
        return (
          <>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setActiveServingDropdownId(null)}
            />
            <View 
              style={[
                styles.dropdown,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.icon + '40',
                  position: 'absolute',
                  top: servingDropdownLayout.y,
                  left: servingDropdownLayout.x,
                  width: Math.max(servingDropdownLayout.width, 150),
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
                {servings.map((serving) => (
                  <TouchableOpacity
                    key={serving.id}
                    style={[
                      styles.dropdownItem,
                      activeItem?.serving?.id === serving.id && { backgroundColor: colors.tint + '20' },
                    ]}
                    onPress={() => handleItemServingChange(activeServingDropdownId, serving)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.dropdownItemText, { color: colors.text }]}>
                      {serving.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        );
      })()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 600,
    padding: 12,
    paddingBottom: 32,
    ...Platform.select({
      web: {
        paddingLeft: 16,
        paddingRight: 16,
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.7,
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
  card: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  stepSection: {
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 1.0,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    minHeight: 44,
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  addFoodButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: 'center',
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
  addFoodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  selectedFoodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  selectedFoodName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    letterSpacing: -0.2,
  },
  removeButton: {
    fontSize: 20,
    fontWeight: '600',
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  field: {
    flex: 1,
  },
  caloriesDisplay: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  caloriesValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 44,
  },
  dropdownButtonText: {
    fontSize: 15,
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 10,
    marginLeft: 6,
    opacity: 0.6,
  },
  dropdown: {
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 200,
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
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemText: {
    fontSize: 14,
  },
  addButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 44,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bundleItemsSection: {
    marginBottom: 12,
  },
  bundleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
  bundleItemFoodName: {
    flex: 2,
    minWidth: 0,
  },
  bundleItemFoodText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bundleItemBrand: {
    fontSize: 11,
    marginTop: 1,
  },
  bundleItemQuantity: {
    width: 50,
  },
  bundleItemInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    textAlign: 'center',
    minHeight: 32,
  },
  bundleItemServing: {
    flex: 1,
    minWidth: 80,
  },
  bundleItemDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 32,
  },
  bundleItemDropdownText: {
    fontSize: 12,
    flex: 1,
  },
  bundleItemKcal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 55,
    justifyContent: 'flex-end',
  },
  bundleItemKcalText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bundleItemKcalUnit: {
    fontSize: 10,
    marginLeft: 2,
  },
  bundleItemDelete: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bundleItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: -0.2,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTrack: {
    width: 40,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  entryCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    overflow: 'hidden',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  entryHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  entryHeaderRight: {
    marginLeft: 8,
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
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minWidth: 36,
    minHeight: 28,
    zIndex: 11,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 50,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 50,
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
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
  },
  searchLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  searchResultsContainer: {
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 300,
    marginBottom: 8,
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
  searchResultsList: {
    maxHeight: 300,
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
  summaryCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  summaryContent: {
    alignItems: 'center',
  },
  summaryCalories: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    width: '100%',
  },
  summaryCaloriesValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  summaryCaloriesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
    gap: 12,
  },
  summaryMacroItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  summaryMacroLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    opacity: 0.8,
  },
  summaryMacroValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});

