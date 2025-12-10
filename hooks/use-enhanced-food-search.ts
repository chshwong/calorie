/**
 * Enhanced Food Search Hook
 * 
 * Implements the full food search behavior with:
 * - Query length rules (0, 1-2, >=3)
 * - Debouncing (300-400ms)
 * - Client-side caching
 * - Request cancellation
 * - Enter key handling
 * - Merging with local Recent/Frequent foods
 * - Proper sorting and ranking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFrequentFoods } from '@/hooks/use-frequent-foods';
import { useRecentFoods } from '@/hooks/use-recent-foods';
import { searchFoodsWithUsage } from '@/lib/services/foodSearch';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import {
  normalizeQuery,
  matchesQuery,
  sortFoodsByPriority,
  mergeFoodResults,
  enhanceFoodItem,
} from '@/src/domain/foodSearch';
import type { FoodMaster } from '@/utils/nutritionMath';
import type { FrequentFood } from '@/lib/services/frequentFoods';
import type { RecentFood } from '@/lib/services/recentFoods';

export interface UseEnhancedFoodSearchOptions {
  /** Meal type for filtering Recent/Frequent foods */
  mealType?: string;
  /** Maximum results to return */
  maxResults?: number;
  /** Debounce delay in ms (default: 350) */
  debounceDelay?: number;
}

export interface UseEnhancedFoodSearchResult {
  /** Current search query */
  searchQuery: string;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Search results with enhanced data */
  searchResults: EnhancedFoodItem[];
  /** Whether search is loading */
  searchLoading: boolean;
  /** Whether to show search results dropdown */
  showSearchResults: boolean;
  /** Set show search results */
  setShowSearchResults: (show: boolean) => void;
  /** Handle search input change */
  handleSearchChange: (text: string) => void;
  /** Handle Enter key press */
  handleEnterPress: () => void;
  /** Clear search */
  clearSearch: () => void;
  /** Ensure local foods are loaded (for empty query state) */
  ensureLocalFoodsLoaded: () => void;
  /** Currently highlighted result index (for keyboard navigation) */
  highlightedIndex: number;
  /** Set highlighted index */
  setHighlightedIndex: (index: number) => void;
}

// In-memory cache for search results
interface CacheEntry {
  results: EnhancedFoodItem[];
  cached_at: Date;
}

const searchCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 20;

/**
 * Clean up old cache entries
 */
function cleanupCache() {
  if (searchCache.size <= MAX_CACHE_SIZE) return;
  
  // Sort by cached_at and remove oldest entries
  const entries = Array.from(searchCache.entries())
    .sort((a, b) => a[1].cached_at.getTime() - b[1].cached_at.getTime());
  
  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  for (const [key] of toRemove) {
    searchCache.delete(key);
  }
}

/**
 * Convert FrequentFood/RecentFood to EnhancedFoodItem
 */
function convertToEnhancedFood(
  food: FrequentFood | RecentFood,
  isRecent: boolean
): EnhancedFoodItem {
  const times_used = 'logCount' in food ? food.logCount : 0;
  const last_used_at = isRecent && 'lastUsedAt' in food 
    ? new Date(food.lastUsedAt) 
    : ('lastLoggedAt' in food ? new Date(food.lastLoggedAt) : null);
  
  // Extract latest entry info for recent foods
  let latestEntry: { quantity: number; unit: string; calories_kcal: number } | null = null;
  if (isRecent && 'latestEntry' in food && food.latestEntry) {
    latestEntry = {
      quantity: food.latestEntry.quantity,
      unit: food.latestEntry.unit,
      calories_kcal: food.latestEntry.calories_kcal,
    };
  }
  
  const enhanced = enhanceFoodItem(food, times_used, last_used_at, latestEntry);
  
  // Add default serving info (if not already set by enhanceFoodItem)
  if ('defaultServingQty' in food) {
    enhanced.default_serving = {
      quantity: food.defaultServingQty,
      unit: food.defaultServingUnit,
      calories: food.defaultServingCalories,
    };
  }
  
  return enhanced;
}

/**
 * Enhanced food search hook
 */
