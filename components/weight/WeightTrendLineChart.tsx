import { ThemedText } from '@/components/themed-text';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildFitbitPathD } from '@/lib/derive/weight-trend-path';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type Props = {
  values: number[]; // NaN = missing
  labelIndices: number[]; // indices into values to label
  getLabel: (index: number) => string;
  height?: number;
  // New props for Y-axis and improved labels
  dayKeys?: string[]; // Array of date keys (YYYY-MM-DD) for the 7-day range
  todayDateString?: string; // Today's date key for "Today" label
  yesterdayDateString?: string; // Yesterday's date key for "Yesterday" label
  /** Dashboard-only: show "Yday" instead of "Yesterday" for yesterday label */
  useYdayLabel?: boolean;
  /** When true, X-axis labels use Today/Yesterday/weekday; when false, use getLabel only (7d only). */
  useTodayYesterdayLabels?: boolean;
  selectedDateString?: string; // Selected date key (last date in range) for Y-axis dotted line
  dailyMap?: Map<string, { weight_lb: number | null }>; // Map to look up weight values by date key
  unit?: 'kg' | 'lbs'; // Weight unit for formatting Y-axis labels
  /** Optional dot radius (default 5); use 4 for long ranges 3m/6m/1y to reduce clutter. */
  dotRadius?: number;
  onDayPress?: (dateKey: string) => void; // Optional: enable per-day navigation (dashboard)
  /** Optional: when user taps "Add one more weigh-in" empty state (dashboard) */
  onEmptyStatePress?: () => void;
};

