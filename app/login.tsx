import Lottie from "lottie-react";
import animationData from "../assets/lottie/Wobbling.json";
import { useState, useEffect } from 'react';
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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { sendMagicLink, signInWithOAuth } from '@/lib/services/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { showAppToast } from '@/components/ui/app-toast';
import { Colors, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { clearPendingLinkState, getOAuthRedirectTo, setPendingLinkState } from '@/lib/auth/oauth';
import { useGeoCountry } from '@/hooks/use-geo-country';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getLinkAccessibilityProps,
  getMinTouchTargetStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';

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

function FeatureCardsSection({
  colors,
  isTwoCol,
}: {
  colors: ThemeColors;
  isTwoCol: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.featureSection, { marginTop: isTwoCol ? 52 : 30 }]}>
      <ThemedText
        style={[styles.featureSectionTitle, { color: colors.text }]}
        accessibilityRole="header"
      >
        {t('auth.login.marketing.feature_section_title')}
      </ThemedText>

      <View style={[styles.featureCardsRow, { flexDirection: isTwoCol ? 'row' : 'column' }]}>
        <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder ?? colors.border }]}>
          <View style={[styles.featureIconBadge, { backgroundColor: colors.appTeal + '18' }]}>
            <Text style={styles.featureEmoji} accessibilityElementsHidden>
              ⚡
            </Text>
          </View>
          <Text style={[styles.featureTitle, { color: colors.text }]}>{t('auth.login.marketing.feature_fast_title')}</Text>
          <Text style={[styles.featureBody, { color: colors.textSecondary }]}>
            {t('auth.login.marketing.feature_fast_body')}
          </Text>
        </View>

        <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder ?? colors.border }]}>
          <View style={[styles.featureIconBadge, { backgroundColor: colors.tint + '18' }]}>
            <Text style={styles.featureEmoji} accessibilityElementsHidden>
              📊
            </Text>
          </View>
          <Text style={[styles.featureTitle, { color: colors.text }]}>{t('auth.login.marketing.feature_clear_title')}</Text>
          <Text style={[styles.featureBody, { color: colors.textSecondary }]}>
            {t('auth.login.marketing.feature_clear_body')}
          </Text>
        </View>

        <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder ?? colors.border }]}>
          <View style={[styles.featureIconBadge, { backgroundColor: colors.chartGreen + '14' }]}>
            <Text style={styles.featureEmoji} accessibilityElementsHidden>
              🔓
            </Text>
          </View>
          <Text style={[styles.featureTitle, { color: colors.text }]}>{t('auth.login.marketing.feature_no_paywalls_title')}</Text>
          <Text style={[styles.featureBody, { color: colors.textSecondary }]}>
            {t('auth.login.marketing.feature_no_paywalls_body')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SocialProofStrip({
  colors,
  isTwoCol,
}: {
  colors: ThemeColors;
  isTwoCol: boolean;
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

  // Show brief spinner only while auth is initializing
  if (authLoading) {
    return (
      <ThemedView style={[styles.page, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // If user is logged in, return null (redirect is handled in useEffect)
  if (user) {
    return null;
  }

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
              </View>

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
                <View style={[styles.header, { marginBottom: sectionGap }]}>
                  <Lottie
                    animationData={animationData}
                    loop
                    autoplay
                    style={{ width: lottieSize, height: lottieSize, marginBottom: 12 }}
                  />
                  <ThemedText
                    style={[styles.brandName, { color: colors.text }]}
                    accessibilityRole="header"
                  >
                    {t('auth.login.brand_name')}
                  </ThemedText>
                  <ThemedText style={[styles.tagline, { color: colors.textSecondary }]}>
                    {t('auth.login.brand_tagline')}
                  </ThemedText>
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

          <FeatureCardsSection colors={colors} isTwoCol={isTwoCol} />
          <SocialProofStrip colors={colors} isTwoCol={isTwoCol} />
        </View>
      </ScrollView>
    </ThemedView>
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
  bulletText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
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
  featureSection: {
    width: '100%',
  },
  featureSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'left',
  },
  featureCardsRow: {
    marginTop: 16,
    width: '100%',
    gap: 14,
  },
  featureCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    minWidth: 0,
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)' },
      default: {},
    }),
  },
  featureIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureEmoji: {
    fontSize: 16,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  featureBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  socialStrip: {
    marginTop: 16,
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
});
