import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Shadows, Spacing } from '@/constants/theme';
import { shareApp } from '@/src/modules/share/ShareApp';

export function ShareButton() {
  const { t } = useTranslation();
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
      accessibilityLabel={t('settings.share.button_label')}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ hovered, pressed }) => [
        styles.container,
        {
          opacity: busy ? 0.75 : pressed ? 0.9 : 1,
          ...(hovered || isFocused ? Shadows.md : Shadows.sm),
          transform: pressed ? [{ scale: 0.995 }] : undefined,
        },
      ]}
    >
      <Image
        source={require('@/assets/images/Share_AvoVibe_Button.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  image: {
    height: Spacing['3xl'],
    width: undefined,
    aspectRatio: undefined,
  },
});

