import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import LogoLightNoTag from '@/assets/brand/Logo_LightMode_NoTag.svg';
import LogoDarkNoTag from '@/assets/brand/Logo_DarkMode_NoTag.svg';

type BrandLogoNoTagProps = {
  width?: number;
  height?: number;
  style?: any;
  accessibilityLabel?: string;
};

export default function BrandLogoNoTag({
  width = 220,
  height,
  style,
  accessibilityLabel = 'AvoVibe logo',
}: BrandLogoNoTagProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Logo = isDark ? LogoDarkNoTag : LogoLightNoTag;

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

