/**
 * MacroCompositionDonutChart - Reusable nested donut chart for macro calorie composition
 * 
 * Displays macro composition with:
 * - Inner ring: Carbs (Net Carb + Fiber), Protein, Fat
 * - Outer ring: Carb breakdown (Fiber + Net Carb) aligned to the Carbs inner slice
 * - External labels with leader lines
 * - Theme-aware colors (light/dark mode)
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  Colors,
  BorderRadius,
  FontSize,
  FontWeight,
  Nudge,
  Spacing,
  brandBlueColorDark,
  brandBlueColorLight,
  brandVioletColorDark,
  brandVioletColorLight,
  salmonColorDark,
  salmonColorLight,
  brandGreenColorDark,
  brandGreencolorLight,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from 'react-i18next';
import type { AvoScoreGrade } from '@/utils/avoScore';

type MacroCompositionDonutChartProps = {
  gramsCarbTotal: number;
  gramsFiber: number;
  gramsProtein: number;
  gramsFat: number;
  size?: number; // default 220
  strokeWidthInner?: number; // default 18
  strokeWidthOuter?: number; // default 12
  gapDegrees?: number; // default 1.2
  minLabelPercent?: number; // default 0 (show all labels > 0%)
  showTooltips?: boolean; // deprecated (tooltips removed by request)
  centerGrade?: AvoScoreGrade;
  centerLabel?: string; // default "AvoScore"
  centerReasons?: string[]; // 1-2 callouts rendered in overlay at donut center
  getGradeColor?: (grade: AvoScoreGrade, colors: typeof Colors.light | typeof Colors.dark) => string;
  style?: ViewStyle;
};

// Helper: Convert polar coordinates to Cartesian
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    // SVG coordinate system: y increases downward.
    // With this, -90° is 12 o'clock and angles increase clockwise.
    y: cy + r * Math.sin(rad),
  };
};

// Helper: Create SVG arc path
const arcPath = (
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
  sweepFlag: 0 | 1
) => {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 ${sweepFlag} ${e.x} ${e.y}`;
};

// Helper: Create donut arc path (outer and inner radius)
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
  /** Percent contribution (0..100), not rounded. */
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
  // showTooltips deprecated; tooltips removed
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
      return translateMaybe('common.less_than_one_percent');
    }
    return `${rounded}%`;
  };
  const macroLabel = (name: string) => {
    switch (name) {
      case 'Protein':
        return translateMaybe('nutrition.protein');
      case 'Fat':
        return translateMaybe('nutrition.fat');
      case 'Fiber':
        return translateMaybe('nutrition.fiber');
      case 'Net Carb':
        return translateMaybe('nutrition.net_carb');
      case 'Carbs':
        return translateMaybe('nutrition.carbs');
      default:
        return translateMaybe(name);
    }
  };
  const scheme = useColorScheme();
  const modeKey = (scheme ?? 'light') as 'light' | 'dark';
  const isDark = scheme === 'dark';
  const colors = Colors[modeKey];
  const centerLabelText = translateMaybe(centerLabel ?? 'avo_score.label');
  const reasons = (centerReasons ?? []).filter(Boolean).slice(0, 2).map(translateMaybe);

  // Calculate macros
  const gramsNetCarb = Math.max(gramsCarbTotal - gramsFiber, 0);
  const kcalNetCarb = gramsNetCarb * 4;
  const kcalProtein = gramsProtein * 4;
  const kcalFat = gramsFat * 9;
  const kcalFiber = gramsFiber * 2;

  // Nested donut model:
  // - Inner ring: CarbsTotal (NetCarb + Fiber), Protein, Fat (must sum to 100%)
  // - Outer ring: spans ONLY the CarbsTotal slice, split into Fiber + NetCarb
  const kcalCarbsTotal = kcalNetCarb + kcalFiber;
  const totalKcal = kcalCarbsTotal + kcalProtein + kcalFat;

  // Color mapping
  const netCarbColor = isDark ? salmonColorDark : salmonColorLight;
  const fiberColor = isDark ? brandGreenColorDark : brandGreencolorLight;
  const proteinColor = isDark ? brandBlueColorDark : brandBlueColorLight;
  const fatColor = isDark ? brandVioletColorDark : brandVioletColorLight;

  // Calculate percentages
  const percentCarbs = totalKcal > 0 ? (kcalCarbsTotal / totalKcal) * 100 : 0;
  const percentFiber = totalKcal > 0 ? (kcalFiber / totalKcal) * 100 : 0;
  const percentNetCarb = totalKcal > 0 ? (kcalNetCarb / totalKcal) * 100 : 0;
  const percentProtein = totalKcal > 0 ? (kcalProtein / totalKcal) * 100 : 0;
  const percentFat = totalKcal > 0 ? (kcalFat / totalKcal) * 100 : 0;

  // Geometry
  const PAD = 70;
  const svgSize = size + PAD * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  // Radii are based on the requested chart `size` (core size), not the padded svgSize
  const chartRadius = size / 2;
  const innerOuterR = chartRadius - 8;
  const innerInnerR = innerOuterR - strokeWidthInner;
  const outerOuterR = chartRadius - 2;
  const outerInnerR = outerOuterR - strokeWidthOuter;
  const startAngle = -90; // 12 o'clock

  const gradeColor = useMemo(() => {
    if (!centerGrade) return colors.text;
    if (getGradeColor) return getGradeColor(centerGrade, colors);
    switch (centerGrade) {
      case 'A':
        return colors.gradeA;
      case 'B':
        return colors.gradeB;
      case 'C':
        return colors.gradeC;
      case 'D':
        return colors.gradeD;
      case 'F':
      default:
        return colors.gradeF;
    }
  }, [centerGrade, colors, getGradeColor]);

  // Calculate inner ring segments
  const innerSegments = useMemo(() => {
    const raw: Array<{
      name: 'Carbs' | 'Protein' | 'Fat';
      percent: number;
      color: string;
      grams: number;
      kcal: number;
    }> = [
      { name: 'Carbs', percent: percentCarbs, color: netCarbColor, grams: gramsCarbTotal, kcal: kcalCarbsTotal },
      { name: 'Protein', percent: percentProtein, color: proteinColor, grams: gramsProtein, kcal: kcalProtein },
      { name: 'Fat', percent: percentFat, color: fatColor, grams: gramsFat, kcal: kcalFat },
    ];

    const visible = raw.filter((s) => s.percent > 0);
    const visibleCount = visible.length;
    const totalGap = gapDegrees * Math.max(visibleCount - 1, 0);
    const available = 360 - totalGap;

    let currentAngle = startAngle;
    const segments: MacroSegment[] = [];

    visible.forEach((s, idx) => {
      const span = (s.percent / 100) * available;
      segments.push({
        name: s.name,
        percent: s.percent,
        startAngle: currentAngle,
        endAngle: currentAngle + span,
        color: s.color,
        grams: s.grams,
        kcal: s.kcal,
      });
      currentAngle += span;
      if (idx < visible.length - 1) currentAngle += gapDegrees;
    });

    return segments;
  }, [
    percentCarbs,
    percentProtein,
    percentFat,
    gapDegrees,
    netCarbColor,
    proteinColor,
    fatColor,
    gramsCarbTotal,
    gramsProtein,
    gramsFat,
    kcalCarbsTotal,
    kcalProtein,
    kcalFat,
  ]);

  // Calculate outer ring segments (only for carb total span)
  const outerSegments = useMemo(() => {
    const carbsSeg = innerSegments.find((s) => s.name === 'Carbs');
    if (!carbsSeg) return [];
    if (kcalCarbsTotal <= 0) return [];

    const carbStartAngle = carbsSeg.startAngle;
    const carbEndAngle = carbsSeg.endAngle;
    const carbSpan = carbEndAngle - carbStartAngle;

    const fiberSpan = (kcalFiber / kcalCarbsTotal) * carbSpan;
    const netCarbSpan = (kcalNetCarb / kcalCarbsTotal) * carbSpan;

    const segments: MacroSegment[] = [];

    if (kcalFiber > 0) {
      segments.push({
        name: 'Fiber',
        percent: percentFiber,
        startAngle: carbStartAngle,
        endAngle: carbStartAngle + fiberSpan,
        color: fiberColor,
        grams: gramsFiber,
        kcal: kcalFiber,
      });
    }

    if (kcalNetCarb > 0) {
      segments.push({
        name: 'Net Carb',
        percent: percentNetCarb,
        startAngle: carbStartAngle + fiberSpan,
        endAngle: carbStartAngle + fiberSpan + netCarbSpan,
        color: netCarbColor,
        grams: gramsNetCarb,
        kcal: kcalNetCarb,
      });
    }

    return segments;
  }, [
    innerSegments,
    kcalCarbsTotal,
    kcalFiber,
    kcalNetCarb,
    percentFiber,
    percentNetCarb,
    fiberColor,
    netCarbColor,
    gramsFiber,
    gramsNetCarb,
  ]);

  // Calculate label positions with collision avoidance
  const labelPositions = useMemo(() => {
    // Labels:
    // - Inner: Protein, Fat
    // - Outer: Fiber, Net Carb
    // (Optional: omit inner Carbs label)
    const allSegments: Array<MacroSegment & { isOuter?: boolean }> = [];

    innerSegments
      .filter((s) => s.name === 'Protein' || s.name === 'Fat')
      .forEach((s) => allSegments.push({ ...s, isOuter: false }));

    outerSegments.forEach((s) => allSegments.push({ ...s, isOuter: true }));

    // Keep labels close to the ring (overlap is OK), but never allow them to drift into the center.
    const labelMargin = 18;
    const minVerticalSpacing = 8;
    const positions: Array<{
      segment: MacroSegment;
      isOuter: boolean;
      x: number;
      y: number;
      anchorX: number;
      anchorY: number;
      side: 'left' | 'right';
    }> = [];

    // Filter segments that should show labels
    // Always show labels for any segment with >0%.
    // (Keep minLabelPercent as an optional override if caller wants it.)
    const visibleSegments = allSegments.filter((seg) => seg.percent > 0 && seg.percent >= minLabelPercent);

    // Calculate initial positions
    for (const segment of visibleSegments) {
      const midAngle = (segment.startAngle + segment.endAngle) / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const radius = segment.isOuter ? outerOuterR : innerOuterR;

      // Anchor point at ring edge
      const anchor = polar(cx, cy, radius, midAngle);

      // Label position
      const labelDistance = chartRadius + labelMargin;
      let labelX = cx + labelDistance * Math.cos(midRad);
      let labelY = cy + labelDistance * Math.sin(midRad);

      // Radial floor: if a label gets clamped inward later, ensure it stays outside the donut.
      const minLabelRadius = outerOuterR + 10;
      const dx = labelX - cx;
      const dy = labelY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < minLabelRadius) {
        const s = minLabelRadius / dist;
        labelX = cx + dx * s;
        labelY = cy + dy * s;
      }

      // Determine side (right half: -90 to 90 degrees)
      const side = midAngle >= -90 && midAngle <= 90 ? 'right' : 'left';

      positions.push({
        segment,
        isOuter: segment.isOuter || false,
        x: labelX,
        y: labelY,
        anchorX: anchor.x,
        anchorY: anchor.y,
        side,
      });
    }

    // Collision avoidance (per-side) to avoid left/right interfering with each other.
    const adjust = (arr: typeof positions) => {
      arr.sort((a, b) => a.y - b.y);
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const curr = arr[i];
        const verticalDistance = Math.abs(curr.y - prev.y);
        if (verticalDistance < minVerticalSpacing) {
          arr[i].y += minVerticalSpacing - verticalDistance;
        }
      }
      return arr;
    };

    const left = adjust(positions.filter((p) => p.side === 'left'));
    const right = adjust(positions.filter((p) => p.side === 'right'));

    return [...left, ...right];

  }, [innerSegments, outerSegments, minLabelPercent, cx, cy, chartRadius, innerOuterR, outerOuterR]);

  // Empty state - check AFTER all hooks are called
  if (totalKcal === 0) {
    return (
      // Important: disable pointer events so the surrounding ScrollView can scroll.
      <View pointerEvents="none" style={[styles.container, style]}>
        <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={innerOuterR - strokeWidthInner / 2}
            stroke={colors.chartGrey}
            strokeWidth={2}
            fill="none"
          />
          <SvgText
            x={cx}
            y={cy}
            fontSize={FontSize.base}
            fill={colors.textSecondary}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {translateMaybe('avo_score.reasons.no_macro_data')}
          </SvgText>
        </Svg>
      </View>
    );
  }

  return (
    // Important: disable pointer events so the surrounding ScrollView can scroll.
    <View pointerEvents="none" style={[styles.container, style]}>
      <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        {/* Inner ring segments */}
        {innerSegments.map((segment, idx) => {
          return (
            <Path
              key={`inner-${idx}`}
              d={donutArcPath(cx, cy, innerInnerR, innerOuterR, segment.startAngle, segment.endAngle, 1)}
              fill={segment.color}
            />
          );
        })}

        {/* Outer ring segments (only in carb total span) */}
        {outerSegments.map((segment, idx) => {
          return (
            <Path
              key={`outer-${idx}`}
              d={donutArcPath(cx, cy, outerInnerR, outerOuterR, segment.startAngle, segment.endAngle, 1)}
              fill={segment.color}
            />
          );
        })}

        {/* Separation line between Fiber and Net Carb in outer ring */}
        {outerSegments.length === 2 && (
          <Line
            x1={polar(cx, cy, outerInnerR, outerSegments[0].endAngle).x}
            y1={polar(cx, cy, outerInnerR, outerSegments[0].endAngle).y}
            x2={polar(cx, cy, outerOuterR, outerSegments[0].endAngle).x}
            y2={polar(cx, cy, outerOuterR, outerSegments[0].endAngle).y}
            stroke={colors.border}
            strokeWidth={1}
          />
        )}

        {/* Labels with leader lines */}
        {labelPositions.map((pos, idx) => {
          const labelText = macroLabel(pos.segment.name);
          const percentText = formatPercent(pos.segment.percent);
          const fontSize = FontSize.sm;
          const lineHeight = FontSize.sm + Spacing.xs; // 16
          const paddingH = Spacing.xs + Nudge.px2; // 6
          const paddingV = Spacing.xs; // 4

          // More generous label width estimate to avoid truncation (e.g. "Net C").
          // NOTE: chart-geometry heuristic; not a theme token. If we need to theme this,
          // we should move it to a shared chart typography helper.
          const CHAR_W = 8.5;
          const longest = Math.max(labelText.length, percentText.length);
          // NOTE: 56 is a chart-geometry minimum width (not a theme token).
          const labelWidth = Math.max(longest * CHAR_W + paddingH * 2, 56);
          const labelHeight = lineHeight * 2 + paddingV * 2;

          // Clamp label placement within the FULL padded SVG viewBox (not inside the PAD region),
          // so labels can live in the padding area instead of being pulled inward over the donut.
          const boundsLeft = 4;
          const boundsRight = svgSize - 4;

          const rectXRaw = pos.side === 'right' ? pos.x : pos.x - labelWidth;
          const rectX = Math.max(boundsLeft, Math.min(rectXRaw, boundsRight - labelWidth));
          const rectY = pos.y - labelHeight / 2;

          // Text X respects padding inside the pill.
          const textX =
            pos.side === 'right' ? rectX + paddingH : rectX + labelWidth - paddingH;

          // SvgText y is baseline; use dominantBaseline="middle" so these are true centers.
          const centerY = pos.y;
          const textY1 = centerY - lineHeight / 2;
          const textY2 = centerY + lineHeight / 2;

          // Leader line should connect to the pill edge closest to the donut.
          const lineEndX = pos.side === 'right' ? rectX : rectX + labelWidth;
          const lineEndY = centerY;

          const haloColor = colors.background;
          const haloStrokeWidth = Spacing.xs + Nudge.px2; // 6
          
          return (
            <React.Fragment key={`label-${idx}`}>
              {/* Leader line */}
              <Line
                x1={pos.anchorX}
                y1={pos.anchorY}
                x2={lineEndX}
                y2={lineEndY}
                stroke={colors.separator}
                strokeWidth={1}
                opacity={0.5}
              />

              {/* Label text (halo outline) */}
              <SvgText
                x={textX}
                y={textY1}
                fontSize={fontSize}
                fill="none"
                stroke={haloColor}
                strokeWidth={haloStrokeWidth}
                strokeLinejoin="round"
                textAnchor={pos.side === 'right' ? 'start' : 'end'}
                alignmentBaseline="middle"
                fontWeight={FontWeight.bold}
              >
                {labelText}
              </SvgText>
              <SvgText
                x={textX}
                y={textY1}
                fontSize={fontSize}
                fill={colors.text}
                textAnchor={pos.side === 'right' ? 'start' : 'end'}
                alignmentBaseline="middle"
                fontWeight={FontWeight.semibold}
              >
                {labelText}
              </SvgText>

              <SvgText
                x={textX}
                y={textY2}
                fontSize={fontSize}
                fill="none"
                stroke={haloColor}
                strokeWidth={haloStrokeWidth}
                strokeLinejoin="round"
                textAnchor={pos.side === 'right' ? 'start' : 'end'}
                alignmentBaseline="middle"
                fontWeight={FontWeight.bold}
              >
                {percentText}
              </SvgText>
              <SvgText
                x={textX}
                y={textY2}
                fontSize={fontSize}
                fill={colors.text}
                textAnchor={pos.side === 'right' ? 'start' : 'end'}
                alignmentBaseline="middle"
                fontWeight={FontWeight.regular}
              >
                {percentText}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Center overlay (always on top of the SVG) */}
      {centerGrade ? (
        <View style={[styles.centerOverlay, { width: svgSize, height: svgSize }]}>
          <View style={[styles.centerInner, { maxWidth: innerInnerR * 2 - 12 }]}>
            <Text style={[styles.centerGradeText, { color: gradeColor }]}>{centerGrade}</Text>
            <Text style={[styles.centerLabelText, { color: colors.text }]}>{centerLabelText}</Text>
            {reasons.length > 0 ? (
              <View style={styles.centerReasonsRow}>
                {reasons.map((r) => (
                  <View
                    key={r}
                    style={[
                      styles.centerReasonChip,
                      { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.centerReasonChipText, { color: colors.textSecondary }]}>
                      {r}
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGradeText: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['4xl'] + Spacing.xs,
  },
  centerLabelText: {
    marginTop: Nudge.px2,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    opacity: 0.85,
  },
  centerReasonsRow: {
    marginTop: Spacing.xs + Nudge.px2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs + Nudge.px2,
  },
  centerReasonChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  centerReasonChipText: {
    fontSize: FontSize.gaugeLabelMd,
    fontWeight: FontWeight.semibold,
  },
});
