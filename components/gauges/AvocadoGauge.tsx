import { MACRO_GAUGE_TEXT } from '@/components/MacroGauge';
import { Colors, FontFamilies, FontSize, Nudge } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensureContrast } from '@/theme/contrast';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText, TSpan } from 'react-native-svg';

type GoalType = 'lose' | 'maintain' | 'recomp' | 'gain';

// ============================================================================
// GEOMETRY CONSTANTS (design-space units)
// ============================================================================
// These are SVG viewBox coordinates used to draw/position the avocado. They are
// not "UI spacing" tokens; they define the canonical shape geometry.
const VB_X = -45;
const VB_Y = -25; // Increased top padding to accommodate tip labels at the top
const VB_W = 180;
const VB_H = 235; // Increased height to match the extra top padding

// The avocado outline's approximate x-bounds within the viewBox (for label centering).
const PATH_MIN_X = -5;
const PATH_MAX_X = 105;
const PATH_CX = (PATH_MIN_X + PATH_MAX_X) / 2; // 50

// Default sizing is a component-level design decision (not a global spacing token).
const DEFAULT_SIZE = 165;
const DEFAULT_STROKE_WIDTH = 5;

export type AvocadoGaugeProps = {
  consumed: number;
  target: number;
  goalType: GoalType;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  /**
   * Background color behind the label text, used for WCAG AA contrast guarding.
   * Defaults to the current theme's `background`.
   */
  surfaceBg?: string;
  showLabel?: boolean;
};

// Avocado silhouette outline (single closed path). The progress "start" is the path's `M` point.
const AVOCADO_PATH =
  'M50 5 ' +
  'C28 5 15 25 15 45 ' +
  'C15 75 -5 80 -5 115 ' +
  'C-5 155 20 170 50 170 ' +
  'C80 170 105 155 105 115 ' +
  'C105 80 85 75 85 45 ' +
  'C85 25 72 5 50 5 Z';

function cubicPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function cubicLength(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  samples = 60
) {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const pt = cubicPoint(i / samples, p0, p1, p2, p3);
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    len += Math.sqrt(dx * dx + dy * dy);
    prev = pt;
  }
  return len;
}

// Approximate total length by sampling each cubic segment (stable across web + native)
const AVOCADO_TOTAL_LEN =
  cubicLength({ x: 50, y: 5 }, { x: 28, y: 5 }, { x: 15, y: 25 }, { x: 15, y: 45 }) +
  cubicLength({ x: 15, y: 45 }, { x: 15, y: 75 }, { x: -5, y: 80 }, { x: -5, y: 115 }) +
  cubicLength({ x: -5, y: 115 }, { x: -5, y: 155 }, { x: 20, y: 170 }, { x: 50, y: 170 }) +
  cubicLength({ x: 50, y: 170 }, { x: 80, y: 170 }, { x: 105, y: 155 }, { x: 105, y: 115 }) +
  cubicLength({ x: 105, y: 115 }, { x: 105, y: 80 }, { x: 85, y: 75 }, { x: 85, y: 45 }) +
  cubicLength({ x: 85, y: 45 }, { x: 85, y: 25 }, { x: 72, y: 5 }, { x: 50, y: 5 });

