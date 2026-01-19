import { supabase } from "@/lib/supabaseClient";
import type { CalorieEntry } from "@/lib/foodDiary/types";

const ENTRY_COLUMNS = `
  id,
  user_id,
  entry_date,
  eaten_at,
  meal_type,
  item_name,
  food_id,
  serving_id,
  quantity,
  unit,
  calories_kcal,
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  saturated_fat_g,
  trans_fat_g,
  sugar_g,
  sodium_mg,
  notes,
  source,
  ai_raw_text,
  ai_confidence,
  created_at,
  updated_at
`;

export async function getEntriesForDate(
  userId: string,
  dateString: string
): Promise<CalorieEntry[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("calorie_entries")
      .select(ENTRY_COLUMNS)
      .eq("user_id", userId)
      .eq("entry_date", dateString)
      .order("created_at", { ascending: true });

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[calorieEntries] fetch error", error.message);
      }
      return [];
    }

    return data ?? [];
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[calorieEntries] fetch exception", error);
    }
    return [];
  }
}

export async function createEntry(
  entry: Omit<CalorieEntry, "id" | "created_at" | "updated_at">
): Promise<CalorieEntry> {
  const { data, error } = await supabase
    .from("calorie_entries")
    .insert(entry)
    .select(ENTRY_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create entry");
  }

  return data;
}