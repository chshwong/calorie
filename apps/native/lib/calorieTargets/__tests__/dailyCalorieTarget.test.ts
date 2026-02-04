import { describe, it, expect } from "vitest";

import {
  clampCustomCalories,
  getCustomCalorieConfig,
  getMaintenancePresets,
  getMaintenanceRange,
  getMaintenanceSummary,
} from "../dailyCalorieTarget";

const baseInputs = {
  sexAtBirth: "female" as const,
  ageYears: 30,
  heightCm: 165,
  weightKg: 68,
  bodyFatPct: null,
  activityLevel: "moderate",
  currentWeightLb: 150,
  targetWeightLb: 150,
};

describe("daily calorie target logic", () => {
  it("computes maintenance range with expected BMR bounds", () => {
    const range = getMaintenanceRange({
      sexAtBirth: baseInputs.sexAtBirth,
      ageYears: baseInputs.ageYears,
      heightCm: baseInputs.heightCm,
      weightKg: baseInputs.weightKg,
      bodyFatPct: baseInputs.bodyFatPct,
      activityLevel: baseInputs.activityLevel,
    });

    expect(range.lowerBmr).toBe(1330);
    expect(range.upperBmr).toBe(1400);
    expect(range.lowerMaintenance).toBe(1940);
    expect(range.upperMaintenance).toBe(2170);
  });

  it("returns maintain presets in order with expected calories", () => {
    const result = getMaintenancePresets({
      ...baseInputs,
      goalType: "maintain",
    });

    expect(result.presets.map((preset) => preset.key)).toEqual([
      "leaner_side",
      "maintain",
      "flexible",
    ]);
    expect(result.presets.map((preset) => preset.caloriesPerDay)).toEqual([
      1950,
      2050,
      2175,
    ]);
    expect(result.recommendedKey).toBe("maintain");
  });

  it("applies rounding rules for maintenance summary and presets", () => {
    const summary = getMaintenanceSummary({
      ...baseInputs,
      goalType: "maintain",
    });

    expect(summary.lower).toBe(1940);
    expect(summary.upper).toBe(2170);
    expect(summary.mid).toBe(2060);
  });

  it("enforces custom calorie step size and bounds", () => {
    const config = getCustomCalorieConfig({
      ...baseInputs,
      goalType: "maintain",
    });

    expect(config.step).toBe(25);
    expect(config.min).toBe(700);
    expect(config.max).toBe(2470);

    const belowMin = clampCustomCalories(600, config);
    expect(belowMin).toBe(700);
    expect(belowMin).toBeGreaterThanOrEqual(config.min);
    expect(belowMin).toBeLessThanOrEqual(config.max);

    const aboveMax = clampCustomCalories(2500, config);
    expect(aboveMax).toBe(2450);
    expect(aboveMax).toBeGreaterThanOrEqual(config.min);
    expect(aboveMax).toBeLessThanOrEqual(config.max);

    const roundedDown = clampCustomCalories(2026, config);
    expect(roundedDown).toBe(2025);
  });
});
