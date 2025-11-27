/**
 * useFoodSearch - Shared hook for food search functionality
 * 
 * Per engineering guidelines section 5.1 and 7:
 * - Reusable logic shared across screens
 * - Domain logic separated from UI
 * - Platform-agnostic (no DOM APIs)
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type FoodMaster } from '@/utils/nutritionMath';

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
  /** Search results */
  searchResults: FoodMaster[];
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
 * Normalize text for search comparison
 * Removes special characters and normalizes whitespace
 */
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[%(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Hook for food search functionality
 * Shared between create-bundle and mealtype-log screens
 */
export function useFoodSearch(options: UseFoodSearchOptions = {}): UseFoodSearchResult {
  const {
    includeCustomFoods = false,
    userId,
    maxResults = 20,
    minQueryLength = 2,
  } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodMaster[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  /**
   * Search food_master table
   * Uses word-order-independent matching
   */
  const searchFoodMaster = useCallback(async (query: string) => {
    if (!query || query.length < minQueryLength) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      const cleanedQuery = normalizeText(query);
      const words = cleanedQuery.split(/\s+/).filter(word => word.length > 0);
      
      if (words.length === 0) {
        setSearchResults([]);
        setShowSearchResults(false);
        setSearchLoading(false);
        return;
      }
      
      // Build search conditions for each word
      // Each word should appear somewhere in name or brand (word order independent)
      const searchConditions: string[] = [];
      
      words.forEach(word => {
        const wordPattern = `%${word}%`;
        searchConditions.push(`name.ilike.${wordPattern}`);
        searchConditions.push(`brand.ilike.${wordPattern}`);
      });

      let allData: FoodMaster[] = [];

      if (includeCustomFoods && userId) {
        // Search both public foods and user's custom foods
        const { data: publicData, error: publicError } = await supabase
          .from('food_master')
          .select('*')
          .or(searchConditions.join(','))
          .eq('is_custom', false)
          .limit(50);

        const { data: customData, error: customError } = await supabase
          .from('food_master')
          .select('*')
          .or(searchConditions.join(','))
          .eq('is_custom', true)
          .eq('owner_user_id', userId)
          .limit(50);

        if (publicError || customError) {
          setSearchResults([]);
          setShowSearchResults(false);
          setSearchLoading(false);
          return;
        }

        allData = [...(publicData || []), ...(customData || [])];
        
        // Remove duplicates based on food id
        allData = Array.from(
          new Map(allData.map(food => [food.id, food])).values()
        );
      } else {
        // Search all foods (original behavior)
        const { data, error } = await supabase
          .from('food_master')
          .select('*')
          .or(searchConditions.join(','))
          .limit(50)
          .order('name', { ascending: true });

        if (error) {
          setSearchResults([]);
          setShowSearchResults(false);
          setSearchLoading(false);
          return;
        }

        allData = data || [];
      }

      // Client-side filtering: ensure ALL words appear in name or brand
      const filteredResults = allData.filter(food => {
        const searchText = normalizeText(`${food.name} ${food.brand || ''}`);
        return words.every(word => searchText.includes(word));
      });
      
      // Sort by priority: is_base_food > is_quality_data > order_index (ascending)
      const sortedResults = filteredResults
        .sort((a, b) => {
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
          return a.name.localeCompare(b.name);
        })
        .slice(0, maxResults);
      
      setSearchResults(sortedResults);
      setShowSearchResults(true);
    } catch (error) {
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  }, [includeCustomFoods, userId, maxResults, minQueryLength]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    searchFoodMaster(text);
  }, [searchFoodMaster]);

  /**
   * Clear search state
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
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

