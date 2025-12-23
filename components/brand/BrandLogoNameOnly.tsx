import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import LogoLightNameOnly from '@/assets/brand/Logo_LightMode_NameOnly.svg';
import LogoDarkNameOnly from '@/assets/brand/Logo_DarkMode_NameOnly.svg';

type BrandLogoNameOnlyProps = {
  width?: number;
  height?: number;
  style?: any;
  accessibilityLabel?: string;
};

export default function BrandLogoNameOnly({
  width = 180,
  height,
  style,
  accessibilityLabel = 'AvoVibe',
}: BrandLogoNameOnlyProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Logo = isDark ? LogoDarkNameOnly : LogoLightNameOnly;

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

