import type { CalorieEntry, DailyEntriesWithStatus } from "@/lib/foodDiary/types";
import { supabase } from "@/lib/supabaseClient";

export async function getEntriesForDate(
  userId: string,
  dateString: string
): Promise<DailyEntriesWithStatus> {
  if (!userId) {
    return { entries: [], log_status: null };
  }

  try {
    const { data, error } = await supabase
      .rpc("get_entries_with_log_status", { p_entry_date: dateString })
      .single();

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[calorieEntries] fetch error", error.message);
      }
      return { entries: [], log_status: null };
    }

    return {
      entries: (data?.entries as CalorieEntry[] | null) ?? [],
      log_status: data?.log_status ?? null,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[calorieEntries] fetch exception", error);
    }
    return { entries: [], log_status: null };
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