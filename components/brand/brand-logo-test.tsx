import React from 'react';
import { View, StyleSheet } from 'react-native';
import Logo from '@/assets/brand/Logo_LightMode_Full.svg';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export function BrandLogoTest() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      {/* White background section */}
      <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
        <Logo width={32} />
        <Logo width={128} />
        <Logo width={256} />
      </View>

      {/* Dark background section */}
      <View style={[styles.section, { backgroundColor: '#000000' }]}>
        <Logo width={32} />
        <Logo width={128} />
        <Logo width={256} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 20,
  },
});

