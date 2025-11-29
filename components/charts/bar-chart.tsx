/**
 * Simple Bar Chart Component
 * 
 * Lightweight bar chart for time series data
 * Uses View components for cross-platform compatibility
 */

import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { getFocusStyle } from '@/utils/accessibility';

type BarData = {
  date: string;
  value: number;
  label?: string;
};

type BarChartProps = {
  data: BarData[];
  maxValue?: number;
  goalValue?: number;
  selectedDate?: string;
  onBarPress?: (date: string) => void;
  colorScale?: (value: number, maxValue: number) => string;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
};

export function BarChart({
  data,
  maxValue,
  goalValue,
  selectedDate,
  onBarPress,
  colorScale,
  height = 120,
  showLabels = true,
  animated = true,
}: BarChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Calculate max value if not provided
  const calculatedMax = maxValue || Math.max(...data.map(d => d.value), goalValue || 0, 1);
  const chartMax = Math.max(calculatedMax * 1.1, 100); // Add 10% padding
  
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

  return (
    <View style={styles.container}>
      <View style={[styles.chartContainer, { height }]}>
        {/* Goal line */}
        {goalValue !== undefined && goalValue > 0 && (
          <View
            style={[
              styles.goalLine,
              {
                bottom: (goalValue / chartMax) * height,
                borderColor: colors.border,
              },
            ]}
          />
        )}
        
        {/* Bars */}
        <View style={styles.barsContainer}>
          {data.map((item, index) => {
            const barHeight = (item.value / chartMax) * height;
            const isSelected = selectedDate === item.date;
            
            return (
              <TouchableOpacity
                key={item.date}
                style={styles.barWrapper}
                onPress={() => onBarPress?.(item.date)}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
              >
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
                      },
                    ]}
                  />
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
});

