import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";

type NutritionLabelRowProps = {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  indentLevel?: number;
};

function NutritionLabelRow({ label, value, bold = false, indentLevel = 0 }: NutritionLabelRowProps) {
  return (
    <View style={[styles.row, { paddingLeft: indentLevel * spacing.sm }]}>
      <Text variant={bold ? "label" : "body"}>{label}</Text>
      <View style={styles.value}>{value}</View>
    </View>
  );
}

export type NutritionLabelLayoutProps = {
  titleLabel?: string;
  titleInput: React.ReactNode;
  servingQuantityInput: React.ReactNode;
  servingUnitInput: React.ReactNode;
  hideServingRow?: boolean;
  caloriesLabel?: string;
  caloriesInput: React.ReactNode;
  fatInput: React.ReactNode;
  satFatInput: React.ReactNode;
  transFatInput: React.ReactNode;
  carbsInput: React.ReactNode;
  fiberInput: React.ReactNode;
  sugarInput: React.ReactNode;
  proteinInput: React.ReactNode;
  sodiumInput: React.ReactNode;
};

export function NutritionLabelLayout(props: NutritionLabelLayoutProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const formatNode = (node: React.ReactNode, decimals: 0 | 1): React.ReactNode => {
    const formatNumber = (value: any) => {
      const num = typeof value === "string" ? Number(value) : Number(value);
      if (!isFinite(num)) return value;
      return decimals === 0 ? Math.round(num).toString() : num.toFixed(decimals);
    };

    if (typeof node === "string" || typeof node === "number") {
      return formatNumber(node);
    }

    if (!React.isValidElement(node)) return node;
    if (node.type === TextInput) return node;

    const propsAny: any = node.props || {};
    const normalizedChildren =
      propsAny.children !== undefined
        ? React.Children.map(propsAny.children, (child) => formatNode(child, decimals))
        : propsAny.children;

    return React.cloneElement(node as any, {
      ...propsAny,
      children: normalizedChildren,
    });
  };

  const caloriesValueNode = formatNode(props.caloriesInput, 0);
  const fatValueNode = formatNode(props.fatInput, 0);
  const satFatValueNode = formatNode(props.satFatInput, 0);
  const transFatValueNode = formatNode(props.transFatInput, 0);
  const carbsValueNode = formatNode(props.carbsInput, 0);
  const fiberValueNode = formatNode(props.fiberInput, 0);
  const sugarValueNode = formatNode(props.sugarInput, 0);
  const proteinValueNode = formatNode(props.proteinInput, 0);
  const sodiumValueNode = formatNode(props.sodiumInput, 0);

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={styles.titleRow}>
        <Text variant="label">{props.titleLabel ?? t("nutrition_label.food_required")}</Text>
        <View style={styles.titleInput}>{props.titleInput}</View>
      </View>

      {!props.hideServingRow ? (
        <View style={styles.servingRow}>
          <Text variant="caption" tone="muted">
            {t("nutrition_label.per")}
          </Text>
          <View style={styles.servingValue}>{props.servingQuantityInput}</View>
          <Text variant="caption" tone="muted">
            {t("nutrition_label.qty_required")}
          </Text>
          <View style={styles.servingValue}>{props.servingUnitInput}</View>
          <Text variant="caption" tone="muted">
            {t("nutrition_label.unit_required")}
          </Text>
        </View>
      ) : null}

      <NutritionLabelRow
        label={props.caloriesLabel ?? t("nutrition_label.calories")}
        value={caloriesValueNode}
        bold
      />

      <NutritionLabelRow label={t("nutrition_label.fat")} value={fatValueNode} bold />
      <NutritionLabelRow
        label={t("nutrition_label.saturated")}
        value={satFatValueNode}
        indentLevel={1}
      />
      <NutritionLabelRow
        label={t("nutrition_label.trans_plus")}
        value={transFatValueNode}
        indentLevel={1}
      />

      <NutritionLabelRow label={t("nutrition_label.carbohydrate")} value={carbsValueNode} bold />
      <NutritionLabelRow
        label={t("nutrition_label.fibre")}
        value={fiberValueNode}
        indentLevel={1}
      />
      <NutritionLabelRow
        label={t("nutrition_label.sugars")}
        value={sugarValueNode}
        indentLevel={1}
      />

      <NutritionLabelRow label={t("nutrition_label.protein")} value={proteinValueNode} bold />
      <NutritionLabelRow label={t("nutrition_label.sodium")} value={sodiumValueNode} bold />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleInput: {
    flex: 1,
    alignItems: "flex-end",
  },
  servingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  servingValue: {
    minWidth: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    minWidth: 64,
    alignItems: "flex-end",
  },
});
