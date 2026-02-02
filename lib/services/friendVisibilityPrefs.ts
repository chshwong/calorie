/**
 * DATA ACCESS SERVICE - Friend visibility prefs (sharing preferences)
 *
 * Source of truth: public.friend_visibility_prefs (not profiles).
 * RPCs: rpc_get_friend_visibility_prefs, rpc_upsert_friend_visibility_prefs.
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';

export type FriendVisibilityPrefs = {
  show_protein: boolean;
  show_fibre: boolean;
  show_water: boolean;
  show_steps: boolean;
  show_food_streak: boolean;
};

const DEFAULT_PREFS: FriendVisibilityPrefs = {
  show_protein: true,
  show_fibre: true,
  show_water: true,
  show_steps: true,
  show_food_streak: true,
};

export async function fetchFriendVisibilityPrefs(): Promise<FriendVisibilityPrefs> {
  const { data, error } = await supabase.rpc('rpc_get_friend_visibility_prefs');

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fetchFriendVisibilityPrefs] RPC failed:', error);
    }
    return DEFAULT_PREFS;
  }

  const row = Array.isArray(data) ? data[0] : (data as any);
  if (!row) return DEFAULT_PREFS;

  return {
    show_protein: Boolean(row.show_protein),
    show_fibre: Boolean(row.show_fibre),
    show_water: Boolean(row.show_water),
    show_steps: Boolean(row.show_steps),
    show_food_streak: Boolean(row.show_food_streak),
  };
}

export async function upsertFriendVisibilityPrefs(prefs: FriendVisibilityPrefs): Promise<void> {
  const { error } = await supabase.rpc('rpc_upsert_friend_visibility_prefs', {
    p_show_protein: prefs.show_protein,
    p_show_fibre: prefs.show_fibre,
    p_show_water: prefs.show_water,
    p_show_steps: prefs.show_steps,
    p_show_food_streak: prefs.show_food_streak,
  });

  if (error) throw error;
}

