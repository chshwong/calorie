/**
 * Streak State Service
 * 
 * Reads from existing streak_state table which tracks Login and Food streaks.
 * Uses the v_streaks view for simplified access.
 */

import { supabase } from '@/lib/supabase';

export type StreakState = {
  user_id: string;
  // Login streak
  login_current_days: number;
  login_pr_days: number;
  login_current_start_date: string | null;
  login_current_end_date: string | null;
  login_pr_end_date: string | null;
  // Food streak
  food_current_days: number;
  food_pr_days: number;
  food_current_start_date: string | null;
  food_current_end_date: string | null;
  food_pr_end_date: string | null;
  // Metadata
  last_recomputed_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Get streak state for the current user
 * 
 * @returns StreakState object or null on error
 */
export async function getStreakState(): Promise<StreakState | null> {
  try {
    const { data, error } = await supabase
      .from('streak_state')
      .select('*')
      .single();

    if (error) {
      // If no row exists, that's okay - streaks haven't been initialized yet
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching streak state:', error);
      return null;
    }

    return data as StreakState;
  } catch (error) {
    console.error('Exception fetching streak state:', error);
    return null;
  }
}

/**
 * Recompute streaks for the current user
 * 
 * Calls the existing RPC to recompute login and food streaks.
 * 
 * @returns true if successful, false otherwise
 */
export async function recomputeStreaks(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('recompute_my_streaks');

    if (error) {
      console.error('Error recomputing streaks:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception recomputing streaks:', error);
    return false;
  }
}

