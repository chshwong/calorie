import { MACRO_GAUGE_TEXT } from '@/components/MacroGauge';
import { Colors, FontFamilies, FontSize, Nudge, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensureContrast } from '@/theme/contrast';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, TSpan } from 'react-native-svg';

const CURVY_GAUGE_FILL_DURATION_MS = 1600;
const CURVY_GAUGE_FILL_EASING = Easing.out(Easing.cubic);

type GoalType = 'lose' | 'maintain' | 'recomp' | 'gain';

type CalorieCurvyGaugeProps = {
  consumed: number;
  target: number;
  goalType: GoalType;
  /** When true, skip mount fill animation (e.g. prefers-reduced-motion). */
  reduceMotion?: boolean;
  /** Change to re-run fill animation (e.g. selected date key). */
  animationKey?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

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

export function CalorieCurvyGauge({ consumed, target, goalType, reduceMotion = false, animationKey }: CalorieCurvyGaugeProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const modeKey = (scheme ?? 'light') as 'light' | 'dark';

  const PINK = colors.chartPink;
  const RED = colors.chartRed;
  const GREEN = colors.chartGreen;
  const ORANGE = colors.chartOrange;
  const TEAL = colors.appTeal; // from theme

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;

  const pct = safeTarget > 0 ? safeConsumed / safeTarget : 0;
  const fillT = clamp(pct, 0, 1); // cap fill at 100% of path

  // Fill animation (0 -> 1) when target > 0 and !reduceMotion. Re-runs when animationKey changes (e.g. date change).
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [animatedProgress, setAnimatedProgress] = useState(reduceMotion || safeTarget === 0 ? 1 : 0);

  useEffect(() => {
    if (reduceMotion || safeTarget === 0) {
      setAnimatedProgress(1);
      return;
    }
    progressAnim.setValue(0);
    setAnimatedProgress(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: CURVY_GAUGE_FILL_DURATION_MS,
      easing: CURVY_GAUGE_FILL_EASING,
      useNativeDriver: false,
    }).start(() => setAnimatedProgress(1));
  }, [reduceMotion, safeTarget, progressAnim, animationKey]);

  useEffect(() => {
    const listener = progressAnim.addListener(({ value: v }) => setAnimatedProgress(v));
    return () => progressAnim.removeListener(listener);
  }, [progressAnim]);

  const displayFillT = fillT * animatedProgress;
  const consumedRounded = Math.round(safeConsumed * animatedProgress);
  const percentDisplay = useMemo(() => {
    if (safeTarget <= 0) return null;
    const displayConsumed = safeConsumed * animatedProgress;
    const rawPct = (displayConsumed / safeTarget) * 100;
    if (!Number.isFinite(rawPct)) return null;
    return rawPct.toFixed(1).replace(/\.0$/, '');
  }, [safeConsumed, safeTarget, animatedProgress]);

  // Color rules
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

  const displayConsumed = safeConsumed * animatedProgress;
  const remainingRaw = safeTarget > 0 ? Math.round(safeTarget - displayConsumed) : 0;
  const isOverBudget = safeTarget > 0 && remainingRaw < 0;
  const remainingAmount = safeTarget > 0 ? (isOverBudget ? Math.abs(remainingRaw) : remainingRaw) : 0;

  // SVG geometry (responsive via viewBox)
  const vbW = 320;

  // Curve control points (tighter vertically)
  const p0 = { x: 24, y: 56 };
  const p1 = { x: 110, y: 24 };
  const p2 = { x: 210, y: 24 };
  const p3 = { x: 296, y: 56 };

  const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  // Approximate path length by sampling (works web+native; avoids getTotalLength differences)
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

  // Dash fill (animated on mount)
  const filledLen = totalLen * displayFillT;

  // Tip position (animated on mount)
  const tipT = displayFillT;
  const tip = cubicPoint(tipT, p0, p1, p2, p3);

  const trackColor = colors.chartGrey;
  const calUnit = t('home.food_log.kcal');
  const calTextColor =
    safeTarget > 0 ? ensureContrast(lineColor, colors.card, modeKey, 4.5) : colors.textSecondary;

  // Nudge the tip label slightly left to avoid clipping on narrow screens when the gauge is full.
  const tipLabelX = tip.x - Spacing.xxs;
  // Slightly smaller label to reduce clipping risk (requested: -1pt).
  const tipLabelFontSize = Math.max(FontSize.xs, MACRO_GAUGE_TEXT.value.sm.fontSize - Nudge.px1);

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={110} viewBox={`0 8 ${vbW} 100`}>

        {/* Track */}
        <Path d={d} stroke={trackColor} strokeWidth={10} fill="none" strokeLinecap="round" />

        {/* Filled portion (dash) */}
        <Path
          d={d}
          stroke={lineColor}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filledLen} ${Math.max(0.001, totalLen - filledLen)}`}
        />

        {/* Tip marker + consumed label */}
        <Circle cx={tip.x} cy={tip.y} r={4} fill={lineColor} />
        {/* Text halo (drawn first) */}
        <SvgText
          x={tipLabelX}
          y={tip.y - 10}
          fontSize={tipLabelFontSize}
          fontFamily={FontFamilies.regular}
          fill={colors.card}
          stroke={colors.card}
          // NOTE: This SVG text halo width is tuned visually for readability across themes.
          // We don't currently have a dedicated theme token for SVG text strokes.
          strokeWidth={4}
          strokeLinejoin="round"
          textAnchor="middle"
        >
          <TSpan x={tipLabelX}>🥪{`${consumedRounded}`}</TSpan>
          {percentDisplay != null ? (
            <TSpan x={tipLabelX} dy={tipLabelFontSize + 2}>{`${percentDisplay}%`}</TSpan>
          ) : null}
        </SvgText>

        {/* Foreground text */}
        <SvgText
          x={tipLabelX}
          y={tip.y - 10}
          fontSize={tipLabelFontSize}
          fontFamily={FontFamilies.regular}
          fill={colors.textSecondary}
          textAnchor="middle"
        >
          <TSpan x={tipLabelX}>🥪{`${consumedRounded}`}</TSpan>
          {percentDisplay != null ? (
            <TSpan x={tipLabelX} dy={tipLabelFontSize + 2}>{`${percentDisplay}%`}</TSpan>
          ) : null}
        </SvgText>

        {/* Center text below the curve */}
        <SvgText
          x={vbW / 2}
          y={70}
          fontSize={MACRO_GAUGE_TEXT.value.md.fontSize}
          fontFamily={FontFamilies.regular}
          textAnchor="middle"
        >
          <TSpan fill={calTextColor}>
            {safeTarget > 0
              ? `${remainingAmount} ${t('home.food_log.kcal')}`
              : `-- ${t('home.food_log.kcal')}`}
          </TSpan>
          <TSpan fill={colors.textSecondary}>
            {` ${isOverBudget ? t('home.summary.over_budget') : t('home.summary.remaining')}`}
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
  },
});


