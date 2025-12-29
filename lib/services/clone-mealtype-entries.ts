/**
 * DATA ACCESS SERVICE - Clone Meal Type Entries
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * Clones calories_entries and calories_entries_mealtype_meta for a specific meal type
 * from one date to another.
 */

import { supabase } from '@/lib/supabase';
import { getEntriesForDate, createEntry, deleteEntries } from './calorieEntries';
import { getMealtypeMetaByDate, upsertMealtypeMeta } from './calories-entries-mealtype-meta';
import type { CalorieEntry } from '@/utils/types';

export interface CloneMealtypeResult {
  entriesCloned: number;
  metaCloned: boolean;
  quickLogCopied: boolean; // Always false, kept for backward compatibility
  notesCopied: boolean;
}

export type TransferMode = 'copy' | 'move';
export type NotesMode = 'exclude' | 'override';

export interface TransferMealtypeParams {
  userId: string;
  sourceDate: string;
  sourceMealType: string;
  targetDate: string;
  targetMealType: string;
  mode: TransferMode;
  notesMode: NotesMode; // 'exclude' means don't copy/delete notes, 'override' means copy and delete if move
}

/**
 * Transfer (copy or move) calories entries and mealtype meta for a specific meal type from one date to another
 * 
 * @param params - Transfer parameters
 * @returns Result with counts of transferred entries and whether meta was transferred
 * @throws Error if sourceDate equals targetDate or if validation fails
 */
export async function transferMealtypeEntries(
  params: TransferMealtypeParams
): Promise<CloneMealtypeResult> {
  const { userId, sourceDate, sourceMealType, targetDate, targetMealType, mode, notesMode } = params;
  if (!userId || !sourceDate || !sourceMealType || !targetDate || !targetMealType) {
    throw new Error('Missing required parameters');
  }

  // Normalize dates for comparison
  const normalizedSource = sourceDate.trim();
  const normalizedTarget = targetDate.trim();

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(normalizedSource) || !dateRegex.test(normalizedTarget)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  // Prevent transferring to the same date and meal type
  if (normalizedSource === normalizedTarget && sourceMealType.toLowerCase() === targetMealType.toLowerCase()) {
    throw new Error('SAME_DATE'); // Special error code for UI to handle
  }

  try {
    // Step 1: Get source entries
    const sourceEntries = await getEntriesForDate(userId, normalizedSource);
    
    // Filter entries by source meal type
    const entriesToTransfer = sourceEntries.filter(entry => 
      entry.meal_type.toLowerCase() === sourceMealType.toLowerCase()
    );

    // Step 2: Copy entries to target
    let entriesTransferred = 0;
    const sourceEntryIds: string[] = [];

    for (const entry of entriesToTransfer) {
      sourceEntryIds.push(entry.id);
      
      // Create new entry with target date and meal type
      const newEntry: Omit<CalorieEntry, 'id' | 'created_at' | 'updated_at'> = {
        user_id: entry.user_id,
        entry_date: normalizedTarget,
        eaten_at: entry.eaten_at,
        meal_type: targetMealType, // Use target meal type
        item_name: entry.item_name,
        food_id: entry.food_id,
        serving_id: entry.serving_id,
        quantity: entry.quantity,
        unit: entry.unit,
        calories_kcal: entry.calories_kcal,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
        fiber_g: entry.fiber_g,
        saturated_fat_g: entry.saturated_fat_g,
        trans_fat_g: entry.trans_fat_g,
        sugar_g: entry.sugar_g,
        sodium_mg: entry.sodium_mg,
        notes: entry.notes,
      };

      const created = await createEntry(newEntry);
      if (created) {
        entriesTransferred++;
      } else {
        console.error(`Failed to transfer entry: ${entry.item_name}`);
        // If copy fails, throw error to prevent deletion
        throw new Error(`Failed to transfer entry: ${entry.item_name}`);
      }
    }

    // Step 3: Copy mealtype meta if notes should be included (notesMode === 'override')
    let metaCloned = false;
    let notesCopied = false;
    const sourceMetaArray = await getMealtypeMetaByDate(userId, normalizedSource);
    const sourceMeta = sourceMetaArray.find(meta => 
      meta.meal_type.toLowerCase() === sourceMealType.toLowerCase()
    );

    // Copy mealtype meta if notes should be included (override mode)
    const includeNotes = notesMode === 'override';
    if (sourceMeta && includeNotes) {
      const hasNote = sourceMeta.note != null && sourceMeta.note.trim().length > 0;
      
      // Only proceed if there's something to copy
      if (hasNote) {
        // Build upsert params
        const upsertParams: any = {
          userId,
          entryDate: normalizedTarget,
          mealType: targetMealType,
          note: sourceMeta.note,
        };

        const metaResult = await upsertMealtypeMeta(upsertParams);

        if (metaResult) {
          metaCloned = true;
          notesCopied = true;
        } else {
          console.error('Failed to copy mealtype meta');
          // If meta copy fails, we still continue (non-critical)
        }
      }
    }

    // Step 4: If mode is 'move', delete source entries and optionally notes
    if (mode === 'move') {
      // Delete source entries (OK if this deletes 0 rows when empty)
      const deleteSuccess = await deleteEntries(sourceEntryIds);
      if (!deleteSuccess && sourceEntryIds.length > 0) {
        // Only error if we expected to delete something
        console.error('Failed to delete source entries after move');
        throw new Error('Failed to delete source entries after move');
      }

      // MUST run even when there were 0 entries
      if (notesMode === 'override') {
        const { error: deleteMetaError } = await supabase
          .from('calories_entries_mealtype_meta')
          .delete()
          .eq('user_id', userId)
          .eq('entry_date', normalizedSource)
          .eq('meal_type', sourceMealType);
        
        if (deleteMetaError) {
          console.error('Failed to delete source mealtype meta after move:', deleteMetaError);
          // Non-critical - just log the error
        }
      }
    }

    return {
      entriesCloned: entriesTransferred,
      metaCloned,
      quickLogCopied: false, // Always false, Quick Log is deprecated
      notesCopied,
    };
  } catch (error) {
    console.error('Exception transferring mealtype entries:', error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Clone calories entries and mealtype meta for a specific meal type from one date to another
 * (Legacy function maintained for backward compatibility)
 * 
 * @deprecated Use transferMealtypeEntries with mode='copy' instead
 */
export async function cloneCaloriesEntriesForMealtype(
  userId: string,
  sourceDate: string,
  sourceMealType: string,
  targetDate: string,
  targetMealType: string,
  includeNotes: boolean = false
): Promise<CloneMealtypeResult> {
  return transferMealtypeEntries({
    userId,
    sourceDate,
    sourceMealType,
    targetDate,
    targetMealType,
    mode: 'copy',
    notesMode: includeNotes ? 'override' : 'exclude',
  });
}
