/**
 * Responsive container component for dashboard sections
 * Reuses the same pattern as ExerciseSectionContainer
 */

import { View, StyleSheet, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { Spacing } from '@/constants/theme';

type DashboardSectionContainerProps = {
  children: React.ReactNode;
  style?: any;
};

export function DashboardSectionContainer({ children, style }: DashboardSectionContainerProps) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth >= 768;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });

    return () => subscription?.remove();
  }, []);

  return (
    <View
      style={[
        styles.responsiveContainer,
        isLargeScreen && styles.responsiveContainerLarge,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  responsiveContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  responsiveContainerLarge: {
    maxWidth: 900,
    alignSelf: 'center',
  },
});

