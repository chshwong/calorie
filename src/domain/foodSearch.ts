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
  
  // Intrinsic rank from DB (0 = best, lower = better)
  search_rank?: number | null;
  
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
 * 1. is_recent (true first)
 * 2. is_frequent (true first)
 * 3. search_rank (lower = better, default large number when null)
 * 4. order_index (lower = better, default large number)
 * 5. is_base_food (true first)
 * 6. is_quality_data (true first)
 * 7. times_used (higher = better)
 * 8. last_used_at (newer date first)
 * 9. name (A–Z) as final tie-breaker
 */
export function sortFoodsByPriority(foods: EnhancedFoodItem[]): EnhancedFoodItem[] {
  return [...foods].sort((a, b) => {
    // 1) Recent first
    const aRecent = a.is_recent ? 1 : 0;
    const bRecent = b.is_recent ? 1 : 0;
    if (aRecent !== bRecent) return bRecent - aRecent;

    // 2) Frequent next
    const aFreq = a.is_frequent ? 1 : 0;
    const bFreq = b.is_frequent ? 1 : 0;
    if (aFreq !== bFreq) return bFreq - aFreq;

    // 3) Intrinsic DB rank (lower is better)
    const aRank = a.search_rank ?? 999999;
    const bRank = b.search_rank ?? 999999;
    if (aRank !== bRank) return aRank - bRank;

    // 4) order_index from food_master
    const aOrder = (a as any).order_index ?? 999999;
    const bOrder = (b as any).order_index ?? 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // 5) is_base_food
    const aBase = a.is_base_food ? 1 : 0;
    const bBase = b.is_base_food ? 1 : 0;
    if (aBase !== bBase) return bBase - aBase;

    // 6) is_quality_data
    const aQuality = a.is_quality_data ? 1 : 0;
    const bQuality = b.is_quality_data ? 1 : 0;
    if (aQuality !== bQuality) return bQuality - aQuality;

    // 7) times_used (higher first)
    const aTimes = a.times_used ?? 0;
    const bTimes = b.times_used ?? 0;
    if (aTimes !== bTimes) return bTimes - aTimes;

    // 8) last_used_at (newer first)
    const aLast = a.last_used_at ? a.last_used_at.getTime() : 0;
    const bLast = b.last_used_at ? b.last_used_at.getTime() : 0;
    if (aLast !== bLast) return bLast - aLast;

    // 9) final tie-breaker: name A–Z
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


