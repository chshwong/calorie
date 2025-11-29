/**
 * CircularStat Component
 * 
 * Reusable circular progress/donut chart with center value
 * Similar to MyFitnessPal's circular stat displays
 * Uses a simplified View-based approach for cross-platform compatibility
 */

import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect, useRef, useState } from 'react';

type CircularStatProps = {
  value: number;
  max: number | null; // null for plain mode
  label: string;
  subtitle?: string;
  accentColor: string;
  size?: 'small' | 'medium' | 'large';
  mode?: 'remaining' | 'consumed' | 'plain';
  showLabel?: boolean;
};

// Responsive sizes based on screen width
const getSizeMap = (screenWidth: number) => {
  const isSmallScreen = screenWidth < 375; // iPhone SE and smaller
  const isMediumScreen = screenWidth < 768; // Most phones
  
  // Small size reduced by ~1/3 for macro circles
  return {
    small: isSmallScreen ? 40 : isMediumScreen ? 47 : 53, // Reduced from 60/70/80
    medium: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    large: isSmallScreen ? 120 : isMediumScreen ? 140 : 160,
  };
};

const getStrokeWidthMap = (screenWidth: number) => {
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth < 768;
  
  // Stroke width reduced proportionally for smaller circles
  return {
    small: isSmallScreen ? 5 : isMediumScreen ? 5 : 6, // Reduced from 6/7/8
    medium: isSmallScreen ? 10 : isMediumScreen ? 11 : 12,
    large: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
  };
};

export function CircularStat({
  value,
  max,
  label,
  subtitle,
  accentColor,
  size = 'medium',
  mode = 'consumed',
  showLabel = true,
}: CircularStatProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);
  
  const SIZE_MAP = getSizeMap(screenWidth);
  const STROKE_WIDTH_MAP = getStrokeWidthMap(screenWidth);
  
  const radius = SIZE_MAP[size];
  const strokeWidth = STROKE_WIDTH_MAP[size];
  
  // Calculate progress
  let progress = 0;
  let displayValue = value;
  
  if (max !== null && max > 0) {
    if (mode === 'remaining') {
      displayValue = Math.max(0, max - value);
      progress = Math.min(1, Math.max(0, displayValue / max));
    } else if (mode === 'consumed') {
      progress = Math.min(1, Math.max(0, value / max));
    } else {
      // plain mode - just show value
      progress = 0;
    }
  }
  
  // Animated progress
  const animatedProgress = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);
  
  // Determine font sizes based on size prop
  const valueFontSize = size === 'large' ? FontSize['3xl'] : size === 'medium' ? FontSize['2xl'] : FontSize.xl;
  const labelFontSize = size === 'large' ? FontSize.sm : FontSize.xs;
  const subtitleFontSize = FontSize.xs;
  
  // Create a circular progress using border and rotation
  // We'll use a simplified approach with a progress bar style visualization
  const progressPercent = progress * 100;
  
  return (
    <View style={styles.container}>
      <View style={[styles.circleContainer, { width: radius * 2, height: radius * 2 }]}>
        {/* Background track circle */}
        <View
          style={[
            styles.circleTrack,
            {
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
              borderWidth: strokeWidth,
              borderColor: colors.backgroundSecondary,
            },
          ]}
        />
        
        {/* Progress indicator using a rotating overlay */}
        {max !== null && progress > 0 && (
          <View
            style={[
              styles.progressOverlay,
              {
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
              },
            ]}
          >
            {/* Create progress segments using border styling */}
            <Animated.View
              style={[
                styles.progressSegment,
                {
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                  borderWidth: strokeWidth,
                  borderColor: accentColor,
                  borderTopColor: progress > 0.125 ? accentColor : 'transparent',
                  borderRightColor: progress > 0.375 ? accentColor : 'transparent',
                  borderBottomColor: progress > 0.625 ? accentColor : 'transparent',
                  borderLeftColor: progress > 0.875 ? accentColor : 'transparent',
                  transform: [
                    { rotate: animatedProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-90deg', '270deg'],
                    }) },
                  ],
                },
              ]}
            />
          </View>
        )}
        
        {/* Center content */}
        <View style={styles.centerContent}>
          <ThemedText
            style={[
              styles.valueText,
              {
                fontSize: valueFontSize,
                fontWeight: FontWeight.bold,
                color: colors.text,
              },
            ]}
          >
            {Math.round(displayValue)}
          </ThemedText>
          {subtitle && (
            <ThemedText
              style={[
                styles.subtitleText,
                {
                  fontSize: subtitleFontSize,
                  color: colors.textMuted,
                },
              ]}
            >
              {subtitle}
            </ThemedText>
          )}
        </View>
      </View>
      
      {showLabel && (
        <ThemedText
          style={[
            styles.labelText,
            {
              fontSize: labelFontSize,
              color: colors.textMuted,
              marginTop: Spacing.xs,
            },
          ]}
        >
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTrack: {
    position: 'absolute',
  },
  progressOverlay: {
    position: 'absolute',
    overflow: 'hidden',
  },
  progressSegment: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  valueText: {
    textAlign: 'center',
  },
  subtitleText: {
    textAlign: 'center',
    marginTop: 2,
  },
  labelText: {
    textAlign: 'center',
  },
});
