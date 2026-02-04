import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";

import { colors, fontSizes } from "@/theme/tokens";
import { useColorScheme } from "@/components/useColorScheme";
import { arcPath, clamp } from "@/components/gauges/arcMath";

type MiniNutrientGaugeProps = {
  title: string;
  value: number;
  unit: string;
  target?: number;
  fraction?: number;
  valueFormat?: "int" | "ceilToTenth";
  size?: "xs" | "sm";
};

const START_DEG = 234;
const END_DEG = -54;
const SPAN = 288;

const ceilTo1Decimal = (n: number) => Math.ceil(n * 10) / 10;

export function MiniNutrientGauge({
  title,
  value,
  unit,
  target,
  fraction,
  valueFormat = "int",
  size = "xs",
}: MiniNutrientGaugeProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const safeValue = Number.isFinite(value) ? value : 0;
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const pct =
    fraction !== undefined
      ? clamp(fraction, 0, 1)
      : clamp(safeTarget > 0 ? safeValue / safeTarget : 0, 0, 1);
  const angle = START_DEG - SPAN * pct;

  const pctOfTarget = safeTarget > 0 ? safeValue / safeTarget : 0;
  const isTransFat = valueFormat === "ceilToTenth";

  let fillColor = theme.chartGreen;
  if (isTransFat) {
    if (safeValue > 0) fillColor = theme.chartOrange;
    if (pctOfTarget >= 1) fillColor = theme.chartPink;
    if (pctOfTarget >= 1.25) fillColor = theme.chartRed;
  } else {
    if (pctOfTarget > 1.25) fillColor = theme.chartRed;
    else if (pctOfTarget >= 1) fillColor = theme.chartPink;
    else if (pctOfTarget >= 0.8) fillColor = theme.chartOrange;
  }

  const vbW = size === "xs" ? 92 : 110;
  const vbH = size === "xs" ? 80 : 90;
  const stroke = size === "xs" ? 5 : 6;
  const cx = vbW / 2;
  const r = size === "xs" ? 32 : 39;
  const cy = vbH / 2.5 + (size === "xs" ? 3 : 5);

  const fullArc = arcPath(cx, cy, r, START_DEG, END_DEG, 1);
  const filledArc = pct > 0 ? arcPath(cx, cy, r, START_DEG, angle, 1) : null;

  let displayValue: string;
  if (valueFormat === "ceilToTenth") {
    const v = safeValue <= 0 ? 0 : ceilTo1Decimal(safeValue);
    displayValue = v === 0 ? "0" : v.toFixed(1);
  } else {
    displayValue = String(Math.round(safeValue));
  }
  const valueText = unit ? `${displayValue}${unit}` : displayValue;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={vbH} viewBox={`0 0 ${vbW} ${vbH}`}>
        <Path d={fullArc} stroke={theme.chartGrey} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {filledArc ? (
          <Path d={filledArc} stroke={fillColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        ) : null}
        <SvgText
          x={cx}
          y={cy + (size === "xs" ? 2 : 6)}
          fontSize={size === "xs" ? fontSizes.caption : fontSizes.label}
          fill={theme.text}
          textAnchor="middle"
        >
          {valueText}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + (size === "xs" ? 14 : 26)}
          fontSize={size === "xs" ? fontSizes.caption : fontSizes.body}
          fill={theme.textMuted}
          textAnchor="middle"
        >
          {title}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
  },
});
