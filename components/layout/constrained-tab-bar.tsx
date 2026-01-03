/**
 * ConstrainedTabBar - Custom tab bar wrapper that constrains content width on large desktop screens
 * 
 * Wraps the default React Navigation BottomTabBar and adds a max-width container
 * on web for screens >= 1024px, matching the main page content width (900px).
 * 
 * The background still spans full width edge-to-edge, but the tab icons/content
 * are constrained and centered to align with the main page content.
 */

import React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { BottomTabBar, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Layout } from '@/constants/theme';

export function ConstrainedTabBar(props: BottomTabBarProps) {
  const [screenWidth, setScreenWidth] = React.useState(
    Dimensions.get('window').width
  );
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Freeze safe-area bottom inset on web (always use 0)
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setScreenWidth(window.width);
      });
      return () => subscription?.remove();
    }
  }, []);

  // Extract background and border colors from the first route's tabBarStyle
  // This matches what we set in screenOptions
  const firstRouteKey = props.state?.routes[0]?.key;
  const firstDescriptor = firstRouteKey ? props.descriptors[firstRouteKey] : undefined;
  const tabBarStyle = firstDescriptor?.options?.tabBarStyle;
  
  // Extract colors from tabBarStyle, fallback to theme colors
  const backgroundColor = (tabBarStyle && typeof tabBarStyle === 'object' && 'backgroundColor' in tabBarStyle)
    ? (tabBarStyle as any).backgroundColor
    : colors.background;
  const borderTopColor = (tabBarStyle && typeof tabBarStyle === 'object' && 'borderTopColor' in tabBarStyle)
    ? (tabBarStyle as any).borderTopColor
    : colors.border;

  // On web, always wrap the tab bar content in a fixed container to prevent jump
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.fullWidthContainer, { backgroundColor, borderTopColor }]}>
        <View style={[styles.footerInner, screenWidth < 1024 && styles.footerInnerMobile]}>
          <BottomTabBar 
            {...props} 
            style={[
              props.style,
              {
                height: Layout.bottomTabBarHeight,
                paddingBottom: 0,
                marginBottom: 0,
                borderTopWidth: 0,
                backgroundColor: 'transparent',
              },
            ]}
          />
        </View>
      </View>
    );
  }

  // On native platforms (iOS/Android), use the default tab bar without constraints
  return (
    <BottomTabBar 
      {...props}
      style={[
        props.style,
        Platform.OS === 'web' && {
          height: Layout.bottomTabBarHeight,
          paddingBottom: 0,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fullWidthContainer: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
      },
      default: {
        position: 'absolute' as any,
      },
    }),
    left: 0,
    right: 0,
    // Slightly overlap the viewport bottom on web to avoid a 1px gap from subpixel rounding.
    bottom: Platform.OS === 'web' ? -StyleSheet.hairlineWidth : 0,
    zIndex: 9999, // ensure it stays above sheets
    // Background spans full width edge-to-edge
  },
  footerInner: {
    width: '100%',
    maxWidth: 900, // Match DesktopPageContainer max-width (same as main content)
    alignSelf: 'center',
    ...Platform.select({
      web: {
        // Ensure proper centering on web
        display: 'flex',
      },
    }),
  },
  footerInnerMobile: {
    maxWidth: '100%',
  },
});

