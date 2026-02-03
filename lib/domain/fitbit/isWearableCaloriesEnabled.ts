import type { UserConfig } from '@/lib/services/userConfig';

/**
 * Wearable Calories (TOTAL caloriesOut) gate.
 *
 * NOTE: Uses legacy preference name `profiles.sync_activity_burn`.
 *
 * Default behavior: enabled unless explicitly set to false.
 *
 * Important: This toggle controls syncing wearable TOTAL calories burned (Fitbit `caloriesOut`),
 * not Fitbit "activity calories".
 */
export function isWearableCaloriesEnabled(userConfig: UserConfig | null | undefined): boolean {
  return userConfig?.sync_activity_burn !== false;
}

