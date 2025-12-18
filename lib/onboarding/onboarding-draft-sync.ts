/**
 * Onboarding Draft Sync Module
 * 
 * Provides optimistic draft saving with background sync for onboarding flow.
 * Ensures Next button is always instant except on final step.
 * 
 * Per engineering guidelines: Centralized data access and business logic
 */

import { updateProfile } from '@/lib/services/profileService';
import { QueryClient } from '@tanstack/react-query';

/**
 * Onboarding draft state - subset of profile fields collected during onboarding
 */
export type OnboardingDraft = {
  first_name?: string | null;
  date_of_birth?: string | null;
  gender?: 'male' | 'female' | 'not_telling' | null;
  height_cm?: number | null;
  height_unit?: 'cm' | 'ft' | null;
  weight_lb?: number | null;
  weight_unit?: 'lb' | 'lbs' | 'kg' | null;
  body_fat_percent?: number | null;
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | null;
  goal_type?: 'lose' | 'maintain' | 'gain' | 'recomp' | null;
  goal_weight_lb?: number | null;
  // Note: onboarding_complete is NOT in draft - only set on final flush
};

/**
 * Convert draft to profile update payload
 */
export function toProfileUpdate(draft: OnboardingDraft): Partial<{
  first_name: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'not_telling' | null;
  height_cm: number | null;
  height_unit: 'cm' | 'ft' | null;
  weight_lb: number | null;
  weight_unit: 'lb' | 'lbs' | 'kg' | null;
  body_fat_percent: number | null;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | null;
  goal_type: 'lose' | 'maintain' | 'gain' | 'recomp' | null;
  goal_weight_lb: number | null;
  [key: string]: any;
}> {
  const update: Record<string, any> = {};
  
  // Only include fields that are defined (not undefined)
  if (draft.first_name !== undefined) update.first_name = draft.first_name;
  if (draft.date_of_birth !== undefined) update.date_of_birth = draft.date_of_birth;
  if (draft.gender !== undefined) update.gender = draft.gender;
  if (draft.height_cm !== undefined) update.height_cm = draft.height_cm;
  if (draft.height_unit !== undefined) update.height_unit = draft.height_unit;
  if (draft.weight_lb !== undefined) update.weight_lb = draft.weight_lb;
  if (draft.weight_unit !== undefined) update.weight_unit = draft.weight_unit;
  if (draft.body_fat_percent !== undefined) update.body_fat_percent = draft.body_fat_percent;
  if (draft.activity_level !== undefined) update.activity_level = draft.activity_level;
  if (draft.goal_type !== undefined) update.goal_type = draft.goal_type;
  if (draft.goal_weight_lb !== undefined) update.goal_weight_lb = draft.goal_weight_lb;
  
  return update;
}

// Internal state for draft saving
let saveTimeoutId: NodeJS.Timeout | null = null;
let inFlightSave: Promise<void> | null = null;
let pendingDraft: OnboardingDraft | null = null;
let lastError: Error | null = null;
let lastAttemptAt: number | null = null;
let currentUserId: string | null = null;
let currentQueryClient: QueryClient | null = null;

const DEBOUNCE_MS = 500; // 500ms debounce (between 300-800ms as specified)

/**
 * Schedule a background save of the draft (debounced, fire-and-forget)
 * 
 * @param draft - The draft to save
 * @param userId - User ID
 * @param queryClient - React Query client for cache updates
 * @param reason - Reason for save (for logging)
 */
export function scheduleDraftSave(
  draft: OnboardingDraft,
  userId: string,
  queryClient: QueryClient,
  reason: string = 'step_next'
): void {
  currentUserId = userId;
  currentQueryClient = queryClient;
  pendingDraft = draft;
  
  // Clear existing timeout
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
    saveTimeoutId = null;
  }
  
  // Schedule new save
  saveTimeoutId = setTimeout(() => {
    saveTimeoutId = null;
    performDraftSave(reason);
  }, DEBOUNCE_MS);
}

/**
 * Perform the actual draft save (internal)
 */
