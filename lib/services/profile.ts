/**
 * DATA ACCESS SERVICE - User Profile
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';

/**
 * Fetch user profile by user ID
 * 
 * @param userId - The user's ID
 * @returns Profile object or null if not found/error
 */
export async function getUserProfile(userId: string): Promise<any | null> {
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

    return data;
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

