/**
 * DATA ACCESS SERVICE - User Config (Profile + Email)
 * 
 * This service fetches ALL user configuration data needed for:
 * - Identity (name, email)
 * - Preferences (units, language)
 * - Goals/Targets (calories, macros, fiber, sodium, sugar, weight goals)
 * - Activity/TDEE inputs
 * - Focus modules
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import { getUserProfile } from './profile';

/**
 * UserConfig type - unified profile + email data
 * This is the canonical type for all user configuration
 */
export type UserConfig = {
  // Identity
  user_id: string;
  email: string | null;
  first_name: string | null;
  avatar_url: string | null;
  
  // Preferences
  language_preference: string | null;
  weight_unit: 'kg' | 'lb' | null;
  // Explicit opt-in provider (future-proof enum-like string)
  weight_sync_provider: 'none' | 'fitbit' | null;
  /** When true, Sync Now will fetch and apply activity calories from Fitbit (default true). */
  sync_activity_burn: boolean | null;
  /** When true, Sync Now will also sync steps from Fitbit (last 7 local dates). */
  exercise_sync_steps: boolean | null;
  water_unit_preference: 'metric' | 'imperial' | null;
  water_unit: string | null;
  distance_unit: 'km' | 'mi' | null;
  
  // Exercise tracking preferences
  exercise_track_cardio_duration: boolean | null;
  exercise_track_cardio_distance: boolean | null;
  exercise_track_cardio_effort: boolean | null;
  exercise_track_strength_sets: boolean | null;
  exercise_track_strength_reps: boolean | null;
  exercise_track_strength_effort: boolean | null;
  
  // Daily Goals/Targets
  daily_calorie_goal: number | null;
  daily_calorie_goal_upper: number | null;
  // NOTE: daily_protein_goal_g is legacy. Do not use it for the Protein gauge.
  daily_protein_goal_g: number | null;
  max_carbs_goal_g: number | null;
  max_fats_goal_g: number | null;
  fibre_target_g: number | null;
  sodium_target_mg: number | null;
  sugar_target_g: number | null;

  // Onboarding target columns (authoritative targets)
  protein_g_min: number | null;
  fiber_g_min: number | null;
  carbs_g_max: number | null;
  sugar_g_max: number | null;
  sodium_mg_max: number | null;
  onboarding_targets_set_at: string | null;
  
  // Water goal
  water_goal_ml: number | null;
  
  // Weight Goals
  goal_weight_lb: number | null;
  goal_weight_kg: number | null;
  weight_goal_pace: number | null;
  weight_goal_target_date: string | null;
  
  // Activity/TDEE inputs
  activity_level: string | null;
  date_of_birth: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_lb: number | null;
  
  // Focus modules
  focus_module_1: string | null;
  focus_module_2: string | null;
  focus_module_3: string | null;
  
  // Status flags
  onboarding_complete: boolean | null;
  is_admin: boolean | null;
  is_active: boolean | null;
  
  // All other profile fields (for backward compatibility)
  [key: string]: any;
};

/**
 * Fetch complete user config (profile + email) by user ID
 * 
 * This is the canonical function that fetches ALL user configuration
 * needed for goals, targets, preferences, and color coding.
 * 
 * @param userId - The user's ID
 * @returns UserConfig object with profile + email, or null if not found/error
 */
export async function getUserConfig(userId: string): Promise<UserConfig | null> {
  if (!userId) {
    return null;
  }

  try {
    // Fetch profile from profiles table
    const profile = await getUserProfile(userId);
    
    if (!profile) {
      return null;
    }

    // Fetch email from auth.users (via auth.getUser)
    let email: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      email = user?.email ?? null;
    } catch (authError) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Could not fetch email from auth:', authError);
      }
      // Continue without email - profile data is still valid
    }

    // Merge profile + email into unified UserConfig
    const userConfig: UserConfig = {
      ...profile,
      email,
    };

    return userConfig;
  } catch (error) {
    console.error('Exception fetching user config:', error);
    return null;
  }
}

