import { FOOD_SEARCH } from "@/constants/constraints";
import { supabase } from "@/lib/supabaseClient";

export interface FoodMaster {
  id: string;
  name: string;
  brand?: string | null;
  serving_size: number;
  serving_unit: string;
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  source?: string | null;
  is_custom?: boolean;
  owner_user_id?: string | null;
  is_base_food?: boolean;
  is_quality_data?: boolean;
  order_index?: number | null;
  barcode?: string | null;
}

type FoodSearchOptions = {
  userId: string;
  query: string;
  includeCustomFoods?: boolean;
  maxResults?: number;
};

export async function searchFoodMaster({
  userId,
  query,
  includeCustomFoods = true,
  maxResults = FOOD_SEARCH.MAX_RESULTS,
}: FoodSearchOptions): Promise<FoodMaster[]> {
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const normalized = query.trim();
  if (!normalized || normalized.length < FOOD_SEARCH.MIN_QUERY_LENGTH) {
    return [];
  }

  const { data, error } = await supabase.rpc("search_food_master", {
    search_term: normalized,
    limit_rows: maxResults * FOOD_SEARCH.RPC_LIMIT_MULTIPLIER,
  });

  if (error) {
    throw error;
  }

  const foodsData = (data ?? []) as FoodMaster[];

  let filteredFoods = foodsData;
  if (!includeCustomFoods) {
    filteredFoods = foodsData.filter((food) => food.is_custom !== true);
  } else {
    filteredFoods = foodsData.filter((food) => {
      if (food.is_custom === true) {
        return food.owner_user_id === userId;
      }
      return true;
    });
  }

  return filteredFoods
    .sort((a, b) => {
      const aIsBase = a.is_base_food === true ? 1 : 0;
      const bIsBase = b.is_base_food === true ? 1 : 0;
      if (bIsBase !== aIsBase) return bIsBase - aIsBase;

      const aIsQuality = a.is_quality_data === true ? 1 : 0;
      const bIsQuality = b.is_quality_data === true ? 1 : 0;
      if (bIsQuality !== aIsQuality) return bIsQuality - aIsQuality;

      const aOrder = a.order_index ?? 0;
      const bOrder = b.order_index ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return (a.name || "").localeCompare(b.name || "");
    })
    .slice(0, maxResults);
}
