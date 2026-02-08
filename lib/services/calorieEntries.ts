/**
 * DATA ACCESS SERVICE - Calorie Entries
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service is platform-agnostic and can be reused in React Native.
 * 
 * Suggested indexes for performance:
 * -- CREATE INDEX IF NOT EXISTS idx_calorie_entries_user_date 
 * --   ON calorie_entries(user_id, entry_date DESC);
 * -- CREATE INDEX IF NOT EXISTS idx_calorie_entries_user_created 
 * --   ON calorie_entries(user_id, created_at DESC);
 */

import { supabase } from '@/lib/supabase';
import type { CalorieEntry, DailyEntriesWithStatus } from '@/utils/types';

// Columns to select - avoid select('*') per guideline 3.2
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

/**
 * Fetch calorie entries for a specific date
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Array of CalorieEntry objects, or empty array on error
 */
export async function getEntriesForDate(
  userId: string,
  dateString: string
): Promise<DailyEntriesWithStatus> {
  if (!userId) {
    return { entries: [], log_status: null };
  }

  try {
    const { data, error } = await supabase
      .rpc('get_entries_with_log_status', { p_entry_date: dateString })
      .single();

    if (error) {
      console.error('Error fetching entries:', error);
      return { entries: [], log_status: null };
    }

    return {
      entries: (data?.entries as CalorieEntry[] | null) ?? [],
      log_status: data?.log_status ?? null,
    };
  } catch (error) {
    console.error('Exception fetching entries:', error);
    return { entries: [], log_status: null };
  }
}

/**
 * Fetch calorie entries for a date range
 * 
 * @param userId - The user's ID
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Array of CalorieEntry objects grouped by date
 */
export async function getEntriesForDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalorieEntry[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('calorie_entries')
      .select(ENTRY_COLUMNS)
      .eq('user_id', userId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching entries for date range:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching entries for date range:', error);
    return [];
  }
}

/**
 * Fetch recent calorie entries for a user
 * 
 * @param userId - The user's ID
 * @param limit - Maximum number of entries to return
 * @returns Array of CalorieEntry objects
 */
export async function getRecentEntries(
  userId: string,
  limit: number = 50
): Promise<CalorieEntry[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('calorie_entries')
      .select(ENTRY_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent entries:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching recent entries:', error);
    return [];
  }
}

/**
 * Create a new calorie entry
 * 
 * @param entry - Partial CalorieEntry without id, created_at, updated_at
 * @returns The created entry or null on error
 */
export async function createEntry(
  entry: Omit<CalorieEntry, 'id' | 'created_at' | 'updated_at'>
): Promise<CalorieEntry | null> {
  try {
    const { data, error } = await supabase
      .from('calorie_entries')
      .insert(entry)
      .select(ENTRY_COLUMNS)
      .single();

    if (error) {
      console.error('Error creating entry:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception creating entry:', error);
    return null;
  }
}

/**
 * Update an existing calorie entry
 * 
 * @param entryId - The entry ID to update
 * @param updates - Partial fields to update
 * @returns The updated entry or null on error
 */
export async function updateEntry(
  entryId: string,
  updates: Partial<CalorieEntry>
): Promise<CalorieEntry | null> {
  try {
    const { data, error } = await supabase
      .from('calorie_entries')
      .update(updates)
      .eq('id', entryId)
      .select(ENTRY_COLUMNS)
      .single();

    if (error) {
      console.error('Error updating entry:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating entry:', error);
    return null;
  }
}

/**
 * Update an existing calorie entry, scoped to a user.
 *
 * Per engineering guidelines, components should not call Supabase directly. This helper
 * also avoids trusting a client-provided user_id by filtering on user_id server-side (RLS still applies).
 */
export async function updateEntryForUser(
  entryId: string,
  userId: string,
  updates: Partial<CalorieEntry>
): Promise<CalorieEntry | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('calorie_entries')
      .update(updates)
      .eq('id', entryId)
      .eq('user_id', userId)
      .select(ENTRY_COLUMNS)
      .single();

    if (error) {
      console.error('Error updating entry for user:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating entry for user:', error);
    return null;
  }
}

/**
 * Delete a calorie entry
 * 
 * @param entryId - The entry ID to delete
 * @returns true on success, false on error
 */
export async function deleteEntry(entryId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('calorie_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('Error deleting entry:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting entry:', error);
    return false;
  }
}

/**
 * Delete multiple calorie entries
 * 
 * @param entryIds - Array of entry IDs to delete
 * @returns true on success, false on error
 */
export async function deleteEntries(entryIds: string[]): Promise<boolean> {
  if (entryIds.length === 0) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('calorie_entries')
      .delete()
      .in('id', entryIds);

    if (error) {
      console.error('Error deleting entries:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting entries:', error);
    return false;
  }
}

