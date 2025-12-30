import { supabase } from '@/lib/supabase';

/**
 * Delete all user-owned data from the database, then attempt to delete the auth user via Edge Function.
 *
 * Engineering guidelines:
 * - Components must NOT call Supabase directly (this service encapsulates DB + Edge calls).
 * - Never log PII or auth tokens.
 */
export async function deleteUserAccountData(params: { userId: string }): Promise<void> {
  const userId = params.userId;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // 1) Delete calorie entries
  {
    const { error } = await supabase.from('calorie_entries').delete().eq('user_id', userId);
    if (error) throw error;
  }

  // 2) Fetch bundle IDs (needed to delete bundle_items)
  const { data: userBundles, error: bundlesFetchError } = await supabase
    .from('bundles')
    .select('id')
    .eq('user_id', userId);

  if (bundlesFetchError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching bundles:', bundlesFetchError);
  }

  const bundleIds = userBundles?.map((b) => b.id) || [];

  // 3) Delete bundle_items for user's bundles (best-effort; CASCADE may cover some cases)
  if (bundleIds.length > 0) {
    const { error } = await supabase.from('bundle_items').delete().in('bundle_id', bundleIds);
    if (error && process.env.NODE_ENV !== 'production') {
      console.error('Error deleting bundle_items:', error);
    }
  }

  // 4) Delete bundles
  {
    const { error } = await supabase.from('bundles').delete().eq('user_id', userId);
    if (error) throw error;
  }

  // 5) Fetch custom food IDs (needed to delete food_servings)
  const { data: customFoods, error: foodsFetchError } = await supabase
    .from('food_master')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('is_custom', true);

  if (foodsFetchError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching custom foods:', foodsFetchError);
  }

  const foodIds = customFoods?.map((f) => f.id) || [];

  // 6) Delete food_servings for user's custom foods
  if (foodIds.length > 0) {
    const { error } = await supabase.from('food_servings').delete().in('food_id', foodIds);
    if (error) throw error;
  }

  // 7) Delete custom food_master entries
  {
    const { error } = await supabase
      .from('food_master')
      .delete()
      .eq('owner_user_id', userId)
      .eq('is_custom', true);
    if (error) throw error;
  }

  // 8) Delete the profile row
  {
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) throw error;
  }

  // 9) Best-effort: delete auth user via Edge Function (does not throw if it fails)
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('No session token available');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/delete-auth-user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to delete auth user: ${response.statusText}`);
    }

    const result = await response.json().catch(() => ({}));
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to delete auth user');
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error deleting auth user (profile and data already deleted):', err);
    }
  }
}


