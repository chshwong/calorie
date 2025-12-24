/**
 * TabPressable - Reusable wrapper for tab buttons that provides press feedback
 * 
 * Matches the press feedback behavior of PlusButtonTab:
 * - scale: 0.95 when pressed
 * - opacity: 0.85 when pressed
 * 
 * Preserves all layout by applying the incoming style prop directly
 * and only adding transform/opacity on top.
 */

import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { getFocusStyle } from '@/utils/accessibility';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export function TabPressable(props: BottomTabBarButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const activeColor = colors.tint;

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        props.style,
        pressed && styles.tabButtonPressed,
        Platform.OS === 'web' && getFocusStyle(activeColor),
      ]}
    />
  );
}

const styles = StyleSheet.create({
  tabButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
});

