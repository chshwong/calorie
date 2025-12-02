/**
 * MoreButtonTab - Custom tab button that opens the More menu instead of navigating directly
 * 
 * Used for the settings/More tab to show a menu instead of navigating immediately.
 */

import React from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';

type MoreButtonTabProps = BottomTabBarButtonProps & {
  onPressCustom?: () => void;
};

export function MoreButtonTab({ onPressCustom, ...props }: MoreButtonTabProps) {
  return (
    <PlatformPressable
      {...props}
      onPress={(e) => {
        if (onPressCustom) {
          onPressCustom();
        } else {
          props.onPress?.(e);
        }
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}

