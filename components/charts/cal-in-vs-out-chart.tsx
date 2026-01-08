/**
 * Cal In vs Out Chart Component
 * 
 * Displays calories consumed (colored by zone) and calories burned side by side
 * Similar to Fitbit's "Cals in vs. out" chart
 */

import { ThemedText } from '@/components/themed-text';
import { RANGES } from '@/constants/constraints';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { CalorieZone } from '@/lib/utils/calorie-zone';

// Chart-specific display constants (not validation limits)
// These define the Y-axis scale and label positions for the calorie chart
// MIN_SCALE_MAX uses RANGES.CALORIES_KCAL.MAX as the baseline for consistent chart scaling
const CHART_SCALE = {
  MIN_SCALE_MAX: RANGES.CALORIES_KCAL.MAX, // Minimum max value for chart scaling (ensures consistent scale)
  Y_AXIS_LABELS: {
    MIDDLE: 1500, // Middle Y-axis label value (1.5k)
    TOP: 3000, // Top Y-axis label value (3k)
  },
} as const;

type CalInVsOutData = {
  date: string;
  caloriesIn: number;
  caloriesOut: number;
  zone: CalorieZone;
};

type CalInVsOutChartProps = {
  data: CalInVsOutData[];
  selectedDate?: string;
  todayDateString?: string;
  onBarPress?: (date: string) => void;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
};

