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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export function ConstrainedTabBar(props: BottomTabBarProps) {
  const [screenWidth, setScreenWidth] = React.useState(
    Dimensions.get('window').width
  );
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isLargeDesktop = Platform.OS === 'web' && screenWidth >= 1024;

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

  // On large desktop screens, wrap the tab bar content in a constrained container
  if (isLargeDesktop) {
    return (
      <View style={[styles.fullWidthContainer, { backgroundColor, borderTopColor }]}>
        <View style={styles.footerInner}>
          <BottomTabBar 
            {...props} 
            style={[
              props.style,
              {
                backgroundColor: 'transparent',
                borderTopWidth: 0,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  // On mobile/tablet, use the default tab bar without constraints
  return <BottomTabBar {...props} />;
}

const styles = StyleSheet.create({
  fullWidthContainer: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
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
});

