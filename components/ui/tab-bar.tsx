import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  type LayoutRectangle,
} from 'react-native';
import { TabButton } from '@/components/ui/tab-button';

/**
 * STANDARD TAB BAR WITH ELASTIC MOVING UNDERLINE
 * 
 * This is the standard tab bar component for the app.
 * All future tab strips that need a moving underline should reuse this component.
 * 
 * Features:
 * - Single elastic animated underline that smoothly moves between tabs
 * - Spring-based animation with elastic feel
 * - Supports custom tab content (e.g., Manual tab with "+" icon)
 * - Respects reduce motion preference
 * 
 * The underline animates smoothly from the old active tab to the new one
 * using spring animations for a natural, elastic feel.
 */

type TabItem = {
  key: string;
  label: string;
  activeColor?: string; // Color for active state
  inactiveColor?: string; // Color for inactive state
  accessibilityLabel?: string; // Optional accessibility label
  // allow custom render later if needed
  renderLabel?: () => React.ReactNode;
};

type TabBarProps = {
  tabs: TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  reduceMotion?: boolean;
  underlineColor?: string; // Optional custom underline color (defaults to active tab's activeColor)
  onActiveTabLayout?: (layout: { x: number; y: number; width: number; height: number } | null) => void; // Optional callback to report active tab layout
};

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeKey,
  onTabPress,
  reduceMotion = false,
  underlineColor,
  onActiveTabLayout,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});

  const handleLayout =
    (key: string) =>
    (e: any) => {
      const layout = e.nativeEvent.layout as LayoutRectangle;
      setLayouts(prev => {
        const newLayouts = { ...prev, [key]: layout };
        return newLayouts;
      });
    };

  // Track previous active key to detect tab changes
  const previousActiveKey = useRef<string | null>(null);

  // Report active tab layout to parent if callback provided
  // Use ref to store callback to avoid including it in dependencies (prevents infinite loops)
  const onActiveTabLayoutRef = useRef(onActiveTabLayout);
  const previousLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  
  useEffect(() => {
    onActiveTabLayoutRef.current = onActiveTabLayout;
  }, [onActiveTabLayout]);

  useEffect(() => {
    const activeLayout = layouts[activeKey];
    if (activeLayout && onActiveTabLayoutRef.current) {
      const { x, y, width, height } = activeLayout;
      // Only call callback if layout actually changed
      const previous = previousLayoutRef.current;
      if (!previous || previous.x !== x || previous.y !== y || previous.width !== width || previous.height !== height) {
        previousLayoutRef.current = { x, y, width, height };
        onActiveTabLayoutRef.current({ x, y, width, height });
      }
    } else if (onActiveTabLayoutRef.current && previousLayoutRef.current !== null) {
      // Layout was removed
      previousLayoutRef.current = null;
      onActiveTabLayoutRef.current(null);
    }
  }, [activeKey, layouts]);

  // Update underline position when activeKey or layouts change
  useEffect(() => {
    const activeLayout = layouts[activeKey];
    if (activeLayout) {
      const { x, width } = activeLayout;
      
      if (reduceMotion) {
        translateX.setValue(x);
        underlineWidth.setValue(width);
        previousActiveKey.current = activeKey;
      } else {
        // Check if this is a tab change (not initial render)
        const isTabChange = previousActiveKey.current !== null && previousActiveKey.current !== activeKey;
        
        if (isTabChange) {
          // Elastic effect: shrink first, then expand to new position
          const currentWidth = underlineWidth._value || width;
          const shrinkWidth = currentWidth * 0.6; // Shrink to 60% of current width
          
          Animated.sequence([
            // Step 1: Shrink the width quickly
            Animated.parallel([
              Animated.spring(underlineWidth, {
                toValue: shrinkWidth,
                useNativeDriver: false,
                mass: 0.3,
                stiffness: 300,
                damping: 20,
              }),
              // Also move slightly toward center during shrink (optional subtle effect)
              Animated.spring(translateX, {
                toValue: x + (width - shrinkWidth) / 2,
                useNativeDriver: true,
                mass: 0.3,
                stiffness: 300,
                damping: 20,
              }),
            ]),
            // Step 2: Expand to new position and full width with elastic bounce
            Animated.parallel([
              Animated.spring(translateX, {
                toValue: x,
                useNativeDriver: true,
                mass: 0.5,
                stiffness: 220,
                damping: 18,
              }),
              Animated.spring(underlineWidth, {
                toValue: width,
                useNativeDriver: false,
                mass: 0.5,
                stiffness: 220,
                damping: 18,
              }),
            ]),
          ]).start();
        } else {
          // Initial render or same tab - just animate normally
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: x,
              useNativeDriver: true,
              mass: 0.5,
              stiffness: 220,
              damping: 18,
            }),
            Animated.spring(underlineWidth, {
              toValue: width,
              useNativeDriver: false,
              mass: 0.5,
              stiffness: 220,
              damping: 18,
            }),
          ]).start();
        }
        
        previousActiveKey.current = activeKey;
      }
    } else if (Object.keys(layouts).length > 0) {
      // If active tab layout not ready yet, initialize to first available tab
      const firstKey = Object.keys(layouts)[0];
      const firstLayout = layouts[firstKey];
      if (firstLayout) {
        translateX.setValue(firstLayout.x);
        underlineWidth.setValue(firstLayout.width);
        previousActiveKey.current = firstKey;
      }
    }
  }, [activeKey, layouts, reduceMotion, translateX, underlineWidth]);

  // Get the active tab's color for the underline (or use provided underlineColor)
  const activeTab = tabs.find(tab => tab.key === activeKey);
  const finalUnderlineColor = underlineColor || activeTab?.activeColor || '#15a0a0';

  return (
    <View style={styles.container}>
      {tabs.map(tab => (
        <TabButton
          key={tab.key}
          label={tab.label}
          isActive={tab.key === activeKey}
          onPress={() => onTabPress(tab.key)}
          onLayout={handleLayout(tab.key)}
          activeColor={tab.activeColor}
          inactiveColor={tab.inactiveColor}
          accessibilityLabel={tab.accessibilityLabel || tab.label}
          reduceMotion={reduceMotion}
        >
          {tab.renderLabel ? tab.renderLabel() : undefined}
        </TabButton>
      ))}

      {/* single global elastic underline - always render if we have any layouts */}
      {Object.keys(layouts).length > 0 && (
        <Animated.View
          style={[
            styles.underline,
            {
              transform: [{ translateX }],
              width: underlineWidth,
              backgroundColor: finalUnderlineColor,
              pointerEvents: 'none',
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    position: 'relative',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    borderRadius: 999,
  },
});

