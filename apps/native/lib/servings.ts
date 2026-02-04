import { supabase } from "@/lib/supabaseClient";
import type { FoodServing } from "@/utils/nutritionMath";

export const FOOD_SERVING_COLUMNS = `
  id,
  food_id,
  serving_name,
  weight_g,
  volume_ml,
  sort_order,
  is_default
`;

export async function getServingsForFood(foodId: string): Promise<FoodServing[]> {
  if (!foodId) return [];

  const { data, error } = await supabase
    .from("food_servings")
    .select(FOOD_SERVING_COLUMNS)
    .eq("food_id", foodId)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true, nullsFirst: true });

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[servings] fetch error", error.message);
    }
    return [];
  }

  return data ?? [];
}

export async function getServingsForFoods(
  foodIds: string[]
): Promise<Map<string, FoodServing[]>> {
  const result = new Map<string, FoodServing[]>();
  if (foodIds.length === 0) return result;

  const { data, error } = await supabase
    .from("food_servings")
    .select(FOOD_SERVING_COLUMNS)
    .in("food_id", foodIds)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true, nullsFirst: true });

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[servings] batch fetch error", error.message);
    }
    return result;
  }

  for (const serving of data ?? []) {
    const list = result.get(serving.food_id) ?? [];
    list.push(serving);
    result.set(serving.food_id, list);
  }

  return result;
}
