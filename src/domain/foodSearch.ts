/**
 * FOOD SEARCH DOMAIN LOGIC
 * 
 * Per engineering guidelines section 2:
 * - Pure TypeScript functions for business logic
 * - No React/browser/UI imports
 * - Platform-agnostic
 */

import type { FoodMaster } from '@/utils/nutritionMath';

// Constants
export const FREQUENT_THRESHOLD = 3; // Minimum times_used to be considered "frequent"
export const RECENT_DAYS = 14; // Days within which a food is considered "recent"

/**
 * Enhanced food item for search results
 * Includes user-specific usage data and computed flags
 */
export interface EnhancedFoodItem extends FoodMaster {
  // User-specific usage data
  times_used: number; // How many times user used this food (0 by default)
  last_used_at: Date | null; // Last time the user logged this food
  
  // Computed flags
  is_frequent: boolean; // times_used >= FREQUENT_THRESHOLD
  is_recent: boolean; // last_used_at within RECENT_DAYS
  
  // Serving info
  default_serving?: {
    quantity: number;
    unit: string;
    calories: number;
  };
  recent_serving?: {
    quantity: number;
    unit: string;
    calories: number;
  }; // Last-used serving size for Recent items
}

/**
 * Compute is_frequent flag based on times_used
 */
export function computeIsFrequent(times_used: number): boolean {
  return times_used >= FREQUENT_THRESHOLD;
}

/**
 * Compute is_recent flag based on last_used_at
 */
export function computeIsRecent(last_used_at: Date | null): boolean {
  if (!last_used_at) return false;
  
  const now = new Date();
  const daysDiff = (now.getTime() - last_used_at.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= RECENT_DAYS;
}

/**
 * Normalize query string for search comparison
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Check if a food matches a query (substring match on name and brand)
 */
export function matchesQuery(food: FoodMaster, query: string): boolean {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return true;
  
  const foodName = (food.name || '').toLowerCase();
  const foodBrand = (food.brand || '').toLowerCase();
  const searchText = `${foodName} ${foodBrand}`.trim();
  
  return foodName.includes(normalizedQuery) || 
         foodBrand.includes(normalizedQuery) || 
         searchText.includes(normalizedQuery);
}

/**
 * Sort foods according to the priority rules:
 * 1. is_frequent (true first)
 * 2. is_recent (true first)
 * 3. is_custom (true first)
 * 4. is_base_food (true first)
 * 5. is_quality (true first)
 * 6. frequency_score (higher first)
 * 7. last_used_at (more recent first, nulls last)
 * 8. name (A–Z)
 */
export function sortFoodsByPriority(foods: EnhancedFoodItem[]): EnhancedFoodItem[] {
  return [...foods].sort((a, b) => {
    // 1. is_frequent (true first)
    if (a.is_frequent !== b.is_frequent) {
      return b.is_frequent ? 1 : -1;
    }
    
    // 2. is_recent (true first)
    if (a.is_recent !== b.is_recent) {
      return b.is_recent ? 1 : -1;
    }
    
    // 3. is_custom (true first)
    const aIsCustom = a.is_custom === true ? 1 : 0;
    const bIsCustom = b.is_custom === true ? 1 : 0;
    if (aIsCustom !== bIsCustom) {
      return bIsCustom - aIsCustom;
    }
    
    // 4. is_base_food (true first)
    const aIsBase = a.is_base_food === true ? 1 : 0;
    const bIsBase = b.is_base_food === true ? 1 : 0;
    if (aIsBase !== bIsBase) {
      return bIsBase - aIsBase;
    }
    
    // 5. is_quality (true first)
    const aIsQuality = a.is_quality_data === true ? 1 : 0;
    const bIsQuality = b.is_quality_data === true ? 1 : 0;
    if (aIsQuality !== bIsQuality) {
      return bIsQuality - aIsQuality;
    }
    
    // 6. frequency_score (higher first)
    if (a.times_used !== b.times_used) {
      return b.times_used - a.times_used;
    }
    
    // 7. last_used_at (more recent first, nulls last)
    if (a.last_used_at !== b.last_used_at) {
      if (!a.last_used_at) return 1;
      if (!b.last_used_at) return -1;
      return b.last_used_at.getTime() - a.last_used_at.getTime();
    }
    
    // 8. name (A–Z)
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Merge DB results with local Recent/Frequent foods
 * Deduplicates by id (DB results take precedence)
 */
export function mergeFoodResults(
  dbResults: EnhancedFoodItem[],
  localFoods: EnhancedFoodItem[]
): EnhancedFoodItem[] {
  // Create a map of DB results by id
  const dbMap = new Map<string, EnhancedFoodItem>();
  for (const food of dbResults) {
    dbMap.set(food.id, food);
  }
  
  // Add local foods that aren't already in DB results
  for (const food of localFoods) {
    if (!dbMap.has(food.id)) {
      dbMap.set(food.id, food);
    }
  }
  
  return Array.from(dbMap.values());
}

/**
 * Enhance a FoodMaster with usage data and computed flags
 */
export function enhanceFoodItem(
  food: FoodMaster,
  times_used: number = 0,
  last_used_at: Date | null = null
): EnhancedFoodItem {
  const is_frequent = computeIsFrequent(times_used);
  const is_recent = computeIsRecent(last_used_at);
  
  return {
    ...food,
    times_used,
    last_used_at,
    is_frequent,
    is_recent,
  };
}


