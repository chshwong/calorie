/**
 * Branded Loading Screen
 * 
 * Shows:
 * - Lottie animation (centered)
 * - Logo_Name&Tag (beneath animation)
 * - Random quote (near bottom)
 * 
 * Mobile-first, respects dark/light mode, matches Home container width on desktop.
 */

import BrandLogoMascotOnly from '@/components/brand/BrandLogoMascotOnly';
import BrandLogoNameAndTag from '@/components/brand/BrandLogoNameAndTag';
import { getStartupTagline } from '@/components/system/startupVisualState';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import animationData from '../../assets/lottie/Wobbling.json';

export default function LoadingScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Animated loading dots state
  const [dotsCount, setDotsCount] = useState(0);
  // Show hint after 5s if still on this screen (stuck state)
  const [showSlowHint, setShowSlowHint] = useState(false);

  // Animate loading dots: 0 → 1 → 2 → 3 → 0 (loop)
  useEffect(() => {
    const interval = setInterval(() => {
      setDotsCount((prev) => (prev + 1) % 4);
    }, 450); // 450ms per step

    return () => clearInterval(interval);
  }, []);

  // After 5s continuous display, show guidance for stuck states
  useEffect(() => {
    const timer = setTimeout(() => setShowSlowHint(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Stable across startup remounts via global singleton.
  const quote = getStartupTagline();

  // Determine if desktop (for container width)
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  // Loading text with animated dots (i18n compliant)
  const loadingText = t('common.loading') + '.'.repeat(dotsCount);

  return (
    <ThemedView style={styles.container}>
      <View 
        style={[
          styles.contentContainer,
          isDesktop && { maxWidth: Layout.desktopMaxWidth },
        ]}
      >
        {/* Main content column: Lottie -> Quote -> Logo */}
        <View style={styles.column}>
          {/* Lottie Animation */}
          <View style={styles.lottieContainer}>
            <View style={styles.mascotStage}>
              <View style={styles.mascotFallback}>
                <BrandLogoMascotOnly width={200} />
              </View>
              <Lottie
                animationData={animationData}
                style={styles.lottie}
                loop={true}
                autoplay={true}
              />
            </View>
          </View>

          {/* Spacer between Lottie and Quote */}
          <View style={styles.spacer} />

          {/* Quote Text - Between animation and logo */}
          {quote && (
            <View style={styles.quoteWrapper}>
              <ThemedText
                nativeID="startup-quote"
                style={[styles.quoteText, { color: colors.textSecondary }]}
              >
                {quote}
              </ThemedText>
            </View>
          )}

          {/* Spacer between Quote and Logo */}
          <View style={styles.spacer} />

          {/* Logo_Name&Tag - Below quote */}
          <View style={styles.logoContainer}>
            <BrandLogoNameAndTag width={220} />
          </View>
        </View>

        {/* Loading text at bottom - separate from main column */}
        <View style={styles.loadingTextContainer}>
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {loadingText}
          </ThemedText>
        </View>

        {/* Slow-loading hint: show after 5s if still stuck */}
        {showSlowHint ? (
          <View style={styles.slowHintContainer}>
            <ThemedText style={[styles.slowHintText, { color: colors.textSecondary }]}>
              This is taking too long—we dropped the avocado. 🥑
            </ThemedText>
            <ThemedText style={[styles.slowHintText, styles.slowHintTextSecond, { color: colors.textSecondary }]}>
              Please close the browser completely and reopen AvoVibe.
            </ThemedText>
          </View>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: Spacing.md, // 16px on mobile
    alignItems: 'center',
    ...Platform.select({
      web: {
        paddingHorizontal: Spacing.lg, // 24px on desktop
      },
    }),
  },
  column: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  lottieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotStage: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotFallback: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.98,
  },
  lottie: {
    width: 200,
    height: 200,
  },
  spacer: {
    height: Spacing['2xl'], // 24px - consistent gap between elements
  },
  quoteWrapper: {
    width: '100%',
    maxWidth: 420, // Constrain quote width for readability
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  quoteText: {
    fontSize: Platform.select({ web: 14, default: 13 }),
    textAlign: 'center',
    lineHeight: Platform.select({ web: 20, default: 18 }),
    fontStyle: 'italic',
    opacity: 0.8,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTextContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Platform.select({
      web: Spacing['2xl'], // 24px
      default: Spacing['2xl'] + 20, // 44px (24px + safe area)
    }),
    paddingTop: Spacing.lg, // 16px gap from logo
    minWidth: 100, // Fixed width to prevent layout shift
  },
  loadingText: {
    fontSize: Platform.select({ web: 14, default: 13 }), // +2px from previous
    textAlign: 'center',
    opacity: 0.65,
    marginTop: 0,
    marginBottom: 0,
    fontFamily: Platform.select({
      web: 'Inter, system-ui, sans-serif',
      default: undefined, // Use system default on native
    }),
    letterSpacing: 0.5, // Slight spacing for better readability
  },
  slowHintContainer: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    maxWidth: 340,
    paddingBottom: Spacing.lg,
  },
  slowHintText: {
    textAlign: 'center',
    fontSize: Platform.select({ web: 14, default: 13 }),
    lineHeight: Platform.select({ web: 20, default: 18 }),
    opacity: 0.9,
    fontFamily: Platform.select({
      web: 'Inter, system-ui, sans-serif',
      default: undefined,
    }),
  },
  slowHintTextSecond: {
    marginTop: 6,
  },
});

