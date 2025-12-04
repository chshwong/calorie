import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function OfflineBanner() {
  const { isOfflineMode } = useOfflineMode();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (!isOfflineMode) {
    return null;
  }

  return (
    <ThemedView style={[styles.banner, { backgroundColor: colors.tint }]}>
      <ThemedText style={[styles.bannerText, { color: colors.background }]}>
        Limited connectivity. Showing last saved data.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      },
      default: {
        // On mobile, it will be at the top of the content
      },
    }),
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});