export function WeightTrendLineChart({ 
  values, 
  labelIndices, 
  getLabel, 
  height = 200,
  dayKeys,
  todayDateString,
  yesterdayDateString,
  useYdayLabel = false,
  useTodayYesterdayLabels = false,
  selectedDateString,
  dailyMap,
  unit = 'lbs',
  dotRadius = 5,
  onDayPress,
  onEmptyStatePress,
}: Props) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [width, setWidth] = useState(0);

  // Reduce overall chart height (~30%) at the source, letting existing scaling math reflow naturally.
  const effectiveHeight = Math.round(height * 1.4);
  
  // Y-axis width for labels
  // IMPORTANT: Keep plot offset width stable so dots/line/X-axis do not shift.
  const yAxisWidth = 40;
  // Label column can be wider to avoid clipping, but must NOT change plot math.
  const yAxisLabelWidth = yAxisWidth + 16;

  // Format weight value for Y-axis label
  const formatWeightLabel = (value: number) => {
    const rounded = roundTo1(value);
    return unit === 'kg' ? `${rounded.toFixed(1)} kg` : `${rounded.toFixed(1)} lbs`;
  };

  const chart = useMemo(() => {
    const DOT_R = Math.max(1, Math.min(10, dotRadius));
    const PAD_X = DOT_R + 2;
    const PAD_Y_TOP = DOT_R + 2;
    const PAD_Y_BOTTOM = DOT_R + 10;
    const xAxisHeight = FontSize.sm + Spacing.sm; // Space for X-axis labels
    const plotHeight = Math.max(effectiveHeight - PAD_Y_TOP - PAD_Y_BOTTOM - xAxisHeight, 1);

    const n = values.length;
    const denom = Math.max(1, n - 1);

    const finite = values.filter((v) => Number.isFinite(v));
    // Need at least 1 point for path/dots; "trend" empty state when < 2.
    if (finite.length < 1) {
      return {
        hasSufficientPoints: false,
        DOT_R,
        PAD_X,
        PAD_Y_TOP,
        PAD_Y_BOTTOM,
        plotHeight,
        xAxisHeight,
        rawMin: 0,
        rawMax: 1,
        minY: 0,
        maxY: 1,
        pathD: '',
        pointsByIndex: [] as Array<{ x: number; y: number } | null>,
      };
    }

    // Improve scaling: add small headroom/footroom so dots don't hug edges.
    const rawMin = Math.min(...finite);
    const rawMax = Math.max(...finite);
    const rawSpan = Math.max(1e-6, rawMax - rawMin);
    const pad = rawSpan * 0.12; // ~12% padding
    const minY = rawMin - pad;
    const maxY = rawMax + pad;
    const span = Math.max(1e-6, maxY - minY);

    // Calculate usable width - account for Y-axis if it will be shown
    // We'll determine this dynamically based on whether yAxisPoints will be calculated
    const effectiveYAxisWidth = (dailyMap && selectedDateString) ? yAxisWidth : 0;
    const usableWidth = Math.max(0, width - effectiveYAxisWidth - PAD_X * 2);
    const usableHeight = Math.max(0, plotHeight);

    // Compute points by index so each dot stays in its calendar-day slot.
    const pointsByIndex: Array<{ x: number; y: number } | null> = values.map((v, i) => {
      if (!Number.isFinite(v)) return null;
      const x = PAD_X + (i / denom) * usableWidth;
      const y = PAD_Y_TOP + ((maxY - v) / span) * usableHeight;
      return { x, y };
    });

    const pathD = buildFitbitPathD(pointsByIndex);
    const hasSufficientPoints = finite.length >= 2;

    return {
      hasSufficientPoints,
      DOT_R,
      PAD_X,
      PAD_Y_TOP,
      PAD_Y_BOTTOM,
      plotHeight,
      xAxisHeight,
      rawMin,
      rawMax,
      minY,
      maxY,
      span,
      pathD,
      pointsByIndex,
    };
  }, [effectiveHeight, values, width, yAxisWidth, dailyMap, selectedDateString, dotRadius]);
  
  // Nice Y-axis ticks: ~5 ticks (cap <= 7), same scale as dots; one list for both grid and labels.
  const yAxisPoints = useMemo(() => {
    if (!chart.hasSufficientPoints || !dailyMap || !selectedDateString) return [];
    const { rawMin, rawMax, minY, maxY, plotHeight, span } = chart;
    const plotSpan = span ?? Math.max(1e-6, maxY - minY);
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return [];

    const stepsLbs = [0.2, 0.5, 1, 2, 5];
    const stepsKg = [0.1, 0.2, 0.5, 1];
    const candidates = unit === 'kg' ? stepsKg : stepsLbs;

    // Flat-line guard: if all values identical, expand range for tick generation.
    let workMin = rawMin;
    let workMax = rawMax;
    if (rawMin === rawMax) {
      const flatStep = unit === 'kg' ? 0.5 : 1;
      workMin = rawMin - flatStep;
      workMax = rawMax + flatStep;
    }
    const range = Math.max(1e-6, workMax - workMin);

    // Pick step: closest to range/4; if tick count > 7, use next larger candidate.
    let step = candidates[0];
    for (const s of candidates) {
      step = s;
      const nMin = Math.floor(workMin / step) * step;
      const nMax = Math.ceil(workMax / step) * step;
      const count = Math.round((nMax - nMin) / step) + 1;
      if (count <= 7) break;
    }

    const niceMin = Math.floor(workMin / step) * step;
    const niceMax = Math.ceil(workMax / step) * step;
    const ticksSet = new Set<number>();
    for (let v = niceMin; v <= niceMax + 1e-6; v += step) {
      ticksSet.add(roundTo1(v));
    }
    let ticks = Array.from(ticksSet);
    if (ticks.length === 0) ticks = [roundTo1(niceMin), roundTo1(niceMax)];

    // Filter: only ticks within [minY, maxY] (same list for grid and labels).
    const filtered = ticks.filter((v) => v >= minY - 1e-6 && v <= maxY + 1e-6);
    const points: Array<{ value: number; position: number; isHighlight: boolean }> = filtered.map((value) => {
      const position = ((value - minY) / plotSpan) * plotHeight;
      return { value, position: Math.max(0, Math.min(plotHeight, position)), isHighlight: false };
    });
    points.sort((a, b) => a.position - b.position);

    // Highlight nearest existing tick to selected (or last valid) weight; styling only.
    const selectedRow = dailyMap.get(selectedDateString);
    let refWeight: number | null = null;
    if (selectedRow && selectedRow.weight_lb != null) {
      refWeight = unit === 'kg' ? roundTo1(lbToKg(selectedRow.weight_lb)) : roundTo1(selectedRow.weight_lb);
    }
    if (refWeight == null) {
      const revIdx = [...values].reverse().findIndex((v) => Number.isFinite(v));
      const lastFiniteIdx = revIdx >= 0 ? values.length - 1 - revIdx : -1;
      if (lastFiniteIdx >= 0 && Number.isFinite(values[lastFiniteIdx])) refWeight = values[lastFiniteIdx];
    }
    if (refWeight != null && points.length > 0) {
      const nearest = points.reduce((prev, curr) =>
        Math.abs(curr.value - refWeight!) < Math.abs(prev.value - refWeight!) ? curr : prev
      );
      nearest.isHighlight = true;
    }

    return points;
  }, [chart, dailyMap, selectedDateString, unit, values]);
  
  // Only 7-day range uses Today/Yesterday/weekday; other ranges use getLabel only.
  const enhancedGetLabel = useMemo(() => {
    if (!useTodayYesterdayLabels || !dayKeys || !todayDateString) return getLabel;
    
    return (idx: number) => {
      const key = dayKeys[idx];
      if (!key) return getLabel(idx);
      
      if (key === todayDateString) {
        return t('common.today');
      }
      if (yesterdayDateString && key === yesterdayDateString) {
        return useYdayLabel ? t('date.yday') : t('common.yesterday');
      }
      const d = new Date(`${key}T00:00:00`);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    };
  }, [useTodayYesterdayLabels, dayKeys, todayDateString, yesterdayDateString, getLabel, t, useYdayLabel]);

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && Number.isFinite(w)) setWidth(w);
      }}
    >
      {width > 0 && chart.hasSufficientPoints ? (
        <View style={[styles.chartContainer, { height: effectiveHeight }]}>
          {(() => {
            const effectiveYAxisWidth = yAxisPoints.length > 0 ? yAxisWidth : 0;
            const plotWidth = width - effectiveYAxisWidth;
            const dayCount = values.length;
            const dayWidth = dayCount > 0 ? plotWidth / dayCount : 0;

            const getDayA11yLabel = (idx: number) => {
              const key = dayKeys?.[idx];
              const fallback = enhancedGetLabel(idx);
              if (!key) return fallback || 'Day';
              if (todayDateString && key === todayDateString) return t('common.today');
              if (yesterdayDateString && key === yesterdayDateString) return useYdayLabel ? t('date.yday') : t('common.yesterday');
              return fallback || key;
            };

            return (
              <>
          {/* Y-axis labels */}
          {yAxisPoints.length > 0 && (
            <View
              style={[
                styles.yAxisContainer,
                {
                  // Keep the plot offset at x=yAxisWidth, but give labels more room to the left.
                  left: yAxisWidth - yAxisLabelWidth,
                  width: yAxisLabelWidth,
                  top: 0,
                  bottom: chart.xAxisHeight,
                },
              ]}
            >
              {yAxisPoints.map((point, idx) => {
                // Y-axis label vertical alignment offset (nudge text down so it sits on the dotted line).
                const BASE_LABEL_OFFSET = Math.round(FontSize.xs * 0.35);
                const isMin = point.value === chart.rawMin;
                const labelOffset = BASE_LABEL_OFFSET + (isMin ? Math.round(FontSize.xs * 0.35) : 0);
                
                return (
                  <View
                    key={idx}
                    style={[
                      styles.yAxisLabelContainer,
                      {
                        position: 'absolute',
                        bottom: chart.PAD_Y_BOTTOM + point.position,
                        transform: [{ translateY: labelOffset }],
                      },
                    ]}
                  >
                    <ThemedText style={[styles.yAxisLabel, { color: colors.textSecondary }]}>
                      {formatWeightLabel(point.value)}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}

          {/* Plot area */}
          <View
            style={[
              styles.plotArea,
              {
                position: 'absolute',
                left: effectiveYAxisWidth,
                right: 0,
                top: 0,
                bottom: chart.xAxisHeight,
              },
            ]}
          >
            {/* Optional per-day tap overlay (dashboard). Kept above SVG (SVG has pointerEvents=none). */}
            {onDayPress && dayKeys && dayWidth > 0 && (
              <View style={styles.dayTapOverlay} pointerEvents="box-none">
                {values.map((_, idx) => {
                  const dayKey = dayKeys[idx];
                  if (!dayKey) return null;
                  const left = idx * dayWidth;
                  return (
                    <TouchableOpacity
                      key={dayKey}
                      style={[styles.dayTapTarget, { left, width: dayWidth }, getMinTouchTargetStyle()]}
                      onPress={() => onDayPress(dayKey)}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(getDayA11yLabel(idx), t('dashboard.food.chart_bar_hint'))}
                      {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                    />
                  );
                })}
              </View>
            )}

            {/* Dotted horizontal lines at Y-axis points - rendered behind trend line */}
            {yAxisPoints.length > 0 && yAxisPoints.map((point, idx) => (
              <View
                key={idx}
                style={[
                  styles.yAxisLine,
                  {
                    bottom: chart.PAD_Y_BOTTOM + point.position,
                    borderColor: colors.textSecondary,
                    opacity: point.isHighlight ? 1 : 0.8,
                  },
                ]}
              />
            ))}

            {/* Trend line and dots - rendered on top; emphasize latest data point */}
            {(() => {
              let lastFiniteIndex = -1;
              for (let i = values.length - 1; i >= 0; i--) {
                if (Number.isFinite(values[i])) {
                  lastFiniteIndex = i;
                  break;
                }
              }
              return (
                <View style={[styles.trendLineContainer, { zIndex: 2 }]}>
                  <Svg
                    width={width - effectiveYAxisWidth}
                    height={effectiveHeight - chart.xAxisHeight}
                    viewBox={`0 0 ${width - effectiveYAxisWidth} ${effectiveHeight - chart.xAxisHeight}`}
                    preserveAspectRatio="none"
                    pointerEvents="none"
                  >
                    <Path d={chart.pathD} fill="none" stroke={colors.tint} strokeWidth={2} />
                    {chart.pointsByIndex.map((p, idx) =>
                      p ? (
                        <Circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={idx === lastFiniteIndex ? chart.DOT_R + 1 : chart.DOT_R}
                          stroke={colors.tint}
                          strokeWidth={idx === lastFiniteIndex ? 3 : 2}
                          fill={colors.tint}
                        />
                      ) : null
                    )}
                  </Svg>
                </View>
              );
            })()}
          </View>

          {/* X-axis labels: inject end index, filter by 42px spacing, fixed 60px width, clamp left */}
          {(() => {
            const n = values.length;
            const endIndex = n - 1;
            const plotWidth = width - effectiveYAxisWidth;
            const usableWidth = Math.max(0, plotWidth - chart.PAD_X * 2);
            const denom = Math.max(1, n - 1);
            const MIN_LABEL_SPACING_PX = 42;
            const LABEL_WIDTH = 60;

            const candidates = Array.from(new Set([...labelIndices, endIndex])).sort((a, b) => a - b);
            let lastX = -Infinity;
            const filteredLabelIndices: number[] = [];
            for (const idx of candidates) {
              if (idx < 0 || idx >= n) continue;
              const dotX = n <= 1 ? plotWidth / 2 : chart.PAD_X + (idx / denom) * usableWidth;
              if (dotX - lastX >= MIN_LABEL_SPACING_PX || idx === endIndex) {
                filteredLabelIndices.push(idx);
                lastX = dotX;
              }
            }

            return (
              <View
                style={[
                  styles.labelsLayer,
                  {
                    position: 'absolute',
                    left: effectiveYAxisWidth,
                    right: 0,
                    bottom: 0,
                    height: chart.xAxisHeight,
                  },
                ]}
                pointerEvents="none"
              >
                {filteredLabelIndices.map((idx) => {
                  const dotX = n <= 1 ? plotWidth / 2 : chart.PAD_X + (idx / denom) * usableWidth;
                  const leftPos = clamp(dotX - LABEL_WIDTH / 2, 0, plotWidth - LABEL_WIDTH);
                  const text = enhancedGetLabel(idx);
                  if (!text) return null;
                  const dayKey = dayKeys?.[idx];
                  const isToday = todayDateString && dayKey === todayDateString;
                  return (
                    <View key={idx} style={[styles.labelItem, { left: leftPos, width: LABEL_WIDTH }]}>
                      <ThemedText
                        numberOfLines={1}
                        style={[
                          { color: colors.textSecondary, fontSize: FontSize.sm },
                          isToday && styles.labelToday,
                        ]}
                      >
                        {text}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            );
          })()}
              </>
            );
          })()}
        </View>
      ) : onEmptyStatePress ? (
        <TouchableOpacity
          onPress={onEmptyStatePress}
          activeOpacity={0.7}
          style={[styles.emptyStateRow, getMinTouchTargetStyle(), Platform.OS === 'web' && styles.emptyStateRowWeb]}
          {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
          {...getButtonAccessibilityProps(
            t('weight.chart_add_one_more'),
            t('weight.dashboard.accessibility_hint')
          )}
        >
          <ThemedText style={{ color: colors.textSecondary }}>{t('weight.chart_add_one_more')}</ThemedText>
        </TouchableOpacity>
      ) : (
        <ThemedText style={{ color: colors.textSecondary }}>{t('weight.chart_add_one_more')}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    // Allow wider Y-axis labels without clipping (does not affect dots/line/x-axis).
    overflow: 'visible',
  },
  chartContainer: {
    position: 'relative',
    width: '100%',
  },
  yAxisContainer: {
    position: 'absolute',
    alignItems: 'flex-end',
    // Keep text fully inside the label column.
    paddingLeft: 4,
    paddingRight: 6,
  },
  yAxisLabelContainer: {
    width: '100%',
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  plotArea: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  trendLineContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  yAxisLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 0, // Behind trend line
  },
  dayTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3, // Above dotted lines + SVG (SVG pointerEvents=none)
  },
  dayTapTarget: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  labelsLayer: {
    // Positioned absolutely in render so X-axis stays pinned to chart bottom.
    // Keep base style minimal to avoid unintended vertical offsets.
    height: FontSize.sm + Spacing.sm,
  },
  labelItem: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  labelToday: {
    fontWeight: FontWeight.bold,
  },
  emptyStateRow: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  emptyStateRowWeb: {
    cursor: 'pointer',
  },
});


