/**
 * Horizontal Bar Chart Component for Dashboard
 * 
 * Transposed bar chart showing 7 days as rows with horizontal bars
 * Used specifically for dashboard Water card
 */

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, ModuleThemes, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

type HorizontalBarData = {
  date: string;
  value: number;
  displayValue?: string; // Formatted value to display (e.g., "1200 ml")
};

type HorizontalBarChartProps = {
  data: HorizontalBarData[];
  maxValue: number;
  goalValue: number;
  goalDisplayValue?: string;
  todayDateString?: string;
  yesterdayDateString?: string;
  useYdayLabel?: boolean;
  onRowPress?: (date: string) => void;
  color?: string;
  width?: number;
  animated?: boolean;
};

export function HorizontalBarChart({
  data,
  maxValue,
  goalValue,
  goalDisplayValue,
  todayDateString,
  yesterdayDateString,
  useYdayLabel = false,
  onRowPress,
  color,
  width = 180,
  animated = true,
}: HorizontalBarChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useTranslation();
  const waterTheme = ModuleThemes.water;

  // Use maxValue directly as scaleMax (no extra headroom when provided)
  const scaleMax = Math.max(maxValue, 1);
  
  // Apply tiny 2% pixel-based padding at right edge (not by inflating scaleMax)
  const rawPlotWidth = width;
  const plotWidth = rawPlotWidth - Math.max(Math.round(rawPlotWidth * 0.02), 2);
  
  // Row height for each day
  const rowHeight = 20;
  const labelWidth = 40; // Width for day labels
  
  // Calculate goal line position (vertical line) - needed for gutter calculation
  const goalLineX =
    goalValue > 0
      ? (goalValue / scaleMax) * plotWidth
      : null;
  
  // Reserve header gutter above bars for goal label
  const headerH = goalLineX !== null && goalDisplayValue ? (FontSize.xs + Spacing.xs * 2) : 0;
  
  // Chart height includes header gutter at top
  const chartHeight = data.length * rowHeight + headerH;
  
  // Check if all data is empty
  const hasData = data.some(d => d.value > 0);
  
  // Bar color (use provided color or default to water theme accent)
  const barColor = color || waterTheme.accent;
  
  // Animate bars
  const animatedWidthsRef = useRef<Animated.Value[]>([]);
  
  useEffect(() => {
    const currentLength = animatedWidthsRef.current.length;
    const dataLength = data.length;
    
    if (dataLength > currentLength) {
      for (let i = currentLength; i < dataLength; i++) {
        animatedWidthsRef.current.push(new Animated.Value(0));
      }
    } else if (dataLength < currentLength) {
      animatedWidthsRef.current = animatedWidthsRef.current.slice(0, dataLength);
    }
  }, [data.length]);

  useEffect(() => {
    if (animated && animatedWidthsRef.current.length === data.length) {
      Animated.parallel(
        animatedWidthsRef.current.map((animValue, index) =>
          Animated.timing(animValue, {
            toValue: data[index]?.value || 0,
            duration: 300,
            delay: index * 20,
            useNativeDriver: false,
          })
        )
      ).start();
    } else if (!animated && animatedWidthsRef.current.length === data.length) {
      data.forEach((item, index) => {
        if (animatedWidthsRef.current[index]) {
          animatedWidthsRef.current[index].setValue(item.value);
        }
      });
    }
  }, [data, animated]);

  // Format date label
  const formatDateLabel = (dateString: string) => {
    if (todayDateString && dateString === todayDateString) {
      return t('common.today');
    }
    if (yesterdayDateString && dateString === yesterdayDateString) {
      return useYdayLabel ? t('date.yday') : t('common.yesterday');
    }
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.chartContainer, { width, height: chartHeight }]}>
        {/* Goal label - positioned in header gutter above bars, centered on goal line */}
        {headerH > 0 && goalLineX !== null && goalDisplayValue && (
          <View
            style={[
              styles.goalLabelContainer,
              {
                left: labelWidth + goalLineX,
                top: 2, // Small padding from top
                width: 110,
                marginLeft: -55, // Center on goal line (half of width)
                alignItems: 'center',
              },
            ]}
          >
            <ThemedText
              numberOfLines={1}
              ellipsizeMode="clip"
              style={[
                styles.goalLabel,
                {
                  color: colors.brandGreen,
                  textShadowColor: colors.textOnTint,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 2,
                  lineHeight: FontSize.xs + 2,
                  ...(Platform.OS === 'android' && { includeFontPadding: false }),
                },
              ]}
            >
              {goalDisplayValue}
            </ThemedText>
          </View>
        )}

        {/* Plot area - shifted down by headerH */}
        <View style={[styles.plotArea, { width: plotWidth, left: labelWidth, top: headerH, bottom: 0 }]}>
          {/* Goal line (vertical dashed line) */}
          {goalLineX !== null && (
            <View
              style={[
                styles.goalLine,
                {
                  left: goalLineX,
                  borderColor: waterTheme.accent,
                },
              ]}
            />
          )}

          {/* Horizontal bars */}
          {data.map((item, index) => {
            const isZero = item.value === 0;
            const barW = isZero ? 0 : (item.value / scaleMax) * plotWidth;
            const barOpacity = !hasData && item.value === 0 ? 0.3 : 1;
            const top = index * rowHeight; // top is relative to plotArea, which already has headerH offset
            
            // Label placement logic - show labels for values >= 25 ml
            const labelText = isZero ? '' : (item.displayValue || '');
            const valueMl = item.value; // Value in ml
            const MIN_VALUE_FOR_LABEL = 25; // Show label for values >= 25 ml
            const OUTSIDE_GAP = 6;
            const INSIDE_PADDING = 8;
            const EST_LABEL_W = 52; // Estimated label width
            
            // Show label if value >= 25 ml (not based on bar width)
            const shouldShowLabel = !isZero && labelText && valueMl >= MIN_VALUE_FOR_LABEL;
            
            // Original placement logic - check if label can fit outside
            const canFitOutside = barW + OUTSIDE_GAP + EST_LABEL_W <= plotWidth;
            
            // Format date for accessibility label
            const dateLabel = formatDateLabel(item.date);
            const valueLabel = isZero 
              ? t('water.chart.no_intake', { defaultValue: 'No intake' })
              : labelText || '';
            const accessibilityLabel = valueLabel 
              ? t('water.chart.bar_accessibility', { 
                  date: dateLabel, 
                  value: valueLabel,
                  defaultValue: '{{date}}, {{value}}'
                })
              : dateLabel;
            const accessibilityHint = onRowPress 
              ? t('water.chart.bar_hint', { defaultValue: 'Double tap to view details for this day' })
              : undefined;

            return (
              <Pressable
                key={item.date}
                style={[
                  styles.barRow,
                  {
                    top,
                    height: rowHeight,
                  },
                  onRowPress && getMinTouchTargetStyle(),
                  Platform.OS === 'web' && ({
                    outlineStyle: 'none' as const,
                    outlineWidth: 0,
                  } as any),
                ]}
                onPress={() => onRowPress?.(item.date)}
                android_ripple={null}
                hitSlop={Spacing.sm}
                accessibilityRole={onRowPress ? 'button' : 'none'}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibilityHint}
                {...(Platform.OS === 'web' && onRowPress && getFocusStyle(color || waterTheme.accent))}
              >
                {/* Horizontal bar or zero marker */}
                <View style={styles.barContainer}>
                  {isZero ? (
                    // Zero marker: thin line to indicate no intake
                    <View
                      style={[
                        styles.zeroMarker,
                        {
                          backgroundColor: colors.textTertiary || colors.textSecondary,
                        },
                      ]}
                    />
                  ) : (
                    <Animated.View
                      style={[
                        styles.bar,
                        {
                          width: animated && animatedWidthsRef.current[index]
                            ? animatedWidthsRef.current[index].interpolate({
                                inputRange: [0, scaleMax],
                                outputRange: [0, plotWidth],
                              })
                            : barW,
                          backgroundColor: barColor,
                          opacity: barOpacity,
                        },
                      ]}
                    >
                      {/* Inside label (when bar is long) */}
                      {shouldShowLabel && !canFitOutside && (
                        <ThemedText
                          numberOfLines={1}
                          ellipsizeMode="clip"
                          style={[
                            styles.barValueLabelInside,
                            {
                              color: '#fff',
                              left: 0,
                              right: INSIDE_PADDING,
                              textAlign: 'right',
                            },
                          ]}
                        >
                          {labelText}
                        </ThemedText>
                      )}
                    </Animated.View>
                  )}
                </View>
                
                {/* Outside label (when there's space) */}
                {shouldShowLabel && canFitOutside && (
                  <ThemedText
                    numberOfLines={1}
                    ellipsizeMode="clip"
                    style={[
                      styles.barValueLabelOutside,
                      {
                        color: colors.text,
                        marginLeft: OUTSIDE_GAP,
                        maxWidth: plotWidth - (barW + OUTSIDE_GAP),
                        ...(Platform.OS === 'android' && { includeFontPadding: false }),
                      },
                    ]}
                  >
                    {labelText}
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Day labels (left side) - shifted down by headerH */}
        <View style={[styles.labelsContainer, { width: labelWidth, top: headerH, bottom: 0 }]}>
          {data.map((item, index) => (
            <View
              key={item.date}
              style={[
                styles.labelRow,
                {
                  height: rowHeight,
                  top: index * rowHeight, // top is relative to labelsContainer, which already has headerH offset
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.dayLabel,
                  {
                    color: colors.textSecondary,
                  },
                  todayDateString && item.date === todayDateString && styles.dayLabelToday,
                ]}
              >
                {formatDateLabel(item.date)}
              </ThemedText>
            </View>
          ))}
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
  },
  plotArea: {
    position: 'absolute',
    // top and bottom are set inline to account for topGutter
  },
  goalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.5,
    zIndex: 5,
  },
  goalLabelContainer: {
    position: 'absolute',
    zIndex: 10, // Above bars and goal line
    justifyContent: 'center',
  },
  goalLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  barRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  barContainer: {
    height: '60%',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 4, // Minimum visible bar
  },
  bar: {
    height: '100%',
    minWidth: 4,
    borderRadius: BorderRadius.sm,
    borderTopLeftRadius: BorderRadius.sm,
    borderBottomLeftRadius: BorderRadius.sm,
    position: 'relative', // For inside label positioning
  },
  zeroMarker: {
    width: 8,
    height: 2,
    borderRadius: 1,
    opacity: 0.5,
    alignSelf: 'center',
  },
  barValueLabelOutside: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: FontSize.xs + 2,
    alignSelf: 'center',
  },
  barValueLabelInside: {
    position: 'absolute',
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: FontSize.xs + 2,
    top: '50%',
    transform: [{ translateY: -(FontSize.xs / 2) - 1 }],
    right: 8, // INSIDE_PADDING
    textAlign: 'right',
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },
  labelsContainer: {
    position: 'absolute',
    left: 0,
    // top and bottom are set inline to account for topGutter
  },
  labelRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: Spacing.xs,
  },
  dayLabel: {
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  dayLabelToday: {
    fontWeight: '700',
  },
});
