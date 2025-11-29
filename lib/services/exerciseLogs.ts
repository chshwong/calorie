/**
 * DATA ACCESS SERVICE - Exercise Logs
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service is platform-agnostic and can be reused in React Native.
 */

import { supabase } from '@/lib/supabase';

// Type definition for exercise log
export type ExerciseLog = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD format
  name: string;
  minutes: number | null;
  notes: string | null;
  created_at: string;
};

// Columns to select - avoid select('*') per guideline 3.2
const EXERCISE_LOG_COLUMNS = `
  id,
  user_id,
  date,
  name,
  minutes,
  notes,
  created_at
`;

/**
 * Fetch exercise logs for a specific date
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Array of ExerciseLog objects, or empty array on error
 * 
 * Required index: exercise_log_user_date_idx ON exercise_log(user_id, date)
 */
export async function getExerciseLogsForDate(
  userId: string,
  dateString: string
): Promise<ExerciseLog[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('exercise_log')
      .select(EXERCISE_LOG_COLUMNS)
      .eq('user_id', userId)
      .eq('date', dateString)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching exercise logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching exercise logs:', error);
    return [];
  }
}

/**
 * Fetch exercise summary for recent days
 * 
 * @param userId - The user's ID
 * @param days - Number of recent days to fetch (default: 7)
 * @returns Array of objects with date, total_minutes, and activity_count
 * 
 * Required index: exercise_log_user_date_idx ON exercise_log(user_id, date)
 */
export async function getExerciseSummaryForRecentDays(
  userId: string,
  days: number = 7
): Promise<Array<{ date: string; total_minutes: number; activity_count: number }>> {
  if (!userId) {
    return [];
  }

  try {
    // Calculate the start date (days ago)
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));

    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('exercise_log')
      .select('date, minutes')
      .eq('user_id', userId)
      .gte('date', startDateString)
      .lte('date', endDateString)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching exercise summary:', error);
      return [];
    }

    // Aggregate by date
    const summaryMap = new Map<string, { total_minutes: number; activity_count: number }>();

    (data || []).forEach((log) => {
      const date = log.date;
      const minutes = log.minutes || 0;

      if (!summaryMap.has(date)) {
        summaryMap.set(date, { total_minutes: 0, activity_count: 0 });
      }

      const summary = summaryMap.get(date)!;
      summary.total_minutes += minutes;
      summary.activity_count += 1;
    });

    // Convert to array and sort by date descending
    const summaryArray = Array.from(summaryMap.entries())
      .map(([date, summary]) => ({
        date,
        total_minutes: summary.total_minutes,
        activity_count: summary.activity_count,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return summaryArray;
  } catch (error) {
    console.error('Exception fetching exercise summary:', error);
    return [];
  }
}

/**
 * Fetch recent and frequent exercises for Quick Add
 * Returns combined list: frequent (top 8) + recent (top 8, excluding frequent), max 10 total
 * 
 * @param userId - The user's ID
 * @param days - Number of days to look back (default: 60)
 * @returns Array of exercises with name and minutes, max 10 items
 * 
 * Required index: exercise_log_user_date_idx ON exercise_log(user_id, date)
 * Note: This query scans recent logs and groups in-memory. For better performance with large datasets,
 * consider a precomputed stats table similar to user_food_stats (see guideline 6.1).
 */
export async function getRecentAndFrequentExercises(
  userId: string,
  days: number = 60
): Promise<Array<{ name: string; minutes: number | null }>> {
  if (!userId) {
    return [];
  }

  try {
    // Calculate the start date
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const startDateString = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('exercise_log')
      .select('name, minutes, created_at')
      .eq('user_id', userId)
      .gte('date', startDateString)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent/frequent exercises:', error);
      return [];
    }

    // Group by (name, minutes) combination
    const exerciseMap = new Map<string, { name: string; minutes: number | null; last_used: string; count: number }>();

    (data || []).forEach((log) => {
      const key = `${log.name}|${log.minutes ?? 'null'}`;
      const existing = exerciseMap.get(key);

      if (existing) {
        existing.count += 1;
        // Keep the most recent created_at
        if (log.created_at > existing.last_used) {
          existing.last_used = log.created_at;
        }
      } else {
        exerciseMap.set(key, {
          name: log.name,
          minutes: log.minutes,
          last_used: log.created_at,
          count: 1,
        });
      }
    });

    const allExercises = Array.from(exerciseMap.values());

    // 1. Frequent list: top 8 by frequency (desc), then recency (desc)
    const frequent = allExercises
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count; // Higher frequency first
        }
        return b.last_used.localeCompare(a.last_used); // More recent first
      })
      .slice(0, 8)
      .map(({ name, minutes }) => ({ name, minutes }));

    // 2. Recent list: top 8 by recency, excluding frequent items
    const frequentKeys = new Set(frequent.map((e) => `${e.name}|${e.minutes ?? 'null'}`));
    const recent = allExercises
      .filter((e) => !frequentKeys.has(`${e.name}|${e.minutes ?? 'null'}`))
      .sort((a, b) => b.last_used.localeCompare(a.last_used)) // Most recent first
      .slice(0, 8)
      .map(({ name, minutes }) => ({ name, minutes }));

    // 3. Combine: frequent first, then recent, max 10 total
    const combined = [...frequent, ...recent].slice(0, 10);

    return combined;
  } catch (error) {
    console.error('Exception fetching recent/frequent exercises:', error);
    return [];
  }
}

