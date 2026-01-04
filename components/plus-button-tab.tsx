/**
 * PlusButtonTab - Custom tab button that renders as a + button instead of a normal tab
 * 
 * Used for the meds/Supps tab to transform it into a + button.
 */

import React from 'react';
import { View, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { useQuickAdd } from '@/contexts/quick-add-context';
import PitDarkSvg from '@/assets/brand/Logo_DarkMode_PitwithPlus.svg';
import PitDarkPng from '@/assets/brand/Logo_DarkMode_PitwithPlus.png';
import PitLightSvg from '@/assets/brand/Logo_LightMode_PitwithPlus.svg';
import PitLightPng from '@/assets/brand/Logo_LightMode_PitwithPLUS.png';

const FAB_SIZE = 52;

type Props = BottomTabBarButtonProps & {
  tourAnchorRef?: React.Ref<any>;
};

export function PlusButtonTab(props: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const activeColor = colors.tint;
  const { setQuickAddVisible } = useQuickAdd();
  const isDark = colorScheme === 'dark';

  // Select the correct mascot asset based on theme
  const PitSvg = isDark ? PitDarkSvg : PitLightSvg;
  const pitPng = isDark ? PitDarkPng : PitLightPng;

  // Explicitly ignore any active/selected state - this button is never "selected"
  // Always use solid accent color regardless of route

  return (
    <Pressable
      onPress={() => setQuickAddVisible(true)}
      ref={props.tourAnchorRef}
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
        {Platform.OS !== 'web' || true ? (
          <PitSvg width={FAB_SIZE} height={FAB_SIZE} />
        ) : (
          <Image source={pitPng} style={{ width: FAB_SIZE, height: FAB_SIZE }} resizeMode="contain" />
        )}
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
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    overflow: 'hidden',
  },
});

