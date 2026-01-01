import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { showAppToast } from '@/components/ui/app-toast';
import {
  clearPendingLinkState,
  getOAuthRedirectTo,
  getPendingLinkState,
  isPendingLinkExpired,
  setPendingLinkState,
} from '@/lib/auth/oauth';

export default function AuthLinkScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [googleLoading, setGoogleLoading] = useState(false);
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

  const canConfirmLink =
    !!user && pending?.provider === 'facebook' && pending.stage === 'google_authed';

  const startGoogleReauth = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showAppToast('Coming soon');
      return;
    }
    if (googleLoading) return;

    setError(null);
    setGoogleLoading(true);

    try {
      const redirectTo = getOAuthRedirectTo();
      setPendingLinkState({ provider: 'facebook', stage: 'google_reauth_required', startedAt: Date.now() });

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (signInError || !data?.url) {
        clearPendingLinkState();
        setError(signInError?.message ?? 'Failed to start Google sign-in. Please try again.');
        return;
      }

      window.location.assign(data.url);
    } finally {
      setGoogleLoading(false);
    }
  };

  const linkFacebook = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showAppToast('Coming soon');
      return;
    }
    if (linkLoading) return;

    setError(null);
    setLinkLoading(true);

    try {
      const state = getPendingLinkState();
      if (!state || state.provider !== 'facebook' || state.stage !== 'google_authed') {
        setError('Linking session expired. Please start again.');
        clearPendingLinkState();
        return;
      }

      const redirectTo = getOAuthRedirectTo();
      setPendingLinkState({ ...state, stage: 'linking' });

      const { data, error: linkError } = await supabase.auth.linkIdentity({
        provider: 'facebook',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (linkError || !data?.url) {
        setPendingLinkState({ ...state, stage: 'google_authed' });
        setError(linkError?.message ?? 'Failed to start Facebook linking. Please try again.');
        return;
      }

      window.location.assign(data.url);
    } finally {
      setLinkLoading(false);
    }
  };

  const cancel = async () => {
    clearPendingLinkState();
    setError(null);
    try {
      // If the user signed into Google just for linking, send them back to login signed-out.
      await supabase.auth.signOut();
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
          <ThemedText style={[styles.title, { color: colors.text }]}>Link accounts</ThemedText>
        </View>

        <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
          To keep one AvoVibe account per email, you need to confirm you own the existing account before linking Facebook.
        </ThemedText>

        {authLoading ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={colors.tint} />
            <ThemedText style={[styles.body, { color: colors.textSecondary }]}>Checking session…</ThemedText>
          </View>
        ) : null}

        {canConfirmLink ? (
          <>
            <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
              Signed in as:{' '}
              <ThemedText style={{ color: colors.text, fontWeight: '800' }}>{user?.email}</ThemedText>
            </ThemedText>

            <Pressable
              onPress={linkFacebook}
              disabled={linkLoading}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.tint, opacity: linkLoading ? 0.7 : 1 },
              ]}
            >
              {linkLoading ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                  <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>Linking…</ThemedText>
                </View>
              ) : (
                <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>Link Facebook</ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={cancel}
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            >
              <ThemedText style={{ color: colors.text, fontWeight: '700' }}>Cancel</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
              Continue with Google to confirm your existing account, then you’ll be able to link Facebook.
            </ThemedText>

            <Pressable
              onPress={startGoogleReauth}
              disabled={googleLoading}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.tint, opacity: googleLoading ? 0.7 : 1 },
              ]}
            >
              {googleLoading ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                  <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>Continuing…</ThemedText>
                </View>
              ) : (
                <ThemedText style={[styles.primaryText, { color: colors.textInverse }]}>Continue with Google</ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace('/login')}
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            >
              <ThemedText style={{ color: colors.text, fontWeight: '700' }}>Back to login</ThemedText>
            </Pressable>
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
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
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
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});


