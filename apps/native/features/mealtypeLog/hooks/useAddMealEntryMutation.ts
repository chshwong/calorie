import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { toDateKey } from "@/lib/foodDiary/dateKey";
import type { CalorieEntry, MealType } from "@/lib/foodDiary/types";
import { createEntry } from "@/services/calorieEntries";
import type { FoodMaster } from "@/services/foodSearch";

type AddMealEntryInput = {
  food: FoodMaster;
  entryDate: string;
  mealType: MealType;
};

export function useAddMealEntryMutation() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ food, entryDate, mealType }: AddMealEntryInput) => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const dateKey = toDateKey(entryDate);
      const quantity = typeof food.serving_size === "number" ? food.serving_size : 1;
      const unit = food.serving_unit ?? "g";

      const payload: Omit<CalorieEntry, "id" | "created_at" | "updated_at"> = {
        user_id: userId,
        entry_date: dateKey,
        eaten_at: null,
        meal_type: mealType,
        item_name: food.name,
        food_id: food.id,
        serving_id: null,
        quantity,
        unit,
        calories_kcal: food.calories_kcal,
        protein_g: food.protein_g ?? null,
        carbs_g: food.carbs_g ?? null,
        fat_g: food.fat_g ?? null,
        fiber_g: food.fiber_g ?? null,
        saturated_fat_g: food.saturated_fat_g ?? null,
        trans_fat_g: food.trans_fat_g ?? null,
        sugar_g: food.sugar_g ?? null,
        sodium_mg: food.sodium_mg ?? null,
        notes: null,
        source: food.source ?? null,
        ai_raw_text: null,
        ai_confidence: null,
      };

      return createEntry(payload);
    },
    onSuccess: (created, { entryDate }) => {
      if (!userId) return;
      const dateKey = toDateKey(entryDate);
      const queryKey = ["entries", userId, dateKey] as const;

      queryClient.setQueryData<CalorieEntry[]>(queryKey, (prev) => {
        const list = prev ?? [];
        return [...list, created];
      });

      queryClient.invalidateQueries({ queryKey });
    },
  });
}
