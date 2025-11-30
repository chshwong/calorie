/**
 * DesktopPageContainer - Reusable layout wrapper for desktop/large tablet screens
 * 
 * Provides consistent max-width (900px) and centering for module home screens.
 * Matches the canonical desktop width from Exercise home screen.
 * 
 * On desktop/large screens (>= 768px):
 * - Constrains content to maxWidth: 900px
 * - Centers content horizontally
 * - Applies consistent horizontal padding (24-32px)
 * 
 * On mobile (< 768px):
 * - Full width with standard padding
 * - Preserves existing mobile layouts
 */

import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { Spacing } from '@/constants/theme';

type DesktopPageContainerProps = {
  children: React.ReactNode;
  style?: any;
};

export function DesktopPageContainer({ children, style }: DesktopPageContainerProps) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = screenWidth >= 768;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });

    return () => subscription?.remove();
  }, []);

  return (
    <View
      style={[
        styles.container,
        isDesktop && styles.containerDesktop,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: Spacing.md, // 16px on mobile
  },
  containerDesktop: {
    maxWidth: 900, // Canonical desktop width matching Exercise screen
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl, // 32px on desktop
  },
});

