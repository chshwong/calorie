import { supabase } from "@/lib/supabaseClient";
import type { FoodMaster } from "@/utils/nutritionMath";

export type FoodMasterMetadata = {
  id: string;
  is_custom: boolean;
  brand: string | null;
};

export async function getFoodMasterById(foodId: string): Promise<FoodMaster | null> {
  if (!foodId) return null;

  const { data, error } = await supabase
    .from("food_master")
    .select("*")
    .eq("id", foodId)
    .single<FoodMaster>();

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[foodMaster] fetch error", error.message);
    }
    return null;
  }

  return data ?? null;
}

export async function getFoodMasterByIds(foodIds: string[]): Promise<FoodMasterMetadata[]> {
  if (!foodIds || foodIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("food_master")
    .select("id, is_custom, brand")
    .in("id", foodIds);

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[foodMaster] batch fetch error", error.message);
    }
    return [];
  }

  return data ?? [];
}