export function CalInVsOutChart({
  data,
  selectedDate,
  todayDateString,
  onBarPress,
  height = 120,
  showLabels = true,
  animated = true,
}: CalInVsOutChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useTranslation();

  // Calculate max value for scaling (consider both in and out)
  // Scale so that MIN_SCALE_MAX means the bar would almost touch the legend at the top (2px away)
  // Use RANGES.CALORIES_KCAL.MAX as reference, but allow chart to scale higher if data exceeds it
  const maxValue = useMemo(() => {
    const allValues = data.flatMap(d => [d.caloriesIn, d.caloriesOut]);
    const dataMax = Math.max(...allValues, 1);
    // Use MIN_SCALE_MAX as the minimum max scale, or data max if it's higher
    // This ensures consistent chart scaling while accommodating higher values
    return Math.max(dataMax, CHART_SCALE.MIN_SCALE_MAX);
  }, [data]);

  // Minimal top inset - just 2px gap from legend (legend is outside chartContainer)
  const topInset = 2; // 2px gap as requested
  const xAxisHeight = showLabels ? (FontSize.xs + Spacing.xs) : 0;
  const yAxisWidth = 40; // Width for Y-axis labels
  const plotHeight = Math.max(height - topInset - xAxisHeight, 1);

  // Calculate Y-axis points: 0, 1.5k, 3k (3 points total)
  // 0 is at the bottom (at x-axis level)
  // Positions scale based on maxValue so labels align with actual bar heights
  // Position is measured from bottom, so higher values = higher positions
  const yAxisPoints = useMemo(() => {
    return [
      { value: 0, position: 0 }, // Bottom (0) - at x-axis level
      {
        value: CHART_SCALE.Y_AXIS_LABELS.MIDDLE,
        position: (CHART_SCALE.Y_AXIS_LABELS.MIDDLE / maxValue) * plotHeight,
      }, // Middle (1.5k) - scaled position
      {
        value: CHART_SCALE.Y_AXIS_LABELS.TOP,
        position: (CHART_SCALE.Y_AXIS_LABELS.TOP / maxValue) * plotHeight,
      }, // Top (3k) - scaled position
    ];
  }, [maxValue, plotHeight]);

  // Format Y-axis label (e.g., 5000 -> "5k", 2500 -> "2.5k")
  const formatYAxisLabel = (value: number): string => {
    if (value >= 1000) {
      const kValue = value / 1000;
      return kValue % 1 === 0 ? `${kValue}k` : `${kValue.toFixed(1)}k`;
    }
    return Math.round(value).toString();
  };

  // Get zone color
  const getZoneColor = (zone: CalorieZone): string => {
    switch (zone) {
      case 'in_zone':
        return colors.brandGreen;
      case 'over':
        return colors.chartPink;
      case 'under':
        return colors.info; // Blue
      default:
        return colors.brandGreen;
    }
  };

  // Purple for calories out (using accentStreak which is purple)
  const caloriesOutColor = colors.accentStreak;

  // Animate bars - separate arrays for in and out
  const animatedHeightsInRef = useRef<Animated.Value[]>([]);
  const animatedHeightsOutRef = useRef<Animated.Value[]>([]);

  // Update animated heights arrays when data length changes
  useEffect(() => {
    const currentLength = animatedHeightsInRef.current.length;
    const dataLength = data.length;

    if (dataLength > currentLength) {
      for (let i = currentLength; i < dataLength; i++) {
        animatedHeightsInRef.current.push(new Animated.Value(0));
        animatedHeightsOutRef.current.push(new Animated.Value(0));
      }
    } else if (dataLength < currentLength) {
      animatedHeightsInRef.current = animatedHeightsInRef.current.slice(0, dataLength);
      animatedHeightsOutRef.current = animatedHeightsOutRef.current.slice(0, dataLength);
    }
  }, [data.length]);

  useEffect(() => {
    if (animated && animatedHeightsInRef.current.length === data.length) {
      Animated.parallel([
        ...animatedHeightsInRef.current.map((animValue, index) =>
          Animated.timing(animValue, {
            toValue: data[index]?.caloriesIn || 0,
            duration: 300,
            delay: index * 20,
            useNativeDriver: false,
          })
        ),
        ...animatedHeightsOutRef.current.map((animValue, index) =>
          Animated.timing(animValue, {
            toValue: data[index]?.caloriesOut || 0,
            duration: 300,
            delay: index * 20 + 10,
            useNativeDriver: false,
          })
        ),
      ]).start();
    } else if (!animated && animatedHeightsInRef.current.length === data.length) {
      data.forEach((item, index) => {
        if (animatedHeightsInRef.current[index]) {
          animatedHeightsInRef.current[index].setValue(item.caloriesIn);
        }
        if (animatedHeightsOutRef.current[index]) {
          animatedHeightsOutRef.current[index].setValue(item.caloriesOut);
        }
      });
    }
  }, [data, animated]);

  // Format date for label
  const formatDateLabel = (dateString: string) => {
    if (todayDateString && dateString === todayDateString) {
      return t('common.today');
    }
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.brandGreen }]} />
          <ThemedText style={[styles.legendText, { color: colors.textSecondary }]}>
            {t('dashboard.food.chart_in_zone')}
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.info }]} />
          <ThemedText style={[styles.legendText, { color: colors.textSecondary }]}>
            {t('dashboard.food.chart_under')}
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.chartPink }]} />
          <ThemedText style={[styles.legendText, { color: colors.textSecondary }]}>
            {t('dashboard.food.chart_over')}
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: caloriesOutColor }]} />
          <ThemedText style={[styles.legendText, { color: colors.textSecondary }]}>
            {t('dashboard.food.chart_cals_out')}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.chartContainer, { height }]}>
        {/* Y-axis labels */}
        <View style={[styles.yAxisContainer, { width: yAxisWidth, height: plotHeight, bottom: xAxisHeight }]}>
          {yAxisPoints.map((point, idx) => {
            // Position labels slightly below the dotted lines (add small offset)
            const labelOffset = idx === 0 ? 0 : FontSize.xs / 2; // Only offset non-zero labels
            return (
              <View
                key={idx}
                style={[
                  styles.yAxisLabelContainer,
                  {
                    position: 'absolute',
                    bottom: point.position - labelOffset, // Position from bottom, slightly below line
                  },
                ]}
              >
                <ThemedText style={[styles.yAxisLabel, { color: colors.textSecondary }]}>
                  {formatYAxisLabel(point.value)}
                </ThemedText>
              </View>
            );
          })}
        </View>

        {/* Plot area */}
        <View style={[styles.plotArea, { height: plotHeight, bottom: xAxisHeight, left: yAxisWidth }]}>
          {/* Dotted horizontal lines at Y-axis points */}
          {yAxisPoints.map((point, idx) => (
            <View
              key={idx}
              style={[
                styles.yAxisLine,
                {
                  bottom: point.position,
                  borderColor: colors.border,
                },
              ]}
            />
          ))}

          {/* Bars */}
          <View style={styles.barsContainer}>
            {data.map((item, index) => {
              const barHeightIn = Math.min((item.caloriesIn / maxValue) * plotHeight * 1.1, plotHeight);
              const barHeightOut = Math.min((item.caloriesOut / maxValue) * plotHeight * 1.1, plotHeight);
              const isSelected = selectedDate === item.date;
              const zoneColor = getZoneColor(item.zone);
              
              // Format date for accessibility label
              const dateLabel = formatDateLabel(item.date);
              const zoneLabel = item.zone === 'in_zone' 
                ? t('dashboard.food.chart_in_zone')
                : item.zone === 'over'
                ? t('dashboard.food.chart_over')
                : t('dashboard.food.chart_under');
              
              // Create descriptive accessibility label
              const accessibilityLabel = t('dashboard.food.chart_bar_accessibility', {
                date: dateLabel,
                caloriesIn: Math.round(item.caloriesIn),
                caloriesOut: Math.round(item.caloriesOut),
                zone: zoneLabel,
              });

              return (
                <TouchableOpacity
                  key={item.date}
                  style={[styles.barWrapper, getMinTouchTargetStyle()]}
                  onPress={() => onBarPress?.(item.date)}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(accessibilityLabel, t('dashboard.food.chart_bar_hint'))}
                  {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                >
                  <View style={styles.dualBarContainer}>
                    {/* Calories In bar - ONE bar per day, colored by zone */}
                    <View style={styles.singleBarContainer}>
                      <Animated.View
                        style={[
                          styles.bar,
                          styles.barIn,
                          {
                            height: animated && animatedHeightsInRef.current[index]
                              ? animatedHeightsInRef.current[index].interpolate({
                                  inputRange: [0, maxValue],
                                  outputRange: [0, plotHeight],
                                })
                              : barHeightIn,
                            backgroundColor: zoneColor,
                            borderColor: 'transparent',
                            borderWidth: 0,
                          },
                        ]}
                      />
                    </View>

                    {/* Calories Out bar - separate purple bar */}
                    <View style={styles.singleBarContainer}>
                      <Animated.View
                        style={[
                          styles.bar,
                          styles.barOut,
                          {
                            height: animated && animatedHeightsOutRef.current[index]
                              ? animatedHeightsOutRef.current[index].interpolate({
                                  inputRange: [0, maxValue],
                                  outputRange: [0, plotHeight],
                                })
                              : barHeightOut,
                            backgroundColor: caloriesOutColor,
                            borderColor: 'transparent',
                            borderWidth: 0,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* X-axis labels row */}
        {showLabels && (
          <View style={[styles.xAxisLabelsRow, { height: xAxisHeight, paddingLeft: yAxisWidth }]}>
            {data.map((item) => (
              <View key={item.date} style={styles.xAxisLabelCell}>
                <ThemedText
                  style={[
                    styles.barLabel,
                    { color: colors.textSecondary },
                    todayDateString && item.date === todayDateString && styles.barLabelToday,
                  ]}
                >
                  {formatDateLabel(item.date)}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.sm,
  },
  legendText: {
    fontSize: FontSize.xs,
  },
  chartContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: Spacing.sm,
  },
  yAxisContainer: {
    position: 'absolute',
    left: 0,
    alignItems: 'flex-end',
    paddingRight: Spacing.xs,
  },
  yAxisLabelContainer: {
    width: '100%',
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  yAxisLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.5,
    zIndex: 1,
  },
  plotArea: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '100%',
    paddingHorizontal: Spacing.xs,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: Spacing.xs / 2,
    position: 'relative',
    // Ensure minimum touch target size for WCAG 2.0 AA compliance (44x44pt)
    minHeight: 44,
    minWidth: 44,
  },
  dualBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 0, // No gap - bars should touch
  },
  singleBarContainer: {
    width: '25%', // Half the original width (was ~50%, now 25%)
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 4,
  },
  bar: {
    width: '100%',
    minHeight: 4,
    borderRadius: BorderRadius.sm,
    borderTopLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.sm,
    marginBottom: 0,
  },
  barIn: {
    marginRight: -2, // Overlap slightly with cal-out bar
  },
  barOut: {
    marginLeft: -2, // Overlap slightly with cal-in bar
  },
  barLabel: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  barLabelToday: {
    fontWeight: FontWeight.bold,
  },
  xAxisLabelsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  xAxisLabelCell: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.xs / 2,
  },
});

