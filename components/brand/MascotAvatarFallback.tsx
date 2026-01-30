import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

type Props = {
  size: number;
  backgroundColor: string;
  borderColor: string;
};

const mascotPng = require('@/assets/brand/Logo_MascotOnly.png');

let MascotSvg: React.ComponentType<{ width: number; height: number }> | null = null;
try {
  MascotSvg = require('@/assets/brand/Logo_MascotOnly.svg').default;
} catch {
  MascotSvg = null;
}

export default function MascotAvatarFallback({ size, backgroundColor, borderColor }: Props) {
  const inner = Math.round(size * 0.68);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          borderColor,
        },
      ]}
    >
      {MascotSvg ? (
        <MascotSvg width={inner} height={inner} />
      ) : (
        <Image
          source={mascotPng}
          style={{ width: inner, height: inner }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
