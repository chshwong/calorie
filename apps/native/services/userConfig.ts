import { supabase } from "@/lib/supabaseClient";
import { getUserProfile } from "@/services/profile";

export type UserConfig = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  avatar_url: string | null;

  language_preference: string | null;
  weight_unit: "kg" | "lb" | null;
  water_unit_preference: "metric" | "imperial" | null;
  water_unit: string | null;
  distance_unit: "km" | "mi" | null;

  exercise_track_cardio_duration: boolean | null;
  exercise_track_cardio_distance: boolean | null;
  exercise_track_cardio_effort: boolean | null;
  exercise_track_strength_sets: boolean | null;
  exercise_track_strength_reps: boolean | null;
  exercise_track_strength_effort: boolean | null;

  daily_calorie_goal: number | null;
  daily_calorie_goal_upper: number | null;
  daily_protein_goal_g: number | null;
  max_carbs_goal_g: number | null;
  max_fats_goal_g: number | null;
  fibre_target_g: number | null;
  sodium_target_mg: number | null;
  sugar_target_g: number | null;
  daily_calorie_target: number | null;
  goal_type: "lose" | "maintain" | "recomp" | "gain" | null;

  protein_g_min: number | null;
  fiber_g_min: number | null;
  carbs_g_max: number | null;
  sugar_g_max: number | null;
  sodium_mg_max: number | null;
  onboarding_targets_set_at: string | null;

  water_goal_ml: number | null;
  goal_weight_lb: number | null;
  goal_weight_kg: number | null;
  weight_goal_pace: number | null;
  weight_goal_target_date: string | null;

  activity_level: string | null;
  date_of_birth: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_lb: number | null;

  focus_module_1: string | null;
  focus_module_2: string | null;
  focus_module_3: string | null;

  onboarding_complete: boolean | null;
  is_admin: boolean | null;
  is_active: boolean | null;

  [key: string]: any;
};

export async function getUserConfig(userId: string): Promise<UserConfig | null> {
  if (!userId) {
    return null;
  }

  try {
    const profile = await getUserProfile(userId);
    if (!profile) {
      return null;
    }

    let email: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      email = data.user?.email ?? null;
    } catch (authError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[userConfig] auth email fetch failed", authError);
      }
    }

    const userConfig: UserConfig = {
      ...profile,
      email,
    };

    return userConfig;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[userConfig] fetch exception", error);
    }
    return null;
  }
}
