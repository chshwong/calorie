/**
 * DATA ACCESS SERVICE - Med Logs
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service is platform-agnostic and can be reused in React Native.
 */

import { supabase } from '@/lib/supabase';
import { getLocalDateKey } from '@/utils/dateTime';

// Type definition for med log
// Note: 'other' type is deprecated but may exist in legacy data (displayed as 'med')
export type MedLog = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD format
  name: string;
  type: 'med' | 'supp' | 'other'; // 'other' is legacy only, new entries must be 'med' or 'supp'
  dose_amount: number | null;
  dose_unit: string | null;
  notes: string | null;
  created_at: string;
};

// Columns to select - avoid select('*') per guideline 3.2
const MED_LOG_COLUMNS = `
  id,
  user_id,
  date,
  name,
  type,
  dose_amount,
  dose_unit,
  notes,
  created_at
`;

/**
 * Fetch med logs for a specific date
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Array of MedLog objects, or empty array on error
 * 
 * Required index: med_log_user_date_idx ON med_log(user_id, date)
 */
export async function getMedLogsForDate(
  userId: string,
  dateString: string
): Promise<MedLog[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('med_log')
      .select(MED_LOG_COLUMNS)
      .eq('user_id', userId)
      .eq('date', dateString)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching med logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching med logs:', error);
    return [];
  }
}

/**
 * Fetch med summary for recent days from daily_sum_meds table
 * 
 * @param userId - The user's ID
 * @param days - Number of recent days to fetch (default: 7)
 * @returns Array of objects with date, item_count, med_count, and supp_count
 * 
 * Required index: daily_sum_meds_user_date_desc_idx ON daily_sum_meds(user_id, date DESC)
 */
export async function getMedSummaryForRecentDays(
  userId: string,
  days: number = 7
): Promise<Array<{ date: string; item_count: number; med_count: number; supp_count: number }>> {
  if (!userId) {
    return [];
  }

  try {
    // Calculate the start date (days ago)
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));

    const startDateString = getLocalDateKey(startDate);
    const endDateString = getLocalDateKey(endDate);

    // Query daily_sum_meds table
    const { data, error } = await supabase
      .from('daily_sum_meds')
      .select('date, med_count, supp_count')
      .eq('user_id', userId)
      .gte('date', startDateString)
      .lte('date', endDateString)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching med summary:', error);
      return [];
    }

    // Map to UI-friendly shape: include med_count, supp_count, and item_count for backward compatibility
    const summaryArray = (data || []).map((row) => ({
      date: row.date,
      med_count: row.med_count || 0,
      supp_count: row.supp_count || 0,
      item_count: (row.med_count || 0) + (row.supp_count || 0),
    }));

    return summaryArray;
  } catch (error) {
    console.error('Exception fetching med summary:', error);
    return [];
  }
}

/**
 * Fetch recent and frequent meds for Quick Add
 * Returns combined list: frequent (top 8) + recent (top 8, excluding frequent), max 10 total
 * 
 * @param userId - The user's ID
 * @param days - Number of days to look back (default: 60)
 * @returns Array of meds with name, type, dose_amount, and dose_unit, max 10 items
 * 
 * Required index: med_log_user_date_idx ON med_log(user_id, date)
 */
export async function getRecentAndFrequentMeds(
  userId: string,
  days: number = 60
): Promise<Array<{ name: string; type: 'med' | 'supp'; dose_amount: number | null; dose_unit: string | null }>> {
  if (!userId) {
    return [];
  }

  try {
    // Calculate the start date
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const startDateString = getLocalDateKey(startDate);

    const { data, error } = await supabase
      .from('med_log')
      .select('name, type, dose_amount, dose_unit, created_at')
      .eq('user_id', userId)
      .gte('date', startDateString)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent/frequent meds:', error);
      return [];
    }

    // Group by (name, type, dose_amount, dose_unit) combination
    // Filter out 'other' type (legacy) - treat as 'med' if needed
    const medMap = new Map<string, { name: string; type: 'med' | 'supp'; dose_amount: number | null; dose_unit: string | null; last_used: string; count: number }>();

    (data || []).forEach((log) => {
      // Convert legacy 'other' type to 'med'
      const normalizedType = log.type === 'other' ? 'med' : (log.type === 'med' || log.type === 'supp' ? log.type : 'med');
      const key = `${log.name}|${normalizedType}|${log.dose_amount ?? 'null'}|${log.dose_unit ?? 'null'}`;
      const existing = medMap.get(key);

      if (existing) {
        existing.count += 1;
        // Keep the most recent created_at
        if (log.created_at > existing.last_used) {
          existing.last_used = log.created_at;
        }
      } else {
        medMap.set(key, {
          name: log.name,
          type: normalizedType,
          dose_amount: log.dose_amount,
          dose_unit: log.dose_unit,
          last_used: log.created_at,
          count: 1,
        });
      }
    });

    const allMeds = Array.from(medMap.values());

    // 1. Frequent list: top 8 by frequency (desc), then recency (desc)
    const frequent = allMeds
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count; // Higher frequency first
        }
        return b.last_used.localeCompare(a.last_used); // More recent first
      })
      .slice(0, 8)
      .map(({ name, type, dose_amount, dose_unit }) => ({ name, type, dose_amount, dose_unit }));

    // 2. Recent list: top 8 by recency, excluding frequent items
    const frequentKeys = new Set(frequent.map((m) => `${m.name}|${m.type}|${m.dose_amount ?? 'null'}|${m.dose_unit ?? 'null'}`));
    const recent = allMeds
      .filter((m) => !frequentKeys.has(`${m.name}|${m.type}|${m.dose_amount ?? 'null'}|${m.dose_unit ?? 'null'}`))
      .sort((a, b) => b.last_used.localeCompare(a.last_used)) // Most recent first
      .slice(0, 8)
      .map(({ name, type, dose_amount, dose_unit }) => ({ name, type, dose_amount, dose_unit }));

    // 3. Combine: frequent first, then recent, max 10 total
    const combined = [...frequent, ...recent].slice(0, 10);

    return combined;
  } catch (error) {
    console.error('Exception fetching recent/frequent meds:', error);
    return [];
  }
}

/**
 * Create a new med log entry
 * 
 * @param entry - Partial MedLog without id, created_at
 * @returns The created entry or null on error
 */
export async function createMedLog(
  entry: Omit<MedLog, 'id' | 'created_at'>
): Promise<MedLog | null> {
  try {
    const { data, error } = await supabase
      .from('med_log')
      .insert(entry)
      .select(MED_LOG_COLUMNS)
      .single();

    if (error) {
      console.error('Error creating med log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception creating med log:', error);
    return null;
  }
}

/**
 * Update an existing med log entry
 * 
 * @param logId - The log ID to update
 * @param updates - Partial fields to update
 * @returns The updated entry or null on error
 */
export async function updateMedLog(
  logId: string,
  updates: Partial<Pick<MedLog, 'name' | 'type' | 'dose_amount' | 'dose_unit' | 'date' | 'notes'>>
): Promise<MedLog | null> {
  try {
    const { data, error } = await supabase
      .from('med_log')
      .update(updates)
      .eq('id', logId)
      .select(MED_LOG_COLUMNS)
      .single();

    if (error) {
      console.error('Error updating med log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating med log:', error);
    return null;
  }
}

/**
 * Delete a med log entry
 * 
 * @param logId - The log ID to delete
 * @returns true on success, false on error
 */
export async function deleteMedLog(logId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('med_log')
      .delete()
      .eq('id', logId);

    if (error) {
      console.error('Error deleting med log:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting med log:', error);
    return false;
  }
}

