import { ThemedText } from '@/components/themed-text';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { buildFitbitPathD } from '@/lib/derive/weight-trend-path';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

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
  selectedDateString?: string; // Selected date key (last date in range) for Y-axis dotted line
  dailyMap?: Map<string, { weight_lb: number | null }>; // Map to look up weight values by date key
  unit?: 'kg' | 'lbs'; // Weight unit for formatting Y-axis labels
  onDayPress?: (dateKey: string) => void; // Optional: enable per-day navigation (dashboard)
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
  selectedDateString,
  dailyMap,
  unit = 'lbs',
  onDayPress,
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
    const DOT_R = 5;
    const PAD_X = DOT_R + 2;
    const PAD_Y_TOP = DOT_R + 2;
    const PAD_Y_BOTTOM = DOT_R + 10;
    const xAxisHeight = FontSize.sm + Spacing.sm; // Space for X-axis labels
    const plotHeight = Math.max(effectiveHeight - PAD_Y_TOP - PAD_Y_BOTTOM - xAxisHeight, 1);

    const n = values.length;
    const denom = Math.max(1, n - 1);

    const finite = values.filter((v) => Number.isFinite(v));
    // Fitbit-style: show dots for actual weigh-ins even if there's only 1 point.
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

    return {
      hasSufficientPoints: true,
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
  }, [effectiveHeight, values, width, yAxisWidth, dailyMap, selectedDateString]);
  
  // Calculate Y-axis points using chart's minY and maxY
  const yAxisPoints = useMemo(() => {
    if (!chart.hasSufficientPoints || !dailyMap || !selectedDateString) return [];
    
    const { rawMin, rawMax, minY, maxY, plotHeight } = chart;
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return [];
    
    // Get selected date's weight
    const selectedRow = dailyMap.get(selectedDateString);
    let selectedWeight: number | null = null;
    if (selectedRow && selectedRow.weight_lb !== null && selectedRow.weight_lb !== undefined) {
      const wLb = selectedRow.weight_lb;
      selectedWeight = unit === 'kg' ? roundTo1(lbToKg(wLb)) : roundTo1(wLb);
    }
    
    const points: Array<{ value: number; position: number }> = [];
    const span = Math.max(1e-6, maxY - minY);
    
    // Always include raw min/max as labels + dotted lines (scaled using padded min/max).
    const pushPoint = (value: number) => {
      const pos = ((value - minY) / span) * plotHeight; // 0..plotHeight (bottom-up within plot region)
      points.push({ value, position: Math.max(0, Math.min(plotHeight, pos)) });
    };

    pushPoint(rawMin);
    if (rawMax !== rawMin) pushPoint(rawMax);
    
    // Include selected date's weight if it's between min and max
    if (
      selectedWeight !== null &&
      Number.isFinite(selectedWeight) &&
      selectedWeight >= rawMin &&
      selectedWeight <= rawMax
    ) {
      const already = points.some((p) => Math.abs(p.value - selectedWeight) < 1e-6);
      if (!already) pushPoint(selectedWeight);
    }
    
    // Sort by position (bottom to top)
    return points.sort((a, b) => a.position - b.position);
  }, [chart, dailyMap, selectedDateString, unit]);
  
  // Update getLabel to use Today/Yesterday/weekday logic if dayKeys are provided
  const enhancedGetLabel = useMemo(() => {
    if (!dayKeys || !todayDateString) return getLabel;
    
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
  }, [dayKeys, todayDateString, yesterdayDateString, getLabel, t, useYdayLabel]);

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
                const isSelected = selectedDateString && dailyMap?.get(selectedDateString) && 
                  (() => {
                    const selectedRow = dailyMap.get(selectedDateString);
                    if (!selectedRow || selectedRow.weight_lb === null) return false;
                    const wLb = selectedRow.weight_lb;
                    const selectedWeight = unit === 'kg' ? roundTo1(lbToKg(wLb)) : roundTo1(wLb);
                    return Math.abs(selectedWeight - point.value) < 0.1;
                  })();
                
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
                        // Fix coordinate mismatch: account for PAD_Y_BOTTOM so labels align with dots.
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
            {yAxisPoints.length > 0 && yAxisPoints.map((point, idx) => {
              const isSelected = selectedDateString && dailyMap?.get(selectedDateString) && 
                (() => {
                  const selectedRow = dailyMap.get(selectedDateString);
                  if (!selectedRow || selectedRow.weight_lb === null) return false;
                  const wLb = selectedRow.weight_lb;
                  const selectedWeight = unit === 'kg' ? roundTo1(lbToKg(wLb)) : roundTo1(wLb);
                  return Math.abs(selectedWeight - point.value) < 0.1;
                })();
              
              return (
                <View
                  key={idx}
                  style={[
                    styles.yAxisLine,
                    {
                      // Fix coordinate mismatch: account for PAD_Y_BOTTOM so lines align with dots.
                      bottom: chart.PAD_Y_BOTTOM + point.position,
                      borderColor: colors.textSecondary,
                      opacity: isSelected ? 1 : 0.8,
                    },
                  ]}
                />
              );
            })}

            {/* Trend line and dots - rendered on top */}
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
                    <Circle key={idx} cx={p.x} cy={p.y} r={chart.DOT_R} stroke={colors.tint} strokeWidth={2} fill={colors.tint} />
                  ) : null
                )}
              </Svg>
            </View>
          </View>

          {/* X-axis labels */}
          <View
            style={[
              styles.labelsLayer,
              {
                position: 'absolute',
                // Align labels layer with plot area (no extra padding shifts).
                left: effectiveYAxisWidth,
                right: 0,
                bottom: 0,
                height: chart.xAxisHeight,
              },
            ]}
            pointerEvents="none"
          >
            {labelIndices.map((idx) => {
              if (idx < 0 || idx >= values.length) return null;
              const n = values.length;
              const denom = Math.max(1, n - 1);
              const plotWidth = width - effectiveYAxisWidth;
              const usableWidth = Math.max(0, plotWidth - chart.PAD_X * 2);

              // Use the exact same horizontal coordinate system as the plotted dots.
              // Dots use: x = PAD_X + (i / denom) * usableWidth
              const dotX = n <= 1 ? plotWidth / 2 : chart.PAD_X + (idx / denom) * usableWidth;

              // Center label under the dot using a fixed container width per slot.
              const slotW = plotWidth / Math.max(1, n);
              const labelW = slotW;
              const left = dotX - labelW / 2;
              const text = enhancedGetLabel(idx);
              if (!text) return null;
              return (
                <View key={idx} style={[styles.labelItem, { left, width: labelW }]}>
                  <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>{text}</ThemedText>
                </View>
              );
            })}
          </View>
              </>
            );
          })()}
        </View>
      ) : (
        <ThemedText style={{ color: colors.textSecondary }}>Add at least 2 weigh-ins to see a trend.</ThemedText>
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
});


