import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Platform, Animated, type LayoutChangeEvent } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

/**
 * REUSABLE SEGMENTED TABS COMPONENT
 * 
 * A presentational segmented tab control that displays tabs as pill-shaped buttons
 * with clear inactive and active states. Designed to look like a professional
 * segmented control with obvious pressability.
 * 
 * Features:
 * - Pill-shaped tabs with rounded-full styling
 * - Clear active/inactive visual states
 * - Accessibility support (tablist/tab roles)
 * - Touch feedback via Pressable
 * - Supports optional icons
 * - Uses theme colors and spacing tokens
 * - Optional layout callback for positioning dropdowns/connectors
 * - Animated elastic underline indicator that follows the active tab
 */

export type SegmentedTabItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  // Strong accent color (for underline, focus ring, etc.)
  themeColor?: string; // RN color string, e.g. '#3B82F6'
  // Softer fill color for the active pill background
  themeFillColor?: string; // RN color string, e.g. '#3B82F626' (with opacity)
};

type TabLayout = { x: number; width: number };

type SegmentedTabsProps = {
  items: SegmentedTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: any;
  onActiveTabLayout?: (layout: { x: number; y: number; width: number; height: number } | null) => void;
  /** Optional refs for specific tab buttons (used for guided tours / measurement). */
  tabRefs?: Record<string, React.Ref<any> | undefined>;
};

export function SegmentedTabs({ items, activeKey, onChange, style, onActiveTabLayout, tabRefs }: SegmentedTabsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const onActiveTabLayoutRef = useRef(onActiveTabLayout);

  // Track tab layouts for animated indicator
  const [tabLayouts, setTabLayouts] = useState<Record<string, TabLayout>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const indicatorScale = useRef(new Animated.Value(1)).current;

  // Get active item and its theme colors
  const activeItem = items.find(item => item.key === activeKey);
  const activeColor = activeItem?.themeColor ?? colors.tint; // Strong accent (underline, focus)
  const activeFillColor = activeItem?.themeFillColor ?? activeColor; // Soft fill (pill background)

  // Update ref when callback changes
  useEffect(() => {
    onActiveTabLayoutRef.current = onActiveTabLayout;
  }, [onActiveTabLayout]);

  // Track layout for each tab
  const handleTabLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts((prev) => {
      if (prev[key]?.x === x && prev[key]?.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });

    // Also report to parent callback if this is the active tab
    if (key === activeKey && onActiveTabLayoutRef.current) {
      const { y, height } = event.nativeEvent.layout;
      onActiveTabLayoutRef.current({ x, y, width, height });
    }
  };

  // Measure active tab layout and report it (for parent callback compatibility)
  const handleActiveTabLayout = (event: LayoutChangeEvent, itemKey: string) => {
    handleTabLayout(itemKey)(event);
    
    if (itemKey !== activeKey && onActiveTabLayoutRef.current) {
      // Clear layout if we were previously the active tab but aren't anymore
      onActiveTabLayoutRef.current(null);
    }
  };

  // Animate indicator when activeKey or tabLayouts change
  useEffect(() => {
    const layout = tabLayouts[activeKey];
    if (!layout) return;

    // Start the scale a bit smaller for rubber-band effect
    indicatorScale.setValue(0.7);

    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: layout.x,
        useNativeDriver: false, // Cannot use native driver for layout properties
        stiffness: 180,
        damping: 18,
        mass: 0.6,
      }),
      Animated.spring(indicatorWidth, {
        toValue: layout.width,
        useNativeDriver: false,
        stiffness: 180,
        damping: 18,
        mass: 0.6,
      }),
      Animated.spring(indicatorScale, {
        toValue: 1,
        useNativeDriver: false,
        stiffness: 220, // slightly stiffer for elastic feel
        damping: 14,
        mass: 0.6,
      }),
    ]).start();
  }, [activeKey, tabLayouts, indicatorX, indicatorWidth, indicatorScale]);

  const activeLayout = tabLayouts[activeKey];
  const showIndicator = !!activeLayout;

  return (
    <View style={style}>
      <View 
        style={[styles.tabsRowContainer, { paddingBottom: Spacing.sm +1 }]} // 6px padding for underline space
        accessibilityRole="tablist"
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const strongColor = item.themeColor ?? activeColor; // Strong accent for underline/focus
          const fillColor = item.themeFillColor ?? activeFillColor; // Soft fill for pill background

          return (
            <Pressable
              key={item.key}
              ref={tabRefs?.[item.key]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={item.accessibilityLabel || item.label}
              onPress={() => onChange(item.key)}
              onLayout={(e) => handleActiveTabLayout(e, item.key)}
              style={({ pressed, focused }) => [
                styles.tab,
                {
                  backgroundColor: isActive 
                    ? fillColor
                    : colors.background, // Clean white background for inactive tabs
                  // Explicitly remove all border properties
                  borderWidth: 0,
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                  borderColor: 'transparent',
                  ...Platform.select({
                    web: {
                      border: 'none',
                    },
                    default: {
                      elevation: 0, // Remove Android shadow/elevation
                      shadowOpacity: 0, // Remove iOS shadow
                      shadowOffset: { width: 0, height: 0 },
                      shadowRadius: 0,
                    },
                  }),
                },
                pressed && styles.tabPressed,
              ]}
            >
              {item.icon ? (
                <View style={styles.iconContainer}>
                  {item.icon}
                </View>
              ) : null}
              <Text
                style={[
                  styles.tabText,
                  {
                    color: colors.text, // Dark text for both active and inactive - readable on pastel backgrounds
                    fontWeight: isActive 
                      ? FontWeight.semibold 
                      : FontWeight.medium,
                  },
                ]}
                numberOfLines={1}
                ellipsizeMode="clip"
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Animated underline indicator */}
        {showIndicator && (
          <Animated.View
            style={[
              styles.indicator,
              {
                transform: [
                  { translateX: indicatorX },
                  { scaleX: indicatorScale },
                ],
                width: indicatorWidth,
                backgroundColor: activeColor, // Strong accent color for underline
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md, // px-3 equivalent (12px) - reduced from px-4
    paddingVertical: Spacing.xs , // py-0.5 equivalent (2px) - MUCH shorter vertical padding
    marginHorizontal: Spacing.xs, // mx-1 equivalent (4px)
    borderRadius: BorderRadius.full,
    // minHeight removed completely for compact iOS segmented control height
    flexShrink: 0, // Prevent compression, allow natural width
    // Explicitly remove all borders
    borderWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderColor: 'transparent',
    // Remove shadows/elevation that might create border-like appearance
    ...Platform.select({
      web: {
        border: 'none',
      },
      default: {
        elevation: 0,
        shadowOpacity: 0,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 0,
      },
    }),
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabFocused: {
    // Additional focus styles for non-web platforms if needed
    ...Platform.select({
      web: {},
      default: {
        // Optional: Add focus indicator for native if needed
        // For now, relying on Pressable's default behavior
      },
    }),
  },
  iconContainer: {
    marginRight: Spacing.sm, // mr-2 equivalent (8px)
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: FontSize.base + 4, // +2 for larger mealtype tabs
    textAlign: 'center',
    flexShrink: 0, // Prevent text compression
  },
  indicator: {
    position: 'absolute',
    bottom: 0, // Move it 2px lower to prevent overlap with compact pill
    height: 2, // Thin underline
    borderRadius: BorderRadius.full,
  },
});

