import { ActivityLevel, ageFromDob, calculateBMR, calculateTDEE } from '@/utils/calculations';
import { lbToKg } from '@/utils/bodyMetrics';

export type SystemBurnedDefaultsInput = {
  gender: string | null | undefined;
  date_of_birth: string | null | undefined;
  height_cm: number | null | undefined;
  weight_lb: number | null | undefined;
  activity_level: string | null | undefined;
};

export type SystemBurnedDefaults = {
  system_bmr_cal: number;
  system_active_cal: number;
  system_tdee_cal: number;
};

const VALID_ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'high', 'very_high'];

export function computeSystemBurnedDefaults(input: SystemBurnedDefaultsInput): SystemBurnedDefaults | null {
  const sex = input.gender === 'male' || input.gender === 'female' ? input.gender : null;
  const dob = input.date_of_birth ?? null;
  const heightCm = typeof input.height_cm === 'number' ? input.height_cm : null;
  const weightLb = typeof input.weight_lb === 'number' ? input.weight_lb : null;
  const activity =
    input.activity_level && VALID_ACTIVITY_LEVELS.includes(input.activity_level as ActivityLevel)
      ? (input.activity_level as ActivityLevel)
      : null;

  if (!sex || !dob || !heightCm || !weightLb || !activity) {
    return null;
  }

  const age = ageFromDob(dob);
  if (!Number.isFinite(age) || age <= 0) {
    return null;
  }

  const weightKg = lbToKg(weightLb);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  const bmrRaw = calculateBMR(weightKg, heightCm, age, sex);
  const bmr = Math.max(0, Math.round(bmrRaw));

  const tdeeRaw = calculateTDEE(bmr, activity);
  const tdeeRounded = Math.max(0, Math.round(tdeeRaw));

  // Keep the invariant system_tdee_cal = system_bmr_cal + system_active_cal.
  const active = Math.max(0, tdeeRounded - bmr);
  const tdee = bmr + active;

  return {
    system_bmr_cal: bmr,
    system_active_cal: active,
    system_tdee_cal: tdee,
  };
}


