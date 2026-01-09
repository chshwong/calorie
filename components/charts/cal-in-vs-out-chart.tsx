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
import type { CalorieZone } from '@/lib/utils/calorie-zone';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

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
  // Use actual data max to fill available height, similar to exercise charts
  // Only use MIN_SCALE_MAX as a fallback if data is empty
  const maxValue = useMemo(() => {
    const allValues = data.flatMap(d => [d.caloriesIn, d.caloriesOut]);
    const dataMax = Math.max(...allValues, 1);
    // Use actual data max so bars fill the available height
    // Only fall back to MIN_SCALE_MAX if data is empty or very small
    return dataMax >= 100 ? dataMax : CHART_SCALE.MIN_SCALE_MAX;
  }, [data]);

  // Minimal top inset - collapsed to minimize space, similar to exercise charts
  const topInset = 0; // No top inset - bars can reach closer to legend
  const xAxisHeight = showLabels ? (FontSize.xs + Spacing.xs) : 0;
  const yAxisWidth = 40; // Width for Y-axis labels
  const plotHeight = Math.max(height - topInset - xAxisHeight, 1);
  
  // Y-axis label vertical alignment offsets
  const BASE_LABEL_OFFSET = Math.round(FontSize.xs * 0.35)+6;
  const ZERO_EXTRA_OFFSET = Math.round(FontSize.xs * 0.35)-4;

  // Calculate Y-axis points: 0, and conditionally labels based on maxValue
  // If maxValue > 10000: labels at every 1.5k increment starting at 1.5k
  // If maxValue > 5000: labels at every 1k increment starting at 1.5k
  // Otherwise: labels at every 500 increment starting at 1.5k
  // 0 is at the bottom (at x-axis level)
  // Positions scale based on maxValue so labels align with actual bar heights
  // Position is measured from bottom, so higher values = higher positions
  const yAxisPoints = useMemo(() => {
    const points = [
      { value: 0, position: 0 }, // Bottom (0) - at x-axis level
    ];
    
    // If tallest bar is under 1.5k, show a label at the tallest bar position
    if (maxValue < CHART_SCALE.Y_AXIS_LABELS.MIDDLE) {
      points.push({
        value: maxValue,
        position: plotHeight, // At the top (where tallest bar ends)
      }); // Max value - shows where tallest bar reaches
    } else {
      // Determine increment based on maxValue to avoid cramped labels
      // Above 10000: use 1.5k increments (1500, 3000, 4500, 6000, 7500, 9000, ...)
      // Above 5000: use 1k increments (1500, 2500, 3500, 4500, 5500, ...)
      // Otherwise: use 500 increments (1500, 2000, 2500, 3000, 3500, ...)
      const startValue = 1500;
      let increment: number;
      if (maxValue > 10000) {
        increment = 1500;
      } else if (maxValue > 5000) {
        increment = 1000;
      } else {
        increment = 500;
      }
      
      // Generate labels at the determined increment from 1500 up to maxValue
      // Only include values that don't exceed the tallest bar
      for (let value = startValue; value <= maxValue; value += increment) {
        points.push({
          value: value,
          position: (value / maxValue) * plotHeight,
        });
      }
    }
    
    // Sort by position (bottom to top) to ensure correct rendering order
    return points.sort((a, b) => a.position - b.position);
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
            // Position labels to align with their respective dotted lines
            // Apply transform for fine-tuning alignment, with extra offset for "0" label
            const isZero = point.value === 0;
            return (
              <View
                key={idx}
                style={[
                  styles.yAxisLabelContainer,
                  {
                    position: 'absolute',
                    bottom: point.position,
                    transform: [
                      { translateY: BASE_LABEL_OFFSET + (isZero ? ZERO_EXTRA_OFFSET : 0) }
                    ],
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
          {/* Dotted horizontal lines at Y-axis points - rendered behind bars */}
          {yAxisPoints.map((point, idx) => (
            <View
              key={idx}
              style={[
                styles.yAxisLine,
                {
                  bottom: point.position,
                  borderColor: colors.textSecondary,
                },
              ]}
            />
          ))}

          {/* Bars */}
          <View style={[styles.barsContainer, { zIndex: 2 }]}>
            {data.map((item, index) => {
              // Scale bars to use full plotHeight based on maxValue, with small top margin
              const topMargin = 2; // Small margin from top
              const availableHeight = plotHeight - topMargin;
              const barHeightIn = Math.max((item.caloriesIn / maxValue) * availableHeight, 0);
              const barHeightOut = Math.max((item.caloriesOut / maxValue) * availableHeight, 0);
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
    marginBottom: Spacing.xxs, // Minimal spacing after legend
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
    opacity: 0.8, // Increased opacity for better visibility, especially in light mode
    zIndex: 0, // Behind bars
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

