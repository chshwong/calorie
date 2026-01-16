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
  height_cm: number | null;
  height_unit: "cm" | "ft" | null;
  activity_level: "sedentary" | "light" | "moderate" | "high" | "very_high" | null;
  weight_lb: number | null;
  weight_unit: "kg" | "lbs" | "lb" | null;
  body_fat_percent: number | null;
  goal_type: "lose" | "maintain" | "gain" | "recomp" | null;
  goal_weight_lb: number | null;
  daily_calorie_target: number | null;
  maintenance_calories: number | null;
  calorie_plan: string | null;
  onboarding_calorie_set_at: string | null;
  protein_g_min: number | null;
  fiber_g_min: number | null;
  carbs_g_max: number | null;
  sugar_g_max: number | null;
  sodium_mg_max: number | null;
  onboarding_targets_set_at: string | null;
  focus_module_1: "Food" | "Exercise" | "Med" | "Water" | null;
  focus_module_2: "Exercise" | "Med" | "Water" | null;
  focus_module_3: "Exercise" | "Med" | "Water" | null;
};

export async function fetchOnboardingProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "first_name, date_of_birth, avatar_url, gender, height_cm, height_unit, activity_level, weight_lb, weight_unit, body_fat_percent, goal_type, goal_weight_lb, daily_calorie_target, maintenance_calories, calorie_plan, onboarding_calorie_set_at, protein_g_min, fiber_g_min, carbs_g_max, sugar_g_max, sodium_mg_max, onboarding_targets_set_at, focus_module_1, focus_module_2, focus_module_3"
    )
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

type StepThreeInput = {
  userId: string;
  heightCm: number;
  heightUnit: "cm" | "ft";
};

export async function saveStepThreeProfile(input: StepThreeInput) {
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      height_cm: input.heightCm,
      height_unit: input.heightUnit,
    })
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

type StepFourInput = {
  userId: string;
  activityLevel: "sedentary" | "light" | "moderate" | "high" | "very_high";
};

export async function saveStepFourProfile(input: StepFourInput) {
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      activity_level: input.activityLevel,
    })
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

type StepFiveInput = {
  userId: string;
  weightLb: number;
  weightUnit: "kg" | "lbs";
  bodyFatPercent?: number;
};

export async function saveStepFiveProfile(input: StepFiveInput) {
  const payload: Record<string, number | string> = {
    weight_lb: input.weightLb,
    weight_unit: input.weightUnit,
  };

  if (input.bodyFatPercent !== undefined) {
    payload.body_fat_percent = input.bodyFatPercent;
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

type StepSixInput = {
  userId: string;
  goalType: "lose" | "maintain" | "gain" | "recomp";
};

export async function saveStepSixProfile(input: StepSixInput) {
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      goal_type: input.goalType,
    })
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

type StepSevenInput = {
  userId: string;
  goalWeightLb: number;
};

export async function saveStepSevenProfile(input: StepSevenInput) {
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      goal_weight_lb: input.goalWeightLb,
    })
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

type StepEightInput = {
  userId: string;
  dailyCalorieTarget: number;
  maintenanceCalories: number;
  caloriePlan: string;
};

export async function saveStepEightProfile(input: StepEightInput) {
  const payload: Record<string, number | string> = {
    daily_calorie_target: input.dailyCalorieTarget,
    maintenance_calories: input.maintenanceCalories,
    calorie_plan: input.caloriePlan,
    onboarding_calorie_set_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

type StepNineInput = {
  userId: string;
  proteinGMin: number;
  fiberGMin: number;
  carbsGMax: number;
  sugarGMax: number;
  sodiumMgMax: number;
};

export async function saveStepNineProfile(input: StepNineInput) {
  const payload: Record<string, number | string> = {
    protein_g_min: input.proteinGMin,
    fiber_g_min: input.fiberGMin,
    carbs_g_max: input.carbsGMax,
    sugar_g_max: input.sugarGMax,
    sodium_mg_max: input.sodiumMgMax,
    onboarding_targets_set_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

type ModulePreferencesInput = {
  userId: string;
  focusModule2: "Exercise" | "Med" | "Water";
  focusModule3: "Exercise" | "Med" | "Water";
};

export async function saveModulePreferences(input: ModulePreferencesInput) {
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      focus_module_1: "Food",
      focus_module_2: input.focusModule2,
      focus_module_3: input.focusModule3,
    })
    .eq("user_id", input.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

export type LegalDocType = "terms" | "privacy" | "health_disclaimer";

export type UserLegalAcceptance = {
  docType: LegalDocType;
  version: string;
  acceptedAt: string;
};

type SaveLegalAgreementsInput = {
  userId: string;
  documents: Array<{ docType: LegalDocType; version: string }>;
};

export async function fetchUserLegalAcceptances(userId: string): Promise<UserLegalAcceptance[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_legal_acceptances")
    .select("doc_type, version, accepted_at")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    docType: row.doc_type as LegalDocType,
    version: row.version,
    acceptedAt: row.accepted_at,
  }));
}

export async function saveLegalAgreements(input: SaveLegalAgreementsInput) {
  const rows = input.documents.map((doc) => ({
    user_id: input.userId,
    doc_type: doc.docType,
    version: doc.version,
  }));

  const { error: insertError } = await supabase
    .from("user_legal_acceptances")
    .insert(rows);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("user_id", input.userId);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  return { ok: true };
}
