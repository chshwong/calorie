import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import LogoLightFull from '@/assets/brand/Logo_LightMode_Full.svg';
import LogoDarkFull from '@/assets/brand/Logo_DarkMode_Full.svg';

type BrandLogoFullProps = {
  width?: number;
  height?: number;
  style?: any;
  accessibilityLabel?: string;
};

export default function BrandLogoFull({
  width = 220,
  height,
  style,
  accessibilityLabel = 'AvoVibe full logo',
}: BrandLogoFullProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Logo = isDark ? LogoDarkFull : LogoLightFull;

  return (
    <View style={[styles.container, style]} accessibilityLabel={accessibilityLabel}>
      <Logo width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});

