export type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "very_high";

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "high",
  "very_high",
];

export function validateActivityLevel(value: string | null | undefined): {
  ok: boolean;
  errorKey?: string;
} {
  if (!value) {
    return { ok: false, errorKey: "onboarding.activity.error_select_activity" };
  }
  if (!ACTIVITY_LEVELS.includes(value as ActivityLevel)) {
    return { ok: false, errorKey: "onboarding.activity.error_select_activity" };
  }
  return { ok: true };
}
