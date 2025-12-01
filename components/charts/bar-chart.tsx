/**
 * Simple Bar Chart Component
 * 
 * Lightweight bar chart for time series data
 * Uses View components for cross-platform compatibility
 */

import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, FontSize, BorderRadius, ModuleThemes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { getFocusStyle } from '@/utils/accessibility';
import { useTranslation } from 'react-i18next';

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
  const calculatedMax = maxValue || Math.max(...data.map(d => d.value), goalValue || 0, 1);
  const chartMax = Math.max(calculatedMax * 1.1, 100); // Add 10% padding
  
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

  // Format date for label (short day name)
  const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Calculate goal line position
  const goalLineBottom = goalValue !== undefined && goalValue > 0 
    ? (goalValue / chartMax) * height 
    : null;
  
  // Minimum bar height for value labels (if bar is too short, show value above)
  const MIN_BAR_HEIGHT_FOR_LABEL = 20;

  return (
    <View style={styles.container}>
      <View style={[styles.chartContainer, { height }]}>
        {/* Goal line with label */}
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
            {/* Goal label */}
            {goalDisplayValue && (
              <View
                style={[
                  styles.goalLabelContainer,
                  {
                    bottom: goalLineBottom - 8,
                    left: Spacing.sm,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <ThemedText style={[styles.goalLabel, { color: waterTheme.accent }]}>
                  {goalDisplayValue}
                </ThemedText>
              </View>
            )}
          </>
        )}
        
        {/* Bars */}
        <View style={styles.barsContainer}>
          {data.map((item, index) => {
            const barHeight = (item.value / chartMax) * height;
            const isSelected = selectedDate === item.date;
            const showValueAbove = barHeight < MIN_BAR_HEIGHT_FOR_LABEL;
            const barOpacity = !hasData && item.value === 0 ? 0.3 : 1;
            
            return (
              <TouchableOpacity
                key={item.date}
                style={styles.barWrapper}
                onPress={() => onBarPress?.(item.date)}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
              >
                {/* Value label above bar (if bar is too short) */}
                {showValueAbove && item.displayValue && (
                  <ThemedText 
                    style={[
                      styles.barValueLabel, 
                      styles.barValueLabelAbove,
                      { color: colors.textSecondary }
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
                              outputRange: [0, height],
                            })
                          : barHeight,
                        backgroundColor: getColor(item.value, chartMax),
                        borderColor: isSelected ? colors.tint : 'transparent',
                        borderWidth: isSelected ? 2 : 0,
                        opacity: barOpacity,
                      },
                    ]}
                  />
                  
                  {/* Value label inside bar (if bar is tall enough) */}
                  {!showValueAbove && item.displayValue && barHeight >= MIN_BAR_HEIGHT_FOR_LABEL && (
                    <View style={styles.barValueContainer}>
                      <ThemedText 
                        style={[
                          styles.barValueLabel, 
                          styles.barValueLabelInside,
                          { color: colors.background }
                        ]}
                      >
                        {item.displayValue}
                      </ThemedText>
                    </View>
                  )}
                </View>
                
                {showLabels && (
                  <ThemedText style={[styles.barLabel, { color: colors.textSecondary }]}>
                    {formatDateLabel(item.date)}
                  </ThemedText>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
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
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.5,
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
    marginBottom: Spacing.xs,
  },
  barLabel: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  barValueLabel: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  barValueLabelAbove: {
    marginBottom: Spacing.xxs,
    textAlign: 'center',
  },
  barValueLabelInside: {
    position: 'absolute',
    top: Spacing.xxs,
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
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    // backgroundColor will be set inline
  },
  goalLabel: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  emptyMessage: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});

