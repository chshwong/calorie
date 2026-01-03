/**
 * Simple Bar Chart Component
 * 
 * Lightweight bar chart for time series data
 * Uses View components for cross-platform compatibility
 */

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, FontWeight, ModuleThemes, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFocusStyle } from '@/utils/accessibility';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

type BarData = {
  date: string;
  value: number;
  displayValue?: string; // Formatted value to display on bar (e.g., "1200 ml")
  label?: string;
};

type BarChartProps = {
  data: BarData[];
  maxValue?: number;
  goalValue?: number;
  goalDisplayValue?: string; // Formatted goal value for label (e.g., "Goal 2000 ml")
  selectedDate?: string;
  todayDateString?: string; // Date string for today (YYYY-MM-DD format) to show "Today" label
  onBarPress?: (date: string) => void;
  colorScale?: (value: number, maxValue: number) => string;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
  emptyMessage?: string; // Message to show when all values are 0
};

export function BarChart({
  data,
  maxValue,
  goalValue,
  goalDisplayValue,
  selectedDate,
  todayDateString,
  onBarPress,
  colorScale,
  height = 120,
  showLabels = true,
  animated = true,
  emptyMessage,
}: BarChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useTranslation();
  const waterTheme = ModuleThemes.water;
  
  // Calculate max value if not provided
  // Use provided maxValue (parent can add padding if desired) or compute from data without extra headroom
  const calculatedMax = maxValue || Math.max(...data.map(d => d.value), goalValue || 0, 1);
  const chartMax = maxValue ? maxValue : Math.max(calculatedMax, 1);

  // Reserve space within the chart for labels without affecting the plot scaling.
  // - topInset: lets value labels above bars remain visible (they can overflow upward into this space)
  // - xAxisHeight: dedicated row for day labels, so it doesn't shrink the plot area and break scaling
  // Extra headroom for multi-line value labels above tall bars
  const topInset = Spacing['4xl'];
  const xAxisHeight = showLabels ? (FontSize.xs + Spacing.md) : 0;
  const plotHeight = Math.max(height - topInset - xAxisHeight, 1);
  const goalLabelHaloRadius = Spacing.sm - Spacing.xs; // 8 - 4 = 4 (token-based)
  
  // Check if all data is empty (all values are 0)
  const hasData = data.some(d => d.value > 0);
  
  // Default color scale: light for low, medium for mid, strong for high
  const defaultColorScale = (value: number, max: number) => {
    const ratio = value / max;
    if (ratio < 0.3) return colors.infoLight;
    if (ratio < 0.6) return colors.info;
    return colors.tint;
  };
  
  const getColor = colorScale || defaultColorScale;
  
  // Animate bars - ensure animatedHeights array matches data length
  const animatedHeightsRef = useRef<Animated.Value[]>([]);
  
  // Update animatedHeights array when data length changes
  useEffect(() => {
    const currentLength = animatedHeightsRef.current.length;
    const dataLength = data.length;
    
    if (dataLength > currentLength) {
      // Add new animated values for new data items
      for (let i = currentLength; i < dataLength; i++) {
        animatedHeightsRef.current.push(new Animated.Value(0));
      }
    } else if (dataLength < currentLength) {
      // Remove excess animated values (keep array in sync)
      animatedHeightsRef.current = animatedHeightsRef.current.slice(0, dataLength);
    }
  }, [data.length]);

  useEffect(() => {
    if (animated && animatedHeightsRef.current.length === data.length) {
      Animated.parallel(
        animatedHeightsRef.current.map((animValue, index) =>
          Animated.timing(animValue, {
            toValue: data[index]?.value || 0,
            duration: 300,
            delay: index * 20,
            useNativeDriver: false,
          })
        )
      ).start();
    } else if (!animated && animatedHeightsRef.current.length === data.length) {
      data.forEach((item, index) => {
        if (animatedHeightsRef.current[index]) {
          animatedHeightsRef.current[index].setValue(item.value);
        }
      });
    }
  }, [data, animated]);

  // Format date for label (short day name, or "Today" in bold if it's today)
  const formatDateLabel = (dateString: string) => {
    // Check if this date is today
    if (todayDateString && dateString === todayDateString) {
      return 'Today';
    }
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Calculate goal line position
  const goalLineBottom = goalValue !== undefined && goalValue > 0 
    ? (goalValue / chartMax) * plotHeight 
    : null;

  return (
    <View style={styles.container}>
      <View style={[styles.chartContainer, { height }]}>
        {/* Plot area: bars + goal line share the same coordinate system */}
        <View style={[styles.plotArea, { height: plotHeight, bottom: xAxisHeight }]}>
          {/* Bars */}
          <View style={styles.barsContainer}>
            {data.map((item, index) => {
              const barHeight = (item.value / chartMax) * plotHeight;
              const isSelected = selectedDate === item.date;
              const barOpacity = !hasData && item.value === 0 ? 0.3 : 1;
              const valueLabelBottom = barHeight + Spacing.xs;
              
              return (
                <TouchableOpacity
                  key={item.date}
                  style={styles.barWrapper}
                  onPress={() => onBarPress?.(item.date)}
                  activeOpacity={0.7}
                  {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                >
                  {/* Value label above bar (always) */}
                  {item.displayValue && (
                    <ThemedText 
                      style={[
                        styles.barValueLabel, 
                        styles.barValueLabelAbove,
                        { color: colors.text, bottom: valueLabelBottom }
                      ]}
                    >
                      {item.displayValue}
                    </ThemedText>
                  )}
                  
                  <View style={styles.barContainer}>
                    <Animated.View
                      style={[
                        styles.bar,
                        {
                          height: animated && animatedHeightsRef.current[index] 
                            ? animatedHeightsRef.current[index].interpolate({
                                inputRange: [0, chartMax],
                                outputRange: [0, plotHeight],
                              })
                            : barHeight,
                          backgroundColor: getColor(item.value, chartMax),
                          borderColor: isSelected ? colors.tint : 'transparent',
                          borderWidth: isSelected ? 2 : 0,
                          opacity: barOpacity,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Goal line with label (rendered above bars) */}
          {goalLineBottom !== null && (
            <>
              <View
                style={[
                  styles.goalLine,
                  {
                    bottom: goalLineBottom,
                    borderColor: waterTheme.accent,
                  },
                ]}
              />
              {/* Goal label - positioned above the line to avoid overlap with bar labels */}
              {goalDisplayValue && (
                <View
                  style={[
                    styles.goalLabelContainer,
                    {
                      // Keep the goal label visually “touching” the goal line
                      bottom: goalLineBottom - Spacing.xs,
                      left: Spacing.sm,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.goalLabel,
                      {
                        color: colors.brandGreen,
                        // Halo: white in light mode, black in dark mode (per theme token)
                        textShadowColor: colors.textOnTint,
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: goalLabelHaloRadius,
                      },
                    ]}
                  >
                    {goalDisplayValue}
                  </ThemedText>
                </View>
              )}
            </>
          )}
        </View>

        {/* X-axis labels row (outside plot scaling) */}
        {showLabels && (
          <View style={[styles.xAxisLabelsRow, { height: xAxisHeight }]}>
            {data.map((item) => (
              <View key={item.date} style={styles.xAxisLabelCell}>
                <ThemedText 
                  style={[
                    styles.barLabel,
                    { color: colors.textSecondary },
                    todayDateString && item.date === todayDateString && styles.barLabelToday
                  ]}
                >
                  {formatDateLabel(item.date)}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
      
      {/* Empty state message */}
      {!hasData && emptyMessage && (
        <ThemedText style={[styles.emptyMessage, { color: colors.textTertiary }]}>
          {emptyMessage}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chartContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: Spacing.sm,
  },
  plotArea: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.5,
    zIndex: 5,
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
  },
  barContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 4, // Minimum visible bar
  },
  bar: {
    width: '80%',
    minHeight: 4,
    borderRadius: BorderRadius.sm,
    borderTopLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.sm,
    marginBottom: 0,
  },
  barLabel: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  barLabelToday: {
    fontWeight: FontWeight.bold,
  },
  barValueLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  barValueLabelAbove: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  barValueLabelInside: {
    position: 'absolute',
    top: 0, // Will be overridden by container positioning
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  barValueContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  goalLabelContainer: {
    position: 'absolute',
    // No chip background; keep minimal padding so halo/text doesn't feel cramped.
    paddingHorizontal: 0,
    paddingVertical: 0,
    zIndex: 6,
  },
  goalLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
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
  emptyMessage: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});

