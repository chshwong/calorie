import { supabase } from "@/lib/supabaseClient";

type CompleteOnboardingInput = {
  userId: string;
  firstName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "not_telling";
  heightCm: number;
  weightLb: number;
};

export async function completeOnboardingProfile(input: CompleteOnboardingInput) {
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName,
      date_of_birth: input.dateOfBirth,
      gender: input.gender,
      height_cm: input.heightCm,
      weight_lb: input.weightLb,
      onboarding_complete: true,
    })
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { data: verifyData, error: verifyError } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("user_id", input.userId)
    .single();

  if (verifyError) {
    return { ok: false, error: `Failed to verify update: ${verifyError.message}` };
  }

  if (verifyData?.onboarding_complete !== true) {
    return { ok: false, error: "Update failed: onboarding_complete is not true after update" };
  }

  return { ok: true };
}
