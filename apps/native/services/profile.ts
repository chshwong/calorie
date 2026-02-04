import { supabase } from "@/lib/supabaseClient";

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

  protein_g_min: number | null;
  fiber_g_min: number | null;
  carbs_g_max: number | null;
  sugar_g_max: number | null;
  sodium_mg_max: number | null;
  onboarding_targets_set_at: string | null;

  [key: string]: any;
};

export async function getUserProfile(userId: string): Promise<ProfileRow | null> {
  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116" || error.message.includes("No rows")) {
        return null;
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn("[profile] fetch error", error.message);
      }
      return null;
    }

    return data as ProfileRow;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[profile] fetch exception", error);
    }
    return null;
  }
}
