/**
 * DATA ACCESS SERVICE - Calories Entries Mealtype Meta
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service handles metadata for meal types (Quick Log, Notes, etc.)
 */

import { supabase } from '@/lib/supabase';

export interface MealtypeMeta {
  id: string;
  user_id: string;
  entry_date: string;
  meal_type: string;
  quick_kcal: number | null;
  quick_protein_g: number | null;
  quick_carbs_g: number | null;
  quick_fat_g: number | null;
  quick_fiber_g: number | null;
  quick_sodium_mg: number | null;
  quick_sugar_g: number | null;
  quick_log_food: string | null;
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
  quickKcal?: number | null;
  quickProteinG?: number | null;
  quickCarbsG?: number | null;
  quickFatG?: number | null;
  quickFiberG?: number | null;
  quickSodiumMg?: number | null;
  quickSugarG?: number | null;
  quickLogFood?: string | null;
  note?: string | null;
}

/**
 * Upsert mealtype meta (insert or update)
 * 
 * undefined values are omitted (won't overwrite existing)
 * null values explicitly set the field to NULL (used to delete Quick Log)
 * 
 * @param params - Upsert parameters
 * @returns The updated/inserted MealtypeMeta row, or null on error
 */
export async function upsertMealtypeMeta(
  params: UpsertMealtypeMetaParams
): Promise<MealtypeMeta | null> {
  const { userId, entryDate, mealType, quickKcal, quickProteinG, quickCarbsG, quickFatG, quickFiberG, quickSodiumMg, quickSugarG, quickLogFood, note } = params;

  if (!userId || !entryDate || !mealType) {
    console.error('Missing required parameters for upsertMealtypeMeta');
    return null;
  }

  try {
    // Build update data object, only including defined fields
    const updateData: any = {};
    
    if (quickKcal !== undefined) {
      updateData.quick_kcal = quickKcal;
    }
    if (quickProteinG !== undefined) {
      updateData.quick_protein_g = quickProteinG;
    }
    if (quickCarbsG !== undefined) {
      updateData.quick_carbs_g = quickCarbsG;
    }
    if (quickFatG !== undefined) {
      updateData.quick_fat_g = quickFatG;
    }
    if (quickFiberG !== undefined) {
      updateData.quick_fiber_g = quickFiberG;
    }
    if (quickSodiumMg !== undefined) {
      updateData.quick_sodium_mg = quickSodiumMg;
    }
    if (quickSugarG !== undefined) {
      updateData.quick_sugar_g = quickSugarG;
    }
    if (quickLogFood !== undefined) {
      updateData.quick_log_food = quickLogFood;
    }
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
