/**
 * DATA ACCESS SERVICE - Clone Day Entries
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * Reusable pattern for cloning entries from one date to another.
 * Currently supports 'pill_intake' (meds/supps), with placeholders for future entity types.
 * 
 * This service is platform-agnostic and can be reused in React Native.
 */

import type { CalorieEntry } from '@/utils/types';
import { createEntry, getEntriesForDate } from './calorieEntries';
import { createExerciseLog, getExerciseLogsForDate, type ExerciseLog } from './exerciseLogs';
import { createMedLog, getMedLogsForDate, type MedLog } from './medLogs';

/**
 * Entity types that can be cloned
 */
export type CloneEntityType = 'pill_intake' | 'food_log' | 'exercise_log';

/**
 * Clone entries from one date to another
 * 
 * @param entityType - Type of entity to clone ('pill_intake', 'food_log', 'exercise_log')
 * @param userId - The user's ID
 * @param sourceDate - Source date in YYYY-MM-DD format
 * @param targetDate - Target date in YYYY-MM-DD format
 * @param entryIds - Optional: Array of entry IDs to clone. If provided, only these entries will be cloned. If omitted, all entries for the source date will be cloned.
 * @param mealType - Optional: For food_log only, filter by meal type. If provided, only entries with this meal type will be cloned.
 * @returns Number of entries cloned
 * @throws Error if sourceDate equals targetDate or if validation fails
 */
export async function cloneDayEntries(
  entityType: CloneEntityType,
  userId: string,
  sourceDate: string,
  targetDate: string,
  entryIds?: string[],
  mealType?: string
): Promise<number> {
  if (!userId || !sourceDate || !targetDate) {
    throw new Error('Missing required parameters');
  }

  // Normalize dates for comparison (ensure YYYY-MM-DD format)
  const normalizedSource = sourceDate.trim();
  const normalizedTarget = targetDate.trim();

  // Validate date format (basic check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(normalizedSource) || !dateRegex.test(normalizedTarget)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  // Prevent cloning to the same date
  if (normalizedSource === normalizedTarget) {
    throw new Error('SAME_DATE'); // Special error code for UI to handle
  }

  switch (entityType) {
    case 'pill_intake':
      return clonePillIntakeForDate(userId, normalizedSource, normalizedTarget, entryIds);
    case 'food_log':
      return cloneFoodLogForDate(userId, normalizedSource, normalizedTarget, entryIds, mealType);
    case 'exercise_log':
      return cloneExerciseLogForDate(userId, normalizedSource, normalizedTarget, entryIds);
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Clone pill/med/supp intake entries from one date to another
 * 
 * @param userId - The user's ID
 * @param sourceDate - Source date in YYYY-MM-DD format
 * @param targetDate - Target date in YYYY-MM-DD format
 * @param entryIds - Optional: Array of entry IDs to clone. If provided, only these entries will be cloned.
 * @returns Number of entries cloned, or 0 on error
 */
async function clonePillIntakeForDate(
  userId: string,
  sourceDate: string,
  targetDate: string,
  entryIds?: string[]
): Promise<number> {
  try {
    // Fetch all entries for the source date
    const sourceEntries = await getMedLogsForDate(userId, sourceDate);

    if (!sourceEntries || sourceEntries.length === 0) {
      return 0; // No entries to clone
    }

    // Filter entries if entryIds is provided
    const entriesToClone = entryIds 
      ? sourceEntries.filter(entry => entryIds.includes(entry.id))
      : sourceEntries;

    if (entriesToClone.length === 0) {
      return 0; // No matching entries to clone
    }

    // Clone each entry to the target date
    let clonedCount = 0;
    for (const entry of entriesToClone) {
      // Create new entry with same data but new date
      const newEntry: Omit<MedLog, 'id' | 'created_at'> = {
        user_id: entry.user_id,
        date: targetDate,
        name: entry.name,
        type: entry.type, // Preserve med/supp/other classification
        dose_amount: entry.dose_amount,
        dose_unit: entry.dose_unit,
        notes: entry.notes,
      };

      const created = await createMedLog(newEntry);
      if (created) {
        clonedCount++;
      } else {
        console.error(`Failed to clone med log entry: ${entry.name}`);
      }
    }

    return clonedCount;
  } catch (error) {
    console.error('Exception cloning pill intake:', error);
    return 0;
  }
}

/**
 * Clone food log entries from one date to another
 * 
 * @param userId - The user's ID
 * @param sourceDate - Source date in YYYY-MM-DD format
 * @param targetDate - Target date in YYYY-MM-DD format
 * @param entryIds - Optional: Array of entry IDs to clone. If provided, only these entries will be cloned.
 * @param mealType - Optional: Filter by meal type. If provided, only entries with this meal type will be cloned.
 * @returns Number of entries cloned, or 0 on error
 */
async function cloneFoodLogForDate(
  userId: string,
  sourceDate: string,
  targetDate: string,
  entryIds?: string[],
  mealType?: string
): Promise<number> {
  try {
    // Fetch all entries for the source date
    const { entries: sourceEntries } = await getEntriesForDate(userId, sourceDate);

    if (!sourceEntries || sourceEntries.length === 0) {
      return 0; // No entries to clone
    }

    // Filter entries by meal type if provided
    let filteredEntries = sourceEntries;
    if (mealType) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.meal_type.toLowerCase() === mealType.toLowerCase()
      );
    }

    // Filter entries if entryIds is provided
    const entriesToClone = entryIds 
      ? filteredEntries.filter(entry => entryIds.includes(entry.id))
      : filteredEntries;

    if (entriesToClone.length === 0) {
      return 0; // No matching entries to clone
    }

    // Clone each entry to the target date (1:1 cloning, including duplicates)
    let clonedCount = 0;
    for (const entry of entriesToClone) {
      // Create new entry with same data but new date
      const newEntry: Omit<CalorieEntry, 'id' | 'created_at' | 'updated_at'> = {
        user_id: entry.user_id,
        entry_date: targetDate,
        eaten_at: entry.eaten_at, // Preserve time if available
        meal_type: entry.meal_type,
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
        clonedCount++;
      } else {
        console.error(`Failed to clone food log entry: ${entry.item_name}`);
      }
    }

    return clonedCount;
  } catch (error) {
    console.error('Exception cloning food log:', error);
    return 0;
  }
}

