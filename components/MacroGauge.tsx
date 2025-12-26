import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText, Polygon, G } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MacroGaugeProps = {
  label: string;
  value: number;   // consumed
  target: number;  // goal
  unit?: string;
  size?: 'sm' | 'md'; // new
  mode?: 'min' | 'max';
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
  mode = 'min',
}: MacroGaugeProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;

  // Scale: BOTH modes land the target at 75% of the gauge (headroom to the right)
  const gaugeMax = safeTarget > 0 ? safeTarget / 0.75 : 1;

  // Needle/arc progress is always against gaugeMax (pins at end if over gaugeMax)
  const v = clamp(value, 0, gaugeMax);
  const pct = v / gaugeMax; // 0..1

  // For max-mode warning colors, we compare against the true target (not gaugeMax)
  const pctOfTarget = safeTarget > 0 ? value / safeTarget : 0;

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

  // Needle should touch the inner edge of the arc stroke
  const needleLen = r - stroke / 2;
  const needleEnd = polar(cx, cy, needleLen, angle);

  // Target is always at 75% of gauge => angle = 180 - 180*0.75 = 45deg
  const targetAngle = 45;

  // Place marker at centerline of the stroke
  const markerPoint = polar(cx, cy, r, targetAngle);

  // A slightly outward point for tick direction
  const markerOut = polar(cx, cy, r + (isSm ? 6 : 8), targetAngle);

  const PINK = '#FF5FA2';
  const ORANGE = '#FFA500';
  const GREEN = '#2ECC71';
  const RED = '#FF3B30';

  const markerColor = mode === 'max' ? RED : GREEN;

  let filledColor = ORANGE;

  if (mode === 'max') {
    // max-mode uses % of the TRUE target
    // Green: first 85%
    // Orange: 85%–99%
    // Pink: 100%–105%
    // Red: >105%
    if (pctOfTarget > 1.05) filledColor = RED;
    else if (pctOfTarget >= 1.0) filledColor = PINK;
    else if (pctOfTarget >= 0.85) filledColor = ORANGE;
    else filledColor = GREEN;
  } else {
    // min-mode uses GAUGE progress (target hits at 75% of gauge)
    // Pink: 0%–25% of gauge
    // Orange: 25%–<75% of gauge
    // Green: >=75% (target reached)
    if (pct >= 0.75) filledColor = GREEN;
    else if (pct <= 0.25) filledColor = PINK;
    else filledColor = ORANGE;
  }

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
            stroke={filledColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Target marker tick (at 75% point) */}
        <Line
          x1={markerPoint.x}
          y1={markerPoint.y}
          x2={markerOut.x}
          y2={markerOut.y}
          stroke={markerColor}
          strokeWidth={isSm ? 2 : 2.5}
          strokeLinecap="round"
        />

        {/* Needle */}
        {(() => {
          // Direction vector from center to needleEnd
          const dx = needleEnd.x - cx;
          const dy = needleEnd.y - cy;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;

          // Unit direction
          const ux = dx / len;
          const uy = dy / len;

          // Perpendicular unit
          const px = -uy;
          const py = ux;

          // Needle thickness scales with size
          const baseHalf = isSm ? 2.2 : 3.0;

          // Tip length (triangle)
          const tipLen = isSm ? 7 : 10;

          // Triangle tip point (at needleEnd)
          const tipX = needleEnd.x;
          const tipY = needleEnd.y;

          // Triangle base center slightly behind the tip
          const baseCX = tipX - ux * tipLen;
          const baseCY = tipY - uy * tipLen;

          // Base corners
          const b1x = baseCX + px * baseHalf;
          const b1y = baseCY + py * baseHalf;
          const b2x = baseCX - px * baseHalf;
          const b2y = baseCY - py * baseHalf;

          // Stem ends at triangle base center
          const stemEndX = baseCX;
          const stemEndY = baseCY;

          return (
            <>
              {/* Stem */}
              <Line
                x1={cx}
                y1={cy}
                x2={stemEndX}
                y2={stemEndY}
                stroke={colors.tint}
                strokeWidth={isSm ? 2 : 3}
                strokeLinecap="round"
              />

              {/* Pointy tip */}
              <Polygon
                points={`${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`}
                fill={colors.tint}
              />
            </>
          );
        })()}
        <Circle cx={cx} cy={cy} r={5} fill={colors.tint} />

        <SvgText
          x={cx}
          y={cy - (isSm ? 8 : 10)}
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


