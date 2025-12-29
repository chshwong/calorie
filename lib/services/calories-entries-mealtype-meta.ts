/**
 * DATA ACCESS SERVICE - Calories Entries Mealtype Meta
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service handles metadata for meal types (Notes, etc.)
 */

import { supabase } from '@/lib/supabase';

export interface MealtypeMeta {
  id: string;
  user_id: string;
  entry_date: string;
  meal_type: string;
  note: string | null;
  inserted_at: string;
  updated_at: string;
}

export interface MealtypeMetaByDate {
  [mealType: string]: MealtypeMeta;
}

/**
 * Fetch mealtype meta for a specific date
 * 
 * @param userId - The user's ID
 * @param entryDate - Date in YYYY-MM-DD format
 * @returns Array of MealtypeMeta objects
 */
export async function getMealtypeMetaByDate(
  userId: string,
  entryDate: string
): Promise<MealtypeMeta[]> {
  if (!userId || !entryDate) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('calories_entries_mealtype_meta')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', entryDate);

    if (error) {
      console.error('Error fetching mealtype meta:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching mealtype meta:', error);
    return [];
  }
}

export interface UpsertMealtypeMetaParams {
  userId: string;
  entryDate: string;
  mealType: string;
  note?: string | null;
}

/**
 * Upsert mealtype meta (insert or update)
 * 
 * undefined values are omitted (won't overwrite existing)
 * null values explicitly set the field to NULL
 * 
 * @param params - Upsert parameters
 * @returns The updated/inserted MealtypeMeta row, or null on error
 */
export async function upsertMealtypeMeta(
  params: UpsertMealtypeMetaParams
): Promise<MealtypeMeta | null> {
  const { userId, entryDate, mealType, note } = params;

  if (!userId || !entryDate || !mealType) {
    console.error('Missing required parameters for upsertMealtypeMeta');
    return null;
  }

  try {
    // Build update data object, only including defined fields
    const updateData: any = {};
    
    if (note !== undefined) {
      updateData.note = note;
    }

    // Check if row exists
    const { data: existing, error: fetchError } = await supabase
      .from('calories_entries_mealtype_meta')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', entryDate)
      .eq('meal_type', mealType)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking for existing mealtype meta:', fetchError);
      return null;
    }

    if (existing) {
      // Update existing row
      const { data, error } = await supabase
        .from('calories_entries_mealtype_meta')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating mealtype meta:', error);
        return null;
      }

      return data;
    } else {
      // Insert new row
      const insertData = {
        user_id: userId,
        entry_date: entryDate,
        meal_type: mealType,
        ...updateData,
      };

      const { data, error } = await supabase
        .from('calories_entries_mealtype_meta')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error inserting mealtype meta:', error);
        return null;
      }

      return data;
    }
  } catch (error) {
    console.error('Exception upserting mealtype meta:', error);
    return null;
  }
}

/**
 * Delete mealtype meta for a specific date and meal type
 * 
 * @param userId - The user's ID
 * @param entryDate - Date in YYYY-MM-DD format
 * @param mealType - Meal type to delete meta for
 * @returns true on success, false on error
 */
export async function deleteMealtypeMeta(
  userId: string,
  entryDate: string,
  mealType: string
): Promise<boolean> {
  if (!userId || !entryDate || !mealType) {
    console.error('Missing required parameters for deleteMealtypeMeta');
    return false;
  }

  try {
    const { error } = await supabase
      .from('calories_entries_mealtype_meta')
      .delete()
      .eq('user_id', userId)
      .eq('entry_date', entryDate)
      .eq('meal_type', mealType);

    if (error) {
      console.error('Error deleting mealtype meta:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting mealtype meta:', error);
    return false;
  }
}