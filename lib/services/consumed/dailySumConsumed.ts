/**
 * DATA ACCESS SERVICE - Daily Consumed Summary
 *
 * Components must NOT call Supabase directly.
 * All reads/writes for daily_sum_consumed live here or in wrapper hooks.
 */

import { supabase } from '@/lib/supabase';
import type { DailyLogStatus, DailySumConsumed, DailySumConsumedMealRow } from '@/utils/types';

// Columns to select - avoid select('*') per guidelines
export const DAILY_SUM_CONSUMED_COLUMNS = `
  user_id,
  entry_date,

  calories,
  protein_g,
  carbs_g,
  fat_g,
  fibre_g,
  sugar_g,
  saturated_fat_g,
  trans_fat_g,
  sodium_mg,

  log_status,

  created_at,
  touched_at,
  status_updated_at,
  completed_at,
  last_recomputed_at,
  updated_at
`;

export async function getDailySumConsumedForRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailySumConsumed[]> {
  if (!userId || !startDate || !endDate) return [];

  const { data, error } = await supabase
    .from('daily_sum_consumed')
    .select(DAILY_SUM_CONSUMED_COLUMNS)
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true });

  if (error) {
    console.error('Error fetching daily_sum_consumed range:', error);
    return [];
  }

  return (data as DailySumConsumed[]) ?? [];
}

// Columns to select for daily_sum_consumed_meal - avoid select('*') per guidelines
export const DAILY_SUM_CONSUMED_MEAL_COLUMNS = `
  user_id,
  entry_date,
  meal_type,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  fibre_g,
  sugar_g,
  saturated_fat_g,
  trans_fat_g,
  sodium_mg,
  created_at,
  last_recomputed_at,
  updated_at
`;

export async function getDailySumConsumedMealForRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailySumConsumedMealRow[]> {
  if (!userId || !startDate || !endDate) return [];

  const { data, error } = await supabase
    .from('daily_sum_consumed_meal')
    .select(DAILY_SUM_CONSUMED_MEAL_COLUMNS)
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true })
    .order('meal_type', { ascending: true });

  if (error) {
    console.error('Error fetching daily_sum_consumed_meal range:', error);
    return [];
  }

  return (data as DailySumConsumedMealRow[]) ?? [];
}

export async function setDailyConsumedStatus(params: {
  entryDate: string;
  status: DailyLogStatus;
}): Promise<boolean> {
  const { entryDate, status } = params;
  if (!entryDate) return false;

  const { error } = await supabase.rpc('set_daily_consumed_status', {
    p_entry_date: entryDate,
    p_status: status,
  });

  if (error) {
    console.error('Error setting daily consumed status:', error);
    return false;
  }

  return true;
}

/**
 * Debug/repair: recompute a single day totals (does NOT update touched_at).
 */
export async function recomputeDailySumConsumed(entryDate: string): Promise<boolean> {
  if (!entryDate) return false;

  const { error } = await supabase.rpc('recompute_daily_sum_consumed', {
    p_entry_date: entryDate,
  });

  if (error) {
    console.error('Error recomputing daily_sum_consumed:', error);
    return false;
  }

  return true;
}

/**
 * Debug/repair: recompute a range totals (set-based; does NOT create missed days).
 * Returns number of upserted rows.
 */
export async function recomputeDailySumConsumedRange(params: {
  startDate: string;
  endDate: string;
}): Promise<number | null> {
  const { startDate, endDate } = params;
  if (!startDate || !endDate) return null;

  const { data, error } = await supabase.rpc('recompute_daily_sum_consumed_range', {
    p_start: startDate,
    p_end: endDate,
  });

  if (error) {
    console.error('Error recomputing daily_sum_consumed range:', error);
    return null;
  }

  // Postgrest returns scalar functions as `data` (number) for returns integer.
  return typeof data === 'number' ? data : null;
}


