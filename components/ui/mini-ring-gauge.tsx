import { Colors, FontFamilies, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

type MiniRingGaugeProps = {
  label: string; // e.g. "Sodium"
  value: number; // consumed
  target: number; // max
  unit?: string; // e.g. "mg"
  size?: 'xs' | 'sm'; // default xs (4-across mobile)
  /**
   * Formatting rule for the center value text.
   * Default keeps existing behavior (whole-number display).
   */
  valueFormat?: 'int' | 'ceilToTenth';
};

// NOTE: These SVG angles/sizes are *geometry constants* in the SVG viewBox coordinate system.
// They are not UI spacing/typography tokens. If we later expose sizing variants, we can promote them into theme tokens.
// 80% of a full circle = 288° span, leave 72° gap at bottom
const START_DEG = 234; // left-bottom-ish
const END_DEG = -54; // right-bottom-ish (same as 306°)
const SPAN = 288;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const ceilTo1Decimal = (n: number) => Math.ceil(n * 10) / 10;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, start: number, end: number) => {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);

  // Determine if arc > 180°
  const sweep = ((start - end) % 360 + 360) % 360; // clockwise span
  const largeArcFlag = sweep > 180 ? 1 : 0;

  // SweepFlag=1 draws clockwise in our polar setup
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${e.x} ${e.y}`;
};

export function MiniRingGauge({
  label,
  value,
  target,
  unit = '',
  size = 'xs',
  valueFormat = 'int',
}: MiniRingGaugeProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const safeValue = Number.isFinite(value) ? value : 0;

  // Gauge fills from 0 → 100% where 100% = target; if over, cap at end.
  const pct = clamp(safeTarget > 0 ? safeValue / safeTarget : 0, 0, 1);
  const angle = START_DEG - SPAN * pct;

  // For “max” nutrients, color should be friendly when low, caution near cap, etc.
  // Draft simple logic:
  // <85% of target -> green
  // 85–99% -> orange
  // >=100% -> pink
  // >125% -> red
  const pctOfTarget = safeTarget > 0 ? safeValue / safeTarget : 0;
  // Trans Fat rule: never show green; any non-zero amount should be orange immediately.
  // We intentionally key this off `valueFormat="ceilToTenth"` because labels are i18n’d
  // (so comparing to a hardcoded "Trans Fat" string would be fragile).
  const isTransFat = valueFormat === 'ceilToTenth';

  let fillColor = colors.chartGreen;
  if (isTransFat) {
    if (safeValue > 0) fillColor = colors.chartOrange;
    if (pctOfTarget >= 1) fillColor = colors.chartPink;
    if (pctOfTarget >= 1.25) fillColor = colors.chartRed;
  } else {
    if (pctOfTarget > 1.25) fillColor = colors.chartRed;
    else if (pctOfTarget >= 1) fillColor = colors.chartPink;
    else if (pctOfTarget >= 0.80) fillColor = colors.chartOrange;
  }

  const vbW = size === 'xs' ? 92 : 110;
  const vbH = size === 'xs' ? 80 : 90;
  const stroke = size === 'xs' ? 5 : 6;

  const cx = vbW / 2;
  const cy = vbH / 2.5 + (size === 'xs' ? 3 : 5);
  const r = size === 'xs' ? 32 : 39;

  const fullArc = arcPath(cx, cy, r, START_DEG, END_DEG);
  const filledArc = pct > 0 ? arcPath(cx, cy, r, START_DEG, angle) : null;

  let displayValue: string;
  if (valueFormat === 'ceilToTenth') {
    const v = safeValue <= 0 ? 0 : ceilTo1Decimal(safeValue);
    displayValue = v === 0 ? '0' : v.toFixed(1);
  } else {
    displayValue = String(Math.round(safeValue));
  }
  const valueText = unit ? `${displayValue}${unit}` : displayValue;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={vbH} viewBox={`0 0 ${vbW} ${vbH}`}>
        {/* Track */}
        <Path d={fullArc} stroke={colors.chartGrey} strokeWidth={stroke} fill="none" strokeLinecap="round" />

        {/* Fill */}
        {filledArc && (
          <Path d={filledArc} stroke={fillColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        )}

        {/* Center value */}
        <SvgText
          x={cx}
          y={cy + (size === 'xs' ? 2 : 6)}
          fontSize={size === 'xs' ? FontSize.sm : FontSize.gaugeLabelMd}
          fontFamily={FontFamilies.regular}
          fill={colors.text}
          textAnchor="middle"
        >
          {valueText}
        </SvgText>

        {/* Label */}
        <SvgText
          x={cx}
          y={cy + (size === 'xs' ? 14 : 26)}
          fontSize={size === 'xs' ? FontSize.xs : FontSize.sm}
          fontFamily={FontFamilies.regular}
          fill={colors.textSecondary}
          textAnchor="middle"
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
  },
});


