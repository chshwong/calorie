import { supabase } from '@/lib/supabase';
import { updateProfile } from './profileService';
import { roundTo2, roundTo3 } from '@/utils/bodyMetrics';

type WeightEntryInput = {
  userId: string;
  weighedAt: Date | string;
  weightLb: number;
  bodyFatPercent?: number | null;
  weightUnit?: 'lb' | 'lbs' | 'kg';
};

/**
 * Inserts a weight log entry and conditionally updates profile fields
 * based on most recent weighed_at ordering.
 */
export async function insertWeightLogAndUpdateProfile(input: WeightEntryInput) {
  const weighed_at = new Date(input.weighedAt).toISOString();
  const weight_lb = roundTo3(input.weightLb);
  const body_fat_percent =
    input.bodyFatPercent !== undefined && input.bodyFatPercent !== null
      ? roundTo2(input.bodyFatPercent)
      : null;
  const weight_unit = input.weightUnit === 'lb' ? 'lbs' : input.weightUnit || null;

  // Insert log row
  const insertPayload: Record<string, any> = {
    user_id: input.userId,
    weighed_at,
    weight_lb,
    body_fat_percent,
  };
  // Only send weight_unit if the column exists; some deployments may not have it
  // Keep it out of the payload to avoid "column does not exist" errors.
  const { error: insertError } = await supabase.from('weight_log').insert(insertPayload);

  if (insertError) {
    console.error('Error inserting weight_log (skipping profile sync)', insertError);
    // Fallback: directly update profile with provided values (no recency guard possible)
    const fallbackUpdates: Record<string, any> = {};
    if (weight_unit) fallbackUpdates.weight_unit = weight_unit;
    fallbackUpdates.weight_lb = weight_lb;
    if (body_fat_percent !== null) {
      fallbackUpdates.body_fat_percent = body_fat_percent;
    }
    if (Object.keys(fallbackUpdates).length > 0) {
      await updateProfile(input.userId, fallbackUpdates);
    }
    return;
  }

  // If we cannot fetch latest entries (e.g., table lacks columns), silently exit after insert
  // Fetch most recent weight entry to guard profile updates
  const { data: latestWeight, error: weightFetchError } = await supabase
    .from('weight_log')
    .select('weighed_at, weight_lb')
    .eq('user_id', input.userId)
    .order('weighed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (weightFetchError) {
    console.error('Error fetching latest weight_log', weightFetchError);
  }

  // Fetch most recent body-fat entry where body_fat_percent is present
  const { data: latestBodyFat, error: bodyFetchError } = await supabase
    .from('weight_log')
    .select('weighed_at, body_fat_percent')
    .eq('user_id', input.userId)
    .not('body_fat_percent', 'is', null)
    .order('weighed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (bodyFetchError) {
    console.error('Error fetching latest body_fat entry', bodyFetchError);
  }

  const profileUpdates: Record<string, any> = {};
  if (weight_unit) {
    profileUpdates.weight_unit = weight_unit;
  }

  if (latestWeight?.weighed_at === weighed_at) {
    profileUpdates.weight_lb = weight_lb;
  }

  if (body_fat_percent !== null && latestBodyFat?.weighed_at === weighed_at) {
    profileUpdates.body_fat_percent = body_fat_percent;
  }

  if (Object.keys(profileUpdates).length === 0) {
    return;
  }

  await updateProfile(input.userId, profileUpdates);
}

