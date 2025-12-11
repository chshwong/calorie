/**
 * useFoodSearch - Shared hook for food search functionality
 * 
 * Per engineering guidelines section 5.1 and 7:
 * - Reusable logic shared across screens
 * - Domain logic separated from UI
 * - Platform-agnostic (no DOM APIs)
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { type FoodMaster } from '@/utils/nutritionMath';
import { getServingsForFoods, getDefaultServingWithNutrients } from '@/lib/servings';
import {
  getPersistentCache,
  setPersistentCache,
  DEFAULT_CACHE_MAX_AGE_MS,
} from '@/lib/persistentCache';

// Cache up to 180 days by default per engineering guidelines.
const FOOD_SEARCH_CACHE_MAX_AGE_MS = DEFAULT_CACHE_MAX_AGE_MS ?? 180 * 24 * 60 * 60 * 1000;

// Prefix for persistent cache keys so they are namespaced
const FOOD_SEARCH_CACHE_PREFIX = 'food-search:';

/**
 * Search result with pre-computed default serving info
 * Uses centralized default serving logic from lib/servings.ts
 */
export interface FoodSearchResult extends FoodMaster {
  defaultServingQty: number;
  defaultServingUnit: string;
  defaultServingCalories: number;
}

export interface UseFoodSearchOptions {
  /** Include user's custom foods in search results */
  includeCustomFoods?: boolean;
  /** User ID for custom foods search (required if includeCustomFoods is true) */
  userId?: string;
  /** Maximum results to return */
  maxResults?: number;
  /** Minimum query length before searching */
  minQueryLength?: number;
}

export interface UseFoodSearchResult {
  /** Current search query */
  searchQuery: string;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Search results with default serving info */
  searchResults: FoodSearchResult[];
  /** Whether search is loading */
  searchLoading: boolean;
  /** Whether to show search results dropdown */
  showSearchResults: boolean;
  /** Set show search results */
  setShowSearchResults: (show: boolean) => void;
  /** Handle search input change */
  handleSearchChange: (text: string) => void;
  /** Clear search */
  clearSearch: () => void;
}

/**
 * Hook for food search functionality
 * Shared between create-bundle and mealtype-log screens
 * Uses Supabase RPC search_food_master - server handles normalization
 */
export function useFoodSearch(options: UseFoodSearchOptions = {}): UseFoodSearchResult {
  const {
    includeCustomFoods = false,
    userId,
    maxResults = 20,
    minQueryLength = 3,
  } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Search food_master table using Supabase RPC
   * Server handles normalization using combined name+brand field
   * Client sends raw user input - no client-side normalization
   */
  const searchFoodMaster = useCallback(async (query: string) => {
    const raw = query ?? '';
    const normalized = raw.trim();

    if (!normalized || normalized.length < minQueryLength) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      return;
    }

    if (!userId) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchResults(true);

    const cacheKey = `${FOOD_SEARCH_CACHE_PREFIX}${userId}:${normalized.toLowerCase()}`;

    try {
      // 1) Try persistent cache first
      const cached = await getPersistentCache<FoodSearchResult[]>(cacheKey, FOOD_SEARCH_CACHE_MAX_AGE_MS);

      if (cached && Array.isArray(cached)) {
        setSearchResults(cached);
        setSearchLoading(false);
        return;
      }

      // 2) If not in cache, call Supabase RPC
      // Use Supabase RPC - server handles normalization using combined name+brand field
      // Client sends raw user input - no client-side normalization
      const { data: foodsData, error: rpcError } = await supabase.rpc('search_food_master', {
        search_term: normalized, // Normalized query - server normalizes using combined name+brand field
        limit_rows: maxResults * 2, // Get more results for client-side sorting/filtering
      });

      if (rpcError) {
        console.error('Error searching foods:', rpcError);
        setSearchResults([]);
        setShowSearchResults(false);
        setSearchLoading(false);
        return;
      }

      if (!foodsData || foodsData.length === 0) {
        setSearchResults([]);
        setShowSearchResults(false);
        setSearchLoading(false);
        return;
      }

      // SECURITY: Filter custom foods if includeCustomFoods is false, or filter by owner
      let filteredFoods = foodsData;
      if (!includeCustomFoods) {
        // Exclude all custom foods
        filteredFoods = foodsData.filter((food: any) => food.is_custom !== true);
      } else {
        // Include only custom foods that belong to this user, or base foods
        filteredFoods = foodsData.filter((food: any) => {
          if (food.is_custom === true) {
            return food.owner_user_id === userId;
          }
          return true; // Base foods are visible to all
        });
      }
      
      // Sort by priority: is_base_food > is_quality_data > order_index (ascending)
      const sortedResults = filteredFoods
        .sort((a: any, b: any) => {
          // 1. is_base_food = true first (highest priority)
          const aIsBase = a.is_base_food === true ? 1 : 0;
          const bIsBase = b.is_base_food === true ? 1 : 0;
          if (bIsBase !== aIsBase) return bIsBase - aIsBase;
          
          // 2. is_quality_data = true second
          const aIsQuality = a.is_quality_data === true ? 1 : 0;
          const bIsQuality = b.is_quality_data === true ? 1 : 0;
          if (bIsQuality !== aIsQuality) return bIsQuality - aIsQuality;
          
          // 3. order_index ascending (smaller first, null treated as 0)
          const aOrder = a.order_index ?? 0;
          const bOrder = b.order_index ?? 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          
          // 4. Fallback to name for consistent ordering
          return (a.name || '').localeCompare(b.name || '');
        })
        .slice(0, maxResults);
      
      // Batch fetch servings for all results using centralized data access
      const foodIds = sortedResults.map((food: any) => food.id);
      const servingsMap = await getServingsForFoods(foodIds);
      
      // Enrich results with default serving info using centralized logic
      const resultsWithServings: FoodSearchResult[] = sortedResults.map((food: any) => {
        const foodServings = servingsMap.get(food.id) || [];
        const { defaultServing, nutrients } = getDefaultServingWithNutrients(food, foodServings);
        
        return {
          ...food,
          defaultServingQty: defaultServing.quantity,
          defaultServingUnit: defaultServing.unit,
          defaultServingCalories: Math.round(nutrients.calories_kcal),
        };
      });
      
      setSearchResults(resultsWithServings);
      setShowSearchResults(true);
      setSearchLoading(false);

      // Persist successful result
      await setPersistentCache(cacheKey, resultsWithServings);
      return;
    } catch (error) {
      console.error('Error searching foods:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  }, [includeCustomFoods, userId, maxResults, minQueryLength]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      // Always clear any existing timer
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }

      const trimmed = text.trim();

      // If below min length, clear results and don't search
      if (!trimmed || trimmed.length < minQueryLength) {
        setSearchResults([]);
        setShowSearchResults(false);
        setSearchLoading(false);
        return;
      }

      // Debounce the actual search to avoid hammering the DB
      searchDebounceRef.current = setTimeout(() => {
        searchFoodMaster(trimmed);
      }, 300);
    },
    [minQueryLength, searchFoodMaster],
  );

  /**
   * Clear search state
   */
  const clearSearch = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchLoading(false);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    handleSearchChange,
    clearSearch,
  };
}

