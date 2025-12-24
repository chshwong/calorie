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

import { useMemo } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import Lottie from 'lottie-react';
import animationData from '../../assets/lottie/Wobbling.json';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import BrandLogoNameAndTag from '@/components/brand/BrandLogoNameAndTag';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadingQuotes } from '@/i18n/quotes/loadingQuotes';

// Home container max width (from DesktopPageContainer)
const HOME_MAX_WIDTH = 900;

export default function LoadingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Pick random quote once per mount
  const quote = useMemo(() => {
    if (loadingQuotes.length === 0) return '';
    return loadingQuotes[Math.floor(Math.random() * loadingQuotes.length)];
  }, []);

  // Determine if desktop (for container width)
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  return (
    <ThemedView style={styles.container}>
      <View 
        style={[
          styles.contentContainer,
          isDesktop && { maxWidth: HOME_MAX_WIDTH },
        ]}
      >
        {/* Vertical column: Lottie -> Quote -> Logo */}
        <View style={styles.column}>
          {/* Lottie Animation */}
          <View style={styles.lottieContainer}>
            <Lottie
              animationData={animationData}
              style={styles.lottie}
              loop={true}
            />
          </View>

          {/* Quote Text - Between animation and logo */}
          {quote && (
            <ThemedText style={[styles.quoteText, { color: colors.textSecondary }]}>
              {quote}
            </ThemedText>
          )}

          {/* Logo_Name&Tag - Below quote */}
          <View style={styles.logoContainer}>
            <BrandLogoNameAndTag width={220} />
          </View>
        </View>
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
    width: '100%',
    paddingHorizontal: Spacing.md, // 16px on mobile
    paddingVertical: Spacing.xl, // 24px vertical padding
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        paddingHorizontal: Spacing.lg, // 24px on desktop
      },
    }),
  },
  column: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  lottieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md, // 16px (2-line gap)
  },
  lottie: {
    width: 200,
    height: 200,
  },
  quoteText: {
    fontSize: Platform.select({ web: 14, default: 13 }),
    textAlign: 'center',
    lineHeight: Platform.select({ web: 20, default: 18 }),
    fontStyle: 'italic',
    opacity: 0.8,
    marginVertical: Spacing.sm, // 10px (8-12px range)
    paddingHorizontal: Spacing.md,
    maxWidth: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl, // 32px (4-line gap)
  },
});

