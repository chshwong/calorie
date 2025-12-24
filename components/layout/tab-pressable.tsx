/**
 * TabPressable - Reusable wrapper for tab buttons that provides press feedback
 * 
 * Matches the press feedback behavior of PlusButtonTab:
 * - scale: 0.95 when pressed
 * - opacity: 0.85 when pressed
 * 
 * Preserves all layout by applying the incoming style prop directly
 * and only adding transform/opacity on top.
 * 
 * On web, prevents full page refresh by stripping href and using preventDefault.
 * This ensures buttons don't render as <a> elements, avoiding browser text decoration.
 */

import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

export function TabPressable(props: BottomTabBarButtonProps) {
  // Destructure href to prevent it from being spread onto Pressable (prevents <a> rendering)
  const { href, onPress, ...rest } = props;

  const pressableProps = {
    ...rest,
    style: ({ pressed }: { pressed: boolean }) => [
      props.style,
      pressed && styles.tabButtonPressed,
    ],
    onPress: (e: any) => {
      // Prevent default navigation to avoid full page refresh
      // React Navigation handles the actual navigation via onPress
      if (Platform.OS === 'web') {
        e?.preventDefault?.();
      }
      onPress?.(e);
    },
  };

  // Always return Pressable directly - no Link wrapping to prevent <a> rendering
  // href is stripped above so it doesn't get passed to Pressable
  return <Pressable {...(pressableProps as any)} />;
}

const styles = StyleSheet.create({
  tabButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
});

