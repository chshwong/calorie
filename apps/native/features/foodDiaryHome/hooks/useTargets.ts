import { useMemo } from "react";

import { useUserConfig } from "@/features/foodDiaryHome/hooks/useUserConfig";

export function useTargets() {
  const { data: userConfig, isLoading } = useUserConfig();

  const targets = useMemo(
    () => ({
      calorieTarget: Number(userConfig?.daily_calorie_target ?? 0),
      proteinTarget: Number(userConfig?.protein_g_min ?? 0),
      fiberTarget: Number(userConfig?.fiber_g_min ?? 0),
      carbsMax: Number(userConfig?.carbs_g_max ?? 0),
      sugarMax: Number(userConfig?.sugar_g_max ?? 0),
      sodiumMax: Number(userConfig?.sodium_mg_max ?? 0),
      goalType: (userConfig?.goal_type ?? "maintain") as
        | "lose"
        | "maintain"
        | "recomp"
        | "gain",
    }),
    [userConfig]
  );

  return { targets, userConfig, isLoading };
}
