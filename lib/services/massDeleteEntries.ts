/**
 * DATA ACCESS SERVICE - Mass Delete Entries
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * Reusable pattern for mass deleting entries by IDs.
 * Currently supports 'pill_intake' (meds/supps) and 'exercise_log'.
 * 
 * This service is platform-agnostic and can be reused in React Native.
 */

import { supabase } from '@/lib/supabase';
import type { CloneEntityType } from './cloneDayEntries';

/**
 * Mass delete entries by IDs
 * 
 * @param entityType - Type of entity to delete ('pill_intake', 'exercise_log')
 * @param userId - The user's ID
 * @param entryIds - Array of entry IDs to delete
 * @returns Number of entries deleted
 * @throws Error if validation fails
 */
export async function massDeleteEntries(
  entityType: CloneEntityType,
  userId: string,
  entryIds: string[]
): Promise<number> {
  if (!userId || !entryIds || entryIds.length === 0) {
    throw new Error('Missing required parameters');
  }

  switch (entityType) {
    case 'pill_intake':
      return massDeletePillIntake(userId, entryIds);
    case 'exercise_log':
      return massDeleteExerciseLog(userId, entryIds);
    case 'food_log':
      // TODO: implement 'food_log' mass delete here if needed
      throw new Error('food_log mass delete not yet implemented');
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Mass delete pill/med/supp intake entries
 * 
 * @param userId - The user's ID
 * @param entryIds - Array of entry IDs to delete
 * @returns Number of entries deleted, or 0 on error
 */
async function massDeletePillIntake(
  userId: string,
  entryIds: string[]
): Promise<number> {
  try {
    const { error, count } = await supabase
      .from('med_log')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .in('id', entryIds);

    if (error) {
      console.error('Error mass deleting pill intake:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Exception mass deleting pill intake:', error);
    return 0;
  }
}

/**
 * Mass delete exercise log entries
 * 
 * @param userId - The user's ID
 * @param entryIds - Array of entry IDs to delete
 * @returns Number of entries deleted, or 0 on error
 */
async function massDeleteExerciseLog(
  userId: string,
  entryIds: string[]
): Promise<number> {
  try {
    const { error, count } = await supabase
      .from('exercise_log')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .in('id', entryIds);

    if (error) {
      console.error('Error mass deleting exercise log:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Exception mass deleting exercise log:', error);
    return 0;
  }
}

