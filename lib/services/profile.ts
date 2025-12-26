/**
 * DATA ACCESS SERVICE - User Profile
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';

/**
 * ProfileRow (local type)
 * NOTE: We use select('*') for profiles, so runtime includes all columns.
 * This type exists to ensure onboarding target columns are not "forgotten" in TS.
 */
export type ProfileRow = {
  user_id: string;
  first_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_lb?: number | null;
  height_unit?: string | null;
  weight_unit?: string | null;
  onboarding_complete?: boolean | null;

  // Onboarding target columns (authoritative)
  protein_g_min: number | null;
  fiber_g_min: number | null;
  carbs_g_max: number | null;
  sugar_g_max: number | null;
  sodium_mg_max: number | null;
  onboarding_targets_set_at: string | null;

  // Allow other columns without constantly updating this type
  [key: string]: any;
};

/**
 * Fetch user profile by user ID
 * 
 * @param userId - The user's ID
 * @returns Profile object or null if not found/error
 */
export async function getUserProfile(userId: string): Promise<ProfileRow | null> {
  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If profile doesn't exist (404/406), return null
      if (error.code === 'PGRST116' || error.message.includes('No rows')) {
        return null;
      }
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as ProfileRow;
  } catch (error) {
    console.error('Exception fetching profile:', error);
    return null;
  }
}

/**
 * Update user profile
 * 
 * @param userId - The user's ID
 * @param updates - Partial profile object with fields to update
 * @returns Updated profile object or null if error
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<any>
): Promise<any | null> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Exception updating profile:', error);
    throw error;
  }
}