/**
 * @deprecated Use getRecentAndFrequentExercises instead
 * Kept for backwards compatibility
 */
export async function getRecentFrequentExercises(
  userId: string,
  days: number = 60
): Promise<Array<{ name: string; minutes: number | null; last_used: string; count: number }>> {
  if (!userId) {
    return [];
  }

  try {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const startDateString = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('exercise_log')
      .select('name, minutes, created_at')
      .eq('user_id', userId)
      .gte('date', startDateString)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent/frequent exercises:', error);
      return [];
    }

    const exerciseMap = new Map<string, { name: string; minutes: number | null; last_used: string; count: number }>();

    (data || []).forEach((log) => {
      const key = `${log.name}|${log.minutes ?? 'null'}`;
      const existing = exerciseMap.get(key);

      if (existing) {
        existing.count += 1;
        if (log.created_at > existing.last_used) {
          existing.last_used = log.created_at;
        }
      } else {
        exerciseMap.set(key, {
          name: log.name,
          minutes: log.minutes,
          last_used: log.created_at,
          count: 1,
        });
      }
    });

    const exerciseArray = Array.from(exerciseMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return b.last_used.localeCompare(a.last_used);
      });

    return exerciseArray;
  } catch (error) {
    console.error('Exception fetching recent/frequent exercises:', error);
    return [];
  }
}

/**
 * Create a new exercise log entry
 * 
 * @param entry - Partial ExerciseLog without id, created_at
 * @returns The created entry or null on error
 */
export async function createExerciseLog(
  entry: Omit<ExerciseLog, 'id' | 'created_at'>
): Promise<ExerciseLog | null> {
  try {
    const { data, error } = await supabase
      .from('exercise_log')
      .insert(entry)
      .select(EXERCISE_LOG_COLUMNS)
      .single();

    if (error) {
      console.error('Error creating exercise log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception creating exercise log:', error);
    return null;
  }
}

/**
 * Update an existing exercise log entry
 * 
 * @param logId - The log ID to update
 * @param updates - Partial fields to update
 * @returns The updated entry or null on error
 */
export async function updateExerciseLog(
  logId: string,
  updates: Partial<Pick<ExerciseLog, 'name' | 'minutes' | 'date' | 'notes'>>
): Promise<ExerciseLog | null> {
  try {
    const { data, error } = await supabase
      .from('exercise_log')
      .update(updates)
      .eq('id', logId)
      .select(EXERCISE_LOG_COLUMNS)
      .single();

    if (error) {
      console.error('Error updating exercise log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating exercise log:', error);
    return null;
  }
}

/**
 * Delete an exercise log entry
 * 
 * @param logId - The log ID to delete
 * @returns true on success, false on error
 */
export async function deleteExerciseLog(logId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('exercise_log')
      .delete()
      .eq('id', logId);

    if (error) {
      console.error('Error deleting exercise log:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting exercise log:', error);
    return false;
  }
}

