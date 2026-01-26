import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, BorderRadius, Layout, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { InterFont } from '@/hooks/use-fonts';
import { shareApp } from '@/src/modules/share/ShareApp';

export function ShareButton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [busy, setBusy] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handlePress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await shareApp();
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // Web-only feature per spec (mobile browsers + desktop fallback).
  if (Platform.OS !== 'web') return null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Share"
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ hovered, pressed }) => [
        styles.container,
        {
          backgroundColor: colors.backgroundSecondary,
          borderColor: hovered || isFocused ? colors.tint : colors.border,
          opacity: busy ? 0.75 : pressed ? 0.9 : 1,
          ...(hovered || isFocused ? Shadows.md : Shadows.sm),
          transform: pressed ? [{ scale: 0.995 }] : undefined,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="share-outline" size={20} color={colors.text} />
        <Text style={[styles.text, { color: colors.text }]}>Share</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.sm,
  },
  text: {
    fontFamily: InterFont.semibold,
    ...(Typography.button ?? Typography.buttonSmall),
  },
});

