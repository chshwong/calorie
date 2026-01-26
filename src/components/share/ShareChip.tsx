import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Shadows, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { InterFont } from '@/hooks/use-fonts';
import { shareApp } from '@/src/modules/share/ShareApp';
import { ThemedText } from '@/components/themed-text';

export function ShareChip() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [busy, setBusy] = useState(false);

  const handlePress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await shareApp();
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // Web-only per spec (mobile browsers + desktop fallback).
  if (Platform.OS !== 'web') return null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Share AvoVibe"
      style={({ hovered, pressed }) => [
        styles.container,
        {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
          opacity: busy ? 0.7 : pressed ? 0.9 : 1,
        },
        hovered ? Shadows.sm : null,
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="share-outline" size={18} color={colors.text} />
        <ThemedText style={[styles.label, { color: colors.text }]}>Share AvoVibe</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 38,
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.buttonSmall,
    fontFamily: InterFont.semibold,
  },
});

