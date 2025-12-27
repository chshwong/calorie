import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamilies, GaugeText } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { ensureContrast } from '@/theme/contrast';

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
  end: number,
  sweepFlag: 0 | 1
) => {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 ${sweepFlag} ${e.x} ${e.y}`;
};

export function MacroGauge({
  label,
  value,
  target,
  unit = 'g',
  size = 'md',
  mode = 'min',
}: MacroGaugeProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const modeKey = (scheme ?? 'light') as 'light' | 'dark';

  const isDark = scheme === 'dark';

  const trackColor = colors.chartGrey;

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;

  // Scale: BOTH modes land the target at 75% of the gauge (headroom to the right)
  const gaugeMax = safeTarget > 0 ? safeTarget / 0.75 : 1;

  // Needle/arc progress is always against gaugeMax (pins at end if over gaugeMax)
  const v = clamp(value, 0, gaugeMax);
  const pct = v / gaugeMax; // 0..1

  // For max-mode warning colors, we compare against the true target (not gaugeMax)
  const pctOfTarget = safeTarget > 0 ? value / safeTarget : 0;

  const angle = 180 - 180 * pct;

  const aNow = angle; // current needle angle (180 -> 0)

  // Convert % of TARGET to an angle on the gauge.
  const angleForPctOfTarget = (pctTarget: number) => {
    // target is at 75% of gauge
    const pctGauge = clamp(pctTarget * 0.75, 0, 1);
    return 180 - 180 * pctGauge;
  };

  // Carbs zones expressed as angles on the gauge
  const a85 = angleForPctOfTarget(0.85);
  const a99 = angleForPctOfTarget(0.99);
  const a100 = angleForPctOfTarget(1.0);
  const a105 = angleForPctOfTarget(1.05);

  const isSm = size === 'sm';

  // SVG scales to parent width; keep a stable aspect ratio via viewBox
  const vbW = isSm ? 120 : 260;
  const vbH = isSm ? 78 : 140;

  const stroke = isSm ? 8 : 14;

  const cx = vbW / 2;
  // Reduce unused bottom space inside the SVG so the value row sits closer to the arc.
  // (Does not change arc size; only its vertical position within the viewBox.)
  const cy = vbH - (isSm ? 6 : 10);
  const r = isSm ? 46 : 100;

  const fullArc = arcPath(cx, cy, r, 180, 0, 1);
  const filledArc = useMemo(() => {
    if (pct <= 0) return null;
    // min-mode only: fill from left (180) -> needle angle along the TOP arc
    if (mode !== 'max') return arcPath(cx, cy, r, 180, angle, 1);
    return null; // max-mode uses spectrum zones, not filledArc
  }, [pct, mode, cx, cy, r, angle]);

  // Needle should touch the inner edge of the arc stroke
  const needleLen = r - stroke / 2;
  const needleEnd = polar(cx, cy, needleLen, angle);

  // Target is always at 75% of gauge => angle = 180 - 180*0.75 = 45deg
  const targetAngle = 45;

  // Place marker at centerline of the stroke
  const markerPoint = polar(cx, cy, r, targetAngle);

  // A slightly outward point for tick direction
  const markerOut = polar(cx, cy, r + (isSm ? 6 : 8), targetAngle);

  // NOTE: Arc colors are intentionally NOT contrast-adjusted (per design).
  // Only the consumed value text below is contrast-guarded for WCAG AA.
  const PINK = colors.chartPink;
  const ORANGE = colors.chartOrange;
  const GREEN = colors.chartGreen;
  const RED = colors.chartRed;

  // For carbs only:
  // - dark mode: keep the dark mask you like
  // - light mode: opaque light-mode mask
  const consumedMaskColor = isDark
    ? 'rgba(60,60,60,0.92)'          // keep dark mode exactly
    : 'rgba(180,180,180,1)';         // opaque light-mode mask

  const markerColor = mode === 'max' ? PINK : GREEN;

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

  // Single source of truth: this is the same color used for the active arc state.
  const activeColor = safeTarget > 0 ? filledColor : undefined;
  const consumedColor = activeColor ? ensureContrast(activeColor, colors.card, modeKey, 4.5) : undefined;
  const consumedFormatted = `${Math.round(value)}${unit}`;
  const targetFormatted = safeTarget > 0 ? `${Math.round(safeTarget)}${unit}` : t('common.no_target');

  return (
    <View style={styles.container}>
      <Svg width="100%" height={isSm ? 78 : 140} viewBox={`0 0 ${vbW} ${vbH}`}>
        {/* Grey track (min mode only; max mode draws its own grey base track) */}
        {mode !== 'max' && (
          <Path
            d={fullArc}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Filled portion - min mode only */}
        {mode !== 'max' && filledArc && (
          <Path
            d={filledArc}
            stroke={filledColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Carbs: static zone track + grey consumed overlay */}
        {mode === 'max' && (
          <>
            {/* 1) STATIC colored track (zones) on TOP arc */}
            {(() => {
              // Convert % of TARGET to gauge angle:
              // target is at 75% of gauge => pctGauge = pctTarget * 0.75
              const ang = (pctTarget: number) => {
                const pctGauge = clamp(pctTarget * 0.75, 0, 1);
                return 180 - 180 * pctGauge;
              };

              // Your requested zones on GAUGE:
              // Green: first 85% of the 75% target range => 0..0.85 target
              // Orange: 0.85..1.05 target
              // Red: >1.05 target (rest of gauge)
              const aGreenEnd = ang(0.85);
              const aOrangeEnd = ang(1.05);

              return (
                <>
                  {/* Green zone: 0 -> 85% target */}
                  <Path
                    d={arcPath(cx, cy, r, 180, aGreenEnd, 1)}
                    stroke={GREEN}
                    strokeWidth={stroke}
                    fill="none"
                    strokeLinecap="round"
                  />

                  {/* Orange zone: 85% -> 105% target */}
                  <Path
                    d={arcPath(cx, cy, r, aGreenEnd, aOrangeEnd, 1)}
                    stroke={ORANGE}
                    strokeWidth={stroke}
                    fill="none"
                    strokeLinecap="butt"
                  />

                  {/* Red zone: beyond 105% target -> end of gauge */}
                  <Path
                    d={arcPath(cx, cy, r, aOrangeEnd, 0, 1)}
                    stroke={RED}
                    strokeWidth={stroke}
                    fill="none"
                    strokeLinecap="round"
                  />
                </>
              );
            })()}

            {/* Grey-out CONSUMED portion (left of needle): 180° -> needle, forced on top arc */}
            {pct > 0 && (
              <Path
                // Start a hair past 180 to cover the rounded cap at the far left
                d={arcPath(
                  cx,
                  cy,
                  r,
                  181,
                  clamp(aNow, 0, 180),
                  1
                )}
                stroke={consumedMaskColor}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </>
        )}

        {/* Target marker tick (at 75% point) */}
        {mode === 'max' ? (
          // CAP STOP BAR (thicker + squared)
          <Line
            x1={markerPoint.x}
            y1={markerPoint.y}
            x2={markerOut.x}
            y2={markerOut.y}
            stroke={markerColor}
            strokeWidth={isSm ? 4 : 5}
            strokeLinecap="butt"
          />
        ) : (
          // MIN MODE TICK (thin + rounded)
          <Line
            x1={markerPoint.x}
            y1={markerPoint.y}
            x2={markerOut.x}
            y2={markerOut.y}
            stroke={markerColor}
            strokeWidth={isSm ? 2.2 : 2.8}
            strokeLinecap="round"
          />
        )}

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
        {mode === 'max' ? (
          <Circle
            cx={cx}
            cy={cy}
            r={5}
            fill={colors.background}
            stroke={colors.tint}
            strokeWidth={2}
          />
        ) : (
          <Circle cx={cx} cy={cy} r={5} fill={colors.tint} />
        )}

        <SvgText
          x={cx}
          y={cy - (isSm ? 8 : 10)}
          fontSize={isSm ? GaugeText.macroGauge.label.md.fontSize : GaugeText.macroGauge.label.md.fontSize}
          fontFamily={FontFamilies.semibold}
          fill={colors.text}
          textAnchor="middle"
        >
          {label}
        </SvgText>
      </Svg>

      <ThemedText style={[styles.value, isSm && styles.valueSm]}>
        {safeTarget > 0 ? (
          <>
            <Text style={consumedColor ? { color: consumedColor } : undefined}>{consumedFormatted}</Text>
            <Text>{` / ${targetFormatted}`}</Text>
          </>
        ) : (
          <Text>{`${consumedFormatted} / ${targetFormatted}`}</Text>
        )}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  value: {
    marginTop: 2,
    fontSize: GaugeText.macroGauge.value.md.fontSize,
    lineHeight: Math.round(GaugeText.macroGauge.value.md.fontSize * 1.15),
    fontFamily: FontFamilies.regular,
  },
  valueSm: {
    marginTop: 2,
    fontSize: GaugeText.macroGauge.value.sm.fontSize,
    lineHeight: Math.round(GaugeText.macroGauge.value.sm.fontSize * 1.15),
    fontFamily: FontFamilies.regular,
  },
});

export const MACRO_GAUGE_TEXT = {
  label: GaugeText.macroGauge.label,
  value: GaugeText.macroGauge.value,
};


