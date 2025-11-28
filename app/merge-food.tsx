import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Platform, 
  ActivityIndicator,
  PanResponder,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type FoodMasterRow = {
  id: string;
  name: string | null;
  brand: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  source: string | null;
  owner_user_id: string | null;
  order_index: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  barcode: string | null;
  is_base_food: boolean | null;
  is_quality_data: boolean | null;
};

type FoodServingRow = {
  id: string;
  food_id: string;
  serving_name: string | null;
  weight_g: number | null;
  volume_ml: number | null;
  is_default: boolean | null;
  sort_order: number | null;
  // Computed field: name of associated master food
  food_master_name?: string | null;
};

type FoodVariantRow = {
  [key: string]: any; // Flexible type to hold all variant columns
  food_master_id: string;
  food_master_name?: string | null; // Computed field: name of associated master food
};

type FoodEntryRow = {
  id: string;
  user_id: string;
  meal_type: string;
  item_name: string;
  quantity: number;
  unit: string;
  protein_g: number | null;
  food_id: string | null;
  serving_id: string | null;
  // Computed field: name of associated master food
  food_master_name?: string | null;
};

type BundleRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  order_index: number | null;
  // Computed field: name(s) of associated master food(s)
  food_master_name?: string | null;
};

type BundleItemRow = {
  id: string;
  bundle_id: string;
  food_id: string | null;
  item_name: string | null;
  serving_id: string | null;
  quantity: number;
  unit: string;
  order_index: number;
  // Computed field: name of associated master food
  food_master_name?: string | null;
};

const BUNDLE_COLUMN_KEYS = [
  'food_master_name',
  'id',
  'user_id',
  'name',
  'created_at',
  'updated_at',
  'order_index',
];

const BUNDLE_ITEM_COLUMN_KEYS = [
  'food_master_name',
  'id',
  'bundle_id',
  'food_id',
  'item_name',
  'serving_id',
  'quantity',
  'unit',
  'order_index',
];

const ENTRY_COLUMN_KEYS = [
  'food_master_name',
  'id',
  'user_id',
  'meal_type',
  'item_name',
  'quantity',
  'unit',
  'protein_g',
  'food_id',
  'serving_id',
];

const VARIANT_COLUMN_KEYS = [
  'id',
  'food_master_id',
  'barcode',
  'variant_name',
  'brand',
  'quantity_label',
  'popularity',
  'energy_kcal_100g',
  'protein_g_100g',
  'carbs_g_100g',
  'fat_g_100g',
  'saturated_fat_g_100g',
  'sugar_g_100g',
  'fiber_g_100g',
  'sodium_mg_100g',
  'source',
  'created_at',
];

const SERVING_ACTION_COLUMNS = ['serving_to_keep', 'serving_to_delete', 'serving_make_default'];

const SERVING_COLUMN_KEYS = [
  ...SERVING_ACTION_COLUMNS,
  'food_master_name',
  'id',
  'food_id',
  'serving_name',
  'weight_g',
  'volume_ml',
  'is_default',
  'sort_order',
];

const ACTION_COLUMNS = ['remove', 'master', 'variant'];

const COLUMN_KEYS = [
  'id',
  'is_base_food',
  'is_quality_data',
  'name',
  'brand',
  'serving_size',
  'serving_unit',
  'calories_kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'saturated_fat_g',
  'source',
  'owner_user_id',
  'order_index',
  'sugar_g',
  'sodium_mg',
  'barcode',
];

// All columns including action columns
const ALL_COLUMN_KEYS = [...ACTION_COLUMNS, ...COLUMN_KEYS];

const DEFAULT_COLUMN_WIDTHS: { [key: string]: number } = {
  remove: 80,
  master: 80,
  variant: 100,
  id: 80,
  name: 200,
  brand: 150,
  serving_size: 100,
  serving_unit: 100,
  calories_kcal: 100,
  protein_g: 90,
  carbs_g: 90,
  fat_g: 90,
  fiber_g: 90,
  saturated_fat_g: 120,
  source: 100,
  owner_user_id: 150,
  order_index: 100,
  sugar_g: 90,
  sodium_mg: 100,
  barcode: 150,
  is_base_food: 120,
  is_quality_data: 130,
  // Serving columns
  food_master_name: 200,
  // Serving action columns
  serving_to_keep: 100,
  serving_to_delete: 100,
  serving_make_default: 120,
  serving_id: 80,
  serving_food_id: 80,
  serving_serving_name: 150,
  serving_weight_g: 100,
  serving_volume_ml: 100,
  serving_is_default: 100,
  serving_sort_order: 80,
  // Variant columns
  variant_food_master_name: 200,
  variant_id: 80,
  variant_food_master_id: 80,
  variant_barcode: 150,
  variant_variant_name: 200,
  variant_brand: 150,
  variant_quantity_label: 120,
  variant_popularity: 100,
  variant_energy_kcal_100g: 130,
  variant_protein_g_100g: 130,
  variant_carbs_g_100g: 130,
  variant_fat_g_100g: 130,
  variant_saturated_fat_g_100g: 160,
  variant_sugar_g_100g: 130,
  variant_fiber_g_100g: 130,
  variant_sodium_mg_100g: 150,
  variant_source: 100,
  variant_created_at: 150,
  // Entry columns
  entry_food_master_name: 200,
  entry_id: 80,
  entry_user_id: 120,
  entry_meal_type: 120,
  entry_item_name: 200,
  entry_quantity: 100,
  entry_unit: 80,
  entry_protein_g: 100,
  entry_food_id: 120,
  entry_serving_id: 120,
  // Bundle columns
  bundle_food_master_name: 200,
  bundle_id: 120,
  bundle_user_id: 120,
  bundle_name: 200,
  bundle_created_at: 150,
  bundle_updated_at: 150,
  bundle_order_index: 100,
  // Bundle Item columns
  bundle_item_food_master_name: 200,
  bundle_item_id: 80,
  bundle_item_bundle_id: 120,
  bundle_item_food_id: 120,
  bundle_item_item_name: 200,
  bundle_item_serving_id: 120,
  bundle_item_quantity: 100,
  bundle_item_unit: 80,
  bundle_item_order_index: 100,
};

const STORAGE_KEY = 'merge_food_column_widths';

// Color palette for food rows (7 distinct colors)
const FOOD_ROW_COLORS = [
  '#E3F2FD', // Light blue
  '#F3E5F5', // Light purple
  '#E8F5E9', // Light green
  '#FFF3E0', // Light orange
  '#FCE4EC', // Light pink
  '#E0F2F1', // Light teal
  '#FFF9C4', // Light yellow
];

// Text color to use on colored rows (always dark for contrast with light pastel backgrounds)
const COLORED_ROW_TEXT = '#1a1a1a';

const loadColumnWidths = async (): Promise<{ [key: string]: number }> => {
  try {
    if (Platform.OS === 'web') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } else {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (error) {
    console.error('Error loading column widths:', error);
  }
  return {};
};

const saveColumnWidths = async (widths: { [key: string]: number }) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(widths));
    }
  } catch (error) {
    console.error('Error saving column widths:', error);
  }
};