export function AvocadoGauge({
  consumed,
  target,
  goalType,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  trackColor,
  surfaceBg,
  showLabel = true,
}: AvocadoGaugeProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const modeKey = (scheme ?? 'light') as 'light' | 'dark';

  const PINK = colors.chartPink;
  const RED = colors.chartRed;
  const GREEN = colors.chartGreen;
  const ORANGE = colors.chartOrange;
  const TEAL = colors.appTeal;

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;

  const pct = safeTarget > 0 ? safeConsumed / safeTarget : 0;
  const fillT = Math.max(0, Math.min(1, pct));

  // Same calorie gauge color rules as `CalorieCurvyGauge`.
  // NOTE: These threshold values are visual state rules (not user-configurable "constraints").
  // They intentionally mirror the existing Curvy gauge to keep behavior consistent.
  const lineColor = useMemo(() => {
    if (safeTarget <= 0) return colors.textSecondary;

    if (goalType === 'lose') {
      if (pct > 1.1) return RED;
      if (pct >= 1.0) return PINK; // 100–110%
      return GREEN; // <=100
    }

    if (goalType === 'maintain' || goalType === 'recomp') {
      if (pct > 1.25) return RED;
      if (pct >= 1.1) return PINK; // 110–125%
      if (pct >= 1.0) return TEAL; // 100–110%
      return GREEN; // <=100
    }

    // gain
    if (pct > 1.25) return PINK;
    if (pct > 1.1) return TEAL; // 110–125%
    if (pct >= 0.9) return GREEN; // 90–110%
    return ORANGE; // <90%
  }, [pct, goalType, safeTarget, colors.textSecondary, GREEN, ORANGE, PINK, RED, TEAL]);

  const remainingRaw = safeTarget > 0 ? Math.round(safeTarget - safeConsumed) : 0;
  const isOverBudget = safeTarget > 0 && remainingRaw < 0;
  const remainingAmount = safeTarget > 0 ? (isOverBudget ? Math.abs(remainingRaw) : remainingRaw) : 0;
  const bgForContrast = surfaceBg ?? colors.background;
  const calTextColor =
    safeTarget > 0 ? ensureContrast(lineColor, bgForContrast, modeKey, 4.5) : colors.textSecondary;

  // Calculate consumed calories and percentage (same as CalorieCurvyGauge)
  const consumedRounded = Math.round(safeConsumed);
  const percentDisplay = useMemo(() => {
    if (safeTarget <= 0) return null;
    const rawPct = (safeConsumed / safeTarget) * 100;
    if (!Number.isFinite(rawPct)) return null;
    // 1 decimal, but trim trailing ".0"
    return rawPct.toFixed(1).replace(/\.0$/, '');
  }, [safeConsumed, safeTarget]);

  // Calculate tip position along the avocado path
  // Sample points along the path to find where fillT percentage is
  const pathSegments = [
    // Segment 1: M50 5 to C28 5, 15 25, 15 45
    { p0: { x: 50, y: 5 }, p1: { x: 28, y: 5 }, p2: { x: 15, y: 25 }, p3: { x: 15, y: 45 } },
    // Segment 2: 15 45 to C15 75, -5 80, -5 115
    { p0: { x: 15, y: 45 }, p1: { x: 15, y: 75 }, p2: { x: -5, y: 80 }, p3: { x: -5, y: 115 } },
    // Segment 3: -5 115 to C-5 155, 20 170, 50 170
    { p0: { x: -5, y: 115 }, p1: { x: -5, y: 155 }, p2: { x: 20, y: 170 }, p3: { x: 50, y: 170 } },
    // Segment 4: 50 170 to C80 170, 105 155, 105 115
    { p0: { x: 50, y: 170 }, p1: { x: 80, y: 170 }, p2: { x: 105, y: 155 }, p3: { x: 105, y: 115 } },
    // Segment 5: 105 115 to C105 80, 85 75, 85 45
    { p0: { x: 105, y: 115 }, p1: { x: 105, y: 80 }, p2: { x: 85, y: 75 }, p3: { x: 85, y: 45 } },
    // Segment 6: 85 45 to C85 25, 72 5, 50 5
    { p0: { x: 85, y: 45 }, p1: { x: 85, y: 25 }, p2: { x: 72, y: 5 }, p3: { x: 50, y: 5 } },
  ];

  // Calculate segment lengths (using same samples as AVOCADO_TOTAL_LEN calculation)
  const segmentSamples = 60;
  const segmentLengths = pathSegments.map(seg => cubicLength(seg.p0, seg.p1, seg.p2, seg.p3, segmentSamples));
  
  // Find which segment contains the tip position
  let accumulatedLength = 0;
  let tipSegmentIndex = 0;
  let tipTInSegment = 0;
  const targetLength = AVOCADO_TOTAL_LEN * fillT;
  
  for (let i = 0; i < segmentLengths.length; i++) {
    if (accumulatedLength + segmentLengths[i] >= targetLength) {
      tipSegmentIndex = i;
      tipTInSegment = (targetLength - accumulatedLength) / segmentLengths[i];
      break;
    }
    accumulatedLength += segmentLengths[i];
  }
  
  // Clamp tipTInSegment to [0, 1] to avoid edge cases
  tipTInSegment = Math.max(0, Math.min(1, tipTInSegment));
  
  // Calculate tip position
  const tipSegment = pathSegments[tipSegmentIndex];
  const tip = cubicPoint(tipTInSegment, tipSegment.p0, tipSegment.p1, tipSegment.p2, tipSegment.p3);

  // Tip label positioning (adjusted to use available white space at top)
  // Offset horizontally toward exterior to avoid overlapping center label
  const isLeftSide = tip.x < PATH_CX;
  const isLowerHalf = tip.y >= 95; // Check if tip is in lower half of avocado
  const horizontalOffset = isLowerHalf ? 13 : 18; // 5px closer when in lower half to avoid edge clipping
  const tipLabelX = isLeftSide ? tip.x - horizontalOffset : tip.x + horizontalOffset;
  
  // Position label above the tip, accounting for stroke path thickness
  // Vertical offset accounts for strokeWidth (can be up to 8) to ensure text is clear
  // When at top (y ~5), position at y ~-15 to use the white space
  // When at bottom, keep closer to tip but with extra clearance for thick strokes
  const strokeClearance = Math.max(4, strokeWidth / 2); // Half of strokeWidth for clearance
  const tipLabelY = tip.y < 50 ? tip.y - 18 : tip.y - (12 + strokeClearance);
  const tipLabelFontSize = Math.max(FontSize.xs, MACRO_GAUGE_TEXT.value.sm.fontSize - Nudge.px1);

  const height = Math.round(size * (VB_H / VB_W));

  // Pit positioning: center horizontally, anchor bottom in lower portion
  // Avocado center x: 50 (PATH_CX), lower portion y: ~130-150
  const pitX = PATH_CX; // Center horizontally
  const pitBottomY = 160; // Bottom anchor point (pit grows upward from here)
  const pitSize = 80; // Increased size (was 35) - grows upward
  const pitScale = pitSize / 418; // Scale factor from original SVG viewBox (418x418) to our size
  
  // Pit colors based on theme (from SVG files)
  // Light mode: circle #b8553f, path #fff, leaf #dcf048
  // Dark mode: circle #e9876f, path #fff, leaf #dcf048
  const pitCircleColor = modeKey === 'dark' ? '#e9876f' : '#b8553f';
  const pitPathColor = '#fff'; // White for both modes
  const pitLeafColor = '#dcf048'; // Yellow-green for both modes
  
  // Pit path data extracted from SVG files
  // Circle: cx="208.93" cy="208.81" r="208.24" (converted to path for react-native-svg)
  // Main path (white inner shape)
  const pitMainPath = 'M253.67,192.2Q241.33,238.13,229,284.05c-2.3,8.52-5,17-7,25.54-1.09,4.64-2.44,9.06-10.13,8.66-6.69-.36-9.91-4.12-10.83-8.86-2.52-12.9-4.81-25.83-7.48-38.71-7.43-35.86-15-71.7-22.54-107.55l-3.85-.22q-7.93,29.44-15.9,58.89c-2.2,8.09-4.67,16.15-6.74,24.26-1.32,5.2-4.31,9.27-12,9.6-7.44.33-9.42-4.49-11.8-8.35-7.51-12.18-12-25.36-23-38.38-8.24,13.21-22.88,13.44-38.29,13-13.45-.38-26.95.12-40.43.14-5.79,0-11-1.46-11.34-6.27-.4-5.81,5.4-7,11.87-7,12.9,0,25.82-.5,38.67.05,11.28.48,18.41-1.92,23.52-10.05,3.35-5.34,5.14-13.66,16.4-13.63,11.91,0,11.34,8.85,15.15,14.21,5.41,7.63,9.65,15.72,15.4,25.28,7.78-11.61,8.43-22.78,11.41-33.36,6.83-24.24,12.49-48.65,18.91-72.95,1.32-5,2.68-11.07,12.14-10.79,8.62.25,9.3,6.18,10.22,10.64,5.44,26.63,10.37,53.31,15.52,80,4.55,23.58,9.17,47.16,16.85,70.78,6.14-24.22,12.13-48.47,18.49-72.67,3.47-13.2,7.38-26.35,11.49-39.45,1.15-3.66,2.36-8,9.37-8.19s8.73,4,10,7.68c6.3,17.18,12.09,34.47,18.23,51.68,2.39,6.7,5.24,13.31,8,20.25,1.42-1,2.76-1.49,3-2.18,5.55-17.32,20.74-21.52,43.11-19.73,18.52,1.49,37.46.05,56.2.24,8.23.09,20.18-2.17,19.67,7.9s-12.74,7.22-20.54,6.8c-19.88-1.09-39.74-1.22-59.64-1.52-10.73-.17-17.74,1.74-20.54,10.31-2.34,7.15-6.35,14-9.77,20.95-2,4-3.28,8.42-11.37,8.19-8.27-.25-10.93-4.11-12.47-9.12-3.25-10.58-6.16-21.23-9.85-31.72C264.09,209.68,262.75,200.59,253.67,192.2Z';
  // Leaf path (yellow-green)
  const pitLeafPath = 'M287.54,168.36c-4.15-24.71,8.21-40,34-44.65A169,169,0,0,1,347.45,121c6.89-.17,11.15,2.85,9.93,10.24-2.21,13.35-5.36,26.29-14.06,37.4-10.77,13.76-37.41,21.83-50.85,7.71.89-11.57,12.17-14.54,17.42-21.33-3.61,2.74-7.57,6.46-11.57,10.16C295.39,167.87,292.62,172.36,287.54,168.36Z';
  // Detail path (brown)
  const pitDetailPath = 'M287.6,168.36c9.87-1.39,13.17-11.84,21.4-15.58,2.6-1.18,4-4.56,8.79-4.63-6.33,12-18.71,17.61-25.26,28.17C289,174.84,287.16,172.31,287.6,168.36Z';
  
  // Calculate transform to position and scale the pit
  // Original SVG: center at (208.93, 208.81), radius 208.24, so bottom is at 208.81 + 208.24 = 417.05
  // We want the bottom of the pit to be anchored at pitBottomY, and it grows upward
  // After scaling, the bottom will be at: centerY + (208.24 * pitScale) below the center
  // So we need: pitBottomY = pitCenterY + (208.24 * pitScale)
  // Therefore: pitCenterY = pitBottomY - (208.24 * pitScale)
  const pitCenterY = pitBottomY - 208.24 * pitScale;
  const pitTransformX = pitX - 208.93 * pitScale;
  const pitTransformY = pitCenterY - 208.81 * pitScale;

  return (
    <View style={[styles.wrap, { width: size, height }]}>
      <Svg
        width={size}
        height={height}
        viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
        style={Platform.OS === 'web' ? { pointerEvents: 'none' } : undefined}
      >
        {/* Track */}
        <Path
          d={AVOCADO_PATH}
          fill="none"
          stroke={trackColor ?? colors.chartGrey}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Progress (dash) */}
        {fillT > 0 && (
          <Path
            d={AVOCADO_PATH}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${AVOCADO_TOTAL_LEN}`}
            strokeDashoffset={AVOCADO_TOTAL_LEN * (1 - fillT)}
          />
        )}

        {/* Avocado Pit (rendered before text so it appears behind) */}
        <G transform={`translate(${pitTransformX}, ${pitTransformY}) scale(${pitScale})`}>
          {/* Outer circle (brown/orange) */}
          <Circle cx={208.93} cy={208.81} r={208.24} fill={pitCircleColor} />
          {/* Main white path */}
          <Path d={pitMainPath} fill={pitPathColor} />
          {/* Leaf (yellow-green) */}
          <Path d={pitLeafPath} fill={pitLeafColor} />
          {/* Detail (brown/orange) */}
          <Path d={pitDetailPath} fill={pitCircleColor} />
        </G>

        {/* Center label inside the avocado (rendered first so tip label can appear on top) */}
        {showLabel && (
          <>
            {/* Text halo (drawn first for contrast) */}
            <SvgText
              x={PATH_CX}
              y={30 + 2 * MACRO_GAUGE_TEXT.value.sm.fontSize} // Moved up by 10 units
              fontSize={MACRO_GAUGE_TEXT.value.sm.fontSize}
              fontFamily={FontFamilies.regular}
              fill={bgForContrast}
              stroke={bgForContrast}
              strokeWidth={3}
              strokeLinejoin="round"
              textAnchor="middle"
            >
              {/* Line 1 */}
              <TSpan x={PATH_CX} fill={bgForContrast}>
                {safeTarget > 0
                  ? `${remainingAmount} ${t('home.food_log.kcal')}`
                  : `-- ${t('home.food_log.kcal')}`}
              </TSpan>

              {/* Line 2 */}
              <TSpan
                x={PATH_CX}
                dy={MACRO_GAUGE_TEXT.value.md.fontSize + 2} // next line
                fill={bgForContrast}
              >
                {isOverBudget ? t('home.summary.over_budget') : t('home.summary.remaining')}
              </TSpan>
            </SvgText>
            {/* Foreground text */}
            <SvgText
              x={PATH_CX}
              y={30 + 2 * MACRO_GAUGE_TEXT.value.sm.fontSize} // Moved up by 10 units
              fontSize={MACRO_GAUGE_TEXT.value.sm.fontSize}
              fontFamily={FontFamilies.regular}
              textAnchor="middle"
            >
              {/* Line 1 */}
              <TSpan x={PATH_CX} fill={calTextColor}>
                {safeTarget > 0
                  ? `${remainingAmount} ${t('home.food_log.kcal')}`
                  : `-- ${t('home.food_log.kcal')}`}
              </TSpan>

              {/* Line 2 */}
              <TSpan
                x={PATH_CX}
                dy={MACRO_GAUGE_TEXT.value.md.fontSize + 2} // next line
                fill={colors.textSecondary}
              >
                {isOverBudget ? t('home.summary.over_budget') : t('home.summary.remaining')}
              </TSpan>
            </SvgText>
          </>
        )}

        {/* Tip marker + consumed label (moves with progress, rendered last in group to appear on top) */}
        {fillT > 0 && (
          <G>
            <Circle cx={tip.x} cy={tip.y} r={4} fill={lineColor} />
            {/* Text halo (drawn first for contrast) */}
            <SvgText
              x={tipLabelX}
              y={tipLabelY}
              fontSize={tipLabelFontSize}
              fontFamily={FontFamilies.regular}
              fill={bgForContrast}
              stroke={bgForContrast}
              strokeWidth={4}
              strokeLinejoin="round"
              textAnchor="middle"
            >
              <TSpan x={tipLabelX}>{consumedRounded}</TSpan>
              {percentDisplay != null ? (
                <TSpan x={tipLabelX} dy={tipLabelFontSize + 2}>{`${percentDisplay}%`}</TSpan>
              ) : null}
            </SvgText>
            {/* Foreground text */}
            <SvgText
              x={tipLabelX}
              y={tipLabelY}
              fontSize={tipLabelFontSize}
              fontFamily={FontFamilies.regular}
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              <TSpan x={tipLabelX}>{consumedRounded}</TSpan>
              {percentDisplay != null ? (
                <TSpan x={tipLabelX} dy={tipLabelFontSize + 2}>{`${percentDisplay}%`}</TSpan>
              ) : null}
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});


