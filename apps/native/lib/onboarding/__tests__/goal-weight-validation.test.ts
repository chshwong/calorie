import { describe, expect, it } from "vitest";

import { PROFILES } from "@/constants/constraints";
import { getGoalWeightRange } from "@/lib/onboarding/goal-weight-validation";

describe("getGoalWeightRange recommendations", () => {
  it("returns null recommendation for gain at global max", () => {
    const range = getGoalWeightRange({
      currentWeightLb: PROFILES.WEIGHT_LB.MAX,
      goalType: "gain",
    });
    expect(range.recommendedLb).toBeNull();
  });

  it("returns null recommendation for lose at global min", () => {
    const range = getGoalWeightRange({
      currentWeightLb: PROFILES.WEIGHT_LB.MIN,
      goalType: "lose",
    });
    expect(range.recommendedLb).toBeNull();
  });

  it("returns a valid recommendation for typical gain/lose", () => {
    const gainRange = getGoalWeightRange({ currentWeightLb: 200, goalType: "gain" });
    expect(gainRange.recommendedLb).toBe(201);

    const loseRange = getGoalWeightRange({ currentWeightLb: 200, goalType: "lose" });
    expect(loseRange.recommendedLb).toBe(199);
  });
});
