import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
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

  const [title, setTitle] = useState('Signing you in…');
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setBusy(false);
      setTitle('Coming soon');
      setDetail('OAuth callback handling is currently configured for web only.');
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
          clearPendingLinkState();
          showAppToast('Sign-in cancelled');
          router.replace('/login');
          return;
        }

        if (isMissingEmailError(oauthError, oauthErrorDescription)) {
          clearPendingLinkState();
          setTitle('Facebook sign-in needs an email');
          setDetail(
            "Your Facebook account didn't provide an email address. Please add an email to Facebook, or sign in with Google/email instead."
          );
          return;
        }

        if (isAccountExistsError(oauthError, oauthErrorDescription)) {
          // Force explicit linking; user must sign in with the existing account first.
          showAppToast('Account already exists — link required');
          router.replace('/auth/link');
          return;
        }

        setBusy(false);
        setTitle('Sign-in failed');
        setDetail(oauthErrorDescription ?? 'An unexpected error occurred. Please try again.');
        return;
      }

      if (!code) {
        setBusy(false);
        setTitle('Sign-in failed');
        setDetail('Missing OAuth code. Please try signing in again.');
        return;
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setBusy(false);
          setTitle('Sign-in failed');
          setDetail(error.message);
          return;
        }

        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          setBusy(false);
          setTitle('Sign-in failed');
          setDetail('No user session was created. Please try again.');
          return;
        }

        if (!user.email) {
          // Defensive: if the provider did not return an email, we do not allow sign-in.
          await supabase.auth.signOut();
          clearPendingLinkState();
          setBusy(false);
          setTitle('Facebook sign-in needs an email');
          setDetail(
            "Your Facebook account didn't provide an email address. Please add an email to Facebook, or sign in with Google/email instead."
          );
          return;
        }

        const pendingAfter = getPendingLinkState();
        if (pendingAfter && isPendingLinkExpired(pendingAfter)) {
          clearPendingLinkState();
        }

        // If the user just re-authed with Google as part of a link flow, route them back to /auth/link to confirm.
        if (pendingAfter?.provider === 'facebook' && pendingAfter.stage === 'google_reauth_required') {
          setPendingLinkState({ ...pendingAfter, stage: 'google_authed' });
          router.replace('/auth/link');
          return;
        }

        // If we just returned from linkIdentity, the account is now linked.
        if (pendingAfter?.provider === 'facebook' && pendingAfter.stage === 'linking') {
          clearPendingLinkState();
          router.replace('/(tabs)');
          return;
        }

        clearPendingLinkState();
        router.replace('/(tabs)');
      } catch (e: any) {
        setBusy(false);
        setTitle('Sign-in failed');
        setDetail(e?.message ?? 'An unexpected error occurred. Please try again.');
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
              Please wait…
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
            <ThemedText style={{ color: colors.text, fontWeight: '700' }}>Back to login</ThemedText>
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
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
});


