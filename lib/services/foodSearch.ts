/**
 * DATA ACCESS SERVICE - Food Search with Usage Statistics
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { FoodMaster } from '@/utils/nutritionMath';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import { enhanceFoodItem } from '@/src/domain/foodSearch';

export interface FoodSearchOptions {
  query: string;
  userId: string;
  limit?: number;
}

export interface FoodSearchResult {
  foods: EnhancedFoodItem[];
}

/**
 * Search foods with user-specific usage statistics (times_used, last_used_at)
 * 
 * Uses Supabase RPC search_food_master with pg_trgm fuzzy search.
 * Server handles all normalization using combined name+brand field.
 * Client sends raw user input - no client-side normalization.
 * 
 * @param options - Search options including query, userId, and limit
 * @returns Array of EnhancedFoodItem with usage statistics
 */
export async function searchFoodsWithUsage(
  options: FoodSearchOptions
): Promise<EnhancedFoodItem[]> {
  const { query, userId, limit = 50 } = options;
  
  if (!userId) {
    return [];
  }

  // Don't search if query is empty
  if (!query) {
    return [];
  }

  try {
    // Single RPC call - server handles fuzzy search with pg_trgm on normalized name+brand field
    // Client sends raw user input - no normalization, lowercasing, or punctuation removal
    const { data: foodsData, error: rpcError } = await supabase.rpc('search_food_master', {
      search_term: query, // Raw user string - server normalizes using regexp_replace + unaccent
      limit_rows: limit,
    });

    if (rpcError) {
      return [];
    }

    if (!foodsData || foodsData.length === 0) {
      return [];
    }

    // SECURITY: Filter out custom foods that don't belong to this user
    const filteredFoods = foodsData.filter((food: any) => {
      // If it's a custom food, it must belong to this user
      if (food.is_custom === true) {
        return food.owner_user_id === userId;
      }
      // Base foods (is_custom = false or null) are visible to all users
      return true;
    });

    // Get food IDs for usage statistics lookup
    const foodIds = filteredFoods.map(f => f.id);

    if (foodIds.length === 0) {
      return [];
    }

    // Fetch usage statistics for these foods for this user
    // Count times_used, get last_used_at, and latest entry serving info from calorie_entries
    const { data: entriesData, error: entriesError } = await supabase
      .from('calorie_entries')
      .select('food_id, created_at, quantity, unit, calories_kcal')
      .eq('user_id', userId)
      .in('food_id', foodIds)
      .not('food_id', 'is', null)
      .order('created_at', { ascending: false });

    if (entriesError) {
      // Continue without usage stats if this fails
    }

    // Build usage statistics map: food_id -> { times_used, last_used_at, latestEntry }
    const usageMap = new Map<string, { 
      times_used: number; 
      last_used_at: Date | null;
      latestEntry: { quantity: number; unit: string; calories_kcal: number } | null;
    }>();
    
    if (entriesData) {
      for (const entry of entriesData) {
        if (!entry.food_id) continue;
        
        const existing = usageMap.get(entry.food_id);
        const entryDate = new Date(entry.created_at);
        
        if (existing) {
          // Increment count and update last_used_at if this entry is more recent
          existing.times_used += 1;
          if (!existing.last_used_at || entryDate > existing.last_used_at) {
            existing.last_used_at = entryDate;
            // Update latest entry if this is more recent
            if (entry.quantity != null && entry.unit) {
              existing.latestEntry = {
                quantity: entry.quantity,
                unit: entry.unit,
                calories_kcal: entry.calories_kcal ?? 0,
              };
            }
          }
        } else {
          // First entry for this food - this is the latest entry
          usageMap.set(entry.food_id, {
            times_used: 1,
            last_used_at: entryDate,
            latestEntry: (entry.quantity != null && entry.unit) ? {
              quantity: entry.quantity,
              unit: entry.unit,
              calories_kcal: entry.calories_kcal ?? 0,
            } : null,
          });
        }
      }
    }

    // Enhance foods with usage statistics
    const enhancedFoods: EnhancedFoodItem[] = filteredFoods.map(food => {
      const usage = usageMap.get(food.id) || { 
        times_used: 0, 
        last_used_at: null,
        latestEntry: null,
      };
      return enhanceFoodItem(food, usage.times_used, usage.last_used_at, usage.latestEntry);
    });

    return enhancedFoods;
  } catch (error) {
    return [];
  }
}


