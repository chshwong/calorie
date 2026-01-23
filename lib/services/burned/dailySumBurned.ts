/**
 * DATA ACCESS SERVICE - Daily Burned Summary
 *
 * Components must NOT call Supabase directly.
 * All reads/writes for daily_sum_burned live here or in wrapper services.
 */

import { supabase } from '@/lib/supabase';
import type { DailySumBurned } from '@/utils/types';

// Columns to select - avoid select('*') per guidelines
export const DAILY_SUM_BURNED_COLUMNS = `
  id,
  user_id,
  entry_date,
  updated_at,

  bmr_cal,
  active_cal,
  tdee_cal,

  burn_reduction_pct_int,
  raw_burn,
  raw_tdee,
  raw_burn_source,
  raw_last_synced_at,

  system_bmr_cal,
  system_active_cal,
  system_tdee_cal,

  bmr_overridden,
  active_overridden,
  tdee_overridden,
  is_overridden,

  source,

  vendor_external_id,
  vendor_payload_hash,
  synced_at
`;

export async function getDailySumBurnedByDate(
  userId: string,
  entryDate: string
): Promise<DailySumBurned | null> {
  if (!userId || !entryDate) return null;

  const { data, error } = await supabase
    .from('daily_sum_burned')
    .select(DAILY_SUM_BURNED_COLUMNS)
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle();

  if (error) {
    console.error('Error fetching daily_sum_burned:', error);
    return null;
  }

  return (data as DailySumBurned) ?? null;
}

export async function getDailySumBurnedForRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailySumBurned[]> {
  if (!userId || !startDate || !endDate) return [];

  const { data, error } = await supabase
    .from('daily_sum_burned')
    .select(DAILY_SUM_BURNED_COLUMNS)
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true });

  if (error) {
    console.error('Error fetching daily_sum_burned range:', error);
    return [];
  }

  return (data as DailySumBurned[]) ?? [];
}

export async function insertDailySumBurned(
  row: Omit<DailySumBurned, 'id' | 'updated_at'>
): Promise<DailySumBurned | null> {
  const { data, error } = await supabase
    .from('daily_sum_burned')
    .insert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .select(DAILY_SUM_BURNED_COLUMNS)
    .single();

  if (error) {
    console.error('Error inserting daily_sum_burned:', error);
    return null;
  }

  return (data as DailySumBurned) ?? null;
}

export async function updateDailySumBurnedById(
  params: {
    userId: string;
    id: string;
    updates: Partial<DailySumBurned>;
  }
): Promise<DailySumBurned | null> {
  const { userId, id, updates } = params;
  if (!userId || !id) return null;

  const { data, error } = await supabase
    .from('daily_sum_burned')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select(DAILY_SUM_BURNED_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating daily_sum_burned:', error);
    return null;
  }

  return (data as DailySumBurned) ?? null;
}


