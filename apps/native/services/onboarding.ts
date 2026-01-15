import { supabase } from "@/lib/supabaseClient";

type CompleteOnboardingInput = {
  userId: string;
  firstName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "not_telling";
  heightCm: number;
  weightLb: number;
};

type StepOneInput = {
  userId: string;
  firstName: string;
  dateOfBirth: string;
  avatarUrl?: string | null;
};

export async function saveStepOneProfile(input: StepOneInput) {
  const payload: Record<string, string> = {
    first_name: input.firstName,
    date_of_birth: input.dateOfBirth,
  };

  if (input.avatarUrl) {
    payload.avatar_url = input.avatarUrl;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

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

type OnboardingProfile = {
  first_name: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  gender: "male" | "female" | null;
};

export async function fetchOnboardingProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, date_of_birth, avatar_url, gender")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116" || error.message.includes("No rows")) {
      return null;
    }
    throw new Error(error.message);
  }

  return (data ?? null) as OnboardingProfile | null;
}

type StepTwoInput = {
  userId: string;
  gender: "male" | "female";
};

export async function saveStepTwoProfile(input: StepTwoInput) {
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      gender: input.gender,
    })
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}