/**
 * Clone exercise log entries from one date to another
 * 
 * @param userId - The user's ID
 * @param sourceDate - Source date in YYYY-MM-DD format
 * @param targetDate - Target date in YYYY-MM-DD format
 * @param entryIds - Optional: Array of entry IDs to clone. If provided, only these entries will be cloned.
 * @returns Number of entries cloned, or 0 on error
 */
async function cloneExerciseLogForDate(
  userId: string,
  sourceDate: string,
  targetDate: string,
  entryIds?: string[]
): Promise<number> {
  try {
    // Fetch all entries for the source date
    const sourceEntries = await getExerciseLogsForDate(userId, sourceDate);

    if (!sourceEntries || sourceEntries.length === 0) {
      return 0; // No entries to clone
    }

    // Filter entries if entryIds is provided
    const entriesToClone = entryIds 
      ? sourceEntries.filter(entry => entryIds.includes(entry.id))
      : sourceEntries;

    if (entriesToClone.length === 0) {
      return 0; // No matching entries to clone
    }

    // Clone each entry to the target date
    let clonedCount = 0;
    for (const entry of entriesToClone) {
      // Create new entry with same data but new date
      const newEntry: Omit<ExerciseLog, 'id' | 'created_at'> = {
        user_id: entry.user_id,
        date: targetDate,
        name: entry.name,
        minutes: entry.minutes,
        notes: entry.notes,
        category: entry.category,
        intensity: entry.intensity,
        distance_km: entry.distance_km,
        sets: entry.sets,
        reps_min: entry.reps_min,
        reps_max: entry.reps_max,
      };

      const created = await createExerciseLog(newEntry);
      if (created) {
        clonedCount++;
      } else {
        console.error(`Failed to clone exercise log entry: ${entry.name}`);
      }
    }

    return clonedCount;
  } catch (error) {
    console.error('Exception cloning exercise log:', error);
    return 0;
  }
}

