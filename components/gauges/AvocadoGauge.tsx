import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Text as SvgText, TSpan } from 'react-native-svg';
import { Colors, FontFamilies } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from 'react-i18next';
import { ensureContrast } from '@/theme/contrast';
import { MACRO_GAUGE_TEXT } from '@/components/MacroGauge';

type GoalType = 'lose' | 'maintain' | 'recomp' | 'gain';

// ============================================================================
// GEOMETRY CONSTANTS (design-space units)
// ============================================================================
// These are SVG viewBox coordinates used to draw/position the avocado. They are
// not "UI spacing" tokens; they define the canonical shape geometry.
const VB_X = -45;
const VB_Y = -10;
const VB_W = 180;
const VB_H = 220;

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

  const height = Math.round(size * (VB_H / VB_W));

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

        {/* Center label inside the avocado */}
        {showLabel && (
          <SvgText
            x={PATH_CX}
            y={78 + 2 * MACRO_GAUGE_TEXT.value.md.fontSize} // "2 lines" down
            fontSize={MACRO_GAUGE_TEXT.value.md.fontSize}
            fontFamily={FontFamilies.regular}
            textAnchor="middle"
          >
            {/* Line 1 */}
            <TSpan fill={calTextColor}>
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


