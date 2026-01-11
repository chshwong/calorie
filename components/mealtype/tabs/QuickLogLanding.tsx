/**
 * Quick Log Landing Component
 * 
 * Renders two premium tiles for Manual Log and AI Camera navigation
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, Shadows, Layout, Typography, FontSize, FontWeight, LineHeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getMinTouchTargetStyle } from '@/utils/accessibility';

type QuickLogLandingProps = {
  entryDate: string;
  mealType: string;
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string, options?: any) => string;
};

export function QuickLogLanding({ entryDate, mealType, colors, t }: QuickLogLandingProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const goToQuickLog = (tab?: 'ai' | 'quick-log') => {
    router.push({
      pathname: '/quick-log',
      params: {
        date: entryDate,
        mealType: mealType,
        ...(tab && { tab }),
      },
    });
  };

  const handleManualLog = () => {
    goToQuickLog('quick-log');
  };

  const handleAiCamera = () => {
    goToQuickLog('ai');
  };

  return (
    <View style={styles.container}>
      <View style={styles.tilesContainer}>
        {/* Manual Log Tile */}
        <TouchableOpacity
          style={[
            styles.tile,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder || colors.icon + '15',
            },
          ]}
          onPress={handleManualLog}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            t('quick_log.landing.manual_log.label', 'Manual Log'),
            t('quick_log.landing.manual_log.hint', 'Enter calories and macros quickly')
          )}
        >
          <View style={styles.tileContent}>
            <View style={styles.iconContainer}>
              <ThemedText style={styles.iconEmoji}>⚡</ThemedText>
            </View>
            <View style={styles.textContainer}>
              <ThemedText style={[styles.tileTitle, { color: colors.text }]}>
                {t('quick_log.landing.manual_log.label', 'Manual Log')}
              </ThemedText>
              <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]}>
                {t('quick_log.landing.manual_log.subtitle', 'Enter calories and macros quickly')}
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.icon} />
          </View>
        </TouchableOpacity>

        {/* AI Camera Tile */}
        <TouchableOpacity
          style={[
            styles.tile,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder || colors.icon + '15',
            },
          ]}
          onPress={handleAiCamera}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            t('quick_log.landing.ai_camera.label', 'AI Camera'),
            t('quick_log.landing.ai_camera.hint', 'Use your own AI assistant (free)')
          )}
        >
          <View style={styles.tileContent}>
            <View style={styles.iconContainer}>
              <ThemedText style={styles.iconEmoji}>📷</ThemedText>
            </View>
            <View style={styles.textContainer}>
              <ThemedText style={[styles.tileTitle, { color: colors.text }]}>
                {t('quick_log.landing.ai_camera.label', 'AI Camera')}
              </ThemedText>
              <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]}>
                {t('quick_log.landing.ai_camera.subtitle', 'Use your own AI assistant (free)')}
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.icon} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: Spacing.lg,
  },
  tilesContainer: {
    gap: Spacing.md,
  },
  tile: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  tileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    minHeight: Layout.minTouchTarget,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  tileTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.lg * LineHeight.tight,
  },
  tileSubtitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.base * LineHeight.normal,
  },
});
