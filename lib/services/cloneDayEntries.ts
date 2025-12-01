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

import { supabase } from '@/lib/supabase';
import { getMedLogsForDate, createMedLog, type MedLog } from './medLogs';
import { getExerciseLogsForDate, createExerciseLog, type ExerciseLog } from './exerciseLogs';

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
 * @returns Number of entries cloned
 * @throws Error if sourceDate equals targetDate or if validation fails
 */
export async function cloneDayEntries(
  entityType: CloneEntityType,
  userId: string,
  sourceDate: string,
  targetDate: string
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
      return clonePillIntakeForDate(userId, normalizedSource, normalizedTarget);
    case 'food_log':
      // TODO: implement 'food_log' cloning here
      throw new Error('food_log cloning not yet implemented');
    case 'exercise_log':
      return cloneExerciseLogForDate(userId, normalizedSource, normalizedTarget);
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
 * @returns Number of entries cloned, or 0 on error
 */
async function clonePillIntakeForDate(
  userId: string,
  sourceDate: string,
  targetDate: string
): Promise<number> {
  try {
    // Fetch all entries for the source date
    const sourceEntries = await getMedLogsForDate(userId, sourceDate);

    if (!sourceEntries || sourceEntries.length === 0) {
      return 0; // No entries to clone
    }

    // Clone each entry to the target date
    let clonedCount = 0;
    for (const entry of sourceEntries) {
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
 * Clone exercise log entries from one date to another
 * 
 * @param userId - The user's ID
 * @param sourceDate - Source date in YYYY-MM-DD format
 * @param targetDate - Target date in YYYY-MM-DD format
 * @returns Number of entries cloned, or 0 on error
 */
async function cloneExerciseLogForDate(
  userId: string,
  sourceDate: string,
  targetDate: string
): Promise<number> {
  try {
    // Fetch all entries for the source date
    const sourceEntries = await getExerciseLogsForDate(userId, sourceDate);

    if (!sourceEntries || sourceEntries.length === 0) {
      return 0; // No entries to clone
    }

    // Clone each entry to the target date
    let clonedCount = 0;
    for (const entry of sourceEntries) {
      // Create new entry with same data but new date
      const newEntry: Omit<ExerciseLog, 'id' | 'created_at'> = {
        user_id: entry.user_id,
        date: targetDate,
        name: entry.name,
        minutes: entry.minutes,
        notes: entry.notes,
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

