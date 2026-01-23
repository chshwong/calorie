import type { DailySumBurned } from '@/utils/types';
import { applyRawToFinals as applyRawToFinalsService } from '@/lib/services/burned/saveDailySumBurned';

/**
 * Convenience wrapper for Sync flows.
 *
 * Authoritative behavior lives in the burned save service to avoid UI drift.
 */
export async function applyRawToFinals(params: {
  userId: string;
  dateInput: Date | string | number | null | undefined;
}): Promise<DailySumBurned | null> {
  return applyRawToFinalsService(params);
}

