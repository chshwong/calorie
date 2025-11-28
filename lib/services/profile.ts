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

