/**
 * DATA ACCESS SERVICE - Weight Logs
 *
 * Centralizes all Supabase access for weight logging.
 * Follows architecture guidelines:
 * - No direct Supabase calls from components/hooks
 * - Platform-agnostic functions (RN + web)
 */

import { supabase } from '@/lib/supabase';
import { roundTo2, roundTo3 } from '@/utils/bodyMetrics';
import { updateUserProfile } from '@/lib/services/profile';

export type WeightLogRow = {
  id: string;
  user_id: string;
  weighed_at: string;
  weight_lb: number;
  body_fat_percent: number | null;
  note: string | null;
};

const WEIGHT_LOG_COLUMNS = `
  id,
  user_id,
  weighed_at,
  weight_lb,
  body_fat_percent,
  note
`;

export async function fetchWeightLogsRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<WeightLogRow[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('weight_log')
      .select(WEIGHT_LOG_COLUMNS)
      .eq('user_id', userId)
      .gte('weighed_at', startISO)
      .lte('weighed_at', endISO)
      .order('weighed_at', { ascending: true });

    if (error) {
      console.error('Error fetching weight logs range', error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error('Exception fetching weight logs range', err);
    return [];
  }
}

export async function fetchEarliestWeighInDate(userId: string): Promise<string | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('weight_log')
      .select('weighed_at')
      .eq('user_id', userId)
      .order('weighed_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching earliest weigh-in date', error);
      return null;
    }

    return data?.weighed_at ?? null;
  } catch (err) {
    console.error('Exception fetching earliest weigh-in date', err);
    return null;
  }
}

export async function fetchLatestWeighInTimestamp(userId: string): Promise<string | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('weight_log')
      .select('weighed_at')
      .eq('user_id', userId)
      .order('weighed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest weigh-in timestamp', error);
      return null;
    }

    return data?.weighed_at ?? null;
  } catch (err) {
    console.error('Exception fetching latest weigh-in timestamp', err);
    return null;
  }
}

export async function fetchLatestBodyFatTimestamp(userId: string): Promise<string | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('weight_log')
      .select('weighed_at')
      .eq('user_id', userId)
      .not('body_fat_percent', 'is', null)
      .order('weighed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest body fat timestamp', error);
      return null;
    }

    return data?.weighed_at ?? null;
  } catch (err) {
    console.error('Exception fetching latest body fat timestamp', err);
    return null;
  }
}

/**
 * Fetch the most recent weigh-in at or before the given timestamp.
 * Used for historical "effective weight" computations.
 */
export async function fetchLatestWeighInAtOrBefore(
  userId: string,
  atOrBeforeISO: string
): Promise<{ weighed_at: string; weight_lb: number } | null> {
  if (!userId || !atOrBeforeISO) return null;

  try {
    const { data, error } = await supabase
      .from('weight_log')
      .select('weighed_at, weight_lb')
      .eq('user_id', userId)
      .lte('weighed_at', atOrBeforeISO)
      .order('weighed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest weigh-in at/before', error);
      return null;
    }

    if (!data) return null;
    return { weighed_at: data.weighed_at as string, weight_lb: data.weight_lb as number };
  } catch (err) {
    console.error('Exception fetching latest weigh-in at/before', err);
    return null;
  }
}

/**
 * Fetch the next weigh-in strictly after the given timestamp.
 * Used to bound the affected window when a weigh-in changes.
 */
export async function fetchNextWeighInAfter(
  userId: string,
  afterISO: string
): Promise<string | null> {
  if (!userId || !afterISO) return null;

  try {
    const { data, error } = await supabase
      .from('weight_log')
      .select('weighed_at')
      .eq('user_id', userId)
      .gt('weighed_at', afterISO)
      .order('weighed_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching next weigh-in after', error);
      return null;
    }

    return (data?.weighed_at as string | undefined) ?? null;
  } catch (err) {
    console.error('Exception fetching next weigh-in after', err);
    return null;
  }
}

export async function insertWeightLogRow(input: {
  userId: string;
  weighedAt: Date;
  weightLb: number;
  bodyFatPercent?: number | null;
  note?: string | null;
}): Promise<WeightLogRow> {
  if (!input.userId) {
    throw new Error('User ID is required to insert weight_log row');
  }

  const payload = {
    user_id: input.userId,
    weighed_at: input.weighedAt.toISOString(),
    weight_lb: roundTo3(input.weightLb),
    body_fat_percent:
      input.bodyFatPercent !== undefined && input.bodyFatPercent !== null
        ? roundTo2(input.bodyFatPercent)
        : null,
    note: input.note ?? null,
  };

  const { data, error } = await supabase
    .from('weight_log')
    .insert(payload)
    .select(WEIGHT_LOG_COLUMNS)
    .single();

  if (error) {
    console.error('Error inserting weight_log row', error);
    throw error;
  }

  return data;
}

export async function updateWeightLogRow(input: {
  id: string;
  weighedAt: Date;
  weightLb: number;
  bodyFatPercent?: number | null;
  note?: string | null;
}): Promise<WeightLogRow> {
  const payload = {
    weighed_at: input.weighedAt.toISOString(),
    weight_lb: roundTo3(input.weightLb),
    body_fat_percent:
      input.bodyFatPercent !== undefined && input.bodyFatPercent !== null
        ? roundTo2(input.bodyFatPercent)
        : null,
    note: input.note ?? null,
  };

  const { data, error } = await supabase
    .from('weight_log')
    .update(payload)
    .eq('id', input.id)
    .select(WEIGHT_LOG_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating weight_log row', error);
    throw error;
  }

  return data;
}

export async function updateProfileWeightLb(userId: string, weightLb: number) {
  if (!userId) throw new Error('User ID is required to update profile weight');

  await updateUserProfile(userId, { weight_lb: roundTo3(weightLb) });
}

export async function updateProfileBodyFat(userId: string, bodyFatPercent: number) {
  if (!userId) throw new Error('User ID is required to update profile body fat');

  await updateUserProfile(userId, { body_fat_percent: roundTo2(bodyFatPercent) });
}

export async function deleteWeightLogById(id: string) {
  if (!id) throw new Error('Missing weight_log id');

  const { error } = await supabase.from('weight_log').delete().eq('id', id);
  if (error) {
    console.error('Error deleting weight_log', error);
    throw error;
  }
}

export async function recomputeProfileWeightAndBodyFat(userId: string) {
  if (!userId) throw new Error('User ID is required to recompute profile weight/body fat');

  const { data: latestWeight, error: latestWeightError } = await supabase
    .from('weight_log')
    .select('weight_lb, weighed_at')
    .eq('user_id', userId)
    .order('weighed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestWeightError) {
    console.error('Error fetching latest weight for recompute', latestWeightError);
    throw latestWeightError;
  }

  const { data: latestBodyFat, error: latestBodyFatError } = await supabase
    .from('weight_log')
    .select('body_fat_percent, weighed_at')
    .eq('user_id', userId)
    .not('body_fat_percent', 'is', null)
    .order('weighed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestBodyFatError) {
    console.error('Error fetching latest body fat for recompute', latestBodyFatError);
    throw latestBodyFatError;
  }

  await updateUserProfile(userId, {
    weight_lb: latestWeight?.weight_lb ?? null,
    body_fat_percent: latestBodyFat?.body_fat_percent ?? null,
  });
}


