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
 * @param options - Search options including query, userId, and limit
 * @returns Array of EnhancedFoodItem with usage statistics
 */
export async function searchFoodsWithUsage(
  options: FoodSearchOptions
): Promise<EnhancedFoodItem[]> {
  const { query, userId, limit = 20 } = options;
  
  if (!userId) {
    return [];
  }

  // Don't search if query is empty or just whitespace
  if (!query || !query.trim()) {
    return [];
  }

  try {
    // Try to use the backend RPC function for multi-word token-based search
    // This ensures multi-word queries match items even when words are not adjacent
    // Example: "egg soup" matches "egg drop soup"
    let foodsData: any[] | null = null;
    let foodsError: any = null;
    
    try {
      const rpcResult = await supabase.rpc('search_food_master', {
        p_query: query,
        p_user_id: userId,
        p_limit: limit * 3, // Get more to account for client-side filtering/ranking
      });
      foodsData = rpcResult.data;
      foodsError = rpcResult.error;
      
      if (foodsError) {
        console.warn('RPC search_food_master returned error:', foodsError);
        console.warn('Error details:', JSON.stringify(foodsError, null, 2));
      }
    } catch (rpcError) {
      // RPC function might not exist yet, fall back to original query method
      console.warn('RPC search_food_master threw exception, falling back to direct query:', rpcError);
      foodsError = rpcError;
    }
    
    // If RPC failed (error occurred), fall back to original query method
    // Note: If RPC succeeded but returned empty data, that's valid - don't fall back
    if (foodsError) {
      console.log('Using fallback query method for search (query:', query, ')');
      
      // Normalize query for search (same as use-food-search.ts)
      const normalizeText = (text: string): string => {
        return text
          .toLowerCase()
          .replace(/[%(),]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      const cleanedQuery = normalizeText(query);
      const words = cleanedQuery.split(/\s+/).filter(word => word.length > 0);
      
      if (words.length === 0) {
        return [];
      }
      
      // Build search conditions: entire query OR first word (to ensure we get relevant results)
      const queryPattern = `%${cleanedQuery}%`;
      const firstWordPattern = words.length > 0 ? `%${words[0]}%` : queryPattern;
      
      const searchConditions = [
        `name.ilike.${queryPattern}`,
        `brand.ilike.${queryPattern}`,
        `name.ilike.${firstWordPattern}`,
        `brand.ilike.${firstWordPattern}`,
      ];
      
      // Search food_master table using original method (get more results for client-side filtering)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('food_master')
        .select('*')
        .or(searchConditions.join(','))
        .limit(limit * 5); // Get more results for client-side filtering
      
      if (fallbackError) {
        console.error('Error searching foods (fallback):', fallbackError);
        return [];
      }
      
      // Client-side filtering: match entire query as substring OR all words appear
      // This handles cases like "egg soup" matching "egg drop soup"
      const filteredResults = (fallbackData || []).filter((food: any) => {
        const foodName = normalizeText(food.name || '');
        const foodBrand = normalizeText(food.brand || '');
        const searchText = `${foodName} ${foodBrand}`.trim();
        
        // First check: entire query appears as substring in name or brand
        if (foodName.includes(cleanedQuery) || foodBrand.includes(cleanedQuery)) {
          return true;
        }
        
        // Second check: entire query appears as substring in combined text
        if (searchText.includes(cleanedQuery)) {
          return true;
        }
        
        // Third check: all words appear (word-order-independent matching)
        // This handles cases like "egg soup" matching "egg drop soup"
        return words.every(word => searchText.includes(word));
      });
      
      foodsData = filteredResults;
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
    }).slice(0, limit * 2); // Limit after filtering

    // Get food IDs for usage statistics lookup (use filtered foods)
    const foodIds = filteredFoods.map(f => f.id);

    // Fetch usage statistics for these foods for this user
    // Count times_used and get last_used_at from calorie_entries
    const { data: entriesData, error: entriesError } = await supabase
      .from('calorie_entries')
      .select('food_id, created_at')
      .eq('user_id', userId)
      .in('food_id', foodIds)
      .not('food_id', 'is', null)
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('Error fetching usage statistics:', entriesError);
      // Continue without usage stats if this fails
    }

    // Build usage statistics map: food_id -> { times_used, last_used_at }
    const usageMap = new Map<string, { times_used: number; last_used_at: Date | null }>();
    
    if (entriesData) {
      for (const entry of entriesData) {
        if (!entry.food_id) continue;
        
        const existing = usageMap.get(entry.food_id);
        if (existing) {
          // Increment count and update last_used_at if this entry is more recent
          existing.times_used += 1;
          const entryDate = new Date(entry.created_at);
          if (!existing.last_used_at || entryDate > existing.last_used_at) {
            existing.last_used_at = entryDate;
          }
        } else {
          // First entry for this food
          usageMap.set(entry.food_id, {
            times_used: 1,
            last_used_at: new Date(entry.created_at),
          });
        }
      }
    }

    // Enhance foods with usage statistics (use filtered foods)
    const enhancedFoods: EnhancedFoodItem[] = filteredFoods.map(food => {
      const usage = usageMap.get(food.id) || { times_used: 0, last_used_at: null };
      return enhanceFoodItem(food, usage.times_used, usage.last_used_at);
    });

    return enhancedFoods;
  } catch (error) {
    console.error('Exception searching foods with usage:', error);
    return [];
  }
}


