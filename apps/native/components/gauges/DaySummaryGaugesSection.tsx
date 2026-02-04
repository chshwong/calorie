import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CurvyLineGauge } from "@/components/gauges/CurvyLineGauge";
import { MacroGauge } from "@/components/gauges/MacroGauge";
import { MiniNutrientGauge } from "@/components/gauges/MiniNutrientGauge";
import { spacing } from "@/theme/tokens";
import { NUTRIENT_LIMITS } from "@/constants/nutrient-limits";

type DaySummaryGaugesSectionProps = {
  caloriesRemaining: number;
  caloriesTarget: number;
  goalType?: "lose" | "maintain" | "recomp" | "gain";
  proteinValue: number;
  proteinTarget: number;
  fiberValue: number;
  fiberTarget: number;
  carbsValue: number;
  carbsTarget: number;
  sugarG: number;
  sugarTarget?: number;
  sodiumMg: number;
  sodiumTarget?: number;
  satFatG: number;
  transFatG: number;
};

export function DaySummaryGaugesSection({
  caloriesRemaining,
  caloriesTarget,
  goalType,
  proteinValue,
  proteinTarget,
  fiberValue,
  fiberTarget,
  carbsValue,
  carbsTarget,
  sugarG,
  sugarTarget,
  sodiumMg,
  sodiumTarget,
  satFatG,
  transFatG,
}: DaySummaryGaugesSectionProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <CurvyLineGauge value={caloriesRemaining} max={caloriesTarget} goalType={goalType} />

      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <MacroGauge
            title={t("home.summary.protein")}
            value={proteinValue}
            target={proteinTarget}
            unit="g"
            size="sm"
            mode="min"
          />
        </View>
        <View style={styles.macroItem}>
          <MacroGauge
            title={t("home.summary.fiber")}
            value={fiberValue}
            target={fiberTarget}
            unit="g"
            size="sm"
            mode="min"
          />
        </View>
        <View style={styles.macroItem}>
          <MacroGauge
            title={t("home.summary.carbs")}
            value={carbsValue}
            target={carbsTarget}
            unit="g"
            size="sm"
            mode="max"
          />
        </View>
      </View>

      <View style={styles.miniRow}>
        <View style={styles.miniItem}>
          <MiniNutrientGauge
            title={t("home.summary.sugar")}
            value={sugarG}
            unit="g"
            target={sugarTarget}
          />
        </View>
        <View style={styles.miniItem}>
          <MiniNutrientGauge
            title={t("home.summary.sodium")}
            value={sodiumMg}
            unit="mg"
            target={sodiumTarget}
          />
        </View>
        <View style={styles.miniItem}>
          <MiniNutrientGauge
            title={t("home.summary.saturated_fat")}
            value={satFatG}
            unit="g"
            target={NUTRIENT_LIMITS.satFatG}
          />
        </View>
        <View style={styles.miniItem}>
          <MiniNutrientGauge
            title={t("home.summary.trans_fat")}
            value={transFatG}
            unit="g"
            target={NUTRIENT_LIMITS.transFatG}
            valueFormat="ceilToTenth"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  macroRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  macroItem: {
    flex: 1,
  },
  miniRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  miniItem: {
    flexBasis: "48%",
    flexGrow: 1,
  },
});
