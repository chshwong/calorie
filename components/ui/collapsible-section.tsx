/**
 * CollapsibleSection - Reusable Collapsible Section Component
 * 
 * Standard pattern for collapsible sections throughout the app.
 * Can be reused for Food, Exercise, Water, and any other modules.
 * 
 * Features:
 * - Header always visible (even when collapsed)
 * - Smooth expand/collapse animations
 * - Chevron icon indicating state
 * - Optional summary text (e.g., "3 items today")
 * - Full AODA compliance (touch targets, accessibility labels)
 * - Respects reduceMotion preference
 * 
 * Per engineering guidelines:
 * - Uses shared theme tokens (Colors, Spacing, BorderRadius, etc.)
 * - No business logic - pure presentation component
 * - Proper separation of concerns
 * - Platform-aware styling
 * 
 * @example
 * <CollapsibleSection
 *   title="Medications"
 *   summary="3 items today"
 *   isCollapsed={isCollapsed}
 *   onToggle={() => setIsCollapsed(!isCollapsed)}
 *   accessibilityLabel="Toggle Medications section"
 * >
 *   <MedList items={meds} />
 * </CollapsibleSection>
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform, LayoutChangeEvent } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

export interface CollapsibleSectionProps {
  /**
   * Section title displayed in the header
   */
  title: string;
  
  /**
   * Optional summary text (e.g., "3 items today", "No items")
   */
  summary?: string;
  
  /**
   * Whether the section is collapsed (true = collapsed, false = expanded)
   */
  isCollapsed: boolean;
  
  /**
   * Callback when header is tapped to toggle collapse state
   */
  onToggle: () => void;
  
  /**
   * Content to display when expanded
   */
  children: React.ReactNode;
  
  /**
   * Accessibility label for the toggle button
   */
  accessibilityLabel: string;
  
  /**
   * Optional: Disable animations for reduced motion accessibility
   */
  reduceMotion?: boolean;
  
  /**
   * Optional: Custom header style
   */
  headerStyle?: object;
  
  /**
   * Optional: Custom content container style
   */
  contentStyle?: object;
}

const ANIMATION_DURATION = 200;

export function CollapsibleSection({
  title,
  summary,
  isCollapsed,
  onToggle,
  children,
  accessibilityLabel,
  reduceMotion = false,
  headerStyle,
  contentStyle,
}: CollapsibleSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Animation values
  const heightAnim = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;
  const chevronRotate = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;
  
  // Content height measurement
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentHeightRef = useRef<number>(0);
  
  // Update animations when collapsed state changes
  useEffect(() => {
    if (reduceMotion || contentHeightRef.current === 0) {
      // Instant change for reduceMotion or if height not measured yet
      heightAnim.setValue(isCollapsed ? 0 : 1);
      opacityAnim.setValue(isCollapsed ? 0 : 1);
      chevronRotate.setValue(isCollapsed ? 0 : 1);
      return;
    }
    
    // Animate height and opacity
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: isCollapsed ? 0 : 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacityAnim, {
        toValue: isCollapsed ? 0 : 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(chevronRotate, {
        toValue: isCollapsed ? 0 : 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [isCollapsed, reduceMotion, heightAnim, opacityAnim, chevronRotate]);
  
  // Measure content height
  const handleContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && height !== contentHeightRef.current) {
      contentHeightRef.current = height;
      setContentHeight(height);
    }
  };
  
  // Calculate animated values
  const animatedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || 0],
    extrapolate: 'clamp',
  });
  
  const chevronRotation = chevronRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  
  return (
    <View style={styles.container}>
      {/* Header - Always visible */}
      <TouchableOpacity
        onPress={onToggle}
        style={[
          styles.header,
          { borderBottomColor: colors.separator },
          headerStyle,
          getMinTouchTargetStyle(),
          Platform.OS === 'web' && getFocusStyle(colors.tint),
        ]}
        activeOpacity={0.7}
        {...getButtonAccessibilityProps(accessibilityLabel)}
        accessibilityState={{ expanded: !isCollapsed }}
      >
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            {title}
          </ThemedText>
          {summary && (
            <ThemedText style={[styles.headerSummary, { color: colors.textSecondary }]}>
              {summary}
            </ThemedText>
          )}
        </View>
        <Animated.View
          style={[
            styles.chevronContainer,
            {
              transform: [{ rotate: chevronRotation }],
            },
          ]}
        >
          <IconSymbol
            name="chevron.down"
            size={16}
            color={colors.textSecondary}
          />
        </Animated.View>
      </TouchableOpacity>
      
      {/* Content - Collapsible */}
      <Animated.View
        style={[
          styles.content,
          {
            height: reduceMotion ? (isCollapsed ? 0 : undefined) : animatedHeight,
            opacity: reduceMotion ? (isCollapsed ? 0 : 1) : opacityAnim,
            overflow: 'hidden',
          },
          contentStyle,
        ]}
      >
        <View onLayout={handleContentLayout} style={styles.contentInner}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    minHeight: 44, // AODA-compliant touch target
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  headerSummary: {
    fontSize: FontSize.xs,
  },
  chevronContainer: {
    marginLeft: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  content: {
    width: '100%',
  },
  contentInner: {
    width: '100%',
  },
});

