import React from 'react';
import { View, StyleSheet } from 'react-native';
import LogoMascotOnly from '@/assets/brand/Logo_MascotOnly.svg';

type BrandLogoMascotOnlyProps = {
  width?: number;
  height?: number;
  style?: any;
  accessibilityLabel?: string;
};

export default function BrandLogoMascotOnly({
  width = 96,
  height,
  style,
  accessibilityLabel = 'AvoVibe mascot',
}: BrandLogoMascotOnlyProps) {
  return (
    <View style={[styles.container, style]} accessibilityLabel={accessibilityLabel}>
      <LogoMascotOnly width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});

