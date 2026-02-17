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
import {
  getStartupTagline,
  isStartupMascotReady,
  markStartupMascotReady,
} from '@/components/system/startupVisualState';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Layout, Nudge, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isNativeWebView } from '@/lib/env/isNativeWebView';
import type { LottieRefCurrentProps } from 'lottie-react';
import Lottie from 'lottie-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import animationData from '../../assets/lottie/Wobbling.json';

export default function LoadingScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const native = isNativeWebView();
  const isWeb = Platform.OS === 'web';
  const startupBackground = isWeb ? 'var(--startup-bg)' : colors.background;
  const startupTextSecondary = isWeb ? 'var(--startup-text-secondary)' : colors.textSecondary;
  
  // Animated loading dots state
  const [dotsCount, setDotsCount] = useState(0);
  // Show hint after 5s if still on this screen (stuck state)
  const [showSlowHint, setShowSlowHint] = useState(false);
  // Hydration guard so fallback only appears in pre-hydration first paint on web.
  const [hasHydrated, setHasHydrated] = useState(false);
  // Show static mascot until Lottie signals readiness.
  const [lottieReady, setLottieReady] = useState(() => isStartupMascotReady());
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  const handleLottieReady = useCallback(() => {
    setLottieReady((prev) => {
      if (prev) return prev;
      markStartupMascotReady();
      return true;
    });
  }, []);

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

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Web startup can hydrate with a paused first frame; explicitly kick playback.
  useEffect(() => {
    if (!hasHydrated) return;
    if (!lottieRef.current) return;
    const id = requestAnimationFrame(() => {
      lottieRef.current?.play();
    });
    return () => cancelAnimationFrame(id);
  }, [hasHydrated, lottieReady]);

  // Stable across startup remounts via global singleton.
  const quote = getStartupTagline();

  // Determine if desktop (for container width)
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  // Loading text with animated dots (i18n compliant)
  const loadingText = t('common.loading') + '.'.repeat(dotsCount);
  const slowHintLine2Key = native
    ? 'loading_screen.slow_hint_line2_Native'
    : 'loading_screen.slow_hint_line2';

  return (
    <ThemedView style={styles.container} lightColor={startupBackground} darkColor={startupBackground}>
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
              {!lottieReady ? (
                <View
                  nativeID="startup-mascot-fallback"
                  style={[
                    styles.mascotFallback,
                    hasHydrated ? styles.mascotFallbackHidden : null,
                  ]}
                  pointerEvents="none"
                >
                  <BrandLogoMascotOnly width={200} />
                </View>
              ) : null}
              <Lottie
                animationData={animationData}
                lottieRef={lottieRef}
                style={styles.lottie}
                loop={true}
                autoplay={true}
                onDOMLoaded={handleLottieReady}
                onDataReady={handleLottieReady}
                onLoadedImages={handleLottieReady}
                onEnterFrame={handleLottieReady}
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
                style={[styles.quoteText, { color: startupTextSecondary }]}
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
          <ThemedText style={[styles.loadingText, { color: startupTextSecondary }]}>
            {loadingText}
          </ThemedText>
        </View>

        {/* Slow-loading hint: show after 5s if still stuck */}
        {showSlowHint ? (
          <View style={styles.slowHintContainer}>
            <ThemedText style={[styles.slowHintText, { color: startupTextSecondary }]}>
              {t('loading_screen.slow_hint_line1')}
            </ThemedText>
            <ThemedText style={[styles.slowHintText, styles.slowHintTextSecond, { color: startupTextSecondary }]}>
              {t(slowHintLine2Key)}
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
    paddingHorizontal: Spacing.md, // 12px on mobile
    alignItems: 'center',
    ...Platform.select({
      web: {
        paddingHorizontal: Spacing.lg, // 16px on desktop
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
  mascotFallbackHidden: {
    opacity: 0,
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
    ...Typography.bodySmall,
    textAlign: 'center',
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
      default: Spacing['2xl'] + Spacing.xl, // 44px (24px + 20px)
    }),
    paddingTop: Spacing.lg, // 16px gap from logo
    minWidth: 100, // Fixed width to prevent layout shift
  },
  loadingText: {
    ...Typography.bodySmall,
    textAlign: 'center',
    opacity: 0.65,
    marginTop: 0,
    marginBottom: 0,
  },
  slowHintContainer: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    maxWidth: 340,
    paddingBottom: Spacing.lg,
  },
  slowHintText: {
    ...Typography.bodySmall,
    textAlign: 'center',
    opacity: 0.9,
  },
  slowHintTextSecond: {
    marginTop: Spacing.xs + Nudge.px2,
  },
});

