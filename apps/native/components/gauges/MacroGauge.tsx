import React, { useMemo } from "react";
import { StyleSheet, View, Text as RNText } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { colors, fontSizes } from "@/theme/tokens";
import { useColorScheme } from "@/components/useColorScheme";
import { arcPath, clamp, polar } from "@/components/gauges/arcMath";

export type MacroGaugeProps = {
  title: string;
  value: number;
  target: number;
  unit?: string;
  size?: "sm" | "md";
  mode?: "min" | "max";
};

export const MACRO_GAUGE_TEXT = {
  value: {
    sm: { fontSize: fontSizes.caption },
    md: { fontSize: fontSizes.body },
  },
  label: {
    sm: { fontSize: fontSizes.label },
    md: { fontSize: fontSizes.title },
  },
};

export function MacroGauge({
  title,
  value,
  target,
  unit = "g",
  size = "sm",
  mode = "min",
}: MacroGaugeProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const gaugeMax = safeTarget > 0 ? safeTarget / 0.75 : 1;
  const v = clamp(value, 0, gaugeMax);
  const pct = v / gaugeMax;
  const pctOfTarget = safeTarget > 0 ? value / safeTarget : 0;

  const angle = 180 - 180 * pct;
  const aNow = angle;

  const angleForPctOfTarget = (pctTarget: number) => {
    const pctGauge = clamp(pctTarget * 0.75, 0, 1);
    return 180 - 180 * pctGauge;
  };

  const aGreenEnd = angleForPctOfTarget(0.85);
  const aOrangeEnd = angleForPctOfTarget(1.05);

  const isSm = size === "sm";
  const vbW = isSm ? 120 : 260;
  const vbH = isSm ? 78 : 140;
  const stroke = isSm ? 8 : 14;

  const cx = vbW / 2;
  const cy = vbH - (isSm ? 6 : 10);
  const r = isSm ? 46 : 100;

  const fullArc = arcPath(cx, cy, r, 180, 0, 1);
  const filledArc = useMemo(() => {
    if (pct <= 0) return null;
    if (mode !== "max") return arcPath(cx, cy, r, 180, angle, 1);
    return null;
  }, [pct, mode, cx, cy, r, angle]);

  const needleLen = r - stroke / 2;
  const needleEnd = polar(cx, cy, needleLen, angle);

  const targetAngle = 45;
  const markerPoint = polar(cx, cy, r, targetAngle);
  const markerOut = polar(cx, cy, r + (isSm ? 6 : 8), targetAngle);

  const PINK = theme.chartPink;
  const ORANGE = theme.chartOrange;
  const GREEN = theme.chartGreen;
  const RED = theme.chartRed;

  let filledColor = ORANGE;
  if (mode === "max") {
    if (pctOfTarget > 1.05) filledColor = RED;
    else if (pctOfTarget >= 1.0) filledColor = PINK;
    else if (pctOfTarget >= 0.85) filledColor = ORANGE;
    else filledColor = GREEN;
  } else {
    if (pct >= 0.75) filledColor = GREEN;
    else if (pct <= 0.25) filledColor = PINK;
    else filledColor = ORANGE;
  }

  const consumedFormatted = `${Math.round(value)}${unit}`;
  const targetFormatted =
    safeTarget > 0 ? `${Math.round(safeTarget)}${unit}` : t("common.no_target");

  return (
    <View style={styles.container}>
      <Svg width="100%" height={isSm ? 78 : 140} viewBox={`0 0 ${vbW} ${vbH}`}>
        {mode !== "max" && (
          <Path
            d={fullArc}
            stroke={theme.chartGrey}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {mode !== "max" && filledArc && (
          <Path
            d={filledArc}
            stroke={filledColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {mode === "max" && (
          <>
            <Path
              d={arcPath(cx, cy, r, 180, aGreenEnd, 1)}
              stroke={GREEN}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d={arcPath(cx, cy, r, aGreenEnd, aOrangeEnd, 1)}
              stroke={ORANGE}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="butt"
            />
            <Path
              d={arcPath(cx, cy, r, aOrangeEnd, 0, 1)}
              stroke={RED}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
            />
            {pct > 0 && (
              <Path
                d={arcPath(cx, cy, r, 181, clamp(aNow, 0, 180), 1)}
                stroke={scheme === "dark" ? "rgba(60,60,60,0.92)" : "rgba(180,180,180,1)"}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </>
        )}

        {mode === "max" ? (
          <Line
            x1={markerPoint.x}
            y1={markerPoint.y}
            x2={markerOut.x}
            y2={markerOut.y}
            stroke={mode === "max" ? PINK : GREEN}
            strokeWidth={isSm ? 4 : 5}
            strokeLinecap="butt"
          />
        ) : (
          <Line
            x1={markerPoint.x}
            y1={markerPoint.y}
            x2={markerOut.x}
            y2={markerOut.y}
            stroke={mode === "max" ? PINK : GREEN}
            strokeWidth={isSm ? 2.2 : 2.8}
            strokeLinecap="round"
          />
        )}

        {(() => {
          const dx = needleEnd.x - cx;
          const dy = needleEnd.y - cy;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const px = -uy;
          const py = ux;
          const baseHalf = isSm ? 2.2 : 3.0;
          const tipLen = isSm ? 7 : 10;
          const tipX = needleEnd.x;
          const tipY = needleEnd.y;
          const baseCX = tipX - ux * tipLen;
          const baseCY = tipY - uy * tipLen;
          const b1x = baseCX + px * baseHalf;
          const b1y = baseCY + py * baseHalf;
          const b2x = baseCX - px * baseHalf;
          const b2y = baseCY - py * baseHalf;
          const stemEndX = baseCX;
          const stemEndY = baseCY;

          return (
            <>
              <Line
                x1={cx}
                y1={cy}
                x2={stemEndX}
                y2={stemEndY}
                stroke={theme.primary}
                strokeWidth={isSm ? 2 : 3}
                strokeLinecap="round"
              />
              <Polygon points={`${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`} fill={theme.primary} />
            </>
          );
        })()}

        {mode === "max" ? (
          <Circle cx={cx} cy={cy} r={5} fill={theme.background} stroke={theme.primary} strokeWidth={2} />
        ) : (
          <Circle cx={cx} cy={cy} r={5} fill={theme.primary} />
        )}

        <SvgText
          x={cx}
          y={cy - (isSm ? 8 : 10)}
          fontSize={MACRO_GAUGE_TEXT.label.md.fontSize}
          fill={theme.text}
          textAnchor="middle"
        >
          {title}
        </SvgText>
      </Svg>

      <RNText style={[styles.value, isSm && styles.valueSm, { color: theme.text }]}>
        <RNText>{consumedFormatted}</RNText>
        <RNText>{` / ${targetFormatted}`}</RNText>
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  value: {
    marginTop: 2,
    fontSize: MACRO_GAUGE_TEXT.value.md.fontSize,
    lineHeight: Math.round(MACRO_GAUGE_TEXT.value.md.fontSize * 1.15),
  },
  valueSm: {
    marginTop: 2,
    fontSize: MACRO_GAUGE_TEXT.value.sm.fontSize,
    lineHeight: Math.round(MACRO_GAUGE_TEXT.value.sm.fontSize * 1.15),
  },
});
