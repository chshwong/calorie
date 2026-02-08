import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { NutritionLabelLayout } from "@/components/NutritionLabelLayout";
import { MacroCompositionDonutChart } from "@/components/charts/MacroCompositionDonutChart";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { dateKeyToLocalStartOfDay } from "@/lib/foodDiary/date-guard";
import { toDateKey } from "@/lib/foodDiary/dateKey";
import type { CalorieEntry, DailyEntriesWithStatus } from "@/lib/foodDiary/types";
import { getFoodMasterById } from "@/lib/services/foodMaster";
import { getServingsForFood } from "@/lib/servings";
import { createEntry } from "@/services/calorieEntries";
import { spacing } from "@/theme/tokens";
import { computeAvoScore, normalizeAvoScoreInputToBasis } from "@/utils/avoScore";
import type { FoodMaster, FoodServing } from "@/utils/nutritionMath";
import {
    calculateNutrientsSimple,
    getDefaultServingSelection,
    getMasterUnitsFromServingOption,
    isVolumeUnit,
} from "@/utils/nutritionMath";

type FoodEditScreenProps = {
  date: string;
  mealType: string;
  foodId: string;
};

export function FoodEditScreen({ date, mealType, foodId }: FoodEditScreenProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const dateKey = useMemo(() => toDateKey(date), [date]);
  const locale = i18n.language === "fr" ? "fr-FR" : "en-US";
  const dateText = useMemo(() => {
    return dateKeyToLocalStartOfDay(dateKey).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [dateKey, locale]);

  const { data: foodMaster, isLoading: foodLoading } = useQuery<FoodMaster | null>({
    queryKey: ["foodMasterFull", foodId],
    enabled: Boolean(foodId),
    queryFn: () => (foodId ? getFoodMasterById(foodId) : Promise.resolve(null)),
  });

  const { data: servings = [], isLoading: servingsLoading } = useQuery<FoodServing[]>({
    queryKey: ["foodServings", foodId],
    enabled: Boolean(foodId),
    queryFn: () => (foodId ? getServingsForFood(foodId) : Promise.resolve([])),
  });

  const defaultSelection = useMemo(() => {
    if (!foodMaster) return null;
    return getDefaultServingSelection(foodMaster, servings);
  }, [foodMaster, servings]);

  const selectionOption = defaultSelection?.defaultOption ?? null;
  const selectionQuantity = defaultSelection?.quantity ?? 0;

  const selectionMasterUnits = useMemo(() => {
    if (!foodMaster || !selectionOption || selectionQuantity <= 0) return 0;
    return getMasterUnitsFromServingOption(selectionOption, selectionQuantity, foodMaster);
  }, [foodMaster, selectionOption, selectionQuantity]);

  const nutrients = useMemo(() => {
    if (!foodMaster || selectionMasterUnits <= 0) return null;
    return calculateNutrientsSimple(foodMaster, selectionMasterUnits);
  }, [foodMaster, selectionMasterUnits]);

  const avo = useMemo(() => {
    if (!nutrients) {
      return computeAvoScore({
        calories: 0,
        carbG: 0,
        fiberG: 0,
        proteinG: 0,
        fatG: 0,
        sugarG: 0,
        sodiumMg: 0,
        satFatG: 0,
        transFatG: 0,
      });
    }

    const baseInput = {
      calories: nutrients.calories_kcal,
      carbG: nutrients.carbs_g ?? 0,
      fiberG: nutrients.fiber_g ?? 0,
      proteinG: nutrients.protein_g ?? 0,
      fatG: nutrients.fat_g ?? 0,
      sugarG: nutrients.sugar_g ?? 0,
      sodiumMg: nutrients.sodium_mg ?? 0,
      satFatG: nutrients.saturated_fat_g ?? 0,
      transFatG: nutrients.trans_fat_g ?? 0,
    };

    const basis = isVolumeUnit(foodMaster?.serving_unit ?? "") ? "per100ml" : "per100g";
    const canNormalize = selectionMasterUnits > 0;
    const normalized = canNormalize
      ? normalizeAvoScoreInputToBasis(baseInput, selectionMasterUnits, basis)
      : baseInput;
    return computeAvoScore(normalized);
  }, [foodMaster?.serving_unit, nutrients, selectionMasterUnits]);

  const macroBasis = useMemo(() => {
    if (!nutrients) {
      return { carbG: 0, fiberG: 0, proteinG: 0, fatG: 0 };
    }

    const base = {
      carbG: nutrients.carbs_g ?? 0,
      fiberG: nutrients.fiber_g ?? 0,
      proteinG: nutrients.protein_g ?? 0,
      fatG: nutrients.fat_g ?? 0,
    };

    if (selectionMasterUnits <= 0) return base;
    const normalized = normalizeAvoScoreInputToBasis(
      {
        calories: 0,
        carbG: base.carbG,
        fiberG: base.fiberG,
        proteinG: base.proteinG,
        fatG: base.fatG,
        sugarG: 0,
        sodiumMg: 0,
        satFatG: 0,
        transFatG: 0,
      },
      selectionMasterUnits,
      isVolumeUnit(foodMaster?.serving_unit ?? "") ? "per100ml" : "per100g"
    );

    return {
      carbG: normalized.carbG,
      fiberG: normalized.fiberG,
      proteinG: normalized.proteinG,
      fatG: normalized.fatG,
    };
  }, [foodMaster?.serving_unit, nutrients, selectionMasterUnits]);

  const addEntryMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !foodMaster || !selectionOption || selectionQuantity <= 0 || !nutrients) {
        throw new Error("Missing required data for log");
      }

      const unitLabel =
        selectionOption.kind === "saved" ? selectionOption.label : selectionOption.unit;
      const servingId =
        selectionOption.kind === "saved" ? selectionOption.serving.id : null;

      const payload: Omit<CalorieEntry, "id" | "created_at" | "updated_at"> = {
        user_id: user.id,
        entry_date: dateKey,
        eaten_at: new Date().toISOString(),
        meal_type: mealType,
        item_name: foodMaster.brand ? `${foodMaster.name} (${foodMaster.brand})` : foodMaster.name,
        food_id: foodMaster.id,
        serving_id: servingId,
        quantity: selectionQuantity,
        unit: unitLabel,
        calories_kcal: Math.round(nutrients.calories_kcal),
        protein_g: round2(nutrients.protein_g),
        carbs_g: round2(nutrients.carbs_g),
        fat_g: round2(nutrients.fat_g),
        fiber_g: round2(nutrients.fiber_g),
        saturated_fat_g: round2(nutrients.saturated_fat_g),
        trans_fat_g: round2(nutrients.trans_fat_g),
        sugar_g: round2(nutrients.sugar_g),
        sodium_mg: round2(nutrients.sodium_mg),
        notes: null,
        source: foodMaster.source ?? null,
        ai_raw_text: null,
        ai_confidence: null,
      };

      return createEntry(payload);
    },
    onSuccess: (created) => {
      if (!user?.id) return;
      const queryKey = ["entries", user.id, dateKey] as const;
      queryClient.setQueryData<DailyEntriesWithStatus>(queryKey, (prev) => {
        const list = prev?.entries ?? [];
        return { entries: [...list, created], log_status: prev?.log_status ?? null };
      });
      queryClient.invalidateQueries({ queryKey });
      router.back();
    },
  });

  const handleLogNew = useCallback(() => {
    if (addEntryMutation.isPending) return;
    addEntryMutation.mutate();
  }, [addEntryMutation]);

  return (
    <Screen padding={0}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="title">{t("mealtype_log.title")}</Text>
          <Text variant="caption" tone="muted">
            {dateText}
          </Text>
        </View>
        <View style={styles.section}>
          <Text variant="label">{t(`mealtype_log.meal_types.${mealType}`)}</Text>
          {foodLoading ? (
            <ActivityIndicator />
          ) : foodMaster ? (
            <Text variant="caption" tone="muted">
              {foodMaster.name}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              {foodId}
            </Text>
          )}
          {servingsLoading ? (
            <ActivityIndicator />
          ) : servings.length > 0 ? (
            <Text variant="caption" tone="muted">
              {t("mealtype_log.food_log.item_other", { count: servings.length })}
            </Text>
          ) : null}
        </View>
        <View style={styles.section}>
          <NutritionLabelLayout
            titleInput={<Text>{foodMaster?.name ?? ""}</Text>}
            servingQuantityInput={<Text>{selectionQuantity || 0}</Text>}
            servingUnitInput={<Text>{selectionOption?.kind === "saved" ? selectionOption.label : selectionOption?.unit ?? ""}</Text>}
            caloriesInput={<Text>{nutrients ? Math.round(nutrients.calories_kcal) : 0}</Text>}
            fatInput={<Text>{nutrients?.fat_g ?? 0}</Text>}
            satFatInput={<Text>{nutrients?.saturated_fat_g ?? 0}</Text>}
            transFatInput={<Text>{nutrients?.trans_fat_g ?? 0}</Text>}
            carbsInput={<Text>{nutrients?.carbs_g ?? 0}</Text>}
            fiberInput={<Text>{nutrients?.fiber_g ?? 0}</Text>}
            sugarInput={<Text>{nutrients?.sugar_g ?? 0}</Text>}
            proteinInput={<Text>{nutrients?.protein_g ?? 0}</Text>}
            sodiumInput={<Text>{nutrients?.sodium_mg ?? 0}</Text>}
          />
        </View>
        <View style={styles.section}>
          <MacroCompositionDonutChart
            gramsCarbTotal={macroBasis.carbG}
            gramsFiber={macroBasis.fiberG}
            gramsProtein={macroBasis.proteinG}
            gramsFat={macroBasis.fatG}
            centerGrade={avo.grade}
            centerLabel={
              isVolumeUnit(foodMaster?.serving_unit ?? "") ? "avo_score.label_per_100ml" : "avo_score.label_per_100g"
            }
            centerReasons={avo.reasons}
          />
        </View>
        <View style={styles.actions}>
          <Button title={t("mealtype_log.buttons.cancel")} variant="ghost" onPress={() => router.back()} />
          <Button title={t("food.buttons.log_food")} onPress={handleLogNew} />
        </View>
      </View>
    </Screen>
  );
}

function round2(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    flex: 1,
  },
  header: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  actions: {
    marginTop: "auto",
    gap: spacing.sm,
  },
});
