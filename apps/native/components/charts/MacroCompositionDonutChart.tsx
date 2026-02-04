import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { useColorScheme } from "@/components/useColorScheme";
import { colors, fontSizes, radius, spacing } from "@/theme/tokens";
import type { AvoScoreGrade } from "@/utils/avoScore";

type MacroCompositionDonutChartProps = {
  gramsCarbTotal: number;
  gramsFiber: number;
  gramsProtein: number;
  gramsFat: number;
  size?: number;
  strokeWidthInner?: number;
  strokeWidthOuter?: number;
  gapDegrees?: number;
  minLabelPercent?: number;
  showTooltips?: boolean;
  showGrams?: boolean;
  centerGrade?: AvoScoreGrade;
  centerLabel?: string;
  centerReasons?: string[];
  getGradeColor?: (grade: AvoScoreGrade, colors: ThemeColors) => string;
  style?: ViewStyle;
};

type ThemeColors = {
  text: string;
  textSecondary: string;
  backgroundSecondary: string;
  border: string;
  tint: string;
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const arcPath = (cx: number, cy: number, r: number, start: number, end: number, sweepFlag: 0 | 1) => {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 ${sweepFlag} ${e.x} ${e.y}`;
};

const donutArcPath = (
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  start: number,
  end: number,
  sweepFlag: 0 | 1
) => {
  const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
  const startOuter = polar(cx, cy, outerR, start);
  const endOuter = polar(cx, cy, outerR, end);
  const endInner = polar(cx, cy, innerR, end);
  const startInner = polar(cx, cy, innerR, start);
  return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArc} ${sweepFlag} ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${innerR} ${innerR} 0 ${largeArc} ${1 - sweepFlag} ${startInner.x} ${startInner.y} Z`;
};

type MacroSegment = {
  name: string;
  percent: number;
  startAngle: number;
  endAngle: number;
  color: string;
  grams: number;
  kcal: number;
};

export function MacroCompositionDonutChart({
  gramsCarbTotal,
  gramsFiber,
  gramsProtein,
  gramsFat,
  size = 220,
  strokeWidthInner = 18,
  strokeWidthOuter = 12,
  gapDegrees = 1.2,
  minLabelPercent = 0,
  showTooltips = false,
  showGrams = false,
  centerGrade,
  centerLabel,
  centerReasons,
  getGradeColor,
  style,
}: MacroCompositionDonutChartProps) {
  const { t } = useTranslation();
  const translateMaybe = (keyOrText: string) => t(keyOrText, { defaultValue: keyOrText });
  const formatPercent = (percent: number) => {
    const rounded = Math.round(percent);
    if (rounded === 0 && percent > 0) {
      return translateMaybe("common.less_than_one_percent");
    }
    return `${rounded}%`;
  };

  const macroLabel = (name: string) => {
    switch (name) {
      case "Protein":
        return translateMaybe("nutrition.protein");
      case "Fat":
        return translateMaybe("nutrition.fat");
      case "Fiber":
        return translateMaybe("nutrition.fiber");
      case "Net Carb":
        return translateMaybe("nutrition.net_carb");
      case "Carbs":
        return translateMaybe("nutrition.carbs");
      default:
        return translateMaybe(name);
    }
  };

  const scheme = useColorScheme();
  const theme = getThemeColors(scheme ?? "light");
  const macroColors = getMacroColors();
  const centerLabelText = translateMaybe(centerLabel ?? "avo_score.label");
  const reasons = (centerReasons ?? []).filter(Boolean).slice(0, 2).map(translateMaybe);

  const gramsNetCarb = Math.max(gramsCarbTotal - gramsFiber, 0);
  const kcalNetCarb = gramsNetCarb * 4;
  const kcalProtein = gramsProtein * 4;
  const kcalFat = gramsFat * 9;
  const kcalFiber = gramsFiber * 2;

  const kcalCarbsTotal = kcalNetCarb + kcalFiber;
  const totalKcal = kcalCarbsTotal + kcalProtein + kcalFat;

  const segments = useMemo<MacroSegment[]>(() => {
    if (totalKcal <= 0) return [];

    const entries = [
      { name: "Carbs", kcal: kcalCarbsTotal, grams: gramsCarbTotal, color: macroColors.carb },
      { name: "Protein", kcal: kcalProtein, grams: gramsProtein, color: macroColors.protein },
      { name: "Fat", kcal: kcalFat, grams: gramsFat, color: macroColors.fat },
    ];

    const angleStart = -90;
    let runningAngle = angleStart;
    return entries.map((entry) => {
      const percent = (entry.kcal / totalKcal) * 100;
      const angle = (entry.kcal / totalKcal) * 360;
      const startAngle = runningAngle + gapDegrees / 2;
      const endAngle = runningAngle + angle - gapDegrees / 2;
      runningAngle += angle;
      return {
        name: entry.name,
        percent,
        startAngle,
        endAngle,
        color: entry.color,
        grams: entry.grams,
        kcal: entry.kcal,
      };
    });
  }, [gapDegrees, gramsCarbTotal, gramsFat, gramsProtein, kcalCarbsTotal, kcalFat, kcalProtein, macroColors, totalKcal]);

  const outerSegments = useMemo<MacroSegment[]>(() => {
    if (totalKcal <= 0 || kcalCarbsTotal <= 0) return [];
    const angleStart = segments.find((s) => s.name === "Carbs")?.startAngle ?? -90;
    const angleEnd = segments.find((s) => s.name === "Carbs")?.endAngle ?? -90;
    const carbSpan = angleEnd - angleStart;
    const fiberAngle = (kcalFiber / kcalCarbsTotal) * carbSpan;
    const netCarbAngle = (kcalNetCarb / kcalCarbsTotal) * carbSpan;
    return [
      {
        name: "Fiber",
        percent: (kcalFiber / totalKcal) * 100,
        startAngle: angleStart + gapDegrees / 2,
        endAngle: angleStart + fiberAngle - gapDegrees / 2,
        color: macroColors.fiber,
        grams: gramsFiber,
        kcal: kcalFiber,
      },
      {
        name: "Net Carb",
        percent: (kcalNetCarb / totalKcal) * 100,
        startAngle: angleStart + fiberAngle + gapDegrees / 2,
        endAngle: angleStart + fiberAngle + netCarbAngle - gapDegrees / 2,
        color: macroColors.carb,
        grams: gramsNetCarb,
        kcal: kcalNetCarb,
      },
    ];
  }, [
    gapDegrees,
    gramsFiber,
    gramsNetCarb,
    kcalCarbsTotal,
    kcalFiber,
    kcalNetCarb,
    segments,
    totalKcal,
    macroColors,
  ]);

  const innerR = size / 2 - strokeWidthInner;
  const outerR = size / 2;

  const gradeColor = centerGrade
    ? getGradeColor?.(centerGrade, theme) ?? theme.tint
    : theme.tint;

  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={innerR} stroke={theme.border} strokeWidth={strokeWidthInner} fill="none" />
        {segments.map((segment) => (
          <Path
            key={segment.name}
            d={arcPath(size / 2, size / 2, innerR, segment.startAngle, segment.endAngle, 1)}
            stroke={segment.color}
            strokeWidth={strokeWidthInner}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {outerSegments.map((segment) => (
          <Path
            key={segment.name}
            d={donutArcPath(size / 2, size / 2, innerR - strokeWidthOuter, innerR, segment.startAngle, segment.endAngle, 1)}
            fill={segment.color}
          />
        ))}

        {segments
          .filter((segment) => segment.percent >= minLabelPercent)
          .map((segment) => {
            const mid = (segment.startAngle + segment.endAngle) / 2;
            const labelPos = polar(size / 2, size / 2, outerR + 14, mid);
            const lineStart = polar(size / 2, size / 2, outerR + 2, mid);
            const lineEnd = polar(size / 2, size / 2, outerR + 10, mid);
            const labelText = `${macroLabel(segment.name)} ${formatPercent(segment.percent)}`;
            return (
              <React.Fragment key={`${segment.name}-label`}>
                <Line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke={theme.border} strokeWidth={1} />
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y}
                  fontSize={fontSizes.caption}
                  fill={theme.text}
                  textAnchor="middle"
                >
                  {labelText}
                </SvgText>
                {showGrams ? (
                  <SvgText
                    x={labelPos.x}
                    y={labelPos.y + 12}
                    fontSize={fontSizes.caption}
                    fill={theme.textSecondary}
                    textAnchor="middle"
                  >
                    {Math.round(segment.grams)}g
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
      </Svg>

      {centerGrade ? (
        <View style={[styles.centerOverlay, { width: size, height: size }]}>
          <View style={[styles.centerInner, { maxWidth: innerR * 2 - 12 }]}>
            <Text style={[styles.centerGradeText, { color: gradeColor }]}>{centerGrade}</Text>
            <Text style={[styles.centerLabelText, { color: theme.text }]}>{centerLabelText}</Text>
            {reasons.length > 0 ? (
              <View style={styles.centerReasonsRow}>
                {reasons.map((reason) => (
                  <View
                    key={reason}
                    style={[
                      styles.centerReasonChip,
                      { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.centerReasonChipText, { color: theme.textSecondary }]}>
                      {reason}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function getThemeColors(mode: "light" | "dark"): ThemeColors {
  const base = colors[mode];
  return {
    text: base.text,
    textSecondary: base.textMuted,
    backgroundSecondary: base.surface,
    border: base.border,
    tint: base.primary,
  };
}

function getMacroColors() {
  return {
    protein: colors.light.chartGreen,
    fat: colors.light.chartPink,
    carb: colors.light.chartOrange,
    fiber: colors.light.chartGreen,
  };
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  centerGradeText: {
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  centerLabelText: {
    fontSize: fontSizes.caption,
  },
  centerReasonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "center",
  },
  centerReasonChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  centerReasonChipText: {
    fontSize: fontSizes.caption,
  },
});
