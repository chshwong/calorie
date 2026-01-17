import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/Card";
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

  return (
    <Card style={styles.card}>
      <Text variant="label">{t("home.summary.title_other")}</Text>

      <View style={styles.row}>
        <Text tone="muted">{t("home.summary.total_calories")}</Text>
        <Text>
          {totals.calories} / {targets.calorieTarget}
        </Text>
      </View>

      <View style={styles.row}>
        <Text tone="muted">{t("home.summary.protein")}</Text>
        <Text>
          {totals.protein} / {targets.proteinTarget}
        </Text>
      </View>

      <View style={styles.row}>
        <Text tone="muted">{t("home.summary.carbs")}</Text>
        <Text>
          {totals.carbs} / {targets.carbsMax}
        </Text>
      </View>

      <View style={styles.row}>
        <Text tone="muted">{t("home.summary.fiber")}</Text>
        <Text>
          {totals.fiber} / {targets.fiberTarget}
        </Text>
      </View>

      <View style={styles.row}>
        <Text tone="muted">{t("home.summary.fat")}</Text>
        <Text>{totals.fat}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
