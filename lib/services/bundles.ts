/**
 * DATA ACCESS SERVICE - Bundles
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import { computeNutrientsForFoodServing, computeNutrientsForRawQuantity } from '@/lib/servings';

export type BundleItem = {
  id: string;
  bundle_id: string;
  food_id: string | null;
  item_name: string | null;
  serving_id: string | null;
  quantity: number;
  unit: string;
  order_index: number;
};

export type Bundle = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFiber?: number;
  foodsMap?: Map<string, { id: string; name: string; calories_kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; serving_size: number; serving_unit: string }>;
  servingsMap?: Map<string, { id: string; serving_name: string; weight_g: number | null; volume_ml: number | null }>;
};

/**
 * Fetch bundles with items and calculate totals
 * 
 * @param userId - The user's ID
 * @returns Array of Bundle objects with items and calculated totals
 */
export async function fetchBundles(userId: string): Promise<Bundle[]> {
  if (!userId) {
    return [];
  }

  try {
    // Fetch bundles ordered by created_at (newest first)
    const { data: bundlesData, error: bundlesError } = await supabase
      .from('bundles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (bundlesError) {
      console.error('Error fetching bundles:', bundlesError);
      return [];
    }

    if (!bundlesData || bundlesData.length === 0) {
      return [];
    }

    // Fetch bundle items for all bundles
    const bundleIds = bundlesData.map(b => b.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from('bundle_items')
      .select('*')
      .in('bundle_id', bundleIds)
      .order('order_index', { ascending: true });

    if (itemsError) {
      console.error('Error fetching bundle items:', itemsError);
      return bundlesData.map(b => ({ ...b, items: [] }));
    }

    // Group items by bundle_id
    const itemsByBundle = new Map<string, BundleItem[]>();
    (itemsData || []).forEach(item => {
      if (!itemsByBundle.has(item.bundle_id)) {
        itemsByBundle.set(item.bundle_id, []);
      }
      itemsByBundle.get(item.bundle_id)!.push(item);
    });

    // Fetch all food names and serving names needed for display
    const allFoodIds = [...new Set((itemsData || []).filter(item => item.food_id).map(item => item.food_id!))];
    const { data: allFoodsData } = allFoodIds.length > 0
      ? await supabase
          .from('food_master')
          .select('id, name, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_size, serving_unit')
          .in('id', allFoodIds)
      : { data: [] };
    
    const foodsMap = new Map((allFoodsData || []).map(food => [food.id, food]));

    const allServingIds = [...new Set((itemsData || []).filter(item => item.serving_id).map(item => item.serving_id!))];
    const { data: allServingsData } = allServingIds.length > 0
      ? await supabase
          .from('food_servings')
          .select('id, serving_name, weight_g, volume_ml')
          .in('id', allServingIds)
      : { data: [] };
    
    const servingsMap = new Map((allServingsData || []).map(serving => [serving.id, serving]));

    // Calculate totals for each bundle
    const bundlesWithItems: Bundle[] = await Promise.all(
      bundlesData.map(async (bundle) => {
        const items = itemsByBundle.get(bundle.id) || [];
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let totalFiber = 0;

        // Calculate totals by fetching food details for items with food_id
        for (const item of items) {
          if (item.food_id && foodsMap.has(item.food_id)) {
            const foodData = foodsMap.get(item.food_id)!;
            let nutrients;
            if (item.serving_id && servingsMap.has(item.serving_id)) {
              const servingData = servingsMap.get(item.serving_id)!;
              nutrients = computeNutrientsForFoodServing(foodData, servingData, item.quantity);
            } else {
              nutrients = computeNutrientsForRawQuantity(foodData, item.quantity, item.unit);
            }
            totalCalories += nutrients.calories_kcal;
            totalProtein += nutrients.protein_g;
            totalCarbs += nutrients.carbs_g;
            totalFat += nutrients.fat_g;
            totalFiber += nutrients.fiber_g;
          }
          // Note: Manual entries (item_name without food_id) don't contribute to totals
        }

        return {
          ...bundle,
          items,
          totalCalories: Math.round(totalCalories),
          totalProtein: Math.round(totalProtein * 10) / 10,
          totalCarbs: Math.round(totalCarbs * 10) / 10,
          totalFat: Math.round(totalFat * 10) / 10,
          totalFiber: Math.round(totalFiber * 10) / 10,
          foodsMap, // Store for formatting items list
          servingsMap, // Store for formatting items list
        };
      })
    );

    return bundlesWithItems;
  } catch (error) {
    console.error('Exception fetching bundles:', error);
    return [];
  }
}

