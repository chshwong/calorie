/**
 * Animated Tab Content Component
 * 
 * Provides smooth animations for tabbed content:
 * - Horizontal slide animation when switching between tabs
 * - Vertical expand/collapse animation when toggling the same tab
 * - Supports reduceMotion accessibility preference
 * 
 * This is the standard pattern for animated tab lists in the app.
 * 
 * @example
 * <AnimatedTabContent
 *   activeKey={activeTab}
 *   isExpanded={isExpanded}
 *   renderContent={(key) => {
 *     switch (key) {
 *       case 'frequent': return <FrequentList />;
 *       case 'recent': return <RecentList />;
 *       default: return null;
 *     }
 *   }}
 *   reduceMotion={reduceMotion}
 * />
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Animated,
  LayoutChangeEvent,
  StyleSheet,
} from 'react-native';

export type TabKey = 'frequent' | 'recent' | 'custom' | 'bundle' | 'manual';

export type AnimatedTabContentProps = {
  /** Currently active tab key */
  activeKey: TabKey;
  /** Previous tab key (optional, will be tracked internally if not provided) */
  previousKey?: TabKey;
  /** Whether content is expanded (true = visible, false = collapsed) */
  isExpanded: boolean;
  /** Function to render content for a given tab key */
  renderContent: (key: TabKey) => React.ReactNode;
  /** Disable animations for reduced motion accessibility */
  reduceMotion?: boolean;
};

// Animation configuration constants
const SLIDE_DURATION = 250;
const EXPAND_DURATION = 180;
const SLIDE_EASING = { useNativeDriver: true };
const EXPAND_EASING = { useNativeDriver: false }; // height cannot use native driver

// Tab order for determining slide direction
const TAB_ORDER: TabKey[] = ['frequent', 'recent', 'custom', 'bundle', 'manual'];

export function AnimatedTabContent({
  activeKey,
  previousKey: previousKeyProp,
  isExpanded,
  renderContent,
  reduceMotion = false,
}: AnimatedTabContentProps) {
  // Track previous key to determine slide direction
  const previousKeyRef = useRef<TabKey>(activeKey);
  const [previousKey, setPreviousKey] = useState<TabKey>(previousKeyProp || activeKey);
  
  // Animation values
  const slideProgress = useRef(new Animated.Value(0)).current;
  const expandProgress = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  
  // Layout measurements
  const [contentWidth, setContentWidth] = useState<number>(0);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentWidthRef = useRef<number>(0);
  const contentHeightRef = useRef<number>(0);
  
  // Track if we're currently animating
  const isAnimatingRef = useRef(false);
  
  // Get tab indices for direction calculation
  const getTabIndex = (key: TabKey): number => {
    return TAB_ORDER.indexOf(key);
  };
  
  // Handle horizontal slide animation when activeKey changes
  useEffect(() => {
    // Use prop if provided, otherwise use internal ref
    const effectivePreviousKey = previousKeyProp !== undefined ? previousKeyProp : previousKeyRef.current;
    
    if (activeKey === effectivePreviousKey) {
      return; // No change, skip animation
    }
    
    if (reduceMotion || contentWidthRef.current === 0) {
      // Instant change for reduceMotion or if width not measured yet
      slideProgress.setValue(0);
      setPreviousKey(activeKey);
      previousKeyRef.current = activeKey;
      return;
    }
    
    // Store previous key for animation
    setPreviousKey(effectivePreviousKey);
    
    // Start slide animation
    isAnimatingRef.current = true;
    slideProgress.setValue(0);
    
    Animated.timing(slideProgress, {
      toValue: 1,
      duration: SLIDE_DURATION,
      ...SLIDE_EASING,
    }).start(() => {
      isAnimatingRef.current = false;
      setPreviousKey(activeKey);
      previousKeyRef.current = activeKey;
      // Reset slide progress after animation completes
      slideProgress.setValue(0);
    });
  }, [activeKey, previousKeyProp, reduceMotion, slideProgress]);
  
  // Handle vertical expand/collapse animation
  useEffect(() => {
    if (reduceMotion || contentHeightRef.current === 0) {
      // Instant change for reduceMotion or if height not measured yet
      expandProgress.setValue(isExpanded ? 1 : 0);
      return;
    }
    
    Animated.timing(expandProgress, {
      toValue: isExpanded ? 1 : 0,
      duration: EXPAND_DURATION,
      ...EXPAND_EASING,
    }).start();
  }, [isExpanded, reduceMotion, expandProgress]);
  
  // Measure content width for horizontal slide
  const handleContentWidthLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== contentWidthRef.current) {
      contentWidthRef.current = width;
      setContentWidth(width);
    }
  };
  
  // Measure content height for vertical expand/collapse
  const handleContentHeightLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      // Only update if height changed significantly (avoid flicker from small changes)
      if (Math.abs(height - contentHeightRef.current) > 1) {
        contentHeightRef.current = height;
        setContentHeight(height);
      }
    }
  };
  
  // Calculate slide transforms
  const oldIndex = getTabIndex(previousKey);
  const newIndex = getTabIndex(activeKey);
  const direction = newIndex > oldIndex ? 1 : -1;
  
  const currentTranslateX = reduceMotion || !isAnimatingRef.current
    ? 0
    : slideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [direction * (contentWidth || 0), 0],
        extrapolate: 'clamp',
      });
  
  const prevTranslateX = reduceMotion || !isAnimatingRef.current
    ? -direction * (contentWidth || 0)
    : slideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -direction * (contentWidth || 0)],
        extrapolate: 'clamp',
      });
  
  const currentOpacity = reduceMotion || !isAnimatingRef.current
    ? 1
    : slideProgress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 0.7, 1],
        extrapolate: 'clamp',
      });
  
  const prevOpacity = reduceMotion || !isAnimatingRef.current
    ? 0
    : slideProgress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [1, 0.3, 0],
        extrapolate: 'clamp',
      });
  
  // Calculate expand/collapse transforms
  const animatedHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || 0],
    extrapolate: 'clamp',
  });
  
  const expandOpacity = expandProgress;
  
  const expandTranslateY = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
    extrapolate: 'clamp',
  });
  
  // Render current and previous content during slide animation
  const shouldShowPrevious = !reduceMotion && isAnimatingRef.current && previousKey !== activeKey;
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: reduceMotion ? (isExpanded ? undefined : 0) : animatedHeight,
          opacity: reduceMotion ? (isExpanded ? 1 : 0) : expandOpacity,
          overflow: 'hidden',
        },
      ]}
    >
      <View
        style={styles.slideContainer}
        onLayout={handleContentWidthLayout}
      >
        {/* Previous content (during slide animation) */}
        {shouldShowPrevious && (
          <Animated.View
            style={[
              styles.slideItem,
              {
                transform: [{ translateX: prevTranslateX }],
                opacity: prevOpacity,
              },
            ]}
          >
            {renderContent(previousKey)}
          </Animated.View>
        )}
        
        {/* Current content */}
        <Animated.View
          style={[
            styles.slideItem,
            {
              transform: [{ translateX: currentTranslateX }],
              opacity: currentOpacity,
            },
          ]}
        >
          <View
            onLayout={handleContentHeightLayout}
            style={{ width: '100%' }}
          >
            <Animated.View
              style={[
                {
                  transform: [{ translateY: reduceMotion ? 0 : expandTranslateY }],
                },
              ]}
            >
              {renderContent(activeKey)}
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  slideContainer: {
    flexDirection: 'row',
    width: '100%',
    position: 'relative',
  },
  slideItem: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
});

