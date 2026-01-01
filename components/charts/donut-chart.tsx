/**
 * Simple Donut Chart Component
 * 
 * Lightweight donut chart for macro visualization
 * Uses View components for cross-platform compatibility
 */

import { View, StyleSheet, Animated } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type DonutSegment = {
  value: number;
  color: string;
  label: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  centerValue: string;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
};

export function DonutChart({ 
  segments, 
  centerValue, 
  size = 120, 
  strokeWidth = 12,
  animated = true,
}: DonutChartProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  // Calculate total for percentages
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  
  // Animate values
  const animatedValues = useRef(
    segments.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (animated) {
      Animated.parallel(
        animatedValues.map((animValue, index) =>
          Animated.timing(animValue, {
            toValue: segments[index]?.value || 0,
            duration: 300,
            useNativeDriver: false,
          })
        )
      ).start();
    }
  }, [segments, animated]);

  // Calculate percentages
  const segmentData = segments.map((segment) => {
    const percentage = total > 0 ? segment.value / total : 0;
    return {
      ...segment,
      percentage,
    };
  });

  return (
    <View style={styles.container}>
      {/* Center content with value */}
      <View style={[styles.centerContent, { width: size, height: size }]}>
        <ThemedText style={[styles.centerValue, { color: colors.text }]}>
          {centerValue}
        </ThemedText>
        <ThemedText style={[styles.centerLabel, { color: colors.textSecondary }]}>
          {t('units.kcal')}
        </ThemedText>
      </View>
      
      {/* Macro bars as visualization */}
      <View style={styles.macroBars}>
        {segmentData.map((segment, index) => (
          <View key={index} style={styles.macroBarContainer}>
            <View style={[styles.macroBarWrapper, { backgroundColor: colors.backgroundSecondary }]}>
              <Animated.View
                style={[
                  styles.macroBar,
                  {
                    width: animated ? animatedValues[index].interpolate({
                      inputRange: [0, total],
                      outputRange: ['0%', `${segment.percentage * 100}%`],
                    }) : `${segment.percentage * 100}%`,
                    backgroundColor: segment.color,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        {segments.map((segment, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <ThemedText style={[styles.legendText, { color: colors.text }]}>
              {segment.label} {Math.round(segment.value)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundCircle: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  macroBars: {
    marginTop: Spacing.md,
    width: '100%',
    gap: Spacing.xs,
  },
  macroBarContainer: {
    width: '100%',
  },
  macroBarWrapper: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroBar: {
    height: '100%',
    borderRadius: 4,
  },
  centerValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  centerLabel: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs / 2,
  },
  legend: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});

