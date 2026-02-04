export type GoalType = "lose" | "maintain" | "gain" | "recomp";

export const GOAL_TYPES: GoalType[] = ["lose", "maintain", "gain", "recomp"];

export function validateGoalType(value: string | null | undefined): {
  ok: boolean;
  errorKey?: string;
} {
  if (!value) {
    return { ok: false, errorKey: "onboarding.goal.error_select_goal" };
  }
  if (!GOAL_TYPES.includes(value as GoalType)) {
    return { ok: false, errorKey: "onboarding.goal.error_select_goal" };
  }
  return { ok: true };
}
