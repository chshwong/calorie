/**
 * Water Drop Gauge Component
 * 
 * SVG-based animated water droplet gauge with fill animation and goal marker
 * Uses react-native-svg for the droplet shape and react-native-reanimated for smooth animations
 * 
 * Follows engineering guidelines:
 * - Pure presentational component (no business logic)
 * - Uses theme tokens for all colors
 * - Memoized to prevent unnecessary re-renders
 * - All geometry constants grouped at top
 */

import React, { memo, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, ModuleThemes, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import Svg, { Path, Rect, Line, Defs, ClipPath, G, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedProps,
} from 'react-native-reanimated';
import { WaterUnit, formatWaterValue, fromMl, getEffectiveGoalMl } from '@/utils/waterUnits';
import { formatWaterAmount, getAlternateUnit } from '@/utils/waterDisplayFormat';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ============================================================================
// GEOMETRY CONSTANTS
// ============================================================================

// Normalized viewBox dimensions (100 units wide, 140 units tall)
const DROPLET_VIEWBOX = '0 0 100 140';

// Scale factor to prevent clipping (85% of original size)
const DROPLET_SCALE = 0.85;

// Calculate translate values to center the scaled droplet
// translateX = viewBoxWidth * (1 - scale) / 2
// translateY = viewBoxHeight * (1 - scale) / 2
const DROPLET_TRANSLATE_X = (100 * (1 - DROPLET_SCALE)) / 2; // 7.5
const DROPLET_TRANSLATE_Y = (140 * (1 - DROPLET_SCALE)) / 2; // 10.5

// Droplet path: teardrop shape
// Point at top (50, 0), curves down to rounded bottom
// Using cubic Bezier curves for smooth teardrop shape
const DROPLET_PATH = 'M 50 0 C 25 35 5 65 5 95 C 5 120 25 140 50 140 C 75 140 95 120 95 95 C 95 65 75 35 50 0 Z';

// Goal line horizontal padding from edges
const GOAL_LINE_PADDING = 10;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate fill percentage (clamped between 0 and 1)
 */
function calculateFillPercent(totalMl: number, goalMl: number | null): number {
  if (!goalMl || goalMl <= 0) return 0;
  return Math.max(0, Math.min(1, totalMl / goalMl));
}

/**
 * Map fill percentage to normalized Y coordinate (0 = top, 140 = bottom)
 */
function fillPercentToY(fillPercent: number): number {
  return 140 - (140 * fillPercent);
}

/**
 * Calculate goal line Y position (normalized)
 * Goal is at the top of the droplet (100% = top)
 */
function calculateGoalY(): number {
  // Goal line at top of droplet (near top, but with some padding)
  return 5; // Small padding from top
}

// ============================================================================
// COMPONENT
// ============================================================================

type WaterDropGaugeProps = {
  totalMl: number;
  goalMl: number | null;
  unitPreference: WaterUnit; // Now accepts WaterUnit instead of 'metric' | 'imperial'
  size?: 'small' | 'medium' | 'large';
};

// Size configurations - increased sizes to prevent clipping
const SIZE_CONFIG = {
  small: {
    width: 140,
    height: 196, // 140 * (140/100) to maintain aspect ratio
    fontSize: FontSize.lg, // Reduced by one step from xl
    unitSize: FontSize.sm, // Reduced by one step from base
    cupsSize: FontSize.base,
    percentSize: FontSize.base,
  },
  medium: {
    width: 160,
    height: 224, // 160 * (140/100)
    fontSize: FontSize.xl, // Reduced by one step from 2xl
    unitSize: FontSize.base, // Reduced by one step from lg
    cupsSize: FontSize.lg,
    percentSize: FontSize.base,
  },
  large: {
    width: 200,
    height: 280, // 200 * (140/100) - larger to prevent clipping
    fontSize: FontSize['2xl'], // Reduced by one step from 3xl
    unitSize: FontSize.lg, // Reduced by one step from xl
    cupsSize: FontSize.lg,
    percentSize: FontSize.base,
  },
};

function WaterDropGaugeComponent({
  totalMl,
  goalMl,
  unitPreference,
  size = 'large',
}: WaterDropGaugeProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const waterTheme = ModuleThemes.water;
  
  const config = SIZE_CONFIG[size];
  
  // Get effective goal (with fallback to defaults if goalMl is null/undefined)
  const effectiveGoalMl = useMemo(
    () => goalMl !== null && goalMl !== undefined && goalMl > 0 
      ? goalMl 
      : getEffectiveGoalMl(unitPreference, null),
    [goalMl, unitPreference]
  );
  
  // Calculate fill percentage
  const fillPercent = useMemo(
    () => calculateFillPercent(totalMl, effectiveGoalMl),
    [totalMl, effectiveGoalMl]
  );
  
  // Animated fill Y position (0 = top, 140 = bottom)
  const fillY = useSharedValue(fillPercentToY(fillPercent));
  
  // Update fill position when totalMl or goalMl changes
  useEffect(() => {
    const targetY = fillPercentToY(fillPercent);
    fillY.value = withTiming(targetY, { duration: 500 });
  }, [fillPercent, fillY]);
  
  // Animated fill props
  const animatedFillProps = useAnimatedProps(() => {
    const currentY = fillY.value;
    const fillHeight = 140 - currentY;
    return {
      y: currentY,
      height: fillHeight,
    };
  });
  
  // Goal line position (at top)
  const goalY = useMemo(() => calculateGoalY(), []);
  
  // Format main number in user's preferred unit using centralized formatting utility
  const mainValue = formatWaterAmount(totalMl, unitPreference);
  
  // Get alternate unit for approximate display using centralized utility
  const alternateUnit = getAlternateUnit(unitPreference);
  
  // Format approximate number in alternate unit using centralized formatting utility
  const approxValue = formatWaterAmount(totalMl, alternateUnit);
  
  // Get numeric value in alternate unit for pluralization check (cups vs cup)
  const approxValueNumeric = fromMl(totalMl, alternateUnit);
  
  // Calculate percentage of goal (business logic - using canonical ml values)
  const percentOfGoal = effectiveGoalMl > 0 
    ? Math.round((totalMl / effectiveGoalMl) * 100) 
    : 0;
  
  // Format goal for label using centralized utilities
  const goalInUnit = fromMl(effectiveGoalMl, unitPreference);
  const goalDisplay = formatWaterValue(goalInUnit, unitPreference);
  
  return (
    <View style={styles.container}>
      <View style={[styles.gaugeContainer, { width: config.width, height: config.height }]}>
        <Svg
          width={config.width}
          height={config.height}
          viewBox={DROPLET_VIEWBOX}
          style={styles.svg}
          {...(Platform.OS === 'web' && { pointerEvents: 'none' })}
        >
          <Defs>
            {/* ClipPath for droplet shape - scaled to match the transformed droplet */}
            <ClipPath id="water-drop-clip">
              <Path 
                d={DROPLET_PATH}
                transform={`translate(${DROPLET_TRANSLATE_X}, ${DROPLET_TRANSLATE_Y}) scale(${DROPLET_SCALE})`}
              />
            </ClipPath>
            
            {/* Gradient for water fill */}
            <LinearGradient id="waterFillGradient" x1="0" y1="0" x2="0" y2="140">
              <Stop offset="0" stopColor={waterTheme.fill} stopOpacity={0.85} />
              <Stop offset="1" stopColor={waterTheme.fill} stopOpacity={0.75} />
            </LinearGradient>
          </Defs>
          
          {/* Scaled droplet group - wraps all droplet elements */}
          <G transform={`translate(${DROPLET_TRANSLATE_X}, ${DROPLET_TRANSLATE_Y}) scale(${DROPLET_SCALE})`}>
            {/* Group for clipped content (water fill) */}
            <G clipPath="url(#water-drop-clip)">
              {/* Water fill (animated rectangle from bottom up) */}
              <AnimatedRect
                animatedProps={animatedFillProps}
                x="0"
                width="100"
                fill="url(#waterFillGradient)"
                opacity={fillPercent > 0 ? 0.8 : 0}
              />
              
              {/* Goal marker line (dashed) */}
              {effectiveGoalMl > 0 && (
                <>
                  <Line
                    x1={GOAL_LINE_PADDING}
                    y1={goalY}
                    x2={100 - GOAL_LINE_PADDING}
                    y2={goalY}
                    stroke={waterTheme.goalLine}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                  {/* Goal label next to dashed line */}
                  {goalDisplay && (
                    <SvgText
                      x={100 - GOAL_LINE_PADDING + 2}
                      y={goalY + 4}
                      fontSize={8}
                      fill={waterTheme.goalLine}
                      opacity={0.7}
                      fontFamily="Inter"
                    >
                      {t('water.goal_label', { value: goalDisplay })}
                    </SvgText>
                  )}
                </>
              )}
            </G>
            
            {/* Droplet outline (stroke only) */}
            <Path
              d={DROPLET_PATH}
              fill="none"
              stroke={waterTheme.accent}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        </Svg>
        
        {/* Text overlay (centered in droplet) */}
        <View style={styles.textOverlay}>
          {/* Main value + Unit - in user's preferred unit */}
          <View style={styles.valueRow}>
            <ThemedText
              style={[
                styles.valueText,
                {
                  fontSize: config.fontSize,
                  fontWeight: FontWeight.bold,
                  color: colors.text,
                },
              ]}
            >
              {mainValue}
            </ThemedText>
            <ThemedText
              style={[
                styles.unitText,
                {
                  fontSize: config.unitSize,
                  fontWeight: FontWeight.medium,
                  color: colors.textSecondary,
                  marginLeft: Spacing.xs / 2,
                },
              ]}
            >
              {unitPreference === 'ml' 
                ? t('water.ml') 
                : unitPreference === 'floz' 
                  ? t('water.floz') 
                  : t('water.cup')}
            </ThemedText>
          </View>
          
          {/* Approximate value in alternate unit - directly underneath */}
          <View style={styles.approxRow}>
            <ThemedText
              style={[
                styles.approxText,
                {
                  fontSize: config.cupsSize,
                  color: colors.textSecondary,
                  marginTop: Spacing.xs / 2,
                },
              ]}
            >
              ≈ {approxValue} {alternateUnit === 'ml' 
                ? t('water.ml') 
                : alternateUnit === 'floz' 
                  ? t('water.floz') 
                  : approxValueNumeric <= 1 
                    ? t('water.cup') 
                    : t('water.cups')}
            </ThemedText>
          </View>
          
          {/* Percentage of goal - inside droplet */}
          {effectiveGoalMl > 0 && (
            <ThemedText
              style={[
                styles.percentText,
                {
                  fontSize: config.percentSize,
                  fontWeight: FontWeight.semibold,
                  color: colors.text,
                  marginTop: Spacing.xs,
                },
              ]}
            >
              {percentOfGoal}% {t('water.of_goal')}
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}

export const WaterDropGauge = memo(WaterDropGaugeComponent);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    top: '35%', // Base position in upper portion of droplet
    paddingTop: Spacing.md + Spacing.sm, // Move text downward by additional line-height (md + sm = ~16px)
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  valueText: {
    textAlign: 'center',
  },
  unitText: {
    textAlign: 'center',
  },
  approxRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  approxText: {
    textAlign: 'center',
  },
  percentText: {
    textAlign: 'center',
  },
});
