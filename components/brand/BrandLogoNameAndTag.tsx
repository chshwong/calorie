import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
// Note: Using exact filename with ampersand - if this fails, we may need to rename assets
import LogoLightNameTag from '@/assets/brand/Logo_LightMode_Name&Tag.svg';
import LogoDarkNameTag from '@/assets/brand/Logo_DarkMode_Name&Tag.svg';

type BrandLogoNameAndTagProps = {
  width?: number;
  height?: number;
  style?: any;
  accessibilityLabel?: string;
};

export default function BrandLogoNameAndTag({
  width = 220,
  height,
  style,
  accessibilityLabel = 'AvoVibe name and tagline',
}: BrandLogoNameAndTagProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Logo = isDark ? LogoDarkNameTag : LogoLightNameTag;

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