export default function MergeFoodScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAdmin, loading: authLoading } = useAuth();

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodMasterRow[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<FoodMasterRow[]>([]);
  const [associatedServings, setAssociatedServings] = useState<FoodServingRow[]>([]);
  const [existingVariants, setExistingVariants] = useState<FoodVariantRow[]>([]);
  const [associatedEntries, setAssociatedEntries] = useState<FoodEntryRow[]>([]);
  const [associatedBundles, setAssociatedBundles] = useState<BundleRow[]>([]);
  const [associatedBundleItems, setAssociatedBundleItems] = useState<BundleItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingServings, setLoadingServings] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [loadingBundleItems, setLoadingBundleItems] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(DEFAULT_COLUMN_WIDTHS);
  const [saving, setSaving] = useState(false);
  const [savingFoods, setSavingFoods] = useState(false);
  const [savingServings, setSavingServings] = useState(false);
  const [savingVariants, setSavingVariants] = useState(false);
  const [savingEntries, setSavingEntries] = useState(false);
  const [savingBundles, setSavingBundles] = useState(false);
  const [savingBundleItems, setSavingBundleItems] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [showMergeSuccess, setShowMergeSuccess] = useState(false);
  const [showMergeError, setShowMergeError] = useState(false);
  const [mergeErrorMessage, setMergeErrorMessage] = useState<string>('');
  // Track edits for each grid type - store original IDs and new values
  const [editedFoods, setEditedFoods] = useState<Map<string, Partial<FoodMasterRow>>>(new Map());
  const [editedServings, setEditedServings] = useState<Map<string, Partial<FoodServingRow>>>(new Map());
  const [editedVariants, setEditedVariants] = useState<Map<string, Partial<FoodVariantRow>>>(new Map());
  const [editedEntries, setEditedEntries] = useState<Map<string, Partial<FoodEntryRow>>>(new Map());
  const [editedBundles, setEditedBundles] = useState<Map<string, Partial<BundleRow>>>(new Map());
  const [editedBundleItems, setEditedBundleItems] = useState<Map<string, Partial<BundleItemRow>>>(new Map());
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [masterChecked, setMasterChecked] = useState<Set<string>>(new Set());
  const [variantChecked, setVariantChecked] = useState<Set<string>>(new Set());
  // Servings checkbox states
  const [servingsToKeep, setServingsToKeep] = useState<Set<string>>(new Set());
  const [servingsToDelete, setServingsToDelete] = useState<Set<string>>(new Set());
  const [servingMakeDefault, setServingMakeDefault] = useState<string | null>(null);
  
  const tableScrollRef = useRef<ScrollView>(null);
  const tableContainerRef = useRef<View>(null);
  const columnWidthsRef = useRef<{ [key: string]: number }>(DEFAULT_COLUMN_WIDTHS);
  const resizeStateRef = useRef<{
    columnKey: string | null;
    startX: number;
    startWidth: number;
  }>({ columnKey: null, startX: 0, startWidth: 0 });

  // Check admin access on focus
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && !isAdmin) {
        Alert.alert('Access Denied', 'You do not have permission to access this page.');
        router.back();
      }
    }, [isAdmin, authLoading, router])
  );

  // Update ref when columnWidths change
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  // Load saved column widths on mount
  useEffect(() => {
    loadColumnWidths().then((widths) => {
      const mergedWidths = { ...DEFAULT_COLUMN_WIDTHS, ...widths };
      setColumnWidths(mergedWidths);
      columnWidthsRef.current = mergedWidths;
    });
  }, []);

  // Fetch search results from database - smart multi-word search
  const fetchSearchResults = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Clean and normalize query: remove special characters, convert to lowercase
      const normalizeText = (text: string) => {
        return text
          .toLowerCase()
          .replace(/[%(),]/g, ' ') // Replace special chars with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      };
      
      const cleanedQuery = normalizeText(query);
      const words = cleanedQuery.split(/\s+/).filter(word => word.length > 0);
      
      if (words.length === 0) {
        setSearchResults([]);
        setShowSearchResults(false);
        setLoading(false);
        return;
      }
      
      // Build search conditions for each word
      // Each word should appear somewhere in name or brand (word order independent)
      const searchConditions: string[] = [];
      
      words.forEach(word => {
        const wordPattern = `%${word}%`;
        // Search for word in name or brand
        searchConditions.push(`name.ilike.${wordPattern}`);
        searchConditions.push(`brand.ilike.${wordPattern}`);
      });
      
      // Use OR for all word matches (allows word order independence)
      // Then filter results client-side to ensure ALL words are present
      // Order by: is_base_food DESC (base foods first), then is_quality_data DESC (quality data second), then name ASC
      const { data, error } = await supabase
        .from('food_master')
        .select(COLUMN_KEYS.join(', '))
        .or(searchConditions.join(','))
        .limit(50) // Get more results for client-side filtering
        .order('is_base_food', { ascending: false })
        .order('is_quality_data', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching search results:', error);
        setSearchResults([]);
        setShowSearchResults(false);
      } else {
        // Client-side filtering: ensure ALL words appear in name or brand
        // Normalize the food name/brand for comparison
        const filteredResults = ((data || []) as FoodMasterRow[]).filter(food => {
          const searchText = normalizeText(`${food.name || ''} ${food.brand || ''}`);
          // Check if all words are present in the normalized combined name+brand text
          return words.every(word => searchText.includes(word));
        });
        
        // Sort filtered results to maintain ranking (same as useFoodSearch hook):
        // 1. is_base_food = true first (highest priority)
        // 2. is_quality_data = true second
        // 3. order_index ascending (smaller first, null treated as 0)
        // 4. Fallback to name for consistent ordering
        filteredResults.sort((a, b) => {
          const aBase = (a.is_base_food === true) ? 1 : 0;
          const bBase = (b.is_base_food === true) ? 1 : 0;
          if (bBase !== aBase) return bBase - aBase;
          
          const aQuality = (a.is_quality_data === true) ? 1 : 0;
          const bQuality = (b.is_quality_data === true) ? 1 : 0;
          if (bQuality !== aQuality) return bQuality - aQuality;
          
          // order_index ascending (smaller first, null treated as 0)
          const aOrder = a.order_index ?? 0;
          const bOrder = b.order_index ?? 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          
          // Fallback to name for consistent ordering
          return (a.name || '').localeCompare(b.name || '');
        });
        
        const results = filteredResults.slice(0, 20); // Limit to 20 for display
        setSearchResults(results);
        setShowSearchResults(results.length > 0);
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSearchResults(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchSearchResults]);

  // Fetch associated servings for food IDs and update food names
  const fetchAndUpdateServings = useCallback(async (foodIds: string[], foods: FoodMasterRow[]) => {
    if (foodIds.length === 0) {
      return;
    }

    setLoadingServings(true);
    try {
      // Fetch servings for the given food IDs
      const { data: servingsData, error } = await supabase
        .from('food_servings')
        .select('id, food_id, serving_name, weight_g, volume_ml, is_default, sort_order')
        .in('food_id', foodIds);

      if (error) {
        console.error('Error fetching associated servings:', error);
        setLoadingServings(false);
        return;
      }

      // Create a map of food_id to food name for lookup
      const foodNameMap = new Map<string, string>();
      foods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      // Add food master name to each serving
      const servingsWithNames: FoodServingRow[] = (servingsData || []).map(serving => ({
        ...serving,
        food_master_name: foodNameMap.get(serving.food_id) || 'Unknown',
      }));

      // Merge with existing servings, avoiding duplicates by ID
      setAssociatedServings(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const newServings = servingsWithNames.filter(s => !existingIds.has(s.id));
        const allServings = [...prev, ...newServings];
        
        // Initialize "To keep" as checked for all new servings (default is checked)
        setServingsToKeep(prevKeep => {
          const newKeep = new Set(prevKeep);
          newServings.forEach(s => newKeep.add(s.id));
          return newKeep;
        });
        
        // Initialize "To delete" as unchecked (opposite of "To keep")
        setServingsToDelete(prevDelete => {
          const newDelete = new Set(prevDelete);
          // Remove new servings from "To delete" since they're checked in "To keep"
          newServings.forEach(s => newDelete.delete(s.id));
          return newDelete;
        });
        
        // Set the first serving (or first new serving) as default if no default exists
        setServingMakeDefault(prevDefault => {
          if (prevDefault === null || !allServings.some(s => s.id === prevDefault)) {
            // No default set or default doesn't exist in current servings
            // Set first new serving as default, or first serving overall
            const defaultServing = newServings.length > 0 
              ? newServings[0].id 
              : (allServings.length > 0 ? allServings[0].id : null);
            return defaultServing;
          }
          return prevDefault;
        });
        
        return allServings;
      });
    } catch (error) {
      console.error('Error fetching associated servings:', error);
    } finally {
      setLoadingServings(false);
    }
  }, []);

  // Fetch existing variants for food IDs and update food names
  const fetchAndUpdateVariants = useCallback(async (foodIds: string[], foods: FoodMasterRow[]) => {
    if (foodIds.length === 0) {
      return;
    }

    setLoadingVariants(true);
    try {
      // Fetch all variants for the given food master IDs
      const { data: variantsData, error } = await supabase
        .from('food_variant')
        .select('*')
        .in('food_master_id', foodIds);

      if (error) {
        console.error('Error fetching existing variants:', error);
        setLoadingVariants(false);
        return;
      }

      // Create a map of food_id to food name for lookup
      const foodNameMap = new Map<string, string>();
      foods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      // Add food master name to each variant
      const variantsWithNames: FoodVariantRow[] = (variantsData || []).map((variant: any) => ({
        ...variant,
        food_master_name: foodNameMap.get(variant.food_master_id) || 'Unknown',
      }));

      // Merge with existing variants, avoiding duplicates by ID
      setExistingVariants(prev => {
        const existingIds = new Set(prev.map(v => v.id));
        const newVariants = variantsWithNames.filter((v: any) => !existingIds.has(v.id));
        return [...prev, ...newVariants];
      });
    } catch (error) {
      console.error('Error fetching existing variants:', error);
    } finally {
      setLoadingVariants(false);
    }
  }, []);

  // Fetch associated food entries for food IDs and update food names
  const fetchAndUpdateEntries = useCallback(async (foodIds: string[], foods: FoodMasterRow[]) => {
    if (foodIds.length === 0) {
      return;
    }

    setLoadingEntries(true);
    try {
      // Fetch all entries for the given food IDs
      const { data: entriesData, error } = await supabase
        .from('calorie_entries')
        .select('id, user_id, meal_type, item_name, quantity, unit, protein_g, food_id, serving_id')
        .in('food_id', foodIds)
        .not('food_id', 'is', null);

      if (error) {
        console.error('Error fetching associated entries:', error);
        setLoadingEntries(false);
        return;
      }

      // Create a map of food_id to food name for lookup
      const foodNameMap = new Map<string, string>();
      foods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      // Add food master name to each entry
      const entriesWithNames: FoodEntryRow[] = (entriesData || []).map((entry: any) => ({
        id: entry.id,
        user_id: entry.user_id,
        meal_type: entry.meal_type,
        item_name: entry.item_name,
        quantity: entry.quantity,
        unit: entry.unit,
        protein_g: entry.protein_g,
        food_id: entry.food_id,
        serving_id: entry.serving_id,
        food_master_name: entry.food_id ? (foodNameMap.get(entry.food_id) || 'Unknown') : 'Unknown',
      }));

      // Merge with existing entries, avoiding duplicates by ID
      setAssociatedEntries(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const newEntries = entriesWithNames.filter((e: any) => !existingIds.has(e.id));
        return [...prev, ...newEntries];
      });
    } catch (error) {
      console.error('Error fetching associated entries:', error);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  // Fetch associated bundles for food IDs
  // A bundle is associated if any of its bundle_items has a food_id matching the Master Food grid
  const fetchAndUpdateBundles = useCallback(async (foodIds: string[], foods: FoodMasterRow[]) => {
    if (foodIds.length === 0) {
      return;
    }

    setLoadingBundles(true);
    try {
      // First, find all bundle_items that reference any of the food IDs
      const { data: bundleItemsData, error: bundleItemsError } = await supabase
        .from('bundle_items')
        .select('bundle_id')
        .in('food_id', foodIds)
        .not('food_id', 'is', null);

      if (bundleItemsError) {
        console.error('Error fetching bundle items:', bundleItemsError);
        setLoadingBundles(false);
        return;
      }

      if (!bundleItemsData || bundleItemsData.length === 0) {
        setLoadingBundles(false);
        return;
      }

      // Get unique bundle_ids
      const bundleIds = [...new Set((bundleItemsData || []).map((item: any) => item.bundle_id))];

      // Fetch all bundles with those bundle_ids
      const { data: bundlesData, error: bundlesError } = await supabase
        .from('bundles')
        .select('*')
        .in('id', bundleIds);

      if (bundlesError) {
        console.error('Error fetching bundles:', bundlesError);
        setLoadingBundles(false);
        return;
      }

      // Create a map of food_id to food name for lookup
      const foodNameMap = new Map<string, string>();
      foods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      // Fetch all bundle_items for these bundles to get food_ids
      const { data: allBundleItemsData, error: allBundleItemsError } = await supabase
        .from('bundle_items')
        .select('bundle_id, food_id')
        .in('bundle_id', bundleIds)
        .not('food_id', 'is', null)
        .in('food_id', foodIds); // Only get items matching selected foods

      // Group bundle_items by bundle_id
      const itemsByBundle = new Map<string, Set<string>>();
      if (!allBundleItemsError && allBundleItemsData) {
        allBundleItemsData.forEach((item: any) => {
          if (item.bundle_id && item.food_id) {
            if (!itemsByBundle.has(item.bundle_id)) {
              itemsByBundle.set(item.bundle_id, new Set());
            }
            itemsByBundle.get(item.bundle_id)!.add(item.food_id);
          }
        });
      }

      // Map to BundleRow type with food_master_name
      const bundles: BundleRow[] = (bundlesData || []).map((bundle: any) => {
        // Get unique food_ids for this bundle that match selected foods
        const bundleFoodIds = itemsByBundle.get(bundle.id) || new Set();
        // Get food names for these food_ids
        const foodNames = Array.from(bundleFoodIds)
          .map(foodId => foodNameMap.get(foodId))
          .filter(name => name !== undefined) as string[];
        // Create comma-separated list of food names
        const foodMasterName = foodNames.length > 0 ? foodNames.join(', ') : null;

        return {
          id: bundle.id,
          user_id: bundle.user_id,
          name: bundle.name,
          created_at: bundle.created_at,
          updated_at: bundle.updated_at,
          order_index: bundle.order_index || null,
          food_master_name: foodMasterName,
        };
      });

      // Merge with existing bundles, avoiding duplicates by ID
      setAssociatedBundles(prev => {
        const existingIds = new Set(prev.map(b => b.id));
        const newBundles = bundles.filter(b => !existingIds.has(b.id));
        return [...prev, ...newBundles];
      });
    } catch (error) {
      console.error('Error fetching associated bundles:', error);
    } finally {
      setLoadingBundles(false);
    }
  }, []);

  // Fetch associated bundle items for food IDs
  const fetchAndUpdateBundleItems = useCallback(async (foodIds: string[], foods: FoodMasterRow[]) => {
    if (foodIds.length === 0) {
      return;
    }

    setLoadingBundleItems(true);
    try {
      // Fetch all bundle_items that reference any of the food IDs
      const { data: bundleItemsData, error: bundleItemsError } = await supabase
        .from('bundle_items')
        .select('*')
        .in('food_id', foodIds)
        .not('food_id', 'is', null)
        .order('order_index', { ascending: true });

      if (bundleItemsError) {
        console.error('Error fetching bundle items:', bundleItemsError);
        setLoadingBundleItems(false);
        return;
      }

      if (!bundleItemsData || bundleItemsData.length === 0) {
        setLoadingBundleItems(false);
        return;
      }

      // Create a map of food_id to food name for lookup
      const foodNameMap = new Map<string, string>();
      foods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      // Map to BundleItemRow type with food_master_name
      const bundleItems: BundleItemRow[] = (bundleItemsData || []).map((item: any) => {
        const foodMasterName = item.food_id ? foodNameMap.get(item.food_id) || null : null;

        return {
          id: item.id,
          bundle_id: item.bundle_id,
          food_id: item.food_id,
          item_name: item.item_name,
          serving_id: item.serving_id,
          quantity: item.quantity || 0,
          unit: item.unit || '',
          order_index: item.order_index || 0,
          food_master_name: foodMasterName,
        };
      });

      // Merge with existing bundle items, avoiding duplicates by ID
      setAssociatedBundleItems(prev => {
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = bundleItems.filter(item => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
    } catch (error) {
      console.error('Error fetching associated bundle items:', error);
    } finally {
      setLoadingBundleItems(false);
    }
  }, []);

  // Update food names in associated servings when selectedFoods changes
  useEffect(() => {
    // Update food master names for existing servings
    setAssociatedServings(prev => {
      const foodNameMap = new Map<string, string>();
      selectedFoods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      return prev.map(serving => ({
        ...serving,
        food_master_name: foodNameMap.get(serving.food_id) || 'Unknown',
      }));
    });

    // Update food master names for existing variants
    setExistingVariants(prev => {
      const foodNameMap = new Map<string, string>();
      selectedFoods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      return prev.map(variant => ({
        ...variant,
        food_master_name: foodNameMap.get(variant.food_master_id) || 'Unknown',
      }));
    });

    // Update food master names for existing entries
    setAssociatedEntries(prev => {
      const foodNameMap = new Map<string, string>();
      selectedFoods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      return prev.map(entry => ({
        ...entry,
        food_master_name: entry.food_id ? (foodNameMap.get(entry.food_id) || 'Unknown') : 'Unknown',
      }));
    });

    // Update food master names for existing bundle items
    setAssociatedBundleItems(prev => {
      const foodNameMap = new Map<string, string>();
      selectedFoods.forEach(food => {
        foodNameMap.set(food.id, food.name || 'Unnamed');
      });

      return prev.map(item => ({
        ...item,
        food_master_name: item.food_id ? (foodNameMap.get(item.food_id) || 'Unknown') : 'Unknown',
      }));
    });
  }, [selectedFoods]);

  // Handle food selection from search results
  const handleFoodSelect = useCallback(async (food: FoodMasterRow) => {
    // Check if food is already in selectedFoods by ID
    const isDuplicate = selectedFoods.some(f => f.id === food.id);
    
    if (!isDuplicate) {
      const newFoods = [...selectedFoods, food];
      setSelectedFoods(newFoods);
      
      // Fetch associated servings, variants, entries, bundles, and bundle items for this food with updated food list
      await Promise.all([
        fetchAndUpdateServings([food.id], newFoods),
        fetchAndUpdateVariants([food.id], newFoods),
        fetchAndUpdateEntries([food.id], newFoods),
        fetchAndUpdateBundles([food.id], newFoods),
        fetchAndUpdateBundleItems([food.id], newFoods),
      ]);
    }
    
    // Don't clear search or hide dropdown - allow multiple selections
    // Dropdown will close when clicking away (onBlur) or clearing search
  }, [selectedFoods, fetchAndUpdateServings, fetchAndUpdateVariants, fetchAndUpdateEntries, fetchAndUpdateBundles, fetchAndUpdateBundleItems]);

  // Clear table
  const handleClearTable = useCallback(() => {
    setSelectedFoods([]);
    setAssociatedServings([]);
    setExistingVariants([]);
    setAssociatedEntries([]);
    setAssociatedBundles([]);
    setAssociatedBundleItems([]);
    setMasterChecked(new Set());
    setVariantChecked(new Set());
    // Clear serving checkbox states
    setServingsToKeep(new Set());
    setServingsToDelete(new Set());
    setServingMakeDefault(null);
  }, []);

  // Handle remove food from table
  const handleRemoveFood = useCallback((foodId: string) => {
    setSelectedFoods(prev => {
      const newFoods = prev.filter(f => f.id !== foodId);
      
      // Remove associated servings and update checkbox states
      setAssociatedServings(currentServings => {
        const servingsToRemove = currentServings.filter(s => s.food_id === foodId);
        const remainingServings = currentServings.filter(s => s.food_id !== foodId);
        
        // Clean up checkbox states for removed servings
        setServingsToKeep(prevKeep => {
          const newKeep = new Set(prevKeep);
          servingsToRemove.forEach(s => newKeep.delete(s.id));
          return newKeep;
        });
        setServingsToDelete(prevDelete => {
          const newDelete = new Set(prevDelete);
          servingsToRemove.forEach(s => newDelete.delete(s.id));
          return newDelete;
        });
        
        // Update default if the default serving was removed
        setServingMakeDefault(prevDefault => {
          if (prevDefault && servingsToRemove.some(s => s.id === prevDefault)) {
            // Default was removed, set a new default (first remaining serving)
            return remainingServings.length > 0 ? remainingServings[0].id : null;
          }
          return prevDefault;
        });
        
        return remainingServings;
      });
      
      // Re-fetch bundles for remaining foods to ensure only valid bundles are shown
      // Clear existing bundles first, then re-fetch to ensure accuracy
      setAssociatedBundles([]);
      if (newFoods.length > 0) {
        // Re-fetch bundles for all remaining foods
        fetchAndUpdateBundles(
          newFoods.map(f => f.id),
          newFoods
        ).catch(error => {
          console.error('Error re-fetching bundles after food removal:', error);
        });
      }
      
      // Re-fetch bundle items for remaining foods
      // Clear existing bundle items first, then re-fetch to ensure accuracy
      setAssociatedBundleItems([]);
      if (newFoods.length > 0) {
        // Re-fetch bundle items for all remaining foods
        fetchAndUpdateBundleItems(
          newFoods.map(f => f.id),
          newFoods
        ).catch(error => {
          console.error('Error re-fetching bundle items after food removal:', error);
        });
      }
      
      return newFoods;
    });
    
    // Remove associated variants and entries for this food
    setExistingVariants(prev => prev.filter(v => v.food_master_id !== foodId));
    setAssociatedEntries(prev => prev.filter(e => e.food_id !== foodId));
    
    setMasterChecked(prev => {
      const newSet = new Set(prev);
      newSet.delete(foodId);
      return newSet;
    });
    setVariantChecked(prev => {
      const newSet = new Set(prev);
      newSet.delete(foodId);
      return newSet;
    });
  }, [fetchAndUpdateBundles]);

  // Handle serving "To keep" checkbox toggle
  // "To delete" is automatically the opposite
  // If unchecking "To keep" and this serving is the default, clear the default
  const handleServingToKeepToggle = useCallback((servingId: string) => {
    const currentlyKeeping = servingsToKeep.has(servingId);
    
    if (currentlyKeeping) {
      // Unchecking "To keep" - remove from keep, add to delete
      setServingsToKeep(prev => {
        const newSet = new Set(prev);
        newSet.delete(servingId);
        return newSet;
      });
      setServingsToDelete(prev => {
        const newSet = new Set(prev);
        newSet.add(servingId);
        return newSet;
      });
      
      // If this serving was the default, clear it
      if (servingMakeDefault === servingId) {
        setServingMakeDefault(null);
      }
    } else {
      // Checking "To keep" - add to keep, remove from delete
      setServingsToKeep(prev => {
        const newSet = new Set(prev);
        newSet.add(servingId);
        return newSet;
      });
      setServingsToDelete(prev => {
        const newSet = new Set(prev);
        newSet.delete(servingId);
        return newSet;
      });
    }
  }, [servingsToKeep, servingMakeDefault]);

  // Handle serving "To delete" checkbox toggle
  // "To keep" is automatically the opposite
  // If checking "To delete" and this serving is the default, clear the default
  const handleServingToDeleteToggle = useCallback((servingId: string) => {
    const currentlyDeleting = servingsToDelete.has(servingId);
    
    if (currentlyDeleting) {
      // Unchecking "To delete" - remove from delete, add to keep
      setServingsToDelete(prev => {
        const newSet = new Set(prev);
        newSet.delete(servingId);
        return newSet;
      });
      setServingsToKeep(prev => {
        const newSet = new Set(prev);
        newSet.add(servingId);
        return newSet;
      });
    } else {
      // Checking "To delete" - add to delete, remove from keep
      setServingsToDelete(prev => {
        const newSet = new Set(prev);
        newSet.add(servingId);
        return newSet;
      });
      setServingsToKeep(prev => {
        const newSet = new Set(prev);
        newSet.delete(servingId);
        return newSet;
      });
      
      // If this serving was the default, clear it
      if (servingMakeDefault === servingId) {
        setServingMakeDefault(null);
      }
    }
  }, [servingsToDelete, servingMakeDefault]);

  // Handle serving "Make Default" checkbox toggle
  // Only one can be checked at a time
  // Can only be checked if "To Keep" is checked and "To Delete" is not checked
  const handleServingMakeDefaultToggle = useCallback((servingId: string) => {
    // Check if this serving can be set as default
    const canBeDefault = servingsToKeep.has(servingId) && !servingsToDelete.has(servingId);
    
    if (!canBeDefault) {
      // Cannot set as default - do nothing
      return;
    }

    setServingMakeDefault(prev => {
      // If clicking on the current default, allow unchecking (none can be default)
      if (prev === servingId) {
        return null;
      }
      // Otherwise, set this one as the new default (this will uncheck the previous one automatically)
      return servingId;
    });
  }, [servingsToKeep, servingsToDelete]);

  // Handle Master checkbox toggle
  // Only one Master can be checked at a time
  const handleMasterToggle = useCallback((foodId: string) => {
    // Check current state to determine if we're checking or unchecking
    const wasChecked = masterChecked.has(foodId);
    
    setMasterChecked(prev => {
      const newSet = new Set(prev);
      
      if (wasChecked) {
        // Unchecking this Master - just remove it
        newSet.delete(foodId);
      } else {
        // Checking this Master - uncheck all others first, then add this one
        newSet.clear();
        newSet.add(foodId);
      }
      
      return newSet;
    });

    // If we're checking Master (not unchecking), uncheck Variant for this row
    if (!wasChecked) {
      setVariantChecked(prev => {
        const newSet = new Set(prev);
        newSet.delete(foodId);
        return newSet;
      });
    }
  }, [masterChecked]);

  // Handle Variant checkbox toggle
  // Cannot check Variant if Master is checked for that row
  const handleVariantToggle = useCallback((foodId: string) => {
    // Prevent checking if Master is checked for this row
    if (masterChecked.has(foodId)) {
      return;
    }

    setVariantChecked(prev => {
      const newSet = new Set(prev);
      if (newSet.has(foodId)) {
        newSet.delete(foodId);
      } else {
        newSet.add(foodId);
      }
      return newSet;
    });
  }, [masterChecked]);

  // Handle column resize
  const handleResizeStart = useCallback((columnKey: string, startX: number, currentWidth: number) => {
    setResizingColumn(columnKey);
    resizeStateRef.current = {
      columnKey,
      startX,
      startWidth: currentWidth,
    };
  }, []);

  const handleResizeMove = useCallback((currentX: number) => {
    const state = resizeStateRef.current;
    if (!state.columnKey) return;

    const delta = currentX - state.startX;
    const newWidth = Math.max(60, state.startWidth + delta); // Minimum width 60
    
    const newWidths = {
      ...columnWidthsRef.current,
      [state.columnKey]: newWidth,
    };
    setColumnWidths(newWidths);
    columnWidthsRef.current = newWidths;
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (resizeStateRef.current.columnKey) {
      saveColumnWidths(columnWidthsRef.current);
      setResizingColumn(null);
      resizeStateRef.current = { columnKey: null, startX: 0, startWidth: 0 };
    }
  }, []);

  // Global mouse handlers for web resizing
  useEffect(() => {
    if (Platform.OS !== 'web' || !resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleResizeMove(e.pageX);
    };

    const handleMouseUp = () => {
      handleResizeEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // Pan responder for column resizing on mobile
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => resizingColumn !== null,
      onMoveShouldSetPanResponder: () => resizingColumn !== null,
      onPanResponderMove: (evt) => {
        if (resizingColumn) {
          handleResizeMove(evt.nativeEvent.pageX);
        }
      },
      onPanResponderRelease: handleResizeEnd,
    })
  ).current;

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      // Format numbers with appropriate decimals
      if (Number.isInteger(value)) {
        return value.toString();
      }
      return value.toFixed(2);
    }
    return String(value);
  };

  const formatColumnHeader = (key: string): string => {
    if (key === 'remove') return 'Remove';
    if (key === 'master') return 'Master';
    if (key === 'variant') return '->Variant';
    if (key === 'serving_to_keep') return 'To keep';
    if (key === 'serving_to_delete') return 'To delete';
    if (key === 'serving_make_default') return 'Make Default';
    if (key === 'is_base_food') return 'Is Base Food';
    if (key === 'is_quality_data') return 'Is Quality Data';
    if (key === 'weight_g') return 'Weight (g)';
    if (key === 'volume_ml') return 'Volume (ml)';
    if (key === 'sort_order') return 'Sort Order';
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderActionCell = (columnKey: string, food: FoodMasterRow) => {
    if (columnKey === 'remove') {
      return (
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: colors.tint + '20' }]}
          onPress={() => handleRemoveFood(food.id)}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            'Remove',
            `Double tap to remove ${food.name || 'this food'} from table`
          )}
        >
          <IconSymbol name="xmark" size={16} color={colors.tint} decorative={true} />
        </TouchableOpacity>
      );
    }
    if (columnKey === 'master') {
      const isChecked = masterChecked.has(food.id);
      return (
        <TouchableOpacity
          style={[
            styles.checkboxContainer,
            { 
              borderColor: isChecked ? colors.tint : colors.separator,
              backgroundColor: isChecked ? colors.tint : 'transparent',
            }
          ]}
          onPress={() => handleMasterToggle(food.id)}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            'Master checkbox',
            `Double tap to ${isChecked ? 'uncheck' : 'check'} Master for ${food.name || 'this food'}`
          )}
        >
          {isChecked && (
            <IconSymbol name="checkmark" size={14} color="#fff" decorative={true} />
          )}
        </TouchableOpacity>
      );
    }
    if (columnKey === 'variant') {
      const isChecked = variantChecked.has(food.id);
      const isMasterChecked = masterChecked.has(food.id);
      const isDisabled = isMasterChecked;
      
      return (
        <TouchableOpacity
          style={[
            styles.checkboxContainer,
            { 
              borderColor: isChecked ? colors.tint : colors.separator,
              backgroundColor: isChecked ? colors.tint : 'transparent',
              opacity: isDisabled ? 0.5 : 1,
            }
          ]}
          onPress={() => !isDisabled && handleVariantToggle(food.id)}
          disabled={isDisabled}
          activeOpacity={isDisabled ? 1 : 0.7}
          {...getButtonAccessibilityProps(
            'Variant checkbox',
            isDisabled 
              ? `Variant is disabled because Master is checked for ${food.name || 'this food'}`
              : `Double tap to ${isChecked ? 'uncheck' : 'check'} Variant for ${food.name || 'this food'}`
          )}
        >
          {isChecked && (
            <IconSymbol name="checkmark" size={14} color="#fff" decorative={true} />
          )}
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderServingActionCell = (columnKey: string, serving: FoodServingRow) => {
    if (columnKey === 'serving_to_keep') {
      const isChecked = servingsToKeep.has(serving.id);
      return (
        <TouchableOpacity
          style={[
            styles.checkboxContainer,
            { 
              borderColor: isChecked ? colors.tint : colors.separator,
              backgroundColor: isChecked ? colors.tint : 'transparent',
            }
          ]}
          onPress={() => handleServingToKeepToggle(serving.id)}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            'To keep checkbox',
            `Double tap to ${isChecked ? 'uncheck' : 'check'} To keep for this serving`
          )}
        >
          {isChecked && (
            <IconSymbol name="checkmark" size={14} color="#fff" decorative={true} />
          )}
        </TouchableOpacity>
      );
    }
    if (columnKey === 'serving_to_delete') {
      const isChecked = servingsToDelete.has(serving.id);
      return (
        <TouchableOpacity
          style={[
            styles.checkboxContainer,
            { 
              borderColor: isChecked ? colors.tint : colors.separator,
              backgroundColor: isChecked ? colors.tint : 'transparent',
            }
          ]}
          onPress={() => handleServingToDeleteToggle(serving.id)}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            'To delete checkbox',
            `Double tap to ${isChecked ? 'uncheck' : 'check'} To delete for this serving`
          )}
        >
          {isChecked && (
            <IconSymbol name="checkmark" size={14} color="#fff" decorative={true} />
          )}
        </TouchableOpacity>
      );
    }
    if (columnKey === 'serving_make_default') {
      const isChecked = servingMakeDefault === serving.id;
      const canBeDefault = servingsToKeep.has(serving.id) && !servingsToDelete.has(serving.id);
      const isDisabled = !canBeDefault;
      
      return (
        <TouchableOpacity
          style={[
            styles.checkboxContainer,
            { 
              borderColor: isChecked ? colors.tint : colors.separator,
              backgroundColor: isChecked ? colors.tint : 'transparent',
              opacity: isDisabled ? 0.5 : 1,
            }
          ]}
          onPress={() => !isDisabled && handleServingMakeDefaultToggle(serving.id)}
          activeOpacity={0.7}
          disabled={isDisabled}
          {...getButtonAccessibilityProps(
            'Make Default checkbox',
            isDisabled 
              ? 'Cannot set as default: must have "To Keep" checked and "To Delete" unchecked'
              : `Double tap to ${isChecked ? 'uncheck' : 'check'} Make Default for this serving`
          )}
        >
          {isChecked && (
            <IconSymbol name="checkmark" size={14} color="#fff" decorative={true} />
          )}
        </TouchableOpacity>
      );
    }
    return null;
  };

  // Handle cell edit for any grid
  const handleCellEdit = useCallback((
    id: string,
    field: string,
    value: any,
    gridType: 'food' | 'serving' | 'variant' | 'entry' | 'bundle' | 'bundleItem'
  ) => {
    switch (gridType) {
      case 'food':
        setEditedFoods(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(id) || {};
          newMap.set(id, { ...existing, [field]: value });
          return newMap;
        });
        break;
      case 'serving':
        setEditedServings(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(id) || {};
          newMap.set(id, { ...existing, [field]: value });
          return newMap;
        });
        break;
      case 'variant':
        setEditedVariants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(id) || {};
          newMap.set(id, { ...existing, [field]: value });
          return newMap;
        });
        break;
      case 'entry':
        setEditedEntries(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(id) || {};
          newMap.set(id, { ...existing, [field]: value });
          return newMap;
        });
        break;
      case 'bundle':
        setEditedBundles(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(id) || {};
          newMap.set(id, { ...existing, [field]: value });
          return newMap;
        });
        break;
      case 'bundleItem':
        setEditedBundleItems(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(id) || {};
          newMap.set(id, { ...existing, [field]: value });
          return newMap;
        });
        break;
    }
  }, []);

  // Helper to get edited value for a cell
  const getEditedValue = useCallback((
    id: string,
    field: string,
    originalValue: any,
    gridType: 'food' | 'serving' | 'variant' | 'entry' | 'bundle' | 'bundleItem'
  ): any => {
    let editedMap: Map<string, any>;
    switch (gridType) {
      case 'food':
        editedMap = editedFoods;
        break;
      case 'serving':
        editedMap = editedServings;
        break;
      case 'variant':
        editedMap = editedVariants;
        break;
      case 'entry':
        editedMap = editedEntries;
        break;
      case 'bundle':
        editedMap = editedBundles;
        break;
      case 'bundleItem':
        editedMap = editedBundleItems;
        break;
      default:
        return originalValue;
    }

    const edits = editedMap.get(id);
    if (edits && field in edits) {
      return edits[field as keyof typeof edits];
    }
    return originalValue;
  }, [editedFoods, editedServings, editedVariants, editedEntries, editedBundles, editedBundleItems]);

  // Save all edited entries
  const handleSave = useCallback(async () => {
    if (saving) return;

    // Check if there are any edits or deletions
    const hasEdits = 
      editedFoods.size > 0 ||
      editedServings.size > 0 ||
      editedVariants.size > 0 ||
      editedEntries.size > 0 ||
      editedBundles.size > 0 ||
      editedBundleItems.size > 0;
    const hasDeletions = servingsToDelete.size > 0;

    if (!hasEdits && !hasDeletions) {
      Alert.alert('No Changes', 'There are no changes to save.');
      return;
    }

    setSaving(true);
    const errors: string[] = [];

    try {
      // Save edited foods (food_master table)
      if (editedFoods.size > 0) {
        for (const [id, edits] of editedFoods.entries()) {
          try {
            // Convert numeric strings to numbers and boolean strings to booleans
            const updates: any = {};
            for (const [key, value] of Object.entries(edits)) {
              if (value === null || value === undefined || value === '') {
                updates[key] = null;
              } else if (['is_base_food', 'is_quality_data'].includes(key)) {
                // Handle boolean fields
                updates[key] = value === true || value === 'true' || value === 1 || value === '1';
              } else if (['serving_size', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'saturated_fat_g', 'sugar_g', 'sodium_mg', 'order_index'].includes(key)) {
                const num = Number(value);
                updates[key] = isNaN(num) ? null : num;
              } else {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from('food_master')
              .update(updates)
              .eq('id', id);

            if (error) {
              errors.push(`Food ${id}: ${error.message}`);
            }
          } catch (error: any) {
            errors.push(`Food ${id}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Handle deletions first (servings marked as "To Delete")
      if (servingsToDelete.size > 0) {
        const servingIdsToDelete = Array.from(servingsToDelete);
        
        // Check if we're deleting the default serving
        const deletingDefault = servingMakeDefault && servingIdsToDelete.includes(servingMakeDefault);
        
        const { error: deleteError } = await supabase
          .from('food_servings')
          .delete()
          .in('id', servingIdsToDelete);

        if (deleteError) {
          errors.push(`Failed to delete servings: ${deleteError.message}`);
        } else {
          // Clear checkbox states for deleted servings
          setServingsToDelete(prev => {
            const newSet = new Set(prev);
            servingIdsToDelete.forEach(id => newSet.delete(id));
            return newSet;
          });
          setServingsToKeep(prev => {
            const newSet = new Set(prev);
            servingIdsToDelete.forEach(id => newSet.delete(id));
            return newSet;
          });
          
          // If we deleted the default serving, clear it
          if (deletingDefault) {
            setServingMakeDefault(null);
          }
        }
      }

      // Save edited servings (food_serving table) - skip those marked for deletion
      if (editedServings.size > 0) {
        for (const [id, edits] of editedServings.entries()) {
          // Skip servings that are marked for deletion (they're already deleted above)
          if (servingsToDelete.has(id)) {
            continue;
          }
          
          try {
            const updates: any = {};
            for (const [key, value] of Object.entries(edits)) {
              if (key === 'food_master_name') continue; // Skip computed field
              if (value === null || value === undefined || value === '') {
                updates[key] = null;
              } else if (['weight_g', 'volume_ml', 'sort_order', 'is_default'].includes(key)) {
                if (key === 'is_default') {
                  updates[key] = value === true || value === 'true' || value === 1 || value === '1';
                } else {
                  const num = Number(value);
                  updates[key] = isNaN(num) ? null : num;
                }
              } else {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from('food_servings')
              .update(updates)
              .eq('id', id);

            if (error) {
              errors.push(`Serving ${id}: ${error.message}`);
            }
          } catch (error: any) {
            errors.push(`Serving ${id}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Save edited variants (food_variant table)
      if (editedVariants.size > 0) {
        for (const [id, edits] of editedVariants.entries()) {
          try {
            const updates: any = {};
            for (const [key, value] of Object.entries(edits)) {
              if (key === 'food_master_name') continue; // Skip computed field
              if (value === null || value === undefined || value === '') {
                updates[key] = null;
              } else if (key.includes('_100g') || key === 'popularity') {
                const num = Number(value);
                updates[key] = isNaN(num) ? null : num;
              } else {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from('food_variant')
              .update(updates)
              .eq('id', id);

            if (error) {
              errors.push(`Variant ${id}: ${error.message}`);
            }
          } catch (error: any) {
            errors.push(`Variant ${id}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Save edited entries (calorie_entries table)
      if (editedEntries.size > 0) {
        for (const [id, edits] of editedEntries.entries()) {
          try {
            const updates: any = {};
            for (const [key, value] of Object.entries(edits)) {
              if (key === 'food_master_name') continue; // Skip computed field
              if (value === null || value === undefined || value === '') {
                updates[key] = null;
              } else if (['quantity', 'protein_g'].includes(key)) {
                const num = Number(value);
                updates[key] = isNaN(num) ? null : num;
              } else {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from('calorie_entries')
              .update(updates)
              .eq('id', id);

            if (error) {
              errors.push(`Entry ${id}: ${error.message}`);
            }
          } catch (error: any) {
            errors.push(`Entry ${id}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Save edited bundles (bundles table)
      if (editedBundles.size > 0) {
        for (const [id, edits] of editedBundles.entries()) {
          try {
            const updates: any = {};
            for (const [key, value] of Object.entries(edits)) {
              if (key === 'food_master_name') continue; // Skip computed field
              if (value === null || value === undefined || value === '') {
                updates[key] = null;
              } else if (key === 'order_index') {
                const num = Number(value);
                updates[key] = isNaN(num) ? null : num;
              } else {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from('bundles')
              .update(updates)
              .eq('id', id);

            if (error) {
              errors.push(`Bundle ${id}: ${error.message}`);
            }
          } catch (error: any) {
            errors.push(`Bundle ${id}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Save edited bundle items (bundle_items table)
      if (editedBundleItems.size > 0) {
        for (const [id, edits] of editedBundleItems.entries()) {
          try {
            const updates: any = {};
            for (const [key, value] of Object.entries(edits)) {
              if (key === 'food_master_name') continue; // Skip computed field
              if (value === null || value === undefined || value === '') {
                updates[key] = null;
              } else if (['quantity', 'order_index'].includes(key)) {
                const num = Number(value);
                updates[key] = isNaN(num) ? null : num;
              } else {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from('bundle_items')
              .update(updates)
              .eq('id', id);

            if (error) {
              errors.push(`Bundle Item ${id}: ${error.message}`);
            }
          } catch (error: any) {
            errors.push(`Bundle Item ${id}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Show result
      if (errors.length > 0) {
        Alert.alert(
          'Save Failed',
          `Some entries failed to save:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n\n... and ${errors.length - 5} more errors.` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        // Clear all edit states on success
        setEditedFoods(new Map());
        setEditedServings(new Map());
        setEditedVariants(new Map());
        setEditedEntries(new Map());
        setEditedBundles(new Map());
        setEditedBundleItems(new Map());
        
        // Refresh all data from database
        try {
          // Refresh selected foods from database
          const foodIds = selectedFoods.map(f => f.id);
          if (foodIds.length > 0) {
            const { data: refreshedFoodsData, error: refreshFoodsError } = await supabase
              .from('food_master')
              .select('*')
              .in('id', foodIds);

            if (!refreshFoodsError && refreshedFoodsData) {
              const refreshedFoods: FoodMasterRow[] = refreshedFoodsData.map((food: any) => ({
                id: food.id,
                name: food.name,
                brand: food.brand,
                serving_size: food.serving_size,
                serving_unit: food.serving_unit,
                calories_kcal: food.calories_kcal,
                protein_g: food.protein_g,
                carbs_g: food.carbs_g,
                fat_g: food.fat_g,
                fiber_g: food.fiber_g,
                saturated_fat_g: food.saturated_fat_g,
                source: food.source,
                owner_user_id: food.owner_user_id,
                order_index: food.order_index,
                sugar_g: food.sugar_g,
                sodium_mg: food.sodium_mg,
                barcode: food.barcode,
                is_base_food: food.is_base_food ?? false,
                is_quality_data: food.is_quality_data ?? false,
              }));

              // Maintain the same order as before
              const orderedRefreshedFoods = foodIds
                .map(id => refreshedFoods.find(f => f.id === id))
                .filter((f): f is FoodMasterRow => f !== undefined);

              setSelectedFoods(orderedRefreshedFoods);

              // Clear existing associated data first (clearing checkbox states too)
              setAssociatedServings([]);
              setExistingVariants([]);
              setAssociatedEntries([]);
              setAssociatedBundles([]);
              setAssociatedBundleItems([]);
              setServingsToKeep(new Set());
              setServingsToDelete(new Set());
              setServingMakeDefault(null);

              // Refresh all associated data (will merge with empty arrays, effectively replacing)
              await Promise.all([
                fetchAndUpdateServings(foodIds, orderedRefreshedFoods),
                fetchAndUpdateVariants(foodIds, orderedRefreshedFoods),
                fetchAndUpdateEntries(foodIds, orderedRefreshedFoods),
                fetchAndUpdateBundles(foodIds, orderedRefreshedFoods),
                fetchAndUpdateBundleItems(foodIds, orderedRefreshedFoods),
              ]);
            }
          } else if (foodIds.length === 0) {
            // No foods selected, clear all associated data
            setAssociatedServings([]);
            setExistingVariants([]);
            setAssociatedEntries([]);
            setAssociatedBundles([]);
            setAssociatedBundleItems([]);
          }
        } catch (refreshError: any) {
          console.error('Error refreshing data after save:', refreshError);
          // Still show success since the save was successful
        }
        
        Alert.alert(
          'Success',
          'All changes have been saved successfully.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        `An unexpected error occurred: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  }, [
    saving, 
    editedFoods, 
    editedServings, 
    editedVariants, 
    editedEntries, 
    editedBundles, 
    editedBundleItems,
    servingsToDelete,
    servingMakeDefault,
    selectedFoods,
    fetchAndUpdateServings,
    fetchAndUpdateVariants,
    fetchAndUpdateEntries,
    fetchAndUpdateBundles,
    fetchAndUpdateBundleItems,
  ]);

  // Individual save handlers for each grid
  const handleSaveFoods = useCallback(async () => {
    if (savingFoods || editedFoods.size === 0) {
      if (editedFoods.size === 0) {
        Alert.alert('No Changes', 'There are no changes to save for Master Food grid.');
      }
      return;
    }

    setSavingFoods(true);
    const errors: string[] = [];

    try {
      for (const [id, edits] of editedFoods.entries()) {
        try {
          const updates: any = {};
          for (const [key, value] of Object.entries(edits)) {
            if (value === null || value === undefined || value === '') {
              updates[key] = null;
            } else if (['is_base_food', 'is_quality_data'].includes(key)) {
              // Handle boolean fields
              updates[key] = value === true || value === 'true' || value === 1 || value === '1';
            } else if (['serving_size', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'saturated_fat_g', 'sugar_g', 'sodium_mg', 'order_index'].includes(key)) {
              const num = Number(value);
              updates[key] = isNaN(num) ? null : num;
            } else {
              updates[key] = value;
            }
          }

          const { error } = await supabase
            .from('food_master')
            .update(updates)
            .eq('id', id);

          if (error) {
            errors.push(`Food ${id}: ${error.message}`);
          }
        } catch (error: any) {
          errors.push(`Food ${id}: ${error.message || 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          'Save Failed',
          `Some foods failed to save:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n\n... and ${errors.length - 5} more errors.` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        setEditedFoods(new Map());
        // Refresh selected foods
        const foodIds = selectedFoods.map(f => f.id);
        if (foodIds.length > 0) {
          const { data: refreshedFoodsData } = await supabase
            .from('food_master')
            .select('*')
            .in('id', foodIds);

          if (refreshedFoodsData) {
            const refreshedFoods: FoodMasterRow[] = refreshedFoodsData.map((food: any) => ({
              id: food.id,
              name: food.name,
              brand: food.brand,
              serving_size: food.serving_size,
              serving_unit: food.serving_unit,
              calories_kcal: food.calories_kcal,
              protein_g: food.protein_g,
              carbs_g: food.carbs_g,
              fat_g: food.fat_g,
              fiber_g: food.fiber_g,
              saturated_fat_g: food.saturated_fat_g,
              source: food.source,
              owner_user_id: food.owner_user_id,
              order_index: food.order_index,
              sugar_g: food.sugar_g,
              sodium_mg: food.sodium_mg,
              barcode: food.barcode,
              is_base_food: food.is_base_food ?? false,
              is_quality_data: food.is_quality_data ?? false,
            }));

            const orderedRefreshedFoods = foodIds
              .map(id => refreshedFoods.find(f => f.id === id))
              .filter((f): f is FoodMasterRow => f !== undefined);

            setSelectedFoods(orderedRefreshedFoods);
          }
        }
        Alert.alert('Success', 'Master Food records saved successfully.', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`, [{ text: 'OK' }]);
    } finally {
      setSavingFoods(false);
    }
  }, [savingFoods, editedFoods, selectedFoods]);

  const handleSaveServings = useCallback(async () => {
    // Check if there are any edits or servings marked for deletion
    const hasEdits = editedServings.size > 0;
    const hasDeletions = servingsToDelete.size > 0;
    
    if (savingServings || (!hasEdits && !hasDeletions)) {
      if (!hasEdits && !hasDeletions) {
        Alert.alert('No Changes', 'There are no changes to save for Associated Servings grid.');
      }
      return;
    }

    setSavingServings(true);
    const errors: string[] = [];

    try {
      // First, handle deletions
      if (hasDeletions) {
        const servingIdsToDelete = Array.from(servingsToDelete);
        
        // Check if we're deleting the default serving - if so, we may need to update defaults
        const deletingDefault = servingMakeDefault && servingIdsToDelete.includes(servingMakeDefault);
        
        // Delete servings marked as "To Delete"
        const { error: deleteError } = await supabase
          .from('food_servings')
          .delete()
          .in('id', servingIdsToDelete);

        if (deleteError) {
          errors.push(`Failed to delete servings: ${deleteError.message}`);
        } else {
          // Clear the checkbox states for deleted servings
          setServingsToDelete(prev => {
            const newSet = new Set(prev);
            servingIdsToDelete.forEach(id => newSet.delete(id));
            return newSet;
          });
          setServingsToKeep(prev => {
            const newSet = new Set(prev);
            servingIdsToDelete.forEach(id => newSet.delete(id));
            return newSet;
          });
          
          // If we deleted the default serving, clear it
          if (deletingDefault) {
            setServingMakeDefault(null);
          }
        }
      }

      // Then, save edited servings (only those not marked for deletion)
      if (hasEdits) {
        for (const [id, edits] of editedServings.entries()) {
          // Skip servings that are marked for deletion (they're already deleted)
          if (servingsToDelete.has(id)) {
            continue;
          }
          
          try {
            const updates: any = {};
            for (const [key, value] of Object.entries(edits)) {
              if (key === 'food_master_name') continue;
              if (value === null || value === undefined || value === '') {
                updates[key] = null;
              } else if (['weight_g', 'volume_ml', 'sort_order', 'is_default'].includes(key)) {
                if (key === 'is_default') {
                  updates[key] = value === true || value === 'true' || value === 1 || value === '1';
                } else {
                  const num = Number(value);
                  updates[key] = isNaN(num) ? null : num;
                }
              } else {
                updates[key] = value;
              }
            }

            const { error } = await supabase
              .from('food_servings')
              .update(updates)
              .eq('id', id);

            if (error) {
              errors.push(`Serving ${id}: ${error.message}`);
            }
          } catch (error: any) {
            errors.push(`Serving ${id}: ${error.message || 'Unknown error'}`);
          }
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          'Save Failed',
          `Some operations failed:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n\n... and ${errors.length - 5} more errors.` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        setEditedServings(new Map());
        // Refresh servings - clear first, then re-fetch
        setAssociatedServings([]);
        const foodIds = selectedFoods.map(f => f.id);
        if (foodIds.length > 0) {
          await fetchAndUpdateServings(foodIds, selectedFoods);
        }
        Alert.alert('Success', 'Associated Servings records saved successfully.', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`, [{ text: 'OK' }]);
    } finally {
      setSavingServings(false);
    }
  }, [savingServings, editedServings, servingsToDelete, servingMakeDefault, selectedFoods, fetchAndUpdateServings]);

  const handleSaveVariants = useCallback(async () => {
    if (savingVariants || editedVariants.size === 0) {
      if (editedVariants.size === 0) {
        Alert.alert('No Changes', 'There are no changes to save for Existing Variants grid.');
      }
      return;
    }

    setSavingVariants(true);
    const errors: string[] = [];

    try {
      for (const [id, edits] of editedVariants.entries()) {
        try {
          const updates: any = {};
          for (const [key, value] of Object.entries(edits)) {
            if (key === 'food_master_name') continue;
            if (value === null || value === undefined || value === '') {
              updates[key] = null;
            } else if (key.includes('_100g') || key === 'popularity') {
              const num = Number(value);
              updates[key] = isNaN(num) ? null : num;
            } else {
              updates[key] = value;
            }
          }

          const { error } = await supabase
            .from('food_variant')
            .update(updates)
            .eq('id', id);

          if (error) {
            errors.push(`Variant ${id}: ${error.message}`);
          }
        } catch (error: any) {
          errors.push(`Variant ${id}: ${error.message || 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          'Save Failed',
          `Some variants failed to save:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n\n... and ${errors.length - 5} more errors.` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        setEditedVariants(new Map());
        // Refresh variants - clear first, then re-fetch
        setExistingVariants([]);
        const foodIds = selectedFoods.map(f => f.id);
        if (foodIds.length > 0) {
          await fetchAndUpdateVariants(foodIds, selectedFoods);
        }
        Alert.alert('Success', 'Existing Variants records saved successfully.', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`, [{ text: 'OK' }]);
    } finally {
      setSavingVariants(false);
    }
  }, [savingVariants, editedVariants, selectedFoods, fetchAndUpdateVariants]);

  const handleSaveEntries = useCallback(async () => {
    if (savingEntries || editedEntries.size === 0) {
      if (editedEntries.size === 0) {
        Alert.alert('No Changes', 'There are no changes to save for Associated Food Entries grid.');
      }
      return;
    }

    setSavingEntries(true);
    const errors: string[] = [];

    try {
      for (const [id, edits] of editedEntries.entries()) {
        try {
          const updates: any = {};
          for (const [key, value] of Object.entries(edits)) {
            if (key === 'food_master_name') continue;
            if (value === null || value === undefined || value === '') {
              updates[key] = null;
            } else if (['quantity', 'protein_g'].includes(key)) {
              const num = Number(value);
              updates[key] = isNaN(num) ? null : num;
            } else {
              updates[key] = value;
            }
          }

          const { error } = await supabase
            .from('calorie_entries')
            .update(updates)
            .eq('id', id);

          if (error) {
            errors.push(`Entry ${id}: ${error.message}`);
          }
        } catch (error: any) {
          errors.push(`Entry ${id}: ${error.message || 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          'Save Failed',
          `Some entries failed to save:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n\n... and ${errors.length - 5} more errors.` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        setEditedEntries(new Map());
        // Refresh entries - clear first, then re-fetch
        setAssociatedEntries([]);
        const foodIds = selectedFoods.map(f => f.id);
        if (foodIds.length > 0) {
          await fetchAndUpdateEntries(foodIds, selectedFoods);
        }
        Alert.alert('Success', 'Associated Food Entries records saved successfully.', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`, [{ text: 'OK' }]);
    } finally {
      setSavingEntries(false);
    }
  }, [savingEntries, editedEntries, selectedFoods, fetchAndUpdateEntries]);

  const handleSaveBundles = useCallback(async () => {
    if (savingBundles || editedBundles.size === 0) {
      if (editedBundles.size === 0) {
        Alert.alert('No Changes', 'There are no changes to save for Associated Bundles grid.');
      }
      return;
    }

    setSavingBundles(true);
    const errors: string[] = [];

    try {
      for (const [id, edits] of editedBundles.entries()) {
        try {
          const updates: any = {};
          for (const [key, value] of Object.entries(edits)) {
            if (key === 'food_master_name') continue;
            if (value === null || value === undefined || value === '') {
              updates[key] = null;
            } else if (key === 'order_index') {
              const num = Number(value);
              updates[key] = isNaN(num) ? null : num;
            } else {
              updates[key] = value;
            }
          }

          const { error } = await supabase
            .from('bundles')
            .update(updates)
            .eq('id', id);

          if (error) {
            errors.push(`Bundle ${id}: ${error.message}`);
          }
        } catch (error: any) {
          errors.push(`Bundle ${id}: ${error.message || 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          'Save Failed',
          `Some bundles failed to save:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n\n... and ${errors.length - 5} more errors.` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        setEditedBundles(new Map());
        // Refresh bundles - clear first, then re-fetch
        setAssociatedBundles([]);
        const foodIds = selectedFoods.map(f => f.id);
        if (foodIds.length > 0) {
          await fetchAndUpdateBundles(foodIds, selectedFoods);
        }
        Alert.alert('Success', 'Associated Bundles records saved successfully.', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`, [{ text: 'OK' }]);
    } finally {
      setSavingBundles(false);
    }
  }, [savingBundles, editedBundles, selectedFoods, fetchAndUpdateBundles]);

  const handleSaveBundleItems = useCallback(async () => {
    if (savingBundleItems || editedBundleItems.size === 0) {
      if (editedBundleItems.size === 0) {
        Alert.alert('No Changes', 'There are no changes to save for Associated Bundles Item grid.');
      }
      return;
    }

    setSavingBundleItems(true);
    const errors: string[] = [];

    try {
      for (const [id, edits] of editedBundleItems.entries()) {
        try {
          const updates: any = {};
          for (const [key, value] of Object.entries(edits)) {
            if (key === 'food_master_name') continue;
            if (value === null || value === undefined || value === '') {
              updates[key] = null;
            } else if (['quantity', 'order_index'].includes(key)) {
              const num = Number(value);
              updates[key] = isNaN(num) ? null : num;
            } else {
              updates[key] = value;
            }
          }

          const { error } = await supabase
            .from('bundle_items')
            .update(updates)
            .eq('id', id);

          if (error) {
            errors.push(`Bundle Item ${id}: ${error.message}`);
          }
        } catch (error: any) {
          errors.push(`Bundle Item ${id}: ${error.message || 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          'Save Failed',
          `Some bundle items failed to save:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n\n... and ${errors.length - 5} more errors.` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        setEditedBundleItems(new Map());
        // Refresh bundle items - clear first, then re-fetch
        setAssociatedBundleItems([]);
        const foodIds = selectedFoods.map(f => f.id);
        if (foodIds.length > 0) {
          await fetchAndUpdateBundleItems(foodIds, selectedFoods);
        }
        Alert.alert('Success', 'Associated Bundles Item records saved successfully.', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`, [{ text: 'OK' }]);
    } finally {
      setSavingBundleItems(false);
    }
  }, [savingBundleItems, editedBundleItems, selectedFoods, fetchAndUpdateBundleItems]);

  // Handle merge entries
  const handleMergeEntries = useCallback(() => {
    setShowMergeConfirm(true);
  }, []);

  // Helper function to convert serving-based values to per-100g
  const convertToPer100g = useCallback((
    value: number | null,
    servingSize: number | null,
    servingUnit: string | null
  ): number | null => {
    if (value === null || servingSize === null || servingSize === 0) {
      return null;
    }

    // For volume units, treat 1ml = 1g
    // For weight units, use directly
    const servingSizeInGrams = servingSize; // Already in grams or ml (treated as grams)

    // Calculate value per 100g
    const per100g = (value / servingSizeInGrams) * 100;
    return Math.round(per100g * 100) / 100; // Round to 2 decimal places
  }, []);

  // Handle merge confirmation
  const handleMergeConfirm = useCallback(async () => {
    setShowMergeConfirm(false);
    setSaving(true);

    try {
      // Step 1: Validation
      const masterCount = masterChecked.size;
      const variantCount = variantChecked.size;

      if (masterCount !== 1) {
        setMergeErrorMessage(`Please select exactly 1 Master food. Currently ${masterCount} selected.`);
        setShowMergeError(true);
        setSaving(false);
        return;
      }

      if (variantCount < 1) {
        setMergeErrorMessage('Please select at least 1 food to convert to Variant (->Variant checkbox).');
        setShowMergeError(true);
        setSaving(false);
        return;
      }

      // Step 2: Identify Ultimate Master and New Variants
      const ultimateMasterId = Array.from(masterChecked)[0];
      const ultimateMaster = selectedFoods.find(f => f.id === ultimateMasterId);
      
      if (!ultimateMaster) {
        setMergeErrorMessage('Ultimate Master food not found in selected foods.');
        setShowMergeError(true);
        setSaving(false);
        return;
      }

      const newVariantIds = Array.from(variantChecked);
      const newVariants = selectedFoods.filter(f => newVariantIds.includes(f.id));

      if (newVariants.length !== variantCount) {
        setMergeErrorMessage('Some selected variants not found in selected foods.');
        setShowMergeError(true);
        setSaving(false);
        return;
      }

      // Step 2.5: Validate Associated Servings - if there are "To Keep" servings, one must be marked as "Make Default"
      // Get all servings that will be associated with Ultimate Master after merge:
      // 1. Servings from New Variants that are marked as "To Keep"
      // 2. Servings already associated with Ultimate Master that are marked as "To Keep"
      const newVariantServingsToKeep = associatedServings.filter(serving => 
        newVariantIds.includes(serving.food_id) && servingsToKeep.has(serving.id)
      );
      
      const ultimateMasterServingsToKeep = associatedServings.filter(serving => 
        serving.food_id === ultimateMasterId && servingsToKeep.has(serving.id)
      );
      
      // Combine all "To Keep" servings
      const allToKeepServings = [...newVariantServingsToKeep, ...ultimateMasterServingsToKeep];
      
      // If there are "To Keep" servings, check if one is marked as "Make Default"
      if (allToKeepServings.length > 0) {
        const hasDefault = servingMakeDefault !== null && 
          allToKeepServings.some(serving => serving.id === servingMakeDefault);
        
        if (!hasDefault) {
          setMergeErrorMessage('Please select one "To Keep" serving as "Make Default" before merging. At least one "To Keep" serving must be marked as the default.');
          setShowMergeError(true);
          setSaving(false);
          return;
        }
      }

      // Track operations for potential rollback
      const createdVariantIds: string[] = [];
      const updatedEntryIds: string[] = [];
      const updatedBundleItemIds: string[] = [];

      try {
        // Step 3: For each New Variant, create food_variant record
        // Use New Variant's own data, converted to per-100g using New Variant's serving_size
        for (const variant of newVariants) {
          // Convert New Variant's nutritional values to per-100g using New Variant's own serving_size
          const energyKcal100g = convertToPer100g(
            variant.calories_kcal,
            variant.serving_size,
            variant.serving_unit
          );
          const proteinG100g = convertToPer100g(
            variant.protein_g,
            variant.serving_size,
            variant.serving_unit
          );
          const carbsG100g = convertToPer100g(
            variant.carbs_g,
            variant.serving_size,
            variant.serving_unit
          );
          const fatG100g = convertToPer100g(
            variant.fat_g,
            variant.serving_size,
            variant.serving_unit
          );
          const saturatedFatG100g = convertToPer100g(
            variant.saturated_fat_g,
            variant.serving_size,
            variant.serving_unit
          );
          const sugarG100g = convertToPer100g(
            variant.sugar_g,
            variant.serving_size,
            variant.serving_unit
          );
          const fiberG100g = convertToPer100g(
            variant.fiber_g,
            variant.serving_size,
            variant.serving_unit
          );
          const sodiumMg100g = convertToPer100g(
            variant.sodium_mg,
            variant.serving_size,
            variant.serving_unit
          );

          // Create food_variant record with New Variant's own data
          // Only food_master_id links to Ultimate Master
          const { data: variantData, error: variantError } = await supabase
            .from('food_variant')
            .insert({
              food_master_id: ultimateMasterId,
              variant_name: variant.name,
              brand: variant.brand,
              barcode: variant.barcode,
              energy_kcal_100g: energyKcal100g,
              protein_g_100g: proteinG100g,
              carbs_g_100g: carbsG100g,
              fat_g_100g: fatG100g,
              saturated_fat_g_100g: saturatedFatG100g,
              sugar_g_100g: sugarG100g,
              fiber_g_100g: fiberG100g,
              sodium_mg_100g: sodiumMg100g,
              source: variant.source,
            })
            .select('id')
            .single();

          if (variantError || !variantData) {
            throw new Error(`Failed to create variant for ${variant.name || variant.id}: ${variantError?.message || 'Unknown error'}`);
          }

          createdVariantIds.push(variantData.id);
        }

        // Step 4: Update calorie_entries that reference New Variants
        for (const variantId of newVariantIds) {
          const { data: entriesToUpdate, error: entriesError } = await supabase
            .from('calorie_entries')
            .select('id')
            .eq('food_id', variantId)
            .not('food_id', 'is', null);

          if (entriesError) {
            throw new Error(`Failed to find entries for variant ${variantId}: ${entriesError.message}`);
          }

          if (entriesToUpdate && entriesToUpdate.length > 0) {
            const entryIds = entriesToUpdate.map(e => e.id);
            const { error: updateError } = await supabase
              .from('calorie_entries')
              .update({ food_id: ultimateMasterId })
              .in('id', entryIds);

            if (updateError) {
              throw new Error(`Failed to update entries for variant ${variantId}: ${updateError.message}`);
            }

            updatedEntryIds.push(...entryIds);
          }
        }

        // Step 5: Update bundle_items that reference New Variants
        for (const variantId of newVariantIds) {
          const { data: bundleItemsToUpdate, error: bundleItemsError } = await supabase
            .from('bundle_items')
            .select('id')
            .eq('food_id', variantId)
            .not('food_id', 'is', null);

          if (bundleItemsError) {
            throw new Error(`Failed to find bundle items for variant ${variantId}: ${bundleItemsError.message}`);
          }

          if (bundleItemsToUpdate && bundleItemsToUpdate.length > 0) {
            const bundleItemIds = bundleItemsToUpdate.map(item => item.id);
            const { error: updateError } = await supabase
              .from('bundle_items')
              .update({ food_id: ultimateMasterId })
              .in('id', bundleItemIds);

            if (updateError) {
              throw new Error(`Failed to update bundle items for variant ${variantId}: ${updateError.message}`);
            }

            updatedBundleItemIds.push(...bundleItemIds);
          }
        }

        // Step 6: Handle Associated Servings for New Variants
        // Get all servings associated with New Variants
        const newVariantServings = associatedServings.filter(serving => 
          newVariantIds.includes(serving.food_id)
        );

        // Relink servings marked as "To Keep" to Ultimate Master
        const servingsToRelink = newVariantServings.filter(serving => 
          servingsToKeep.has(serving.id)
        );

        if (servingsToRelink.length > 0) {
          const servingIdsToRelink = servingsToRelink.map(s => s.id);
          const { error: relinkError } = await supabase
            .from('food_servings')
            .update({ food_id: ultimateMasterId })
            .in('id', servingIdsToRelink);

          if (relinkError) {
            throw new Error(`Failed to relink servings to Ultimate Master: ${relinkError.message}`);
          }
        }

        // Delete servings marked as "To Delete"
        const servingsToRemove = newVariantServings.filter(serving => 
          servingsToDelete.has(serving.id)
        );

        if (servingsToRemove.length > 0) {
          const servingIdsToRemove = servingsToRemove.map(s => s.id);
          const { error: deleteError } = await supabase
            .from('food_servings')
            .delete()
            .in('id', servingIdsToRemove);

          if (deleteError) {
            throw new Error(`Failed to delete servings: ${deleteError.message}`);
          }
        }

        // Delete any remaining servings from New Variants (not marked as To Keep or To Delete)
        // These are the ones that were ignored (unchecked in both To Keep and To Delete)
        const remainingServings = newVariantServings.filter(serving => 
          !servingsToKeep.has(serving.id) && !servingsToDelete.has(serving.id)
        );

        if (remainingServings.length > 0) {
          const remainingServingIds = remainingServings.map(s => s.id);
          const { error: remainingDeleteError } = await supabase
            .from('food_servings')
            .delete()
            .in('id', remainingServingIds);

          if (remainingDeleteError) {
            throw new Error(`Failed to delete remaining servings: ${remainingDeleteError.message}`);
          }
        }

        // Step 6.5: Handle "Make Default" serving
        // First, unset all defaults for Ultimate Master (including any that might already exist)
        const { error: unsetDefaultError } = await supabase
          .from('food_servings')
          .update({ is_default: false })
          .eq('food_id', ultimateMasterId);

        if (unsetDefaultError) {
          throw new Error(`Failed to unset default servings for Ultimate Master: ${unsetDefaultError.message}`);
        }

        // Only set a default if there are "To Keep" servings and one is marked as "Make Default"
        const hasToKeepServings = servingsToRelink.length > 0 || 
          associatedServings.some(s => 
            s.food_id === ultimateMasterId && servingsToKeep.has(s.id)
          );

        if (hasToKeepServings && servingMakeDefault) {
          // The serving marked as "Make Default" could be:
          // 1. Already associated with Ultimate Master
          // 2. A serving from a New Variant that was relinked to Ultimate Master
          // After relinking, it should now be associated with Ultimate Master
          const defaultServing = associatedServings.find(s => s.id === servingMakeDefault);
          
          if (defaultServing) {
            // Check if this serving is now associated with Ultimate Master
            // (either it was already, or it was just relinked)
            const isFromUltimateMaster = defaultServing.food_id === ultimateMasterId;
            const wasRelinked = servingsToRelink.some(s => s.id === servingMakeDefault);
            
            // Also verify that this serving is marked as "To Keep" (not "To Delete")
            const isMarkedToKeep = servingsToKeep.has(servingMakeDefault);
            const isMarkedToDelete = servingsToDelete.has(servingMakeDefault);
            
            if ((isFromUltimateMaster || wasRelinked) && isMarkedToKeep && !isMarkedToDelete) {
              // Set this serving as the default
              const { error: setDefaultError } = await supabase
                .from('food_servings')
                .update({ is_default: true })
                .eq('id', servingMakeDefault);

              if (setDefaultError) {
                throw new Error(`Failed to set default serving: ${setDefaultError.message}`);
              }
            }
          }
        }
        // If no serving is marked as "Make Default" or there are no "To Keep" servings,
        // no default will be set (none can be default as well)

        // Step 7: Delete New Variants from food_master
        for (const variantId of newVariantIds) {
          const { error: deleteError } = await supabase
            .from('food_master')
            .delete()
            .eq('id', variantId);

          if (deleteError) {
            throw new Error(`Failed to delete variant ${variantId} from food_master: ${deleteError.message}`);
          }
        }

        // Success! Refresh the UI
        // Remove merged variants from selectedFoods
        setSelectedFoods(prev => prev.filter(f => !newVariantIds.includes(f.id)));
        
        // Clear checkbox states
        setMasterChecked(new Set());
        setVariantChecked(new Set());

        // Refresh all associated data
        const remainingFoodIds = selectedFoods
          .filter(f => !newVariantIds.includes(f.id))
          .map(f => f.id);
        
        if (remainingFoodIds.length > 0) {
          const remainingFoods = selectedFoods.filter(f => !newVariantIds.includes(f.id));
          await Promise.all([
            fetchAndUpdateServings(remainingFoodIds, remainingFoods),
            fetchAndUpdateVariants(remainingFoodIds, remainingFoods),
            fetchAndUpdateEntries(remainingFoodIds, remainingFoods),
            fetchAndUpdateBundles(remainingFoodIds, remainingFoods),
            fetchAndUpdateBundleItems(remainingFoodIds, remainingFoods),
          ]);
        } else {
          // No foods left, clear everything
          setAssociatedServings([]);
          setExistingVariants([]);
          setAssociatedEntries([]);
          setAssociatedBundles([]);
          setAssociatedBundleItems([]);
        }

        setShowMergeSuccess(true);
      } catch (error: any) {
        // Rollback: Try to undo what was done
        // Note: Since Supabase doesn't support transactions, we'll try to rollback what we can
        
        let rollbackErrors: string[] = [];

        // Rollback: Delete created variants
        for (const variantId of createdVariantIds) {
          const { error } = await supabase
            .from('food_variant')
            .delete()
            .eq('id', variantId);
          if (error) {
            rollbackErrors.push(`Failed to rollback variant ${variantId}: ${error.message}`);
          }
        }

        // Rollback: Revert entry updates (we don't know original food_ids, so we can't fully rollback)
        // This is a limitation - we'd need to track original food_ids
        
        // Rollback: Revert bundle item updates (same limitation)

        const errorMessage = error?.message || 'Unknown error occurred during merge';
        const rollbackMessage = rollbackErrors.length > 0 
          ? `${errorMessage}\n\nRollback attempted but some operations may have partially completed.`
          : errorMessage;

        setMergeErrorMessage(rollbackMessage);
        setShowMergeError(true);
      }
    } catch (error: any) {
      setMergeErrorMessage(error?.message || 'An unexpected error occurred during merge.');
      setShowMergeError(true);
    } finally {
      setSaving(false);
    }
  }, [
    masterChecked,
    variantChecked,
    selectedFoods,
    convertToPer100g,
    fetchAndUpdateServings,
    fetchAndUpdateVariants,
    fetchAndUpdateEntries,
    fetchAndUpdateBundles,
    fetchAndUpdateBundleItems,
  ]);

  // Handle merge cancel
  const handleMergeCancel = useCallback(() => {
    setShowMergeConfirm(false);
  }, []);

  // Get color for a food ID (cycles through 7 colors)
  const getFoodColor = useCallback((foodId: string): string => {
    const foodIndex = selectedFoods.findIndex(f => f.id === foodId);
    if (foodIndex === -1) return 'transparent';
    return FOOD_ROW_COLORS[foodIndex % FOOD_ROW_COLORS.length];
  }, [selectedFoods]);

  // Get color for a row based on food_id (for associated grids)
  const getRowColorByFoodId = useCallback((foodId: string | null): string => {
    if (!foodId) return 'transparent';
    return getFoodColor(foodId);
  }, [getFoodColor]);

  // Get color for a bundle row (looks up first food_id from associated bundle_items)
  const getBundleRowColor = useCallback((bundleId: string): string => {
    const bundleItem = associatedBundleItems.find(item => item.bundle_id === bundleId);
    if (!bundleItem || !bundleItem.food_id) return 'transparent';
    return getRowColorByFoodId(bundleItem.food_id);
  }, [associatedBundleItems, getRowColorByFoodId]);

  // Handle loading and access denied states - EARLY RETURNS AFTER ALL HOOKS
  if (authLoading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!isAdmin) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: '#ff0000' }}>
          Access Denied
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          onPress={() => router.back()}
          activeOpacity={0.6}
          {...getButtonAccessibilityProps(
            'Go back',
            'Double tap to go back to the previous screen'
          )}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Merge Food
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Save and Merge Buttons */}
      <View style={[styles.saveButtonContainer, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            getMinTouchTargetStyle(),
            { 
              backgroundColor: colors.tint,
              opacity: saving ? 0.6 : 1,
              ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
            }
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
          {...getButtonAccessibilityProps(
            'Save all changes',
            'Double tap to save all edited entries'
          )}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.saveButtonContent}>
              <IconSymbol name="checkmark.circle.fill" size={20} color="#fff" decorative={true} />
              <Text style={styles.saveButtonText}>Save All Changes</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mergeButton,
            getMinTouchTargetStyle(),
            { 
              backgroundColor: colors.tint,
              ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
            }
          ]}
          onPress={handleMergeEntries}
          activeOpacity={0.8}
          {...getButtonAccessibilityProps(
            'Merge entries',
            'Double tap to merge entries'
          )}
        >
          <View style={[styles.saveButtonContent, { pointerEvents: 'none' }]}>
            <IconSymbol name="arrow.left.arrow.right" size={20} color="#fff" decorative={true} />
            <Text style={styles.saveButtonText}>Merge Entries</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.contentContainer}
        contentContainerStyle={styles.contentScrollContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Search Bar with Clear Button */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <View style={styles.searchBarRow}>
            {/* Clear Table Button */}
            <TouchableOpacity
              style={[
                styles.clearTableButton,
                getMinTouchTargetStyle(),
                { 
                  backgroundColor: colors.tint + '20',
                  ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                }
              ]}
              onPress={handleClearTable}
              disabled={selectedFoods.length === 0}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                'Clear table',
                'Double tap to clear all foods from the table'
              )}
            >
              <IconSymbol name="trash" size={18} color={colors.tint} decorative={true} />
              <Text style={[styles.clearTableButtonText, { color: colors.tint }]}>Clear</Text>
            </TouchableOpacity>

            {/* Search Input */}
            <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary, flex: 1 }]}>
              <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} decorative={true} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Master Food Search"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (text.trim() && searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                onFocus={() => {
                  if (searchResults.length > 0 && searchQuery.trim()) {
                    setShowSearchResults(true);
                  }
                }}
                {...getInputAccessibilityProps(
                  'Master Food Search',
                  'Enter food name to search'
                )}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  style={styles.clearSearchButton}
                  {...getButtonAccessibilityProps(
                    'Clear search',
                    'Double tap to clear search'
                  )}
                >
                  <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} decorative={true} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Results Dropdown */}
          {searchQuery.trim() && showSearchResults && (
            <View style={[styles.searchResultsContainer, { backgroundColor: colors.card, borderColor: colors.separator }]}>
              {loading ? (
                <View style={styles.searchResultsLoading}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <ThemedText style={[styles.searchResultsLoadingText, { color: colors.textSecondary }]}>
                    Searching...
                  </ThemedText>
                </View>
              ) : searchResults.length > 0 ? (
                <ScrollView 
                  style={styles.searchResultsScroll}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {searchResults.map((food) => {
                    const isSelected = selectedFoods.some(f => f.id === food.id);
                    return (
                      <TouchableOpacity
                        key={food.id}
                        style={[
                          styles.searchResultItem,
                          { 
                            backgroundColor: isSelected ? colors.tint + '15' : 'transparent',
                            borderBottomColor: colors.separator,
                          }
                        ]}
                        onPress={() => handleFoodSelect(food)}
                        disabled={isSelected}
                        activeOpacity={0.7}
                        {...getButtonAccessibilityProps(
                          `${food.name || 'Unnamed food'}`,
                          `Double tap to ${isSelected ? 'already selected' : 'add to table'}`
                        )}
                      >
                        <View style={styles.searchResultContent}>
                          <ThemedText 
                            style={[styles.searchResultName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {food.name || 'Unnamed'}
                          </ThemedText>
                          {food.brand && (
                            <ThemedText 
                              style={[styles.searchResultBrand, { color: colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {food.brand}
                            </ThemedText>
                          )}
                        </View>
                        {isSelected && (
                          <IconSymbol name="checkmark.circle.fill" size={20} color={colors.tint} decorative={true} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.searchResultsEmpty}>
                  <ThemedText style={[styles.searchResultsEmptyText, { color: colors.textSecondary }]}>
                    No foods found
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        </View>

        {/* UI's Master Food grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              UI's Master Food grid ({selectedFoods.length} {selectedFoods.length === 1 ? 'row' : 'rows'})
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.gridSaveButton,
                getMinTouchTargetStyle(),
                { 
                  backgroundColor: colors.tint,
                  opacity: savingFoods || editedFoods.size === 0 ? 0.6 : 1,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={handleSaveFoods}
              disabled={savingFoods || editedFoods.size === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Save Master Food records',
                'Double tap to save Master Food grid changes'
              )}
            >
              {savingFoods ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.gridSaveButtonText}>Save Master Food records</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.tableWrapper}>
          <ScrollView
            ref={tableScrollRef}
            horizontal
            showsHorizontalScrollIndicator={true}
            style={styles.tableHorizontalScroll}
          >
            <View 
              ref={tableContainerRef}
              style={styles.tableContainer}
              {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
            >
              {/* Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                {ALL_COLUMN_KEYS.map((key, index) => (
                  <View
                    key={key}
                    style={[
                      styles.headerCell,
                      { 
                        width: columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key],
                        borderRightColor: colors.separator,
                      }
                    ]}
                  >
                    <ThemedText 
                      style={[styles.headerText, { color: colors.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {formatColumnHeader(key)}
                    </ThemedText>
                    {Platform.OS === 'web' && (
                      <View
                        style={[styles.resizeHandle, { backgroundColor: colors.separator }]}
                        // @ts-ignore - web-specific mouse events
                        onMouseDown={(e: any) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const startX = e.pageX || (e.clientX + (window.scrollX || 0));
                          handleResizeStart(key, startX, columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key]);
                        }}
                      />
                    )}
                    {Platform.OS !== 'web' && (
                      <TouchableOpacity
                        style={[styles.resizeHandleMobile, { backgroundColor: colors.tint + '40' }]}
                        onPressIn={(e) => {
                          const layout = e.nativeEvent.target as any;
                          handleResizeStart(key, e.nativeEvent.pageX, columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key]);
                        }}
                      />
                    )}
                  </View>
                ))}
              </View>

              {/* Table Body */}
              <ScrollView
                style={styles.tableBodyScroll}
                showsVerticalScrollIndicator={true}
              >
                {selectedFoods.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      Search and select foods to add them to the table
                    </ThemedText>
                  </View>
                ) : (
                  selectedFoods.map((food, rowIndex) => {
                    const rowColor = getFoodColor(food.id);
                    return (
                    <View
                      key={food.id || rowIndex}
                      style={[
                        styles.tableRow,
                        { 
                          backgroundColor: rowColor,
                          borderBottomColor: colors.separator,
                        }
                      ]}
                    >
                      {ALL_COLUMN_KEYS.map((key) => (
                        <View
                          key={key}
                          style={[
                            styles.tableCell,
                            { 
                              width: columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key],
                              borderRightColor: colors.separator,
                            }
                          ]}
                        >
                          {ACTION_COLUMNS.includes(key) ? (
                            <View style={styles.actionCellWrapper}>
                              {renderActionCell(key, food)}
                            </View>
                          ) : ['is_base_food', 'is_quality_data'].includes(key) ? (() => {
                            // Render boolean fields as checkboxes
                            const originalValue = food[key as keyof FoodMasterRow];
                            const editedValue = getEditedValue(food.id, key, originalValue, 'food');
                            const isChecked = editedValue === true || editedValue === 'true' || editedValue === 1 || editedValue === '1';
                            return (
                              <TouchableOpacity
                                style={[
                                  styles.checkboxContainer,
                                  { 
                                    borderColor: isChecked ? colors.tint : colors.separator,
                                    backgroundColor: isChecked ? colors.tint : 'transparent',
                                  }
                                ]}
                                onPress={() => {
                                  const newValue = !isChecked;
                                  setEditedFoods(prev => {
                                    const newMap = new Map(prev);
                                    const currentEdits = newMap.get(food.id) || {};
                                    newMap.set(food.id, { ...currentEdits, [key]: newValue });
                                    return newMap;
                                  });
                                }}
                                activeOpacity={0.7}
                                {...getButtonAccessibilityProps(
                                  `${key} checkbox`,
                                  `Double tap to ${isChecked ? 'uncheck' : 'check'} ${formatColumnHeader(key)}`
                                )}
                              >
                                {isChecked && (
                                  <IconSymbol name="checkmark" size={14} color="#fff" decorative={true} />
                                )}
                              </TouchableOpacity>
                            );
                          })() : (() => {
                            const originalValue = food[key as keyof FoodMasterRow];
                            const editedValue = getEditedValue(food.id, key, originalValue, 'food');
                            const displayValue = editedValue === null || editedValue === undefined ? '' : String(editedValue);
                            const isNumeric = ['serving_size', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'saturated_fat_g', 'sugar_g', 'sodium_mg', 'order_index'].includes(key);
                            return (
                              <TextInput
                                style={[
                                  styles.editableCell,
                                  {
                                    width: columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key],
                                    color: COLORED_ROW_TEXT,
                                  }
                                ]}
                                value={displayValue}
                                onChangeText={(text) => {
                                  const parsedValue = isNumeric 
                                    ? (text === '' ? null : (isNaN(Number(text)) ? text : Number(text)))
                                    : text;
                                  handleCellEdit(food.id, key, parsedValue, 'food');
                                }}
                                keyboardType={isNumeric ? 'numeric' : 'default'}
                                placeholder="-"
                                placeholderTextColor="#666"
                                multiline={false}
                                {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                                {...getInputAccessibilityProps(
                                  `${key} field`,
                                  `Edit ${key}`,
                                  undefined,
                                  true
                                )}
                              />
                            );
                          })()}
                        </View>
                      ))}
                    </View>
                    );
                  })
                  )}
              </ScrollView>
            </View>
          </ScrollView>
          </View>
        </View>

        {/* Associated Servings grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              Associated Servings ({associatedServings.length} {associatedServings.length === 1 ? 'row' : 'rows'})
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.gridSaveButton,
                getMinTouchTargetStyle(),
                { 
                  backgroundColor: colors.tint,
                  opacity: savingServings || editedServings.size === 0 ? 0.6 : 1,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={handleSaveServings}
              disabled={savingServings || editedServings.size === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Save Associated Servings records',
                'Double tap to save Associated Servings grid changes'
              )}
            >
              {savingServings ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.gridSaveButtonText}>Save Associated Servings records</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.tableWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.tableHorizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Serving Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                  {SERVING_COLUMN_KEYS.map((key) => (
                    <View
                      key={key}
                      style={[
                        styles.headerCell,
                        { 
                          width: columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 150,
                          borderRightColor: colors.separator,
                        }
                      ]}
                    >
                      <ThemedText 
                        style={[styles.headerText, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {key === 'food_master_name' ? 'FoodMaster' : formatColumnHeader(key)}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {/* Serving Table Body */}
                <ScrollView
                  style={styles.tableBodyScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingServings ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Loading servings...
                      </ThemedText>
                    </View>
                  ) : associatedServings.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No associated servings. Add foods to the Master Food grid above.
                      </ThemedText>
                    </View>
                  ) : (
                    associatedServings.map((serving, rowIndex) => {
                      const rowColor = getRowColorByFoodId(serving.food_id);
                      return (
                        <View
                          key={serving.id || rowIndex}
                          style={[
                            styles.tableRow,
                            { 
                              backgroundColor: rowColor,
                              borderBottomColor: colors.separator,
                            }
                          ]}
                        >
                        {SERVING_COLUMN_KEYS.map((key) => (
                          <View
                            key={key}
                            style={[
                              styles.tableCell,
                              { 
                                width: columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 150,
                                borderRightColor: colors.separator,
                                justifyContent: SERVING_ACTION_COLUMNS.includes(key) ? 'center' : 'flex-start',
                                alignItems: SERVING_ACTION_COLUMNS.includes(key) ? 'center' : 'flex-start',
                              }
                            ]}
                          >
                            {SERVING_ACTION_COLUMNS.includes(key) ? (
                              renderServingActionCell(key, serving)
                            ) : key === 'food_master_name' ? (
                              <ThemedText 
                                style={[styles.cellText, { color: colors.text }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {formatCellValue(serving.food_master_name)}
                              </ThemedText>
                            ) : (() => {
                              const originalValue = key === 'is_default' 
                                ? (serving.is_default ? 'Yes' : 'No')
                                : serving[key as keyof FoodServingRow];
                              const editedValue = getEditedValue(serving.id, key, originalValue, 'serving');
                              const displayValue = editedValue === null || editedValue === undefined ? '' : String(editedValue);
                              const isNumeric = ['weight_g', 'volume_ml', 'sort_order'].includes(key);
                              const isBoolean = key === 'is_default';
                              return (
                                <TextInput
                                  style={[
                                    styles.editableCell,
                                    {
                                      width: columnWidths[`serving_${key}`] || DEFAULT_COLUMN_WIDTHS[`serving_${key}`] || 150,
                                      color: colors.text,
                                    }
                                  ]}
                                  value={displayValue}
                                  onChangeText={(text) => {
                                    let parsedValue: any = text;
                                    if (isNumeric) {
                                      parsedValue = text === '' ? null : (isNaN(Number(text)) ? text : Number(text));
                                    } else if (isBoolean) {
                                      parsedValue = text.toLowerCase() === 'yes' || text === '1' || text === 'true';
                                    }
                                    handleCellEdit(serving.id, key, parsedValue, 'serving');
                                  }}
                                  keyboardType={isNumeric ? 'numeric' : 'default'}
                                  placeholder="-"
                                  placeholderTextColor={colors.textSecondary}
                                  multiline={false}
                                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                                  {...getInputAccessibilityProps(
                                    `${key} field`,
                                    `Edit ${key}`,
                                    undefined,
                                    true
                                  )}
                                />
                              );
                            })()}
                        </View>
                      ))}
                    </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </ScrollView>
          </View>
        </View>

        {/* Existing Variants grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              Existing Variants ({existingVariants.length} {existingVariants.length === 1 ? 'row' : 'rows'})
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.gridSaveButton,
                getMinTouchTargetStyle(),
                { 
                  backgroundColor: colors.tint,
                  opacity: savingVariants || editedVariants.size === 0 ? 0.6 : 1,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={handleSaveVariants}
              disabled={savingVariants || editedVariants.size === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Save Existing Variants records',
                'Double tap to save Existing Variants grid changes'
              )}
            >
              {savingVariants ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.gridSaveButtonText}>Save Existing Variants records</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.tableWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.tableHorizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Variant Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                  {/* FOODMASTER column on the left */}
                  <View
                    style={[
                      styles.headerCell,
                      { 
                        width: columnWidths['variant_food_master_name'] || DEFAULT_COLUMN_WIDTHS['variant_food_master_name'] || 200,
                        borderRightColor: colors.separator,
                      }
                    ]}
                  >
                    <ThemedText 
                      style={[styles.headerText, { color: colors.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      FOODMASTER
                    </ThemedText>
                  </View>
                  {/* All variant table columns */}
                  {VARIANT_COLUMN_KEYS.map((key) => (
                        <View
                          key={key}
                          style={[
                            styles.headerCell,
                            { 
                              width: columnWidths[`variant_${key}`] || DEFAULT_COLUMN_WIDTHS[`variant_${key}`] || 150,
                              borderRightColor: colors.separator,
                            }
                          ]}
                        >
                          <ThemedText 
                            style={[styles.headerText, { color: colors.text }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {formatColumnHeader(key)}
                          </ThemedText>
                        </View>
                      ))}
                </View>

                {/* Variant Table Body */}
                <ScrollView
                  style={styles.tableBodyScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingVariants ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Loading variants...
                      </ThemedText>
                    </View>
                  ) : existingVariants.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No existing variants. Add foods to the Master Food grid above.
                      </ThemedText>
                    </View>
                  ) : (
                    existingVariants.map((variant, rowIndex) => {
                      const rowColor = getRowColorByFoodId(variant.food_master_id);
                      return (
                      <View
                        key={variant.id || rowIndex}
                        style={[
                          styles.tableRow,
                          { 
                            backgroundColor: rowColor,
                            borderBottomColor: colors.separator,
                          }
                        ]}
                      >
                        {/* FOODMASTER column on the left - read-only */}
                        <View
                          style={[
                            styles.tableCell,
                            { 
                              width: columnWidths['variant_food_master_name'] || DEFAULT_COLUMN_WIDTHS['variant_food_master_name'] || 200,
                              borderRightColor: colors.separator,
                            }
                          ]}
                        >
                          <ThemedText 
                            style={[styles.cellText, { color: colors.text }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {formatCellValue(variant.food_master_name)}
                          </ThemedText>
                        </View>
                        {/* All variant table columns */}
                        {VARIANT_COLUMN_KEYS.map((key) => (
                              <View
                                key={key}
                                style={[
                                  styles.tableCell,
                                  { 
                                    width: columnWidths[`variant_${key}`] || DEFAULT_COLUMN_WIDTHS[`variant_${key}`] || 150,
                                    borderRightColor: colors.separator,
                                  }
                                ]}
                              >
                                {(() => {
                                  const originalValue = variant[key];
                                  const editedValue = getEditedValue(variant.id, key, originalValue, 'variant');
                                  const displayValue = editedValue === null || editedValue === undefined ? '' : String(editedValue);
                                  const isNumeric = key.includes('_100g') || key === 'popularity';
                                  return (
                                    <TextInput
                                      style={[
                                        styles.editableCell,
                                        {
                                          width: columnWidths[`variant_${key}`] || DEFAULT_COLUMN_WIDTHS[`variant_${key}`] || 150,
                                          color: colors.text,
                                        }
                                      ]}
                                      value={displayValue}
                                      onChangeText={(text) => {
                                        const parsedValue = isNumeric 
                                          ? (text === '' ? null : (isNaN(Number(text)) ? text : Number(text)))
                                          : text;
                                        handleCellEdit(variant.id, key, parsedValue, 'variant');
                                      }}
                                      keyboardType={isNumeric ? 'numeric' : 'default'}
                                      placeholder="-"
                                      placeholderTextColor={colors.textSecondary}
                                      multiline={false}
                                      {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                                      {...getInputAccessibilityProps(
                                        `${key} field`,
                                        `Edit ${key}`,
                                        undefined,
                                        true
                                      )}
                                    />
                                  );
                                })()}
                              </View>
                            ))}
                      </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Associated Food Entries grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              Associated Food Entries ({associatedEntries.length} {associatedEntries.length === 1 ? 'row' : 'rows'})
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.gridSaveButton,
                getMinTouchTargetStyle(),
                { 
                  backgroundColor: colors.tint,
                  opacity: savingEntries || editedEntries.size === 0 ? 0.6 : 1,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={handleSaveEntries}
              disabled={savingEntries || editedEntries.size === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Save Associated Food Entries records',
                'Double tap to save Associated Food Entries grid changes'
              )}
            >
              {savingEntries ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.gridSaveButtonText}>Save Associated Food Entries records</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.tableWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.tableHorizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Entry Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                  {/* FOODMASTER column on the left */}
                  <View
                    style={[
                      styles.headerCell,
                      { 
                        width: columnWidths['entry_food_master_name'] || DEFAULT_COLUMN_WIDTHS['entry_food_master_name'] || 200,
                        borderRightColor: colors.separator,
                      }
                    ]}
                  >
                    <ThemedText 
                      style={[styles.headerText, { color: colors.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      FOODMASTER
                    </ThemedText>
                  </View>
                  {/* All entry table columns */}
                  {ENTRY_COLUMN_KEYS.filter(key => key !== 'food_master_name').map((key) => (
                    <View
                      key={key}
                      style={[
                        styles.headerCell,
                        { 
                          width: columnWidths[`entry_${key}`] || DEFAULT_COLUMN_WIDTHS[`entry_${key}`] || 150,
                          borderRightColor: colors.separator,
                        }
                      ]}
                    >
                      <ThemedText 
                        style={[styles.headerText, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {formatColumnHeader(key)}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {/* Entry Table Body */}
                <ScrollView
                  style={styles.tableBodyScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingEntries ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Loading entries...
                      </ThemedText>
                    </View>
                  ) : associatedEntries.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No associated food entries. Add foods to the Master Food grid above.
                      </ThemedText>
                    </View>
                  ) : (
                    associatedEntries.map((entry, rowIndex) => {
                      const rowColor = getRowColorByFoodId(entry.food_id);
                      return (
                      <View
                        key={entry.id || rowIndex}
                        style={[
                          styles.tableRow,
                          { 
                            backgroundColor: rowColor,
                            borderBottomColor: colors.separator,
                          }
                        ]}
                      >
                        {/* FOODMASTER column on the left */}
                        <View
                          style={[
                            styles.tableCell,
                            { 
                              width: columnWidths['entry_food_master_name'] || DEFAULT_COLUMN_WIDTHS['entry_food_master_name'] || 200,
                              borderRightColor: colors.separator,
                            }
                          ]}
                        >
                          <ThemedText 
                            style={[styles.cellText, { color: colors.text }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {formatCellValue(entry.food_master_name)}
                          </ThemedText>
                        </View>
                        {/* All entry table columns */}
                        {ENTRY_COLUMN_KEYS.filter(key => key !== 'food_master_name').map((key) => (
                          <View
                            key={key}
                            style={[
                              styles.tableCell,
                              { 
                                width: columnWidths[`entry_${key}`] || DEFAULT_COLUMN_WIDTHS[`entry_${key}`] || 150,
                                borderRightColor: colors.separator,
                              }
                            ]}
                          >
                            {(() => {
                              const originalValue = entry[key as keyof FoodEntryRow];
                              const editedValue = getEditedValue(entry.id, key, originalValue, 'entry');
                              const displayValue = editedValue === null || editedValue === undefined ? '' : String(editedValue);
                              const isNumeric = ['quantity', 'protein_g'].includes(key);
                              return (
                                <TextInput
                                  style={[
                                    styles.editableCell,
                                    {
                                      width: columnWidths[`entry_${key}`] || DEFAULT_COLUMN_WIDTHS[`entry_${key}`] || 150,
                                      color: colors.text,
                                    }
                                  ]}
                                  value={displayValue}
                                  onChangeText={(text) => {
                                    const parsedValue = isNumeric 
                                      ? (text === '' ? null : (isNaN(Number(text)) ? text : Number(text)))
                                      : text;
                                    handleCellEdit(entry.id, key, parsedValue, 'entry');
                                  }}
                                  keyboardType={isNumeric ? 'numeric' : 'default'}
                                  placeholder="-"
                                  placeholderTextColor={colors.textSecondary}
                                  multiline={false}
                                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                                  {...getInputAccessibilityProps(
                                    `${key} field`,
                                    `Edit ${key}`,
                                    undefined,
                                    true
                                  )}
                                />
                              );
                            })()}
                          </View>
                            ))}
                      </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Associated Bundles grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              Associated Bundles ({associatedBundles.length} {associatedBundles.length === 1 ? 'row' : 'rows'})
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.gridSaveButton,
                getMinTouchTargetStyle(),
                { 
                  backgroundColor: colors.tint,
                  opacity: savingBundles || editedBundles.size === 0 ? 0.6 : 1,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={handleSaveBundles}
              disabled={savingBundles || editedBundles.size === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Save Associated Bundles records',
                'Double tap to save Associated Bundles grid changes'
              )}
            >
              {savingBundles ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.gridSaveButtonText}>Save Associated Bundles records</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.tableWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.tableHorizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Bundle Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                  {BUNDLE_COLUMN_KEYS.map((key) => (
                    <View
                      key={key}
                      style={[
                        styles.headerCell,
                        { 
                          width: columnWidths[`bundle_${key}`] || DEFAULT_COLUMN_WIDTHS[`bundle_${key}`] || 150,
                          borderRightColor: colors.separator,
                        }
                      ]}
                    >
                      <ThemedText 
                        style={[styles.headerText, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {key === 'food_master_name' ? 'MasterFood' : formatColumnHeader(key)}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {/* Bundle Table Body */}
                <ScrollView
                  style={styles.tableBodyScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingBundles ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Loading bundles...
                      </ThemedText>
                    </View>
                  ) : associatedBundles.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No associated bundles. Add foods to the Master Food grid above.
                      </ThemedText>
                    </View>
                  ) : (
                    associatedBundles.map((bundle, rowIndex) => {
                      const rowColor = getBundleRowColor(bundle.id);
                      return (
                      <View
                        key={bundle.id || rowIndex}
                        style={[
                          styles.tableRow,
                          { 
                            backgroundColor: rowColor,
                            borderBottomColor: colors.separator,
                          }
                        ]}
                      >
                        {BUNDLE_COLUMN_KEYS.map((key) => (
                          <View
                            key={key}
                            style={[
                              styles.tableCell,
                              { 
                                width: columnWidths[`bundle_${key}`] || DEFAULT_COLUMN_WIDTHS[`bundle_${key}`] || 150,
                                borderRightColor: colors.separator,
                              }
                            ]}
                          >
                            {key === 'food_master_name' ? (
                              <ThemedText 
                                style={[styles.cellText, { color: colors.text }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {formatCellValue(bundle.food_master_name)}
                              </ThemedText>
                            ) : (() => {
                              const originalValue = bundle[key as keyof BundleRow];
                              const editedValue = getEditedValue(bundle.id, key, originalValue, 'bundle');
                              const displayValue = editedValue === null || editedValue === undefined ? '' : String(editedValue);
                              const isNumeric = key === 'order_index';
                              return (
                                <TextInput
                                  style={[
                                    styles.editableCell,
                                    {
                                      width: columnWidths[`bundle_${key}`] || DEFAULT_COLUMN_WIDTHS[`bundle_${key}`] || 150,
                                      color: colors.text,
                                    }
                                  ]}
                                  value={displayValue}
                                  onChangeText={(text) => {
                                    const parsedValue = isNumeric 
                                      ? (text === '' ? null : (isNaN(Number(text)) ? text : Number(text)))
                                      : text;
                                    handleCellEdit(bundle.id, key, parsedValue, 'bundle');
                                  }}
                                  keyboardType={isNumeric ? 'numeric' : 'default'}
                                  placeholder="-"
                                  placeholderTextColor={colors.textSecondary}
                                  multiline={false}
                                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                                  {...getInputAccessibilityProps(
                                    `${key} field`,
                                    `Edit ${key}`,
                                    undefined,
                                    true
                                  )}
                                />
                              );
                            })()}
                          </View>
                        ))}
                      </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Associated Bundles Item grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              Associated Bundles Item ({associatedBundleItems.length} {associatedBundleItems.length === 1 ? 'row' : 'rows'})
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.gridSaveButton,
                getMinTouchTargetStyle(),
                { 
                  backgroundColor: colors.tint,
                  opacity: savingBundleItems || editedBundleItems.size === 0 ? 0.6 : 1,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                }
              ]}
              onPress={handleSaveBundleItems}
              disabled={savingBundleItems || editedBundleItems.size === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Save Associated Bundles Item records',
                'Double tap to save Associated Bundles Item grid changes'
              )}
            >
              {savingBundleItems ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.gridSaveButtonText}>Save Associated Bundles Item records</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.tableWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.tableHorizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Bundle Item Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                  {BUNDLE_ITEM_COLUMN_KEYS.map((key) => (
                    <View
                      key={key}
                      style={[
                        styles.headerCell,
                        { 
                          width: columnWidths[`bundle_item_${key}`] || DEFAULT_COLUMN_WIDTHS[`bundle_item_${key}`] || 150,
                          borderRightColor: colors.separator,
                        }
                      ]}
                    >
                      <ThemedText 
                        style={[styles.headerText, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {key === 'food_master_name' ? 'MasterFood' : formatColumnHeader(key)}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {/* Bundle Item Table Body */}
                <ScrollView
                  style={styles.tableBodyScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingBundleItems ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Loading bundle items...
                      </ThemedText>
                    </View>
                  ) : associatedBundleItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No associated bundle items. Add foods to the Master Food grid above.
                      </ThemedText>
                    </View>
                  ) : (
                    associatedBundleItems.map((item, rowIndex) => {
                      const rowColor = getRowColorByFoodId(item.food_id);
                      return (
                      <View
                        key={item.id || rowIndex}
                        style={[
                          styles.tableRow,
                          { 
                            backgroundColor: rowColor,
                            borderBottomColor: colors.separator,
                          }
                        ]}
                      >
                        {BUNDLE_ITEM_COLUMN_KEYS.map((key) => (
                          <View
                            key={key}
                            style={[
                              styles.tableCell,
                              { 
                                width: columnWidths[`bundle_item_${key}`] || DEFAULT_COLUMN_WIDTHS[`bundle_item_${key}`] || 150,
                                borderRightColor: colors.separator,
                              }
                            ]}
                          >
                            {key === 'food_master_name' ? (
                              <ThemedText 
                                style={[styles.cellText, { color: colors.text }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {formatCellValue(item.food_master_name)}
                              </ThemedText>
                            ) : (() => {
                              const originalValue = item[key as keyof BundleItemRow];
                              const editedValue = getEditedValue(item.id, key, originalValue, 'bundleItem');
                              const displayValue = editedValue === null || editedValue === undefined ? '' : String(editedValue);
                              const isNumeric = ['quantity', 'order_index'].includes(key);
                              return (
                                <TextInput
                                  style={[
                                    styles.editableCell,
                                    {
                                      width: columnWidths[`bundle_item_${key}`] || DEFAULT_COLUMN_WIDTHS[`bundle_item_${key}`] || 150,
                                      color: colors.text,
                                    }
                                  ]}
                                  value={displayValue}
                                  onChangeText={(text) => {
                                    const parsedValue = isNumeric 
                                      ? (text === '' ? null : (isNaN(Number(text)) ? text : Number(text)))
                                      : text;
                                    handleCellEdit(item.id, key, parsedValue, 'bundleItem');
                                  }}
                                  keyboardType={isNumeric ? 'numeric' : 'default'}
                                  placeholder="-"
                                  placeholderTextColor={colors.textSecondary}
                                  multiline={false}
                                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                                  {...getInputAccessibilityProps(
                                    `${key} field`,
                                    `Edit ${key}`,
                                    undefined,
                                    true
                                  )}
                                />
                              );
                            })()}
                          </View>
                        ))}
                      </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {/* Merge Confirmation Modal */}
      <ConfirmModal
        visible={showMergeConfirm}
        title="Merge Entries"
        message="Are You Sure the merge the entries?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={handleMergeConfirm}
        onCancel={handleMergeCancel}
      />

      {/* Merge Success Modal */}
      <ConfirmModal
        visible={showMergeSuccess}
        title="Merge Successful"
        message="The merge operation completed successfully! Variants have been created and linked to the Ultimate Master."
        confirmText="OK"
        cancelText="OK"
        onConfirm={() => setShowMergeSuccess(false)}
        onCancel={() => setShowMergeSuccess(false)}
      />

      {/* Merge Error Modal */}
      <ConfirmModal
        visible={showMergeError}
        title="Merge Failed"
        message={mergeErrorMessage || 'An error occurred during the merge operation.'}
        confirmText="OK"
        cancelText={null}
        onConfirm={() => setShowMergeError(false)}
        onCancel={() => setShowMergeError(false)}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
      />
    </ThemedView>
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
    paddingHorizontal: Platform.select({ web: 16, default: 16 }),
    paddingTop: Platform.select({ web: 30, default: Platform.OS === 'ios' ? 50 : 30 }),
    paddingBottom: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--background)',
      },
      default: {
        backgroundColor: 'transparent',
      },
    }),
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  headerTitle: {
    fontSize: Platform.select({ web: 20, default: 18 }),
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 44,
  },
  saveButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Platform.select({ web: 16, default: 16 }),
    paddingVertical: 12,
    borderBottomWidth: 1,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: Platform.select({ web: 100, default: 0 }),
        zIndex: 99,
        backgroundColor: 'var(--background)',
      },
    }),
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(10, 126, 164, 0.3)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  mergeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(10, 126, 164, 0.3)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: Platform.select({ web: 16, default: 15 }),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  contentContainer: {
    flex: 1,
  },
  contentScrollContainer: {
    padding: Platform.select({ web: 16, default: 16 }),
    paddingBottom: Platform.select({ web: 24, default: 24 }),
  },
  searchContainer: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
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
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearTableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    minHeight: 44,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  clearTableButtonText: {
    fontSize: Platform.select({ web: 14, default: 14 }),
    fontWeight: '600',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: Platform.select({ web: 14, default: 14 }),
    padding: 0,
    minWidth: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  searchResultsContainer: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 300,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  searchResultsScroll: {
    maxHeight: 300,
  },
  searchResultsLoading: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  searchResultsLoadingText: {
    fontSize: 14,
  },
  searchResultsEmpty: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultsEmptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 44,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  searchResultContent: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  searchResultName: {
    fontSize: Platform.select({ web: 14, default: 14 }),
    fontWeight: '600',
    marginBottom: 2,
  },
  searchResultBrand: {
    fontSize: Platform.select({ web: 12, default: 12 }),
    opacity: 0.7,
  },
  gridContainer: {
    marginBottom: 24,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
    gap: 12,
  },
  gridTitle: {
    fontSize: Platform.select({ web: 18, default: 16 }),
    fontWeight: '700',
    flex: 1,
    minWidth: 200,
  },
  gridSaveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 4px rgba(10, 126, 164, 0.2)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  gridSaveButtonText: {
    color: '#fff',
    fontSize: Platform.select({ web: 13, default: 12 }),
    fontWeight: '600',
  },
  tableWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 200,
    maxHeight: 400,
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
  tableHorizontalScroll: {
    flex: 1,
  },
  tableContainer: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    ...Platform.select({
      web: {
        position: 'sticky',
      },
    }),
  },
  headerCell: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRightWidth: 1,
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: Platform.select({ web: 12, default: 11 }),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    cursor: 'col-resize',
    ...Platform.select({
      web: {
        cursor: 'col-resize',
      },
    }),
  },
  resizeHandleMobile: {
    position: 'absolute',
    right: -4,
    top: 0,
    bottom: 0,
    width: 12,
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 40,
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  cellText: {
    fontSize: Platform.select({ web: 13, default: 12 }),
  },
  editableCell: {
    fontSize: Platform.select({ web: 13, default: 12 }),
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 4,
    minHeight: 32,
    ...Platform.select({
      web: {
        outlineWidth: 0,
        outlineStyle: 'none',
      },
    }),
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionCellWrapper: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      },
    }),
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      },
    }),
  },
});

