import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText, TSpan } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { colors, fontSizes, spacing } from "@/theme/tokens";
import { useColorScheme } from "@/components/useColorScheme";
import { clamp, cubicPoint } from "@/components/gauges/arcMath";

type GoalType = "lose" | "maintain" | "recomp" | "gain";

type CurvyLineGaugeProps = {
  value: number; // remaining calories
  max: number; // daily target
  label?: string;
  goalType?: GoalType;
};

export function CurvyLineGauge({ value, max, label, goalType = "maintain" }: CurvyLineGaugeProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const safeTarget = Number.isFinite(max) && max > 0 ? max : 0;
  const remainingRaw = Number.isFinite(value) ? Math.round(value) : 0;
  const isOverBudget = safeTarget > 0 && remainingRaw < 0;
  const remainingAmount = safeTarget > 0 ? Math.abs(remainingRaw) : 0;

  const consumed = safeTarget > 0 ? safeTarget - remainingRaw : 0;
  const pct = safeTarget > 0 ? consumed / safeTarget : 0;
  const fillT = clamp(pct, 0, 1);

  const lineColor = useMemo(() => {
    if (safeTarget <= 0) return theme.textMuted;
    if (goalType === "lose") {
      if (pct > 1.1) return theme.chartRed;
      if (pct >= 1.0) return theme.chartPink;
      return theme.chartGreen;
    }
    if (goalType === "maintain" || goalType === "recomp") {
      if (pct > 1.25) return theme.chartRed;
      if (pct >= 1.1) return theme.chartPink;
      if (pct >= 1.0) return theme.appTeal;
      return theme.chartGreen;
    }
    if (pct > 1.25) return theme.chartPink;
    if (pct > 1.1) return theme.appTeal;
    if (pct >= 0.9) return theme.chartGreen;
    return theme.chartOrange;
  }, [goalType, pct, safeTarget, theme]);

  const vbW = 320;
  const p0 = { x: 24, y: 56 };
  const p1 = { x: 110, y: 24 };
  const p2 = { x: 210, y: 24 };
  const p3 = { x: 296, y: 56 };
  const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  const samples = 80;
  const points = Array.from({ length: samples + 1 }, (_, i) =>
    cubicPoint(i / samples, p0, p1, p2, p3)
  );
  const segLens = points.slice(1).map((pt, i) => {
    const prev = points[i];
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    return Math.sqrt(dx * dx + dy * dy);
  });
  const totalLen = segLens.reduce((a, b) => a + b, 0);
  const filledLen = totalLen * fillT;
  const tip = cubicPoint(fillT, p0, p1, p2, p3);

  const statusText = isOverBudget ? t("home.summary.over_budget") : t("home.summary.remaining");
  const labelText = label ?? `${t("home.food_log.kcal")} ${statusText}`;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={110} viewBox={`0 8 ${vbW} 100`}>
        <Path d={d} stroke={theme.chartGrey} strokeWidth={10} fill="none" strokeLinecap="round" />
        <Path
          d={d}
          stroke={lineColor}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filledLen} ${Math.max(0.001, totalLen - filledLen)}`}
        />
        <Circle cx={tip.x} cy={tip.y} r={4} fill={lineColor} />

        <SvgText
          x={vbW / 2}
          y={70}
          fontSize={fontSizes.body}
          fill={theme.text}
          textAnchor="middle"
        >
          <TSpan>
            {safeTarget > 0 ? `${remainingAmount} ${labelText}` : `-- ${labelText}`}
          </TSpan>
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 0,
    marginTop: 0,
    marginBottom: spacing.sm,
  },
});
