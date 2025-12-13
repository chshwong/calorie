import { roundTo2, roundTo3 } from '@/utils/bodyMetrics';
import { updateProfile } from './profileService';
import {
  fetchLatestBodyFatTimestamp,
  fetchLatestWeighInTimestamp,
  insertWeightLogRow,
  updateProfileBodyFat,
  updateProfileWeightLb,
} from './weightLogs';

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
  const weighedAtDate = new Date(input.weighedAt);
  const weight_lb = roundTo3(input.weightLb);
  const body_fat_percent =
    input.bodyFatPercent !== undefined && input.bodyFatPercent !== null
      ? roundTo2(input.bodyFatPercent)
      : null;
  const weight_unit = input.weightUnit === 'lb' ? 'lbs' : input.weightUnit || null;

  let insertedWeighedAt = weighedAtDate.toISOString();

  try {
    const inserted = await insertWeightLogRow({
      userId: input.userId,
      weighedAt: weighedAtDate,
      weightLb: weight_lb,
      bodyFatPercent: body_fat_percent ?? undefined,
    });
    insertedWeighedAt = inserted.weighed_at ?? insertedWeighedAt;
  } catch (insertError) {
    console.error('Error inserting weight_log (skipping profile sync)', insertError);
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

  const [latestWeightAt, latestBodyFatAt] = await Promise.all([
    fetchLatestWeighInTimestamp(input.userId),
    body_fat_percent !== null ? fetchLatestBodyFatTimestamp(input.userId) : Promise.resolve(null),
  ]);

  const updates: Record<string, any> = {};
  if (weight_unit) {
    updates.weight_unit = weight_unit;
  }

  const insertedMs = new Date(insertedWeighedAt).getTime();

  if (latestWeightAt && insertedMs >= new Date(latestWeightAt).getTime()) {
    updates.weight_lb = weight_lb;
  }

  if (
    body_fat_percent !== null &&
    latestBodyFatAt &&
    insertedMs >= new Date(latestBodyFatAt).getTime()
  ) {
    updates.body_fat_percent = body_fat_percent;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  if (updates.weight_lb !== undefined) {
    await updateProfileWeightLb(input.userId, updates.weight_lb);
    delete updates.weight_lb;
  }

  if (updates.body_fat_percent !== undefined) {
    await updateProfileBodyFat(input.userId, updates.body_fat_percent);
    delete updates.body_fat_percent;
  }

  if (Object.keys(updates).length > 0) {
    await updateProfile(input.userId, updates);
  }
}

