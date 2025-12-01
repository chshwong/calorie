import { supabase } from '@/lib/supabase';

/**
 * Updates a user's profile with the provided fields.
 * Only updates the fields that are provided (partial update).
 * Returns the updated profile or null on error.
 */
export async function updateProfile(
  userId: string,
  updates: {
    first_name?: string | null;
    date_of_birth?: string | null;
    gender?: 'male' | 'female' | 'not_telling' | null;
    height_cm?: number | null;
    weight_lb?: number | null;
    height_unit?: 'cm' | 'ft' | null;
    weight_unit?: 'lbs' | 'kg' | null;
    goal_type?: 'lose' | 'maintain' | 'gain' | 'recomp' | null;
    onboarding_complete?: boolean | null;
    [key: string]: any;
  }
): Promise<any | null> {
  try {
    // Filter out undefined values to allow partial updates
    const cleanUpdates: Record<string, any> = {};
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        cleanUpdates[key] = updates[key];
      }
    });

    const { data, error } = await supabase
      .from('profiles')
      .update(cleanUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }

    return data;
  } catch (error: any) {
    console.error('Exception in updateProfile:', error);
    return null;
  }
}

/**
 * Ensures a profile exists for the given user ID.
 * If the profile doesn't exist, creates one with onboarding_complete = false.
 * Returns the profile (existing or newly created).
 */
export async function ensureProfileExists(userId: string): Promise<any | null> {
  try {
    // First, try to fetch the existing profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      // Profile exists, return it
      return existingProfile;
    }

    // Profile doesn't exist (or fetch failed), create a new one
    if (fetchError && (fetchError.code === 'PGRST116' || fetchError.message?.includes('No rows'))) {
      // Profile doesn't exist, create it
      const newProfile = {
        user_id: userId,
        onboarding_complete: false,
        is_active: true,
        // All other fields will be null/defaults
      };

      // Try using the database function first if it exists
      let profileError = null;
      try {
        const { error: functionError } = await supabase.rpc('create_user_profile', {
          p_user_id: userId,
          p_first_name: null,
          p_date_of_birth: null,
          p_gender: null,
          p_height_cm: null,
          p_weight_lb: null,
          p_height_unit: null,
          p_weight_unit: null,
          p_onboarding_complete: false,
        });

        if (functionError) {
          // Function doesn't exist or failed, try direct insert
          profileError = functionError;
        } else {
          // Function succeeded, fetch the profile
          const { data: createdProfile, error: fetchCreatedError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (createdProfile) {
            return createdProfile;
          }
          if (fetchCreatedError) {
            profileError = fetchCreatedError;
          }
        }
      } catch (e: any) {
        // Function call failed, will try direct insert
        profileError = e;
      }

      // If function failed or doesn't exist, try direct insert
      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        // If insert fails due to duplicate key (profile was created by another process), try fetching again
        if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
          const { data: retryProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (retryProfile) {
            return retryProfile;
          }
        }
        return null;
      }

      return insertedProfile;
    }

    // If fetch error is something else, log it and return null
    console.error('Error fetching profile:', fetchError);
    return null;
  } catch (error: any) {
    console.error('Exception in ensureProfileExists:', error);
    return null;
  }
}

