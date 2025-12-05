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
 * @returns Result with counts of cloned entries and whether meta was cloned
 * @throws Error if sourceDate equals targetDate or if validation fails
 */
export async function cloneCaloriesEntriesForMealtype(
  userId: string,
  sourceDate: string,
  sourceMealType: string,
  targetDate: string,
  targetMealType: string,
  includeQuickLog: boolean = false
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
    const sourceMetaArray = await getMealtypeMetaByDate(userId, normalizedSource);
    const sourceMeta = sourceMetaArray.find(meta => 
      meta.meal_type.toLowerCase() === sourceMealType.toLowerCase()
    );

    if (sourceMeta && includeQuickLog) {
      // Only copy quick log values if includeQuickLog is true and they exist; always set note = null (do not copy notes)
      // Check if there are any quick log values to copy
      const hasQuickLog = sourceMeta.quick_kcal != null;
      
      if (hasQuickLog) {
        // Upsert meta for target date/meal type with quick log values only
        const metaResult = await upsertMealtypeMeta({
          userId,
          entryDate: normalizedTarget,
          mealType: targetMealType,
          quickKcal: sourceMeta.quick_kcal,
          quickProteinG: sourceMeta.quick_protein_g,
          quickCarbsG: sourceMeta.quick_carbs_g,
          quickFatG: sourceMeta.quick_fat_g,
          quickFiberG: sourceMeta.quick_fiber_g,
          quickSugarG: sourceMeta.quick_sugar_g,
          quickSodiumMg: sourceMeta.quick_sodium_mg,
          note: null, // Always set note to null - do not copy notes
        });

        if (metaResult) {
          metaCloned = true;
        } else {
          console.error('Failed to clone mealtype meta');
        }
      }
    }

    return {
      entriesCloned,
      metaCloned,
    };
  } catch (error) {
    console.error('Exception cloning mealtype entries:', error);
    throw error; // Re-throw to let caller handle
  }
}
