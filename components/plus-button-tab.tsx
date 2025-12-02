/**
 * PlusButtonTab - Custom tab button that renders as a + button instead of a normal tab
 * 
 * Used for the meds/Supps tab to transform it into a + button.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { useQuickAdd } from '@/contexts/quick-add-context';

export function PlusButtonTab(props: BottomTabBarButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const activeColor = colors.tint;
  const { setQuickAddVisible } = useQuickAdd();

  // Explicitly ignore any active/selected state - this button is never "selected"
  // Always use solid accent color regardless of route

  return (
    <Pressable
      onPress={() => setQuickAddVisible(true)}
      style={({ pressed }) => [
        styles.plusButtonContainer,
        pressed && styles.plusButtonPressed,
        Platform.OS === 'web' && getFocusStyle(activeColor),
      ]}
      {...getButtonAccessibilityProps(
        'Add',
        'Double tap to add new item',
        false
      )}
    >
      <View style={[styles.plusButton, { backgroundColor: activeColor }]}>
        <Text style={styles.plusButtonText}>+</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plusButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 13,
    paddingHorizontal: 4,
    minHeight: 60,
  },
  plusButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  plusButton: {
    width: 52,
    height: 52,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  plusButtonText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#ffffff',
  },
});