export function useEnhancedFoodSearch(
  options: UseEnhancedFoodSearchOptions = {}
): UseEnhancedFoodSearchResult {
  const {
    mealType,
    maxResults = 20,
    debounceDelay = 350,
  } = options;

  const { user } = useAuth();
  const userId = user?.id;

  // Get local Recent/Frequent foods
  const { data: frequentFoods = [] } = useFrequentFoods(mealType);
  const { data: recentFoods = [] } = useRecentFoods(mealType);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EnhancedFoodItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs for debouncing and request cancellation
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentRequestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const wasClearedRef = useRef(false); // Track if search was explicitly cleared
  const hasUserInteractedRef = useRef(false); // Track if user has ever interacted with search (focused/typed)

  /**
   * Get local Recent/Frequent foods as EnhancedFoodItem[]
   */
  const getLocalFoods = useCallback((): EnhancedFoodItem[] => {
    const enhanced: EnhancedFoodItem[] = [];
    
    // Convert frequent foods
    for (const food of frequentFoods) {
      enhanced.push(convertToEnhancedFood(food, false));
    }
    
    // Convert recent foods
    for (const food of recentFoods) {
      enhanced.push(convertToEnhancedFood(food, true));
    }
    
    // Deduplicate by id
    const foodMap = new Map<string, EnhancedFoodItem>();
    for (const food of enhanced) {
      if (!foodMap.has(food.id)) {
        foodMap.set(food.id, food);
      } else {
        // If both frequent and recent, prefer recent (has recent_serving)
        const existing = foodMap.get(food.id)!;
        if (food.recent_serving && !existing.recent_serving) {
          foodMap.set(food.id, food);
        }
      }
    }
    
    return Array.from(foodMap.values());
  }, [frequentFoods, recentFoods]);

  /**
   * Filter local foods by query
   */
  const filterLocalFoods = useCallback((query: string): EnhancedFoodItem[] => {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) return getLocalFoods();
    
    const localFoods = getLocalFoods();
    return localFoods.filter(food => matchesQuery(food, normalizedQuery));
  }, [getLocalFoods]);

  /**
   * Perform DB search
   */
  const performDBSearch = useCallback(async (
    query: string,
    requestId: number
  ): Promise<EnhancedFoodItem[]> => {
    if (!userId) return [];
    
    try {
      const results = await searchFoodsWithUsage({
        query,
        userId,
        limit: maxResults * 2, // Get more for client-side filtering
      });
      
      // Check if this request is still current
      if (requestId !== currentRequestIdRef.current) {
        return []; // Stale request, discard
      }
      
      return results;
    } catch (error) {
      return [];
    }
  }, [userId, maxResults]);

  /**
   * Merge and sort results
   */
  const mergeAndSortResults = useCallback((
    dbResults: EnhancedFoodItem[],
    localFoods: EnhancedFoodItem[]
  ): EnhancedFoodItem[] => {
    // Attach intrinsic DB rank (0 = best) to each DB result
    const dbWithRank: EnhancedFoodItem[] = dbResults.map((item, index) => ({
      ...item,
      search_rank: index,
    }));
    
    const merged = mergeFoodResults(dbWithRank, localFoods);
    const sorted = sortFoodsByPriority(merged);
    return sorted.slice(0, maxResults);
  }, [maxResults]);

  /**
   * Update search results
   */
  const updateSearchResults = useCallback((
    results: EnhancedFoodItem[],
    query: string
  ) => {
    setSearchResults(results);
    setShowSearchResults(results.length > 0);
    setSearchLoading(false);
    
    // Update cache
    const normalizedQuery = normalizeQuery(query);
    if (normalizedQuery) {
      cleanupCache();
      searchCache.set(normalizedQuery, {
        results,
        cached_at: new Date(),
      });
    }
  }, []);

  /**
   * Handle search with query length rules
   */
  const handleSearch = useCallback((query: string, forceSearch: boolean = false) => {
    const normalizedQuery = normalizeQuery(query);
    
    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Query length === 0: Show local Recent/Frequent only
    if (normalizedQuery.length === 0) {
      const localFoods = getLocalFoods();
      const sorted = sortFoodsByPriority(localFoods);
      updateSearchResults(sorted.slice(0, maxResults), query);
      return;
    }
    
    // Query length 1-2: Local-only filtered mode
    if (normalizedQuery.length <= 2 && !forceSearch) {
      const filtered = filterLocalFoods(normalizedQuery);
      const sorted = sortFoodsByPriority(filtered);
      updateSearchResults(sorted.slice(0, maxResults), query);
      return;
    }
    
    // Query length >= 3 (or forced): DB search
    const performSearch = async () => {
      // Check cache first
      const cached = searchCache.get(normalizedQuery);
      if (cached && !forceSearch) {
        // Show cached results immediately (stale-while-revalidate)
        updateSearchResults(cached.results, query);
      } else {
        setSearchLoading(true);
      }
      
      // Generate new request ID
      const requestId = ++currentRequestIdRef.current;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      // Perform DB search
      const dbResults = await performDBSearch(normalizedQuery, requestId);
      
      // Check if request was aborted or stale
      if (abortController.signal.aborted || requestId !== currentRequestIdRef.current) {
        return; // Discard stale results
      }
      
      // Merge with local foods
      const localFoods = filterLocalFoods(normalizedQuery);
      const merged = mergeAndSortResults(dbResults, localFoods);
      
      // Update results
      updateSearchResults(merged, query);
    };
    
    if (forceSearch) {
      // Enter key: immediate search
      performSearch();
    } else {
      // Normal typing: debounce
      debounceTimerRef.current = setTimeout(performSearch, debounceDelay);
    }
  }, [
    getLocalFoods,
    filterLocalFoods,
    performDBSearch,
    mergeAndSortResults,
    updateSearchResults,
    maxResults,
    debounceDelay,
  ]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((text: string) => {
    hasUserInteractedRef.current = true; // Mark that user has interacted
    setSearchQuery(text);
    setHighlightedIndex(-1);
    handleSearch(text, false);
  }, [handleSearch]);

  /**
   * Handle Enter key press
   * Returns the selected food item or null
   */
  const handleEnterPress = useCallback((): EnhancedFoodItem | null => {
    if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
      // Select highlighted item
      return searchResults[highlightedIndex];
    } else if (searchResults.length > 0) {
      // Select first result
      return searchResults[0];
    } else {
      // Force search if query exists
      if (searchQuery.trim().length > 0) {
        handleSearch(searchQuery, true);
      }
      return null;
    }
  }, [highlightedIndex, searchResults, searchQuery, handleSearch]);

  /**
   * Ensure local foods are loaded into results (for empty query state)
   * This is called when focusing the search bar with empty query
   */
  const ensureLocalFoodsLoaded = useCallback(() => {
    hasUserInteractedRef.current = true; // Mark that user has interacted (focused)
    if (searchQuery.length === 0) {
      const localFoods = getLocalFoods();
      const sorted = sortFoodsByPriority(localFoods);
      setSearchResults(sorted.slice(0, maxResults));
    }
  }, [searchQuery.length, getLocalFoods, maxResults]);

  /**
   * Clear search
   * Cancels all pending operations and resets state
   * NOTE: Does NOT clear the local Recent/Frequent cache - that persists
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    // Clear displayed results, but local foods cache (getLocalFoods) persists
    setSearchResults([]);
    setShowSearchResults(false);
    setHighlightedIndex(-1);
    wasClearedRef.current = true; // Mark that search was explicitly cleared
    
    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Cancel any in-flight DB request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Invalidate current request ID to prevent stale results
    currentRequestIdRef.current += 1;
    // NOTE: We do NOT clear the local Recent/Frequent cache here
    // getLocalFoods() will continue to return cached data
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Initialize with local foods when query is empty
  // But don't auto-show dropdown on initial mount or if search was just cleared
  useEffect(() => {
    if (searchQuery.length === 0) {
      const localFoods = getLocalFoods();
      const sorted = sortFoodsByPriority(localFoods);
      setSearchResults(sorted.slice(0, maxResults));
      
      // Don't auto-open dropdown on initial mount (for MealType Log default state)
      // Only show dropdown if:
      // 1. Search wasn't explicitly cleared
      // 2. User has interacted with the search (focused or typed)
      if (!wasClearedRef.current && hasUserInteractedRef.current) {
        setShowSearchResults(sorted.length > 0);
      }
      
      // Reset the cleared flag after a short delay
      // This allows the dropdown to show again when user focuses input later
      if (wasClearedRef.current) {
        const timer = setTimeout(() => {
          wasClearedRef.current = false;
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      // Query is not empty - reset cleared flag and mark as interacted
      wasClearedRef.current = false;
      hasUserInteractedRef.current = true;
    }
  }, [getLocalFoods, maxResults, searchQuery.length]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    handleSearchChange,
    handleEnterPress,
    clearSearch,
    ensureLocalFoodsLoaded,
    highlightedIndex,
    setHighlightedIndex,
  };
}