async function performDraftSave(reason: string): Promise<void> {
  if (!pendingDraft || !currentUserId || !currentQueryClient) {
    return;
  }
  
  const draftToSave = pendingDraft;
  pendingDraft = null; // Clear pending before starting save
  
  // If there's already a save in flight, queue a follow-up
  if (inFlightSave) {
    // Wait for current save to finish, then save latest draft
    inFlightSave = inFlightSave
      .then(() => {
        // After current save completes, check if there's a newer draft
        if (pendingDraft) {
          const latestDraft = pendingDraft;
          pendingDraft = null;
          return performDraftSave('follow_up');
        }
        return Promise.resolve();
      })
      .catch(() => {
        // If current save failed, still try to save latest draft
        if (pendingDraft) {
          const latestDraft = pendingDraft;
          pendingDraft = null;
          return performDraftSave('follow_up_after_error');
        }
        return Promise.resolve();
      });
    return;
  }
  
  // Start new save
  inFlightSave = (async () => {
    try {
      const updateData = toProfileUpdate(draftToSave);
      lastAttemptAt = Date.now();
      
      const updatedProfile = await updateProfile(currentUserId, updateData);
      
      if (!updatedProfile) {
        throw new Error('Failed to save draft');
      }
      
      // Update React Query cache with the draft (optimistic update)
      // This keeps the app consistent even if network is slow
      currentQueryClient.setQueryData(['userProfile', currentUserId], updatedProfile);
      
      lastError = null;
    } catch (error: any) {
      lastError = error;
      lastAttemptAt = Date.now();
      // Do not throw - background saves are best-effort
    } finally {
      inFlightSave = null;
      
      // If a newer draft arrived while we were saving, queue another save
      if (pendingDraft) {
        const latestDraft = pendingDraft;
        pendingDraft = null;
        // Use a small delay to avoid rapid-fire saves
        setTimeout(() => {
          performDraftSave('latest_wins');
        }, 100);
      }
    }
  })();
}

/**
 * Flush draft save - awaits the latest save and retries once if it failed
 * 
 * @param draft - The draft to ensure is saved
 * @param userId - User ID
 * @param queryClient - React Query client
 * @returns Promise that resolves when save is complete
 */
export async function flushDraftSave(
  draft: OnboardingDraft,
  userId: string,
  queryClient: QueryClient
): Promise<void> {
  // Clear any pending debounced save
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
    saveTimeoutId = null;
  }
  
  // Update pending draft to latest
  pendingDraft = draft;
  currentUserId = userId;
  currentQueryClient = queryClient;
  
  // Wait for any in-flight save to complete
  if (inFlightSave) {
    await inFlightSave;
  }
  
  // If there's still a pending draft (or last save failed), save it now
  if (pendingDraft || lastError) {
    const draftToFlush = pendingDraft || draft;
    pendingDraft = null;
    
    try {
      const updateData = toProfileUpdate(draftToFlush);
      lastAttemptAt = Date.now();
      
      const updatedProfile = await updateProfile(userId, updateData);
      
      if (!updatedProfile) {
        throw new Error('Failed to flush draft');
      }
      
      // Update cache
      queryClient.setQueryData(['userProfile', userId], updatedProfile);
      
      lastError = null;
    } catch (error: any) {
      lastError = error;
      lastAttemptAt = Date.now();
      
      // Retry once
      try {
        const updateData = toProfileUpdate(draftToFlush);
        const updatedProfile = await updateProfile(userId, updateData);
        
        if (!updatedProfile) {
          throw new Error('Failed to flush draft on retry');
        }
        
        queryClient.setQueryData(['userProfile', userId], updatedProfile);
        lastError = null;
      } catch (retryError: any) {
        lastError = retryError;
        lastAttemptAt = Date.now();
        throw retryError; // Re-throw on retry failure
      }
    }
  }
}

/**
 * Get last error (for debugging)
 */
export function getLastDraftError(): { error: Error | null; attemptedAt: number | null } {
  return { error: lastError, attemptedAt: lastAttemptAt };
}

/**
 * Clear draft sync state (for testing/cleanup)
 */
export function clearDraftSyncState(): void {
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
    saveTimeoutId = null;
  }
  inFlightSave = null;
  pendingDraft = null;
  lastError = null;
  lastAttemptAt = null;
  currentUserId = null;
  currentQueryClient = null;
}

