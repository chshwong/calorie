/**
 * Premium Stat Tile Component for Today Snapshot
 * 
 * Gradient background, hero numbers, and accent colors
 */

import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, BorderRadius, Shadows, Layout, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getMinTouchTargetStyle, getFocusStyle } from '@/utils/accessibility';
import { Animated } from 'react-native';
import { useRef } from 'react';

type StatTileProps = {
  icon: string;
  label: string;
  value: string;
  status?: string;
  accentColor: string;
  onPress: () => void;
};

export function StatTile({ icon, label, value, status, accentColor, onPress }: StatTileProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Gradient colors based on accent
  const gradientColors = [
    colors.card,
    `${accentColor}20`, // 12% opacity equivalent
  ];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  // Create gradient effect using overlay
  const accentColorWithOpacity = `${accentColor}20`; // 12% opacity

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      {...(Platform.OS === 'web' && getFocusStyle(accentColor))}
      {...getButtonAccessibilityProps(`${label}: ${value}`)}
    >
      <Animated.View
        style={[
          styles.tile,
          {
            transform: [{ scale: scaleAnim }],
            borderRadius: BorderRadius.card,
            backgroundColor: colors.card,
            ...Shadows.card,
          },
        ]}
      >
        {/* Gradient overlay effect */}
        <View style={[styles.gradient, { backgroundColor: colors.card }]}>
          {/* Accent overlay for gradient effect */}
          {Platform.OS === 'web' ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  ...(Platform.OS === 'web' && {
                    // @ts-ignore - Web-only CSS property
                    backgroundImage: `linear-gradient(135deg, ${colors.card} 0%, ${accentColorWithOpacity} 100%)`,
                  }),
                },
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: accentColorWithOpacity,
                  opacity: 0.3,
                  borderTopLeftRadius: BorderRadius.card,
                  borderBottomRightRadius: BorderRadius.card,
                },
              ]}
            />
          )}
          <View style={styles.content}>
            <IconSymbol name={icon as any} size={26} color={accentColor} />
            <ThemedText style={[styles.label, { color: colors.textMuted }]}>
              {label}
            </ThemedText>
            <ThemedText style={[styles.heroValue, { color: colors.text }]}>
              {value}
            </ThemedText>
            {status && (
              <ThemedText style={[styles.status, { color: colors.textSubtle }]}>
                {status}
              </ThemedText>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 100,
    overflow: 'hidden',
    ...getMinTouchTargetStyle(),
  },
  gradient: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: Layout.cardInnerPaddingCompact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 3, // Reduced from Spacing.xs (4) to 3
    width: '100%',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  status: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs / 2,
  },
});

