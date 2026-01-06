import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { exchangeCodeForSession, getSession, getUser, signOut } from '@/lib/services/auth';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { showAppToast } from '@/components/ui/app-toast';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  clearPendingLinkState,
  getPendingLinkState,
  isPendingLinkExpired,
  setPendingLinkState,
} from '@/lib/auth/oauth';

function isAccountExistsError(error: string, description?: string) {
  const s = `${error} ${description ?? ''}`.toLowerCase();
  return (
    s.includes('already registered') ||
    s.includes('already exists') ||
    s.includes('email already') ||
    s.includes('account exists')
  );
}

function isMissingEmailError(error: string, description?: string) {
  const s = `${error} ${description ?? ''}`.toLowerCase();
  return s.includes('email') && (s.includes('missing') || s.includes('not provided') || s.includes('no email'));
}

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const code = useMemo(() => {
    const c = params.code;
    return typeof c === 'string' ? c : Array.isArray(c) ? c[0] : undefined;
  }, [params.code]);

  const oauthError = useMemo(() => {
    const e = params.error;
    return typeof e === 'string' ? e : Array.isArray(e) ? e[0] : undefined;
  }, [params.error]);

  const oauthErrorDescription = useMemo(() => {
    const d = (params.error_description ?? params.errorDescription) as any;
    return typeof d === 'string' ? d : Array.isArray(d) ? d[0] : undefined;
  }, [params.error_description, (params as any).errorDescription]);

  const [title, setTitle] = useState(t('auth.callback.signing_in_title'));
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setBusy(false);
      setTitle(t('auth.callback.coming_soon_title'));
      setDetail(t('auth.callback.web_only_detail'));
      return;
    }

    const run = async () => {
      setBusy(true);

      // Clear stale pending link state early.
      const pending = getPendingLinkState();
      if (pending && isPendingLinkExpired(pending)) {
        clearPendingLinkState();
      }

      if (oauthError) {
        if (oauthError === 'access_denied') {
          const existing = getPendingLinkState();
          if (existing) {
            setPendingLinkState({ ...existing, lastError: 'cancelled', stage: 'needs_verification' });
          }
          // Cancellation should never trap the user in a linking state.
          clearPendingLinkState();
          showAppToast(t('auth.callback.cancelled_toast'));
          router.replace('/login');
          return;
        }

        if (isMissingEmailError(oauthError, oauthErrorDescription)) {
          clearPendingLinkState();
          setTitle(t('auth.callback.needs_email_title'));
          setDetail(t('auth.callback.needs_email_detail'));
          return;
        }

        if (isAccountExistsError(oauthError, oauthErrorDescription)) {
          // Force explicit linking; user must sign in with the existing account first.
          showAppToast(t('auth.callback.account_exists_toast'));
          const existing = getPendingLinkState();
          if (existing) {
            setPendingLinkState({ ...existing, stage: 'needs_verification', lastError: 'account_exists' });
          }
          router.replace('/auth/link');
          return;
        }

        setBusy(false);
        setTitle(t('auth.callback.failed_title'));
        setDetail(oauthErrorDescription ?? t('common.unexpected_error'));
        return;
      }

      try {
        // OAuth callback: ?code=... (PKCE) → exchange.
        // Magic link callback: no code; Supabase will restore session from URL tokens on page load.
        if (code) {
          const { error } = await exchangeCodeForSession(code);
          if (error) {
            setBusy(false);
            setTitle(t('auth.callback.failed_title'));
            setDetail(error.message);
            return;
          }
        }

        // Session may take a moment to appear for magic link callbacks.
        let sessionUser = (await getSession()).data.session?.user ?? null;
        if (!sessionUser && !code) {
          for (let i = 0; i < 5; i += 1) {
            // Small delay to allow the client to parse URL tokens and persist the session.
            await new Promise((r) => setTimeout(r, 250));
            sessionUser = (await getSession()).data.session?.user ?? null;
            if (sessionUser) break;
          }
        }

        const user = sessionUser ?? (await getUser()).data.user ?? null;
        if (!user) {
          setBusy(false);
          setTitle(t('auth.callback.failed_title'));
          setDetail(t('auth.callback.no_session_detail'));
          return;
        }

        if (!user.email) {
          // Defensive: if the provider did not return an email, we do not allow sign-in.
          await signOut();
          clearPendingLinkState();
          setBusy(false);
          setTitle(t('auth.callback.needs_email_title'));
          setDetail(t('auth.callback.needs_email_detail'));
          return;
        }

        const pendingAfter = getPendingLinkState();
        if (pendingAfter && isPendingLinkExpired(pendingAfter)) {
          clearPendingLinkState();
        }

        // If the user just verified ownership (Google or magic link), route them back to /auth/link to finish linking.
        if (pendingAfter && (pendingAfter.stage === 'verifying_google' || pendingAfter.stage === 'verifying_magic')) {
          setPendingLinkState({ ...pendingAfter, stage: 'verified' });
          router.replace('/auth/link');
          return;
        }

        // If we just returned from linkIdentity, the account is now linked.
        if (pendingAfter?.stage === 'linking') {
          clearPendingLinkState();
          router.replace('/(tabs)');
          return;
        }

        clearPendingLinkState();
        router.replace('/(tabs)');
      } catch (e: any) {
        setBusy(false);
        setTitle(t('auth.callback.failed_title'));
        setDetail(e?.message ?? t('common.unexpected_error'));
      } finally {
        setBusy(false);
      }
    };

    void run();
  }, [code, oauthError, oauthErrorDescription, router]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.headerRow}>
          <IconSymbol name="lock.fill" size={22} color={colors.tint} />
          <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
        </View>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={colors.tint} />
            <ThemedText style={[styles.detail, { color: colors.textSecondary }]}>
              {t('auth.callback.please_wait')}
            </ThemedText>
          </View>
        ) : null}

        {detail ? (
          <ThemedText style={[styles.detail, { color: colors.textSecondary }]}>{detail}</ThemedText>
        ) : null}

        {!busy ? (
          <Pressable
            onPress={() => router.replace('/login')}
            style={[styles.button, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
          >
            <ThemedText style={{ color: colors.text, fontWeight: FontWeight.bold }}>
              {t('auth.callback.back_to_login')}
            </ThemedText>
          </Pressable>
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
    maxWidth: 520,
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
  detail: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.5,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  button: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
});


