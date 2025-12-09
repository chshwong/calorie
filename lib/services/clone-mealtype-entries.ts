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
import { getEntriesForDate, createEntry } from './calorieEntries';
import { getMealtypeMetaByDate, upsertMealtypeMeta } from './calories-entries-mealtype-meta';
import type { CalorieEntry } from '@/utils/types';

export interface CloneMealtypeResult {
  entriesCloned: number;
  metaCloned: boolean;
  quickLogCopied: boolean;
  notesCopied: boolean;
}

/**
 * Clone calories entries and mealtype meta for a specific meal type from one date to another
 * 
 * @param userId - The user's ID
 * @param sourceDate - Source date in YYYY-MM-DD format
 * @param sourceMealType - Source meal type
 * @param targetDate - Target date in YYYY-MM-DD format
 * @param targetMealType - Target meal type
 * @param includeQuickLog - Whether to copy quick log values (default: false)
 * @param includeNotes - Whether to copy notes (default: false)
 * @returns Result with counts of cloned entries and whether meta was cloned
 * @throws Error if sourceDate equals targetDate or if validation fails
 */
export async function cloneCaloriesEntriesForMealtype(
  userId: string,
  sourceDate: string,
  sourceMealType: string,
  targetDate: string,
  targetMealType: string,
  includeQuickLog: boolean = false,
  includeNotes: boolean = false
): Promise<CloneMealtypeResult> {
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

  // Prevent cloning to the same date
  if (normalizedSource === normalizedTarget && sourceMealType.toLowerCase() === targetMealType.toLowerCase()) {
    throw new Error('SAME_DATE'); // Special error code for UI to handle
  }

  try {
    // Use a transaction-like approach: clone entries first, then meta
    // Note: Supabase doesn't support true transactions in the client, so we do sequential operations
    // If entries fail, we stop. If meta fails, we still return the entries count.

    // Step 1: Clone calories_entries
    const sourceEntries = await getEntriesForDate(userId, normalizedSource);
    
    // Filter entries by source meal type
    const entriesToClone = sourceEntries.filter(entry => 
      entry.meal_type.toLowerCase() === sourceMealType.toLowerCase()
    );

    let entriesCloned = 0;
    for (const entry of entriesToClone) {
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
        entriesCloned++;
      } else {
        console.error(`Failed to clone entry: ${entry.item_name}`);
      }
    }

    // Step 2: Clone mealtype meta if it exists
    let metaCloned = false;
    let quickLogCopied = false;
    let notesCopied = false;
    const sourceMetaArray = await getMealtypeMetaByDate(userId, normalizedSource);
    const sourceMeta = sourceMetaArray.find(meta => 
      meta.meal_type.toLowerCase() === sourceMealType.toLowerCase()
    );

    // Copy mealtype meta if quick log or notes should be included
    if (sourceMeta && (includeQuickLog || includeNotes)) {
      const hasQuickLog = sourceMeta.quick_kcal != null;
      const hasNote = sourceMeta.note != null && sourceMeta.note.trim().length > 0;
      
      // Track what we're trying to copy
      const willCopyQuickLog = includeQuickLog && hasQuickLog;
      const willCopyNotes = includeNotes && hasNote;
      
      // Only proceed if there's something to copy
      if (willCopyQuickLog || willCopyNotes) {
        // Build upsert params: use undefined to preserve existing values, or source values to override
        const upsertParams: any = {
          userId,
          entryDate: normalizedTarget,
          mealType: targetMealType,
        };

        // Handle Quick Log: only include if we're overriding
        if (willCopyQuickLog) {
          upsertParams.quickKcal = sourceMeta.quick_kcal;
          upsertParams.quickProteinG = sourceMeta.quick_protein_g;
          upsertParams.quickCarbsG = sourceMeta.quick_carbs_g;
          upsertParams.quickFatG = sourceMeta.quick_fat_g;
          upsertParams.quickFiberG = sourceMeta.quick_fiber_g;
          upsertParams.quickSugarG = sourceMeta.quick_sugar_g;
          upsertParams.quickSodiumMg = sourceMeta.quick_sodium_mg;
          upsertParams.quickLogFood = sourceMeta.quick_log_food;
        }
        // If excludeQuickLog, we don't include these fields (undefined) - existing values are preserved

        // Handle Notes: only include if we're overriding
        if (willCopyNotes) {
          upsertParams.note = sourceMeta.note;
        }
        // If excludeNotes, we don't include this field (undefined) - existing value is preserved

        const metaResult = await upsertMealtypeMeta(upsertParams);

        if (metaResult) {
          metaCloned = true;
          // Only mark as copied if upsert was successful
          if (willCopyQuickLog) {
            quickLogCopied = true;
          }
          if (willCopyNotes) {
            notesCopied = true;
          }
        } else {
          console.error('Failed to clone mealtype meta');
        }
      }
    }

    return {
      entriesCloned,
      metaCloned,
      quickLogCopied,
      notesCopied,
    };
  } catch (error) {
    console.error('Exception cloning mealtype entries:', error);
    throw error; // Re-throw to let caller handle
  }
}
