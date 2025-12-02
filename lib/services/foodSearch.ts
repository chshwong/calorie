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

  try {
    // Normalize query for search
    const normalizedQuery = query.trim().toLowerCase();
    const queryPattern = `%${normalizedQuery}%`;
    
    // Search food_master table
    // SECURITY: Exclude custom foods that don't belong to this user
    // Custom foods (is_custom = true) must have owner_user_id = userId
    // Base foods (is_custom = false or null) are visible to all users
    let searchQuery = supabase
      .from('food_master')
      .select('*')
      .or(`name.ilike.${queryPattern},brand.ilike.${queryPattern}`);
    
    // Filter: Only include custom foods that belong to this user, or base foods (is_custom = false/null)
    // This is done by filtering out custom foods where owner_user_id != userId
    // We'll filter in two steps: get all matching foods, then filter out other users' custom foods
    const { data: foodsData, error: foodsError } = await searchQuery.limit(limit * 3); // Get more to account for filtering
    
    if (foodsError) {
      console.error('Error searching foods:', foodsError);
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


