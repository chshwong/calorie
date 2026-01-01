import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { showAppToast } from '@/components/ui/app-toast';
import {
  getUserIdentities,
  linkIdentity,
  sendMagicLink as sendMagicLinkEmail,
  signInWithOAuth,
  signOut,
} from '@/lib/services/auth';
import {
  clearPendingLinkState,
  type AuthProvider,
  getOAuthRedirectTo,
  getPendingLinkState,
  isPendingLinkExpired,
  setPendingLinkState,
} from '@/lib/auth/oauth';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

export default function AuthLinkScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [email, setEmail] = useState(user?.email ?? '');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => {
    const state = getPendingLinkState();
    if (state && isPendingLinkExpired(state)) {
      clearPendingLinkState();
      return null;
    }
    return state;
  }, []);

  const targetProvider: AuthProvider | null = pending?.targetProvider ?? null;
  const canLink = !!user && !!targetProvider;

  const startGoogleVerify = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showAppToast(t('auth.callback.coming_soon_title'));
      return;
    }
    if (googleLoading) return;

    setError(null);
    setMagicSent(false);
    setGoogleLoading(true);

    try {
      const redirectTo = getOAuthRedirectTo();
      if (!targetProvider) {
        setError(t('auth.linking.expired_detail'));
        return;
      }
      setPendingLinkState({ targetProvider, stage: 'verifying_google', startedAt: Date.now() });

      const { error: signInError } = await signInWithOAuth({
        provider: 'google',
        redirectTo,
        queryParams: { prompt: 'select_account' },
      });

      if (signInError) {
        setPendingLinkState({ targetProvider, stage: 'needs_verification', startedAt: Date.now(), lastError: 'unknown' });
        setError(signInError?.message ?? t('auth.linking.google_start_failed'));
        return;
      }
      // Success triggers a redirect on web.
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showAppToast(t('auth.callback.coming_soon_title'));
      return;
    }
    if (magicLoading) return;

    setError(null);
    setMagicSent(false);
    setMagicLoading(true);

    try {
      if (!targetProvider) {
        setError(t('auth.linking.expired_detail'));
        return;
      }

      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
        setError(t('auth.linking.invalid_email'));
        return;
      }

      setPendingLinkState({ targetProvider, stage: 'verifying_magic', startedAt: Date.now() });
      const redirectTo = getOAuthRedirectTo();
      const { error: otpError } = await sendMagicLinkEmail({ email: trimmedEmail, emailRedirectTo: redirectTo });

      if (otpError) {
        setPendingLinkState({ targetProvider, stage: 'needs_verification', startedAt: Date.now(), lastError: 'unknown' });
        setError(otpError.message ?? t('auth.linking.magic_link_send_failed'));
        return;
      }

      setMagicSent(true);
    } finally {
      setMagicLoading(false);
    }
  };

  const linkTargetProvider = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showAppToast(t('auth.callback.coming_soon_title'));
      return;
    }
    if (linkLoading) return;

    setError(null);
    setLinkLoading(true);

    try {
      const state = getPendingLinkState();
      if (!state || !state.targetProvider) {
        setError(t('auth.linking.expired_detail'));
        clearPendingLinkState();
        return;
      }

      // If already linked, finish successfully.
      const identities = await getUserIdentities();
      const alreadyLinked = identities.data?.identities?.some((i) => i.provider === state.targetProvider) ?? false;
      if (alreadyLinked) {
        clearPendingLinkState();
        showAppToast(t('auth.linking.already_linked_toast'));
        router.replace('/(tabs)');
        return;
      }

      const redirectTo = getOAuthRedirectTo();
      setPendingLinkState({ ...state, stage: 'linking' });

      const { error: linkError } = await linkIdentity({
        provider: state.targetProvider,
        redirectTo,
      });

      if (linkError) {
        setPendingLinkState({ ...state, stage: 'verified' });
        setError(linkError?.message ?? t('auth.linking.link_start_failed'));
        return;
      }
      // Success triggers a redirect on web.
    } finally {
      setLinkLoading(false);
    }
  };

  const cancel = async () => {
    clearPendingLinkState();
    setError(null);
    try {
      // If the user signed in just for linking, send them back to login signed-out.
      await signOut();
    } catch {
      // ignore
    } finally {
      router.replace('/login');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.headerRow}>
          <IconSymbol name="link" size={22} color={colors.tint} />
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {t('auth.linking.title')}
          </ThemedText>
        </View>

        <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
          {targetProvider
            ? t('auth.linking.subtitle_with_target', { provider: targetProvider })
            : t('auth.linking.expired_detail')}
        </ThemedText>

        {authLoading ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={colors.tint} />
            <ThemedText style={[styles.body, { color: colors.textSecondary }]}>Checking session…</ThemedText>
          </View>
        ) : null}

        {!targetProvider ? (
          <>
            <Pressable
              onPress={() => router.replace('/login')}
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            >
              <ThemedText style={{ color: colors.text, fontWeight: FontWeight.bold }}>
                {t('auth.linking.back_to_login')}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            {/* Step 1: Verify ownership (if not signed in) */}
            {!user ? (
              <>
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                  {t('auth.linking.verify_intro')}
                </ThemedText>

                <Pressable
                  onPress={startGoogleVerify}
                  disabled={googleLoading || linkLoading || magicLoading}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.tint, opacity: googleLoading ? 0.7 : 1 },
                    getMinTouchTargetStyle(),
                  ]}
                  {...getButtonAccessibilityProps(
                    googleLoading ? t('auth.linking.google_continue_loading') : t('auth.linking.google_continue'),
                    t('auth.linking.google_continue'),
                    googleLoading || linkLoading || magicLoading
                  )}
                >
                  {googleLoading ? (
                    <View style={styles.busyRow}>
                      <ActivityIndicator size="small" color={colors.textInverse} />
                      <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>
                        {t('auth.linking.continuing')}
                      </ThemedText>
                    </View>
                  ) : (
                    <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>
                      {t('auth.linking.google_continue')}
                    </ThemedText>
                  )}
                </Pressable>

                <View style={styles.magicBlock}>
                  <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                    {t('auth.linking.or_confirm_via_email')}
                  </ThemedText>
                  <TextInput
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      setMagicSent(false);
                      setError(null);
                    }}
                    editable={!magicLoading && !googleLoading && !linkLoading}
                    placeholder={t('auth.linking.email_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    style={[
                      styles.input,
                      {
                        borderColor: error ? colors.error : colors.border,
                        backgroundColor: colors.backgroundSecondary,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    {...getInputAccessibilityProps(
                      t('common.email'),
                      t('auth.linking.email_placeholder'),
                      error ?? undefined,
                      true
                    )}
                  />

                  <Pressable
                    onPress={handleSendMagicLink}
                    disabled={magicLoading || googleLoading || linkLoading}
                    style={[
                      styles.secondaryButton,
                      { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, opacity: magicLoading ? 0.7 : 1 },
                      getMinTouchTargetStyle(),
                    ]}
                    {...getButtonAccessibilityProps(
                      magicLoading ? t('auth.linking.magic_sending') : t('auth.linking.magic_send'),
                      t('auth.linking.magic_send'),
                      magicLoading || googleLoading || linkLoading
                    )}
                  >
                    {magicLoading ? (
                      <View style={styles.busyRow}>
                        <ActivityIndicator size="small" color={colors.text} />
                        <ThemedText style={{ color: colors.text, fontWeight: FontWeight.bold }}>
                          {t('auth.linking.sending')}
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText style={{ color: colors.text, fontWeight: FontWeight.bold }}>
                        {t('auth.linking.magic_send')}
                      </ThemedText>
                    )}
                  </Pressable>

                  {magicSent ? (
                    <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                      {t('auth.linking.magic_sent_hint')}
                    </ThemedText>
                  ) : null}
                </View>

                <Pressable
                  onPress={cancel}
                  style={[styles.tertiaryButton]}
                  {...getButtonAccessibilityProps(t('common.cancel'), t('common.cancel'))}
                >
                  <ThemedText style={{ color: colors.textSecondary, fontWeight: FontWeight.bold }}>
                    {t('common.cancel')}
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                {/* Step 2: Link */}
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                  {t('auth.linking.signed_in_as')}{' '}
                  <ThemedText style={{ color: colors.text, fontWeight: '800' }}>{user.email}</ThemedText>
                </ThemedText>

                <Pressable
                  onPress={linkTargetProvider}
                  disabled={linkLoading}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.tint, opacity: linkLoading ? 0.7 : 1 },
                    getMinTouchTargetStyle(),
                  ]}
                  {...getButtonAccessibilityProps(
                    linkLoading ? t('auth.linking.linking') : t('auth.linking.link_provider', { provider: targetProvider }),
                    t('auth.linking.link_provider', { provider: targetProvider }),
                    linkLoading
                  )}
                >
                  {linkLoading ? (
                    <View style={styles.busyRow}>
                      <ActivityIndicator size="small" color={colors.textInverse} />
                      <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>
                        {t('auth.linking.linking')}
                      </ThemedText>
                    </View>
                  ) : (
                    <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>
                      {t('auth.linking.link_provider', { provider: targetProvider })}
                    </ThemedText>
                  )}
                </Pressable>

                <Pressable
                  onPress={cancel}
                  style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                >
                  <ThemedText style={{ color: colors.text, fontWeight: FontWeight.bold }}>
                    {t('common.cancel')}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </>
        )}

        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.error, backgroundColor: colors.errorLight }]}>
            <IconSymbol name="info.circle.fill" size={18} color={colors.error} />
            <ThemedText style={{ color: colors.error, flex: 1 }}>{error}</ThemedText>
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
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  body: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.5,
  },
  primaryButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing['5xl'],
  },
  primaryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  secondaryButton: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  tertiaryButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  magicBlock: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    minHeight: Spacing['5xl'],
  },
});


