/**
 * DATA ACCESS SERVICE - Bundle Items
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service is platform-agnostic and can be reused in React Native.
 */

import { supabase } from '@/lib/supabase';

export type BundleItemReference = {
  bundle_id: string;
  bundle_name: string;
};

/**
 * Check if a food is referenced in any bundle items
 * 
 * @param userId - The user's ID
 * @param foodId - The food ID to check
 * @returns Array of bundle references (bundle_id and bundle_name), or empty array if not referenced
 * 
 * Suggested index for performance:
 * -- CREATE INDEX IF NOT EXISTS idx_bundle_items_food_id 
 * --   ON bundle_items(food_id) WHERE food_id IS NOT NULL;
 */
export async function getBundleItemReferencesForFood(
  userId: string,
  foodId: string
): Promise<BundleItemReference[]> {
  if (!userId || !foodId) {
    return [];
  }

  try {
    // Query bundle_items joined with bundles to get bundle names
    // First get bundle_items with the food_id, then filter by user's bundles
    const { data: bundleItems, error: itemsError } = await supabase
      .from('bundle_items')
      .select('bundle_id')
      .eq('food_id', foodId);

    if (itemsError) {
      console.error('Error fetching bundle items:', itemsError);
      return [];
    }

    if (!bundleItems || bundleItems.length === 0) {
      return [];
    }

    // Get unique bundle IDs
    const bundleIds = [...new Set(bundleItems.map(item => item.bundle_id))];

    // Fetch bundles to get names and filter by user
    const { data: bundles, error: bundlesError } = await supabase
      .from('bundles')
      .select('id, name')
      .in('id', bundleIds)
      .eq('user_id', userId);

    if (bundlesError) {
      console.error('Error fetching bundles:', bundlesError);
      return [];
    }

    if (!bundles || bundles.length === 0) {
      return [];
    }

    // Convert to array format
    return bundles.map(bundle => ({
      bundle_id: bundle.id,
      bundle_name: bundle.name,
    }));
  } catch (error) {
    console.error('Exception checking bundle item references:', error);
    return [];
  }
}

