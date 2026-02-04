import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/Card";
import { DaySummaryGaugesSection } from "@/components/gauges/DaySummaryGaugesSection";
import { Text } from "@/components/ui/Text";
import { spacing } from "@/theme/tokens";
import type { DailyTotals } from "@/lib/foodDiary/types";

type DaySummaryCardProps = {
  totals: DailyTotals;
  targets: {
    calorieTarget: number;
    proteinTarget: number;
    fiberTarget: number;
    carbsMax: number;
    sugarMax: number;
    sodiumMax: number;
    goalType: "lose" | "maintain" | "recomp" | "gain";
  };
  isLoading: boolean;
};

export function DaySummaryCard({ totals, targets, isLoading }: DaySummaryCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card>
        <Text tone="muted">{t("home.summary.loading_entries")}</Text>
      </Card>
    );
  }

  const caloriesRemaining = targets.calorieTarget - totals.calories;

  return (
    <Card style={styles.card}>
      <Text variant="label">{t("home.summary.title_other")}</Text>
      <DaySummaryGaugesSection
        caloriesRemaining={caloriesRemaining}
        caloriesTarget={targets.calorieTarget}
        goalType={targets.goalType}
        proteinValue={totals.protein}
        proteinTarget={targets.proteinTarget}
        fiberValue={totals.fiber}
        fiberTarget={targets.fiberTarget}
        carbsValue={totals.carbs}
        carbsTarget={targets.carbsMax}
        sugarG={totals.sugar}
        sugarTarget={targets.sugarMax}
        sodiumMg={totals.sodium}
        sodiumTarget={targets.sodiumMax}
        satFatG={totals.saturatedFat}
        transFatG={totals.transFat}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
});
