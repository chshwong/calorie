import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  Animated,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';

/**
 * STANDARD ANIMATED TAB BUTTON COMPONENT
 * 
 * This is the standard animated tab button for the app.
 * All future tabs should reuse this component (or extend it) for consistent behavior and UX.
 * 
 * Features:
 * - Guaranteed bounce animation on press (scale down then spring back)
 * - Active state styling (background, text color)
 * - Accessibility support
 * - Platform-specific focus styles for web
 * - Layout measurement support for TabBar underline animation
 * 
 * The bounce animation is always triggered on press (unless reduceMotion is true).
 * The Animated.View always includes transform: [{ scale }] to ensure the animation is visible.
 * 
 * Note: The underline indicator is managed by TabBar, not by individual TabButtons.
 */

type TabButtonProps = {
  label: string;
  isActive: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  activeColor?: string; // Color for active state (text)
  inactiveColor?: string; // Color for inactive state (text)
  accessibilityLabel?: string; // Optional, defaults to label
  // global reduce-motion flag if needed later; default is false
  reduceMotion?: boolean;
  // NEW: used by TabBar to measure position + width
  onLayout?: (event: LayoutChangeEvent) => void;
};

const BOUNCE_SCALE = 0.94;

// Default colors (can be overridden via props)
const DEFAULT_ACTIVE_COLOR = '#15a0a0';
const DEFAULT_INACTIVE_COLOR = '#364152';

export const TabButton: React.FC<TabButtonProps> = ({
  label,
  isActive,
  onPress,
  children,
  disabled,
  activeColor = DEFAULT_ACTIVE_COLOR,
  inactiveColor = DEFAULT_INACTIVE_COLOR,
  accessibilityLabel,
  reduceMotion = false,
  onLayout, // NEW: allow parent to measure this tab
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const runBounce = () => {
    if (reduceMotion) return;

    scale.setValue(1);
    Animated.sequence([
      Animated.spring(scale, {
        toValue: BOUNCE_SCALE,
        speed: 40,
        bounciness: 0,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 20,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    runBounce();
    onPress?.();
  };

  const content = children ?? (
    <Text style={[styles.label, { color: isActive ? activeColor : inactiveColor }]}>
      {label}
    </Text>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive, disabled }}
      accessibilityLabel={accessibilityLabel || label}
      style={Platform.OS === 'web' ? styles.webPressable : undefined}
      onLayout={onLayout} // NEW: measure the Pressable container for accurate positioning
    >
      <Animated.View
        style={[
          styles.tab,
          isActive && { backgroundColor: activeColor + '15' },
          // CRITICAL: transform must always be present for animation to be visible
          { transform: [{ scale }] },
          Platform.OS === 'web' && styles.webFocusOutline,
        ]}
      >
        {content}
        {/* REMOVED: inline indicator - the underline is now managed by TabBar */}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  webPressable: {
    cursor: 'pointer',
  },
  webFocusOutline: {
    outlineStyle: 'none',
  },
});
