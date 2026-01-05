import Lottie from "lottie-react";
import animationData from "../assets/lottie/Wobbling.json";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  useWindowDimensions,
  Image,
  type ScrollView as ScrollViewType,
  type LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { sendMagicLink, signInWithOAuth } from '@/lib/services/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import BrandLogoNameAndTag from '@/components/brand/BrandLogoNameAndTag';
import { showAppToast } from '@/components/ui/app-toast';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Nudge, Shadows, Spacing, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { clearPendingLinkState, getOAuthRedirectTo, setPendingLinkState } from '@/lib/auth/oauth';
import { useGeoCountry } from '@/hooks/use-geo-country';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getLinkAccessibilityProps,
  getMinTouchTargetStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function animateScrollTo(scrollViewRef: React.RefObject<ScrollViewType | null>, targetY: number, durationMs = 550) {
  const refAny = scrollViewRef.current as any;
  const node: any = refAny?.getScrollableNode?.() ?? refAny;
  if (!node) return;

  // RN Web: scrollable node is typically an HTMLElement with scrollTop.
  const hasDomScrollTop = typeof node.scrollTop === 'number' && typeof node.scrollTo === 'function';
  const startY = hasDomScrollTop ? (node.scrollTop as number) : (refAny?.__lastScrollY ?? 0);
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const step = (now: number) => {
    const elapsed = now - start;
    const t = clamp(elapsed / durationMs, 0, 1);
    const eased = easeInOutCubic(t);
    const nextY = startY + (targetY - startY) * eased;

    if (hasDomScrollTop) {
      node.scrollTo({ top: nextY, behavior: 'auto' });
    } else if (typeof refAny?.scrollTo === 'function') {
      // Fallback for non-web implementations (shouldn't be used per requirements, but safe).
      refAny.scrollTo({ y: nextY, animated: false });
    }

    if (t < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

function HeroVisualComposite({
  colors,
  colorScheme,
  isWeb,
  isTwoCol,
}: {
  colors: ThemeColors;
  colorScheme: 'light' | 'dark';
  isWeb: boolean;
  isTwoCol: boolean;
}) {
  const { t } = useTranslation();
  const height = isTwoCol ? 400 : 300;
  const phoneWidth = isTwoCol ? 280 : 240;
  const phoneHeight = isTwoCol ? 392 : 340;
  const phoneOffsetX = Math.round(phoneWidth / 2);
  const phoneOffsetY = Math.round(phoneHeight / 2);
  const cardWidth = isTwoCol ? 188 : 170;

  return (
    <View
      style={[styles.heroVisualWrap, { height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Glow behind phone */}
      <View
        pointerEvents="none"
        style={[
          styles.heroGlow,
          isWeb
            ? {
                backgroundImage:
                  colorScheme === 'dark'
                    ? 'radial-gradient(260px circle at 50% 45%, rgba(233, 135, 111, 0.40), transparent 60%), radial-gradient(340px circle at 52% 55%, rgba(91, 194, 198, 0.32), transparent 62%)'
                    : 'radial-gradient(280px circle at 50% 42%, rgba(184, 85, 63, 0.32), transparent 62%), radial-gradient(360px circle at 52% 56%, rgba(47, 164, 169, 0.30), transparent 64%)',
              }
            : null,
        ]}
      />

      {/* Phone frame */}
      <View
        style={[
          styles.phoneFrame,
          {
            borderColor: colors.cardBorder ?? colors.border,
            backgroundColor: colorScheme === 'dark' ? '#0B0F14' : '#FFFFFF',
            width: phoneWidth,
            height: phoneHeight,
            transform: [{ translateX: -phoneOffsetX }, { translateY: -phoneOffsetY }],
          },
        ]}
      >
        <View style={[styles.phoneNotch, { backgroundColor: colorScheme === 'dark' ? '#11181C' : '#EAECEF' }]} />
        <View
          style={[
            styles.phoneScreen,
            {
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
            },
            isWeb
              ? {
                  backgroundImage:
                    colorScheme === 'dark'
                      ? 'radial-gradient(160px circle at 35% 30%, rgba(91, 194, 198, 0.35), transparent 62%), radial-gradient(220px circle at 70% 55%, rgba(233, 135, 111, 0.30), transparent 62%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))'
                      : 'radial-gradient(170px circle at 32% 28%, rgba(47, 164, 169, 0.32), transparent 62%), radial-gradient(240px circle at 72% 58%, rgba(184, 85, 63, 0.24), transparent 62%), linear-gradient(135deg, rgba(15,23,42,0.02), rgba(15,23,42,0.00))',
                }
              : null,
          ]}
        >
          {/* Placeholder "floating UI" bars */}
          <View style={[styles.phoneBar, { backgroundColor: colors.border + '55' }]} />
          <View style={[styles.phoneBar, { width: '74%', backgroundColor: colors.border + '45' }]} />
          <View style={[styles.phoneBar, { width: '62%', backgroundColor: colors.border + '35' }]} />
        </View>
      </View>

      {/* Floating stat cards */}
      <View
        style={[
          styles.floatingCard,
          styles.floatingCardTL,
          {
            width: cardWidth,
            backgroundColor: colorScheme === 'dark' ? 'rgba(11, 15, 20, 0.72)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: colors.cardBorder ?? colors.border,
            ...(isWeb ? ({ backdropFilter: 'blur(10px)' } as any) : null),
          },
        ]}
      >
        <Text style={[styles.floatingCardTitle, { color: colors.textSecondary }]}>
          {t('auth.login.marketing.demo_today_label')}
        </Text>
        <Text style={[styles.floatingCardValue, { color: colors.text }]} numberOfLines={1}>
          {t('auth.login.marketing.demo_today_calories')}
        </Text>
        <Text style={[styles.floatingCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {t('auth.login.marketing.demo_today_target')}
        </Text>
      </View>

      <View
        style={[
          styles.floatingCard,
          styles.floatingCardBR,
          {
            width: cardWidth,
            backgroundColor: colorScheme === 'dark' ? 'rgba(11, 15, 20, 0.72)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: colors.cardBorder ?? colors.border,
            ...(isWeb ? ({ backdropFilter: 'blur(10px)' } as any) : null),
          },
        ]}
      >
        <Text style={[styles.floatingCardTitle, { color: colors.textSecondary }]}>
          {t('auth.login.marketing.demo_macros_label')}
        </Text>
        <Text style={[styles.floatingCardValue, { color: colors.text }]} numberOfLines={1}>
          {t('auth.login.marketing.demo_macros_value_primary')}
        </Text>
        <Text style={[styles.floatingCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {t('auth.login.marketing.demo_macros_value_secondary')}
        </Text>
      </View>
    </View>
  );
}

type StepsMockVariant = 'logging' | 'progress' | 'plan';

function PhoneMock({
  colors,
  colorScheme,
  isWeb,
  variant,
}: {
  colors: ThemeColors;
  colorScheme: 'light' | 'dark';
  isWeb: boolean;
  variant: StepsMockVariant;
}) {
  // Use theme surfaces (no hardcoded colors).
  const frameBg = colors.card;
  const screenBg = colors.backgroundSecondary;

  const renderVariant = () => {
    switch (variant) {
      case 'logging':
        return (
          <View style={styles.mockContent}>
            <View style={styles.mockTopRow}>
              <View style={[styles.mockPill, { backgroundColor: colors.appTeal + '18', borderColor: colors.appTeal + '35' }]}>
                <View style={[styles.mockDot, { backgroundColor: colors.appTeal }]} />
                <View style={[styles.mockPillText, { backgroundColor: colors.textSecondary + '55' }]} />
              </View>
              <View style={[styles.mockChip, { backgroundColor: colors.tintLight, borderColor: colors.tint + '35' }]}>
                <View style={[styles.mockChipText, { backgroundColor: colors.textSecondary + '55' }]} />
              </View>
            </View>

            <View style={styles.mockList}>
              <View style={[styles.mockListRow, { borderColor: colors.border }]}>
                <View style={[styles.mockAvatar, { backgroundColor: colors.tint + '18' }]} />
                <View style={styles.mockListTextCol}>
                  <View style={[styles.mockLine, { width: '78%', backgroundColor: colors.textSecondary + '55' }]} />
                  <View style={[styles.mockLine, { width: '52%', backgroundColor: colors.textSecondary + '35' }]} />
                </View>
              </View>
              <View style={[styles.mockListRow, { borderColor: colors.border }]}>
                <View style={[styles.mockAvatar, { backgroundColor: colors.appTeal + '18' }]} />
                <View style={styles.mockListTextCol}>
                  <View style={[styles.mockLine, { width: '70%', backgroundColor: colors.textSecondary + '55' }]} />
                  <View style={[styles.mockLine, { width: '46%', backgroundColor: colors.textSecondary + '35' }]} />
                </View>
              </View>
              <View style={[styles.mockListRow, { borderColor: colors.border }]}>
                <View style={[styles.mockAvatar, { backgroundColor: colors.chartGreen + '18' }]} />
                <View style={styles.mockListTextCol}>
                  <View style={[styles.mockLine, { width: '66%', backgroundColor: colors.textSecondary + '55' }]} />
                  <View style={[styles.mockLine, { width: '40%', backgroundColor: colors.textSecondary + '35' }]} />
                </View>
              </View>
            </View>

            <View style={[styles.mockCtaBar, { backgroundColor: colors.tint, borderColor: (colors.cardBorder ?? colors.border) + '55' }]}>
              <View style={[styles.mockCtaText, { backgroundColor: colors.textInverse + 'AA' }]} />
              <View style={[styles.mockCtaIcon, { backgroundColor: colors.textInverse + 'CC' }]} />
            </View>
          </View>
        );

      case 'progress':
        return (
          <View style={styles.mockContent}>
            <View style={styles.mockTopRow}>
              <View style={[styles.mockChip, { backgroundColor: colors.tintLight, borderColor: colors.tint + '35' }]}>
                <View style={[styles.mockChipText, { backgroundColor: colors.textSecondary + '55' }]} />
              </View>
              <View style={[styles.mockPill, { backgroundColor: colors.chartGreen + '14', borderColor: colors.chartGreen + '35' }]}>
                <View style={[styles.mockDot, { backgroundColor: colors.chartGreen }]} />
                <View style={[styles.mockPillText, { backgroundColor: colors.textSecondary + '55' }]} />
              </View>
            </View>

            <View style={[styles.mockChartCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.mockChartBars}>
                <View style={[styles.mockBar, { height: '55%', backgroundColor: colors.tint + '55' }]} />
                <View style={[styles.mockBar, { height: '72%', backgroundColor: colors.appTeal + '55' }]} />
                <View style={[styles.mockBar, { height: '46%', backgroundColor: colors.chartGreen + '55' }]} />
                <View style={[styles.mockBar, { height: '82%', backgroundColor: colors.tint + '55' }]} />
                <View style={[styles.mockBar, { height: '64%', backgroundColor: colors.appTeal + '55' }]} />
              </View>
              <View style={styles.mockDividerRow}>
                <View style={[styles.mockTinyLine, { backgroundColor: colors.textSecondary + '35' }]} />
                <View style={[styles.mockTinyLine, { width: '38%', backgroundColor: colors.textSecondary + '35' }]} />
              </View>
            </View>

            <View style={styles.mockRowChips}>
              <View style={[styles.mockChip, { backgroundColor: colors.appTeal + '18', borderColor: colors.appTeal + '35' }]} />
              <View style={[styles.mockChip, { backgroundColor: colors.tint + '18', borderColor: colors.tint + '35' }]} />
              <View style={[styles.mockChip, { backgroundColor: colors.chartGreen + '14', borderColor: colors.chartGreen + '35' }]} />
            </View>
          </View>
        );

      case 'plan':
        return (
          <View style={styles.mockContent}>
            <View style={styles.mockTopRow}>
              <View style={[styles.mockPill, { backgroundColor: colors.tint + '12', borderColor: colors.tint + '35' }]}>
                <View style={[styles.mockDot, { backgroundColor: colors.tint }]} />
                <View style={[styles.mockPillText, { backgroundColor: colors.textSecondary + '55' }]} />
              </View>
              <View style={[styles.mockChip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <View style={[styles.mockChipText, { backgroundColor: colors.textSecondary + '55' }]} />
              </View>
            </View>

            <View style={[styles.mockCalendar, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.mockCalendarRow}>
                {(['m', 't', 'w', 'th', 'f', 'sa', 'su'] as const).map((dayKey, i) => (
                  <View
                    key={dayKey}
                    style={[
                      styles.mockCalendarDot,
                      {
                        backgroundColor:
                          i === 2 ? colors.tint : i === 4 ? colors.appTeal : colors.textSecondary + '35',
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={[styles.mockLine, { width: '72%', backgroundColor: colors.textSecondary + '45' }]} />
            </View>

            <View style={styles.mockGrid}>
              <View style={[styles.mockMealCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={[styles.mockMealThumb, { backgroundColor: colors.appTeal + '18' }]} />
                <View style={[styles.mockLine, { width: '70%', backgroundColor: colors.textSecondary + '55' }]} />
                <View style={[styles.mockLine, { width: '48%', backgroundColor: colors.textSecondary + '35' }]} />
              </View>
              <View style={[styles.mockMealCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={[styles.mockMealThumb, { backgroundColor: colors.tint + '18' }]} />
                <View style={[styles.mockLine, { width: '62%', backgroundColor: colors.textSecondary + '55' }]} />
                <View style={[styles.mockLine, { width: '42%', backgroundColor: colors.textSecondary + '35' }]} />
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.phoneMockFrame,
        {
          borderColor: colors.cardBorder ?? colors.border,
          backgroundColor: frameBg,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.phoneMockNotch,
          { backgroundColor: colorScheme === 'dark' ? colors.backgroundSecondary : colors.border },
        ]}
      />

      <View
        style={[
          styles.phoneMockScreen,
          { borderColor: colors.border, backgroundColor: screenBg },
          isWeb
            ? ({
                backgroundImage:
                  colorScheme === 'dark'
                    ? 'radial-gradient(160px circle at 30% 22%, rgba(91, 194, 198, 0.28), transparent 62%), radial-gradient(240px circle at 76% 60%, rgba(233, 135, 111, 0.22), transparent 62%), linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))'
                    : 'radial-gradient(160px circle at 28% 20%, rgba(47, 164, 169, 0.26), transparent 62%), radial-gradient(240px circle at 76% 62%, rgba(184, 85, 63, 0.18), transparent 62%), linear-gradient(135deg, rgba(15,23,42,0.02), rgba(15,23,42,0.00))',
              } as any)
            : null,
        ]}
      >
        {renderVariant()}
      </View>
    </View>
  );
}

function StepsShowcaseMobileStack({
  colors,
  colorScheme,
  isWeb,
  screenWidth,
}: {
  colors: ThemeColors;
  colorScheme: 'light' | 'dark';
  isWeb: boolean;
  screenWidth: number;
}) {
  const { t } = useTranslation();

  const steps: Array<{
    variant: StepsMockVariant;
    titleKey: string;
    bodyKey: string;
  }> = [
    { variant: 'logging', titleKey: 'auth.login.marketing.steps_1_title', bodyKey: 'auth.login.marketing.steps_1_body' },
    { variant: 'progress', titleKey: 'auth.login.marketing.steps_2_title', bodyKey: 'auth.login.marketing.steps_2_body' },
    { variant: 'plan', titleKey: 'auth.login.marketing.steps_3_title', bodyKey: 'auth.login.marketing.steps_3_body' },
  ];

  // Center the mockups and constrain their width. Use runtime math + theme tokens (no magic px constants).
  const horizontalPadding = Spacing['2xl'];
  const maxMockWidth = Math.min(Layout.maxContentWidth, Math.max(Spacing['6xl'], screenWidth - horizontalPadding * 2));

  return (
    <View style={[styles.stepsSection, { marginTop: Spacing['3xl'] }]}>
      <ThemedText style={[styles.stepsHeading, { color: colors.text }]} accessibilityRole="header">
        {t('auth.login.marketing.steps_section_title')}
      </ThemedText>

      <View style={[styles.stepsList, { marginTop: Spacing['4xl'] }]}>
        {steps.map((step, idx) => (
          <View key={step.variant} style={{ width: '100%', marginTop: idx === 0 ? 0 : Spacing['6xl'] }}>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <View style={{ width: maxMockWidth, maxWidth: maxMockWidth }}>
                <PhoneMock colors={colors} colorScheme={colorScheme} isWeb={isWeb} variant={step.variant} />
              </View>
            </View>

            <View style={{ width: '100%', alignItems: 'center', marginTop: Spacing['3xl'] }}>
              <Text style={[styles.stepNumber, { color: colors.tint }]} accessibilityElementsHidden>
                {String(idx + 1)}
              </Text>
              <ThemedText style={[styles.stepTitle, { color: colors.text, textAlign: 'center' }]}>
                {t(step.titleKey)}
              </ThemedText>
              <ThemedText
                style={[
                  styles.stepBody,
                  { color: colors.textSecondary, textAlign: 'center', maxWidth: Layout.maxContentWidth },
                ]}
              >
                {t(step.bodyKey)}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function StepsShowcaseSection({
  colors,
  colorScheme,
  isTwoCol,
  isWeb,
  overlapMode,
  screenWidth,
}: {
  colors: ThemeColors;
  colorScheme: 'light' | 'dark';
  isTwoCol: boolean;
  isWeb: boolean;
  overlapMode: boolean;
  screenWidth: number;
}) {
  const { t } = useTranslation();

  // Overlap/collage is explicitly controlled by the parent so mobile can never accidentally enter collage mode.
  const enableOverlap = overlapMode && isTwoCol;

  // Mobile / non-collage layout: absolutely no transforms or overlap.
  if (!enableOverlap) {
    return <StepsShowcaseMobileStack colors={colors} colorScheme={colorScheme} isWeb={isWeb} screenWidth={screenWidth} />;
  }

  // Constrain decorative mockups with theme tokens (no magic pixels).
  const phoneMaxWidth = Math.max(Spacing['5xl'], Math.round(Layout.maxContentWidth * (isTwoCol ? 0.62 : 0.56)));
  const phoneWidth = Math.min(phoneMaxWidth, Math.max(Spacing['6xl'], Math.round(screenWidth - Spacing['3xl'])));
  const desktopTextMaxWidth = Math.round(Layout.maxContentWidth * 0.72);

  // Explicit spacing (avoid relying on `gap`, which is inconsistent across RN targets).
  const rowSpacing = enableOverlap ? Spacing.lg : Spacing['5xl'];
  // Desktop-only overlap between step mockups.
  // We scale overlap off the current mock height so it looks consistent across desktop widths.
  const phoneHeight = Math.round(phoneWidth * (16 / 10)); // matches phoneMockFrame aspectRatio (10/16)
  const maxLift = Spacing['6xl'] * 8;
  const liftStep2Y = enableOverlap ? -clamp(Math.round(phoneHeight * 0.25), 0, maxLift) : 0; // ~25% overlap with step 1
  // Step 3 needs to be much higher so the collage feels stacked (per screenshots).
  const liftStep3Y = enableOverlap ? -clamp(Math.round(phoneHeight * 0.55), 0, maxLift) : 0;
  // Desktop-only horizontal overlap (bring step 2 toward center; step 3 tuned separately).
  const mediaOverlapShiftXStep2 = enableOverlap ? Spacing['6xl'] + Spacing['4xl'] + Spacing['3xl'] : 0;
  // Step 3 should overlap step 2 by ~25% (less than before) so we shift it left.
  // Note: `Spacing['1xl']` is not a valid token; use `Spacing.xl`.
  const mediaOverlapShiftXStep3 = enableOverlap ? Spacing.xl : 0;

  const bodyLineHeight = Math.round(FontSize.md * 1.45);
  const step1TextLiftY = enableOverlap ? -clamp(bodyLineHeight * 4, 0, Spacing['6xl'] * 2) : 0; // ~3 lines
  const step2TextLiftY = enableOverlap ? -clamp(Math.round(phoneHeight * 0.28), 0, Spacing['6xl'] * 3) : 0;
  const step3TextLiftY = enableOverlap ? -clamp(Math.round(phoneHeight * 0.42), 0, Spacing['6xl'] * 6) : 0;

  const steps: Array<{
    variant: StepsMockVariant;
    titleKey: string;
    bodyKey: string;
  }> = [
    { variant: 'logging', titleKey: 'auth.login.marketing.steps_1_title', bodyKey: 'auth.login.marketing.steps_1_body' },
    { variant: 'progress', titleKey: 'auth.login.marketing.steps_2_title', bodyKey: 'auth.login.marketing.steps_2_body' },
    { variant: 'plan', titleKey: 'auth.login.marketing.steps_3_title', bodyKey: 'auth.login.marketing.steps_3_body' },
  ];

  return (
    <View style={[styles.stepsSection, { marginTop: isTwoCol ? Spacing['3xl'] : Spacing['3xl'] }]}>
      <ThemedText style={[styles.stepsHeading, { color: colors.text }]} accessibilityRole="header">
        {t('auth.login.marketing.steps_section_title')}
      </ThemedText>

      <View style={styles.stepsList}>
        {steps.map((step, idx) => {
          const isReversed = isTwoCol && idx === 1;
          const rowDirection = enableOverlap ? (isReversed ? 'row-reverse' : 'row') : 'column';
          const rowZIndex = enableOverlap ? steps.length - idx : undefined;
          const liftMediaY = enableOverlap ? (idx === 1 ? liftStep2Y : idx === 2 ? liftStep3Y : 0) : 0;
          const shiftMediaX = enableOverlap ? (idx === 1 ? -mediaOverlapShiftXStep2 : idx === 2 ? mediaOverlapShiftXStep3 : 0) : 0;

          const isStep2 = idx === 1;
          const isStep3 = idx === 2;
          const textLiftY = enableOverlap ? (idx === 0 ? step1TextLiftY : isStep2 ? step2TextLiftY : isStep3 ? step3TextLiftY : 0) : 0;
          const textAlign = enableOverlap && isStep2 ? 'right' : 'left';
          return (
            <View
              key={step.variant}
              style={[
                styles.stepsRow,
                {
                  flexDirection: rowDirection,
                  marginTop: idx === 0 ? 0 : rowSpacing,
                  zIndex: rowZIndex,
                  justifyContent: enableOverlap ? 'center' : 'flex-start',
                },
              ]}
            >
              <View
                style={[
                  styles.stepMediaCol,
                  enableOverlap
                    ? {
                        flexGrow: 0,
                        flexShrink: 1,
                        flexBasis: 'auto',
                        width: phoneMaxWidth,
                        maxWidth: phoneMaxWidth,
                      }
                    : null,
                ]}
              >
                <View
                  style={{
                    width: phoneWidth,
                    maxWidth: phoneMaxWidth,
                    alignSelf: 'center',
                    transform: enableOverlap
                      ? [
                          ...(liftMediaY !== 0 ? [{ translateY: liftMediaY }] : []),
                          ...(shiftMediaX !== 0 ? [{ translateX: shiftMediaX }] : []),
                        ]
                      : undefined,
                  }}
                >
                  <PhoneMock colors={colors} colorScheme={colorScheme} isWeb={isWeb} variant={step.variant} />
                </View>
              </View>

              <View
                style={[
                  styles.stepTextCol,
                  enableOverlap
                    ? {
                        flexGrow: 0,
                        flexShrink: 1,
                        flexBasis: 'auto',
                        maxWidth: desktopTextMaxWidth,
                        marginLeft: isReversed ? 0 : Spacing['5xl'],
                        // Step 2 needs extra clearance so the phone mock never covers the text.
                        marginRight: isReversed
                          ? isStep2
                            ? Spacing['6xl'] + Spacing['6xl'] + Spacing['4xl']
                            : Spacing['5xl']
                          : 0,
                        alignItems: isStep2 ? 'flex-end' : 'flex-start',
                        transform: textLiftY !== 0 ? [{ translateY: textLiftY }] : undefined,
                      }
                    : { marginTop: Spacing['2xl'], alignItems: 'flex-start' },
                ]}
              >
                <Text style={[styles.stepNumber, { color: colors.tint }]} accessibilityElementsHidden>
                  {String(idx + 1)}
                </Text>
                <ThemedText style={[styles.stepTitle, { color: colors.text, textAlign }]}>{t(step.titleKey)}</ThemedText>
                <ThemedText style={[styles.stepBody, { color: colors.textSecondary, textAlign }]}>{t(step.bodyKey)}</ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SocialProofStrip({
  colors,
  isTwoCol,
  isCompact,
}: {
  colors: ThemeColors;
  isTwoCol: boolean;
  isCompact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.socialStrip,
        {
          borderColor: colors.cardBorder ?? colors.border,
          backgroundColor: colors.backgroundSecondary,
          flexDirection: isTwoCol ? 'row' : 'column',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          alignSelf: 'center',
          ...(isCompact
            ? ({
                maxWidth: Layout.desktopMaxWidth,
                paddingVertical: Layout.rowGapCompact,
                paddingHorizontal: Spacing.lg,
              } as any)
            : null),
        },
      ]}
    >
      <View style={styles.socialItem}>
        <Text style={styles.socialEmoji} accessibilityElementsHidden>
          ✅
        </Text>
        <Text style={[styles.socialText, { color: colors.text }]}>{t('auth.login.marketing.social_no_subscriptions')}</Text>
      </View>
      <View style={styles.socialItem}>
        <Text style={styles.socialEmoji} accessibilityElementsHidden>
          ✅
        </Text>
        <Text style={[styles.socialText, { color: colors.text }]}>{t('auth.login.marketing.social_no_ads')}</Text>
      </View>
      <View style={styles.socialItem}>
        <Text style={styles.socialEmoji} accessibilityElementsHidden>
          ✅
        </Text>
        <Text style={[styles.socialText, { color: colors.text }]}>{t('auth.login.marketing.social_private_by_default')}</Text>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useLocalSearchParams<{ country?: string | string[] }>();
  const [email, setEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'] as ThemeColors;
  const { width: screenWidth } = useWindowDimensions();
  const isTwoCol = screenWidth >= 1024;
  const isWeb = Platform.OS === 'web';
  const isMobileWeb = isWeb && !isTwoCol;
  // Collage mode must NEVER activate on mobile browsers (even if viewport width is large due to viewport/meta quirks).
  // Gate on desktop-like input (fine pointer + hover) AND no touch points.
  const isDesktopLikePointer = useMemo(() => {
    if (!isWeb) return false;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, [isWeb]);

  const hasTouchPoints = useMemo(() => {
    if (!isWeb) return false;
    if (typeof navigator === 'undefined') return false;
    return (navigator as any).maxTouchPoints > 0;
  }, [isWeb]);

  const overlapMode = isWeb && isTwoCol && screenWidth >= 1200 && isDesktopLikePointer && !hasTouchPoints;

  // In overlap/collage mode, the step mockups are lifted via transforms (visual-only),
  // which leaves extra layout space below the collage. Pull the social proof strip up
  // by approximately the same amount as step 3's lift, minus a small buffer.
  const socialProofOffsetY = useMemo(() => {
    if (!overlapMode) return Spacing.lg;

    const phoneMaxWidth = Math.max(Spacing['5xl'], Math.round(Layout.maxContentWidth * 0.62));
    const phoneWidth = Math.min(
      phoneMaxWidth,
      Math.max(Spacing['6xl'], Math.round(screenWidth - Spacing['3xl']))
    );
    const phoneHeight = Math.round(phoneWidth * (16 / 10)); // matches PhoneMock aspect ratio
    const maxLift = Spacing['6xl'] * 8;
    const liftStep3Y = -clamp(Math.round(phoneHeight * 0.55), 0, maxLift);

    // Keep a small gap between the collage and the strip.
    return liftStep3Y + Spacing['4xl'];
  }, [overlapMode, screenWidth]);

  const scrollViewRef = useRef<ScrollViewType | null>(null);
  const authSectionYRef = useRef<number | null>(null);

  const onAuthSectionLayout = useMemo(
    () => (e: LayoutChangeEvent) => {
      authSectionYRef.current = e.nativeEvent.layout.y;
    },
    []
  );

  const countryParamRaw = searchParams?.country;
  const countryParam = Array.isArray(countryParamRaw) ? countryParamRaw[0] : countryParamRaw;

  const forcedCountry = countryParam === 'CA' ? 'CA' : countryParam === 'NotCanada' ? 'NotCanada' : null;
  const { data: geoCountry } = useGeoCountry({ enabled: isWeb && !forcedCountry });
  const country = forcedCountry ?? geoCountry ?? null;

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/(tabs)');
    }
  }, [authLoading, user, router]);

  // If user is logged in, return null (redirect is handled in useEffect)
  if (user) {
    return null;
  }

  const isBlocking = authLoading;

  const handleScrollToAuth = () => {
    if (isMobileWeb && typeof document !== 'undefined') {
      const el = document.getElementById('login-auth-start');
      // On RN Web, nativeID becomes the DOM id; scrollIntoView scrolls the nearest scroll container.
      if (el && typeof (el as any).scrollIntoView === 'function') {
        // Web-only UI behavior (allowed): smooth in-page scroll (no navigation).
        (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    const y = authSectionYRef.current;
    if (typeof y !== 'number') return;
    // Small offset so the auth card isn't flush to the very top.
    animateScrollTo(scrollViewRef, Math.max(0, y - 12), 600);
  };

  const handleSendMagicLink = async () => {
    if (magicLinkLoading) return;

    setMagicLinkError(null);
    setMagicLinkSent(false);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey ||
      supabaseUrl.includes('YOUR-PROJECT') ||
      supabaseKey.includes('YOUR-ANON-KEY')
    ) {
      // Magic link is enabled; if env is missing, show a real configuration error.
      setMagicLinkError(t('auth.login.error_supabase_not_configured'));
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      const errorMsg = t('auth.login.error_invalid_email');
      setMagicLinkError(errorMsg);
      return;
    }

    setMagicLinkLoading(true);
    try {
      const emailRedirectTo = getOAuthRedirectTo();
      const { error } = await sendMagicLink({ email: trimmedEmail, emailRedirectTo });

      if (error) {
        // Show a user-friendly error (no "coming soon" messaging).
        setMagicLinkError(error.message || t('common.unexpected_error'));
        return;
      }

      setMagicLinkSent(true);
    } catch (e: any) {
      setMagicLinkError(e?.message || t('common.unexpected_error'));
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setGoogleError(null);

    try {
      const redirectTo = getOAuthRedirectTo();
      if (Platform.OS === 'web') {
        setPendingLinkState({ targetProvider: 'google', stage: 'auth_start', startedAt: Date.now() });
      }

      const { error } = await signInWithOAuth({
        provider: 'google',
        redirectTo,
        queryParams: { prompt: 'select_account' },
      });

      if (error) {
        if (process.env.NODE_ENV !== 'production') console.error(error);
        setGoogleError(t('auth.login.error_google_sign_in_failed'));
        clearPendingLinkState();
        return;
      }
      // On web, Supabase triggers a redirect automatically.
      // On native (future), we'll implement WebBrowser/deep-link handling.
      if (Platform.OS !== 'web') showAppToast(t('auth.callback.coming_soon_title'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const pageBaseColor = (colors as any).dashboardBackground ?? colors.background;
  const lottieSize = isTwoCol ? 132 : 108;
  const cardMaxWidth = 460;
  const cardPadding = isTwoCol ? 32 : 24;
  const sectionGap = isTwoCol ? 22 : 16;
  const buttonHeight = isTwoCol ? 56 : 52;
  const showHeroVisual = screenWidth >= 360;

  return (
    <View style={{ flex: 1 }}>
      <BlockingBrandedLoader enabled={isBlocking} timeoutMs={5000} />
      {!isBlocking ? (
        <ThemedView style={[styles.page, { backgroundColor: pageBaseColor }]}>
      {/* Premium background layers */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.backgroundBase,
          isWeb
            ? {
                backgroundImage:
                  colorScheme === 'dark'
                    ? [
                        // Hero glow
                        'radial-gradient(900px circle at 18% 26%, rgba(91, 194, 198, 0.20), transparent 58%)',
                        // Card glow
                        'radial-gradient(700px circle at 78% 38%, rgba(233, 135, 111, 0.16), transparent 55%)',
                        // Depth wash
                        'linear-gradient(135deg, rgba(220, 240, 72, 0.06), transparent 40%)',
                        // Subtle "noise" texture (no assets)
                        'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 3px)',
                      ].join(',')
                    : [
                        'radial-gradient(950px circle at 20% 18%, rgba(47, 164, 169, 0.18), transparent 58%)',
                        'radial-gradient(760px circle at 76% 28%, rgba(184, 85, 63, 0.14), transparent 58%)',
                        'linear-gradient(135deg, rgba(220, 240, 72, 0.08), transparent 45%)',
                        'repeating-linear-gradient(0deg, rgba(17,24,28,0.020) 0px, rgba(17,24,28,0.020) 1px, transparent 1px, transparent 3px)',
                      ].join(','),
              }
            : null,
        ]}
      >
        {!isWeb ? (
          <>
            <View
              style={[
                styles.nativeBlob,
                {
                  top: -150,
                  left: -120,
                  width: 420,
                  height: 420,
                  backgroundColor: colors.appTeal + '18',
                },
              ]}
            />
            <View
              style={[
                styles.nativeBlob,
                {
                  top: 220,
                  right: -140,
                  width: 380,
                  height: 380,
                  backgroundColor: colors.tint + '16',
                },
              ]}
            />
            <View
              style={[
                styles.nativeBlob,
                {
                  bottom: -170,
                  left: -140,
                  width: 420,
                  height: 420,
                  backgroundColor: colors.chartGreen + '10',
                },
              ]}
            />
          </>
        ) : null}
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: isTwoCol ? 56 : 28,
            paddingBottom: isTwoCol ? 56 : 28,
            paddingHorizontal: isTwoCol ? 32 : 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.shell, { maxWidth: isTwoCol ? 1180 : 740 }]}>
          <View
            style={[
              styles.topLogoWrap,
              {
                alignItems: isTwoCol ? 'flex-start' : 'center',
              },
            ]}
          >
            <BrandLogoNameAndTag
              width={252}
              style={styles.topLogo}
              accessibilityLabel={t('auth.login.brand_logo_alt')}
            />
          </View>

          <View
            style={[
              styles.grid,
              {
                flexDirection: isTwoCol ? 'row' : 'column',
                gap: isTwoCol ? 56 : 24,
                alignItems: isTwoCol ? 'center' : 'stretch',
              },
            ]}
          >
            {/* Hero (marketing) */}
            <View
              style={[
                styles.hero,
                // In two-col layout, the hero should flex to fill remaining space (not claim 100% width).
                isTwoCol ? { width: 'auto', flexGrow: 1, flexShrink: 1, flexBasis: 0 } : null,
                {
                  maxWidth: isTwoCol ? 620 : '100%',
                  minWidth: isTwoCol ? 420 : undefined,
                },
              ]}
            >
              <ThemedText
                style={[styles.heroH1, isTwoCol ? styles.heroH1Desktop : null, { color: colors.text }]}
                accessibilityRole="header"
              >
                {country === 'CA' ? t('auth.login.marketing.hero_headline_ca') : t('auth.login.marketing.hero_headline_default')}
              </ThemedText>

              <ThemedText style={[styles.heroSub, isTwoCol ? styles.heroSubDesktop : null, { color: colors.textSecondary }]}>
                {t('auth.login.marketing.hero_subtitle')}
              </ThemedText>

              <View style={styles.bulletList}>
                <View style={styles.bulletRow}>
                  <View style={[styles.bulletIcon, { backgroundColor: colors.appTeal + '18' }]}>
                    <Text style={styles.bulletEmoji} accessibilityElementsHidden>
                      ⚡
                    </Text>
                  </View>
                  <ThemedText style={[styles.bulletText, { color: colors.text }]}>
                    {t('auth.login.marketing.bullet_fast_logging')}
                  </ThemedText>
                </View>

                <View style={styles.bulletRow}>
                  <View style={[styles.bulletIcon, { backgroundColor: colors.tint + '18' }]}>
                    <Text style={styles.bulletEmoji} accessibilityElementsHidden>
                      📊
                    </Text>
                  </View>
                  <ThemedText style={[styles.bulletText, { color: colors.text }]}>
                    {t('auth.login.marketing.bullet_clear_macros')}
                  </ThemedText>
                </View>

                <View style={styles.bulletRow}>
                  <View style={[styles.bulletIcon, { backgroundColor: colors.chartGreen + '14' }]}>
                    <Text style={styles.bulletEmoji} accessibilityElementsHidden>
                      🔒
                    </Text>
                  </View>
                  <ThemedText style={[styles.bulletText, { color: colors.text }]}>
                    {t('auth.login.marketing.bullet_honest_no_paywalls')}
                  </ThemedText>
                </View>

                {country === 'CA' ? (
                  <View style={styles.bulletRow}>
                    <View style={[styles.bulletIcon, { backgroundColor: colors.tintLight }]}>
                      <Image
                        // Twemoji Canada flag (1F1E8-1F1E6). Using an image avoids "CA" fallback rendering on some platforms.
                        source={{ uri: 'https://twemoji.maxcdn.com/v/latest/72x72/1f1e8-1f1e6.png' }}
                        style={styles.flagIcon}
                        accessibilityLabel="Canada"
                      />
                    </View>
                    <ThemedText style={[styles.bulletText, { color: colors.text }]}>
                      {t('auth.login.marketing.bullet_canadian_values')}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {isMobileWeb ? (
                <Pressable
                  onPress={handleScrollToAuth}
                  {...getButtonAccessibilityProps(t('auth.login.track_now_aria'), t('auth.login.track_now_aria'), false)}
                  style={(state) => {
                    const pressed = state.pressed;
                    const hovered = Boolean((state as any).hovered);
                    const focused = Boolean((state as any).focused);
                    return [
                      styles.heroCtaButton,
                      getMinTouchTargetStyle(),
                      {
                        width: '100%',
                        height: Layout.minTouchTarget,
                        backgroundColor: colors.tint,
                        borderColor: (colors.cardBorder ?? colors.border) + '55',
                        opacity: pressed ? 0.94 : hovered ? 0.98 : 1,
                        transform: isWeb && hovered && !pressed ? [{ translateY: -1 }] : [{ translateY: 0 }],
                        ...(isWeb
                          ? ({
                              // Spec-driven web-only sheen. We keep it here (not a theme token) because RN native doesn't
                              // support gradients the same way without additional deps.
                              backgroundImage:
                                'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
                            } as any)
                          : null),
                      },
                      focused && isWeb
                        ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.tint, outlineOffset: 2 }
                        : null,
                    ];
                  }}
                >
                  <View style={styles.heroCtaInner}>
                    <Text style={[styles.heroCtaText, { color: colors.textInverse }]}>{t('auth.login.track_now')}</Text>
                    <View style={styles.heroCtaChevron} pointerEvents="none">
                      <IconSymbol name="chevron.right" size={FontSize.lg} color={colors.textInverse} decorative />
                    </View>
                  </View>
                </Pressable>
              ) : null}

              {showHeroVisual ? (
                <HeroVisualComposite
                  colors={colors}
                  colorScheme={colorScheme ?? 'light'}
                  isWeb={isWeb}
                  isTwoCol={isTwoCol}
                />
              ) : null}
            </View>

            {/* Auth card */}
            <View
              style={[
                styles.authCol,
                // In two-col layout, keep the auth column clamped so it can't overflow off-screen.
                isTwoCol ? { width: cardMaxWidth, maxWidth: cardMaxWidth, flexGrow: 0, flexShrink: 0 } : null,
                { alignItems: isTwoCol ? 'flex-end' : 'center' },
              ]}
              onLayout={onAuthSectionLayout}
            >
              <View
                style={[
                  styles.card,
                  {
                    width: '100%',
                    maxWidth: cardMaxWidth,
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder ?? colors.border,
                    padding: cardPadding,
                  },
                ]}
              >
                {/* Brand header */}
                <View nativeID="login-auth-start" style={[styles.header, { marginBottom: sectionGap }]}>
                  <Lottie
                    animationData={animationData}
                    loop
                    autoplay
                    style={{ width: lottieSize, height: lottieSize, marginBottom: 12 }}
                  />
                  <BrandLogoNameAndTag
                    width={315}
                    style={styles.brandLogoNameTag}
                    accessibilityLabel={t('auth.login.brand_logo_alt')}
                  />
                </View>

                {/* Auth gateway */}
                <View style={{ gap: sectionGap }}>
                  {/* Google */}
                  {googleError ? (
                    <View
                      style={[
                        styles.errorContainer,
                        { backgroundColor: colors.errorLight, borderColor: colors.error },
                      ]}
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      {...(isWeb ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
                    >
                      <IconSymbol name="info.circle.fill" size={18} color={colors.error} />
                      <ThemedText style={[styles.errorText, { color: colors.error }]}>
                        {googleError}
                      </ThemedText>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={handleGoogleLogin}
                    disabled={googleLoading}
                    {...getButtonAccessibilityProps(
                      googleLoading ? t('auth.login.signing_in_google') : t('auth.login.google_sign_in'),
                      t('auth.login.google_sign_in'),
                      googleLoading
                    )}
                    style={(state) => {
                      // RN's PressableStateCallbackType doesn't include web-only fields, but RN Web provides them.
                      const hovered = isWeb ? Boolean((state as any).hovered) : false;
                      const focused = isWeb ? Boolean((state as any).focused) : false;
                      const pressed = state.pressed;
                      return [
                        styles.primaryButton,
                        getMinTouchTargetStyle(),
                        {
                          height: buttonHeight,
                          backgroundColor: colors.tint,
                          opacity: googleLoading ? 0.7 : pressed ? 0.9 : 1,
                          transform:
                            isWeb && hovered && !pressed && !googleLoading ? [{ translateY: -1 }] : [{ translateY: 0 }],
                        },
                        focused && isWeb
                          ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.tint, outlineOffset: 2 }
                          : null,
                      ];
                    }}
                  >
                    {googleLoading ? (
                      <View style={styles.buttonLoading} accessibilityElementsHidden={true}>
                        <ActivityIndicator color={colors.textInverse} size="small" />
                        <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
                          {t('auth.login.signing_in_google')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.buttonInner}>
                        <View style={styles.leftIconPill}>
                          <Text style={styles.leftIconText}>G</Text>
                        </View>
                        <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
                          {t('auth.login.google_sign_in')}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {/* Divider */}
                  <View style={styles.dividerContainer}>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    <ThemedText style={[styles.dividerText, { color: colors.textSecondary }]}>
                      {t('common.or')}
                    </ThemedText>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  </View>

                  {/* Magic link */}
                  <View style={{ gap: 10 }}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>
                      {t('auth.login.email_label')}
                    </ThemedText>

                    <View
                      style={[
                        styles.magicRow,
                        {
                          flexDirection: isTwoCol ? 'row' : 'column',
                          alignItems: isTwoCol ? 'flex-end' : 'stretch',
                        },
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.input,
                          {
                            borderColor: magicLinkError ? colors.error : colors.border,
                            color: colors.text,
                            backgroundColor: colors.backgroundSecondary,
                          },
                        ]}
                        placeholder={t('auth.login.email_placeholder_short')}
                        placeholderTextColor={colors.textSecondary}
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          setMagicLinkError(null);
                          setMagicLinkSent(false);
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        editable={!magicLinkLoading}
                        {...getInputAccessibilityProps(
                          t('auth.login.email_label'),
                          t('auth.login.email_placeholder_short'),
                          magicLinkError ?? undefined,
                          true
                        )}
                        {...getWebAccessibilityProps(
                          'textbox',
                          t('auth.login.email_label'),
                          magicLinkError ? 'magic-email-error' : undefined,
                          magicLinkError ? true : undefined,
                          true
                        )}
                      />

                      <Pressable
                        onPress={handleSendMagicLink}
                        disabled={magicLinkLoading}
                        {...getButtonAccessibilityProps(
                          t('auth.login.magic_link_send'),
                          t('auth.login.magic_link_send'),
                          magicLinkLoading
                        )}
                        style={(state) => {
                          // RN's PressableStateCallbackType doesn't include web-only fields, but RN Web provides them.
                          const hovered = isWeb ? Boolean((state as any).hovered) : false;
                          const focused = isWeb ? Boolean((state as any).focused) : false;
                          const pressed = state.pressed;
                          return [
                            styles.magicButton,
                            getMinTouchTargetStyle(),
                            {
                              height: buttonHeight,
                              backgroundColor: colors.backgroundTertiary,
                              borderColor: colors.border,
                              opacity: magicLinkLoading ? 0.7 : pressed ? 0.92 : 1,
                              width: isTwoCol ? undefined : '100%',
                              minWidth: isTwoCol ? 220 : undefined,
                              transform:
                                isWeb && hovered && !pressed && !magicLinkLoading
                                  ? [{ translateY: -1 }]
                                  : [{ translateY: 0 }],
                            },
                            focused && isWeb
                              ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.tint, outlineOffset: 2 }
                              : null,
                          ];
                        }}
                      >
                        {magicLinkLoading ? (
                          <View style={styles.buttonLoading} accessibilityElementsHidden={true}>
                            <ActivityIndicator color={colors.text} size="small" />
                            <Text style={[styles.magicButtonText, { color: colors.text }]}>
                              {t('auth.login.magic_link_sending')}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.magicButtonText, { color: colors.text }]}>
                            {t('auth.login.magic_link_send')}
                          </Text>
                        )}
                      </Pressable>
                    </View>

                    {magicLinkError ? (
                      <View
                        style={[
                          styles.errorContainer,
                          { backgroundColor: colors.errorLight, borderColor: colors.error },
                        ]}
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                        {...(isWeb ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
                      >
                        <IconSymbol name="info.circle.fill" size={18} color={colors.error} />
                        <ThemedText style={[styles.errorText, { color: colors.error }]}>
                          {magicLinkError}
                        </ThemedText>
                      </View>
                    ) : null}

                    {magicLinkSent ? (
                      <ThemedText
                        style={[styles.successText, { color: colors.textSecondary }]}
                        accessibilityLiveRegion="polite"
                      >
                        {t('auth.login.magic_link_sent_hint')}
                      </ThemedText>
                    ) : null}
                  </View>

                  {/* Legal footer */}
                  <View style={[styles.legalRow, { borderTopColor: colors.border }]}>
                    <Pressable
                      // Route typegen doesn't currently include /legal/* in this file.
                      onPress={() => router.push('/legal/privacy' as any)}
                      {...getLinkAccessibilityProps(t('auth.login.legal_privacy'), t('auth.login.legal_privacy'))}
                      style={(state) => [
                        styles.legalLink,
                        isWeb && Boolean((state as any).focused)
                          ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.tint, outlineOffset: 2 }
                          : null,
                      ]}
                    >
                      <ThemedText type="link" style={styles.legalLinkText}>
                        {t('auth.login.legal_privacy')}
                      </ThemedText>
                    </Pressable>

                    <Text style={[styles.legalDot, { color: colors.textSecondary }]}>{' · '}</Text>

                    <Pressable
                      // Route typegen doesn't currently include /legal/* in this file.
                      onPress={() => router.push('/legal/terms' as any)}
                      {...getLinkAccessibilityProps(t('auth.login.legal_terms'), t('auth.login.legal_terms'))}
                      style={(state) => [
                        styles.legalLink,
                        isWeb && Boolean((state as any).focused)
                          ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.tint, outlineOffset: 2 }
                          : null,
                      ]}
                    >
                      <ThemedText type="link" style={styles.legalLinkText}>
                        {t('auth.login.legal_terms')}
                      </ThemedText>
                    </Pressable>

                    <Text style={[styles.legalDot, { color: colors.textSecondary }]}>{' · '}</Text>

                    <Pressable
                      // Route typegen doesn't currently include /legal/* in this file.
                      onPress={() => router.push('/legal/health' as any)}
                      {...getLinkAccessibilityProps(t('auth.login.legal_health'), t('auth.login.legal_health'))}
                      style={(state) => [
                        styles.legalLink,
                        isWeb && Boolean((state as any).focused)
                          ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.tint, outlineOffset: 2 }
                          : null,
                      ]}
                    >
                      <ThemedText type="link" style={styles.legalLinkText}>
                        {t('auth.login.legal_health')}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <StepsShowcaseSection
            colors={colors}
            colorScheme={colorScheme ?? 'light'}
            isTwoCol={isTwoCol}
            isWeb={isWeb}
            overlapMode={overlapMode}
            screenWidth={screenWidth}
          />
          <View
            style={{
              width: '100%',
              alignItems: 'center',
              marginTop: socialProofOffsetY,
            }}
          >
            <SocialProofStrip colors={colors} isTwoCol={isTwoCol} isCompact={overlapMode} />
          </View>
        </View>
      </ScrollView>
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    overflow: 'hidden',
  },
  backgroundBase: {
    opacity: 1,
  },
  nativeBlob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: '100%',
  },
  shell: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  topLogoWrap: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  topLogo: {
    // BrandLogoNameAndTag centers internally; outer wrapper controls alignment per breakpoint.
    alignItems: 'center',
  },
  grid: {
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  hero: {
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
    flexShrink: 1,
  },
  heroH1: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 34,
    flexShrink: 1,
    maxWidth: '100%',
  },
  heroH1Desktop: {
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.0,
  },
  heroSub: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  heroSubDesktop: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 24,
  },
  bulletList: {
    marginTop: 18,
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulletIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletEmoji: {
    fontSize: 16,
  },
  flagIcon: {
    width: Spacing.lg,
    height: Spacing.lg,
    resizeMode: 'contain',
  },
  bulletText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
  },
  heroCtaButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderWidth: 1, // no token; intentional minimal border for depth
    overflow: 'hidden',
    ...(Shadows.card as any),
  },
  heroCtaInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCtaChevron: {
    position: 'absolute',
    right: Spacing.lg,
  },
  heroCtaText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  heroVisualWrap: {
    marginTop: 22,
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 18px 55px rgba(15, 23, 42, 0.12)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.12,
        shadowRadius: 26,
        elevation: 10,
      },
    }),
  },
  heroGlow: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: -40,
    bottom: -40,
    opacity: 1,
  },
  phoneFrame: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -120 }, { translateY: -170 }],
    width: 240,
    height: 340,
    borderRadius: 34,
    borderWidth: 1,
    padding: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.16)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.16,
        shadowRadius: 26,
        elevation: 12,
      },
    }),
  },
  phoneNotch: {
    alignSelf: 'center',
    width: 72,
    height: 10,
    borderRadius: 9999,
    marginTop: 6,
    marginBottom: 10,
    opacity: 0.9,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 26,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
    gap: 10,
  },
  phoneBar: {
    height: 12,
    borderRadius: 8,
    width: '86%',
  },
  floatingCard: {
    position: 'absolute',
    width: 170,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 10,
      },
    }),
  },
  floatingCardTL: {
    top: 18,
    left: 14,
  },
  floatingCardBR: {
    bottom: 16,
    right: 14,
  },
  floatingCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  floatingCardValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  floatingCardSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  authCol: {
    width: '100%',
    alignSelf: 'center',
    flexShrink: 0,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.10), 0 3px 10px rgba(15, 23, 42, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  header: {
    alignItems: 'center',
  },
  brandLogoNameTag: {
    width: '100%',
    height: Spacing['6xl'],
    marginTop: Spacing.sm,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 52,
    flex: 1,
    minWidth: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  comingSoon: {
    fontSize: 12,
    textAlign: 'center',
  },
  secureLine: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  buttonInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    // Reserve space for the absolute-positioned Google icon pill so it never overlaps the label.
    paddingLeft: Spacing['5xl'],
    paddingRight: Spacing.lg,
  },
  leftIconPill: {
    position: 'absolute',
    left: 14,
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  leftIconText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4285F4',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  magicRow: {
    width: '100%',
    gap: 12,
    alignItems: 'stretch',
  },
  magicButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1.5,
  },
  magicButtonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  successText: {
    fontSize: 13,
    lineHeight: 18,
  },
  trustLine: {
    marginTop: 2,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalRow: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  legalLink: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  legalLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  legalDot: {
    fontSize: 12,
  },
  socialStrip: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  socialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialEmoji: {
    fontSize: 14,
  },
  socialText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ---------------------------------------------------------------------------
  // Steps (1–2–3) showcase section
  // ---------------------------------------------------------------------------
  stepsSection: {
    width: '100%',
  },
  stepsHeading: {
    fontSize: FontSize['3xl'],
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: Math.round(FontSize['3xl'] * 1.15),
  },
  stepsList: {
    marginTop: Spacing['4xl'],
    width: '100%',
  },
  stepsRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  stepMediaCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    width: '100%',
  },
  stepTextCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    width: '100%',
    alignItems: 'flex-start',
  },
  stepNumber: {
    fontSize: FontSize['4xl'],
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: Math.round(FontSize['4xl'] * 1.0),
  },
  stepTitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: Math.round(FontSize.xl * 1.25),
  },
  stepBody: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    lineHeight: Math.round(FontSize.md * 1.45),
    maxWidth: Layout.maxContentWidth,
  },

  // ---------------------------------------------------------------------------
  // PhoneMock (local placeholder visuals; decorative)
  // ---------------------------------------------------------------------------
  phoneMockFrame: {
    width: '100%',
    aspectRatio: 10 / 16,
    borderWidth: 1,
    borderRadius: BorderRadius['3xl'],
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 16px 44px rgba(15, 23, 42, 0.10)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.10,
        shadowRadius: 22,
        elevation: 8,
      },
    }),
  },
  phoneMockNotch: {
    position: 'absolute',
    top: Spacing.sm,
    alignSelf: 'center',
    width: '28%',
    height: Spacing.sm,
    borderRadius: BorderRadius.chip,
    zIndex: 2,
  },
  phoneMockScreen: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius['3xl'],
    paddingTop: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    overflow: 'hidden',
  },
  mockContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  mockTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  mockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
  },
  mockDot: {
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: BorderRadius.chip,
  },
  mockPillText: {
    height: Spacing.sm,
    borderRadius: BorderRadius.sm,
    flexGrow: 1,
  },
  mockChip: {
    height: Layout.minTouchTarget,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockChipText: {
    width: Spacing['4xl'],
    height: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },

  // Logging variant
  mockList: {
    width: '100%',
    gap: Spacing.md,
    flexGrow: 1,
  },
  mockListRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  mockAvatar: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    borderRadius: BorderRadius.xl,
  },
  mockListTextCol: {
    flex: 1,
    gap: Spacing.sm,
  },
  mockLine: {
    height: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  mockCtaBar: {
    width: '100%',
    height: Layout.minTouchTarget,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  mockCtaText: {
    width: '52%',
    height: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  mockCtaIcon: {
    width: Spacing.lg,
    height: Spacing.lg,
    borderRadius: BorderRadius.chip,
  },

  // Progress variant
  mockChartCard: {
    width: '100%',
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    flexGrow: 1,
  },
  mockChartBars: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexGrow: 1,
  },
  mockBar: {
    width: '18%',
    borderRadius: BorderRadius.md,
  },
  mockDividerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mockTinyLine: {
    width: '24%',
    height: Nudge.px2,
    borderRadius: BorderRadius.sm,
  },
  mockRowChips: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },

  // Plan variant
  mockCalendar: {
    width: '100%',
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  mockCalendarRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockCalendarDot: {
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: BorderRadius.chip,
  },
  mockGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.lg,
    flexGrow: 1,
  },
  mockMealCard: {
    flex: 1,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  mockMealThumb: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.xl,
  },
});
