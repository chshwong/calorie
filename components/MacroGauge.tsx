import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MacroGaugeProps = {
  label: string;
  value: number;   // consumed
  target: number;  // goal
  unit?: string;
  size?: 'sm' | 'md'; // new
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
};

const arcPath = (
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number
) => {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`;
};

export function MacroGauge({
  label,
  value,
  target,
  unit = 'g',
  size = 'md',
}: MacroGaugeProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;

  // Scale: goal at 75%
  const gaugeMax = safeTarget > 0 ? safeTarget / 0.75 : 1;
  const v = clamp(value, 0, gaugeMax);
  const pct = v / gaugeMax;

  const angle = 180 - 180 * pct;

  const isSm = size === 'sm';

  // SVG scales to parent width; keep a stable aspect ratio via viewBox
  const vbW = isSm ? 120 : 260;
  const vbH = isSm ? 78 : 140;

  const stroke = isSm ? 8 : 14;

  const cx = vbW / 2;
  const cy = vbH - (isSm ? 10 : 18);
  const r = isSm ? 46 : 100;

  const fullArc = arcPath(cx, cy, r, 180, 0);
  const filledArc =
    pct > 0 ? arcPath(cx, cy, r, 180, angle) : null;

  const needleEnd = polar(cx, cy, r - 18, angle);

  return (
    <View style={styles.container}>
      <Svg width="100%" height={isSm ? 78 : 140} viewBox={`0 0 ${vbW} ${vbH}`}>
        {/* Grey track */}
        <Path
          d={fullArc}
          stroke={colors.backgroundSecondary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />

        {/* Filled portion */}
        {filledArc && (
          <Path
            d={filledArc}
            stroke={pct >= 0.75 ? '#2ECC71' : '#FFA500'}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <Line
          x1={cx}
          y1={cy}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={colors.tint}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={5} fill={colors.tint} />

        <SvgText
          x={cx}
          y={cy - (isSm ? 10 : 12)}
          fontSize={isSm ? 12 : 13}
          fontWeight="600"
          fill={colors.text}
          textAnchor="middle"
        >
          {label}
        </SvgText>
      </Svg>

      <ThemedText style={[styles.value, isSm && styles.valueSm]}>
        {Math.round(value)}{unit} / {safeTarget > 0 ? `${Math.round(safeTarget)}${unit}` : 'No target'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  value: {
    marginTop: -2,
    fontSize: 12,
  },
  valueSm: {
    marginTop: -2,
    fontSize: 12,
  },
});


