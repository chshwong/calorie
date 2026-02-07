import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearPendingAuthState,
  getPendingAuthState,
  isPendingAuthExpired,
  setPendingAuthState,
} from "@/lib/auth/oauth";
import { exchangeCodeForSession, setSession } from "@/lib/services/auth";
import { spacing } from "@/theme/tokens";

type AuthParams = {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

function parseParamString(input: string): Record<string, string> {
  if (!input) return {};
  const trimmed = input.startsWith("?") || input.startsWith("#") ? input.slice(1) : input;
  if (!trimmed) return {};
  const pairs = trimmed.split("&");
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    if (!pair) continue;
    const [rawKey, rawValue] = pair.split("=");
    if (!rawKey) continue;
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue ?? "");
    out[key] = value;
  }
  return out;
}

function parseAuthParams(url: string): AuthParams {
  try {
    const parsed = new URL(url);
    const queryParams = parseParamString(parsed.search);
    const hashParams = parseParamString(parsed.hash);
    return {
      code: queryParams.code ?? hashParams.code,
      access_token: hashParams.access_token ?? queryParams.access_token,
      refresh_token: hashParams.refresh_token ?? queryParams.refresh_token,
      error: queryParams.error ?? hashParams.error,
      error_description:
        queryParams.error_description ??
        (queryParams as any).errorDescription ??
        hashParams.error_description ??
        (hashParams as any).errorDescription,
    };
  } catch {
    return parseParamString(url) as AuthParams;
  }
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, loading } = useAuth();
  const urlFromHook = Linking.useURL();
  const [capturedUrl, setCapturedUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(true);
  const [detail, setDetail] = React.useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);
  const lastUrlRef = React.useRef<string | null>(null);

  const getParam = React.useCallback((value: unknown) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
    return undefined;
  }, []);

  const handleAuthUrl = React.useCallback(
    async (url: string) => {
      if (!url) return;
      if (lastUrlRef.current === url) return;
      lastUrlRef.current = url;

      setBusy(true);
      setDetail(null);

      const pending = await getPendingAuthState();
      if (pending && isPendingAuthExpired(pending)) {
        await clearPendingAuthState();
      }

      const { code, access_token, refresh_token, error, error_description } = parseAuthParams(url);

      if (error) {
        setBusy(false);
        setDetail(error_description || "Authentication failed. Please try again.");
        return;
      }

      try {
        if (code) {
          await setPendingAuthState({
            stage: "processing",
            provider: "google",
            startedAt: Date.now(),
            lastUrl: url,
          });
          const { error: exchangeError } = await exchangeCodeForSession(code);
          if (exchangeError) {
            setBusy(false);
            setDetail(exchangeError.message || "Failed to complete sign-in.");
            return;
          }
        } else if (access_token && refresh_token) {
          await setPendingAuthState({
            stage: "processing",
            provider: "magic",
            startedAt: Date.now(),
            lastUrl: url,
          });
          const { error: sessionError } = await setSession({ access_token, refresh_token });
          if (sessionError) {
            setBusy(false);
            setDetail(sessionError.message || "Failed to complete sign-in.");
            return;
          }
        } else {
          setBusy(false);
          setDetail("Missing authentication parameters. Please try again.");
          return;
        }

        await clearPendingAuthState();
        router.replace("/post-login-gate");
      } catch (e: any) {
        setBusy(false);
        setDetail(e?.message || "An unexpected error occurred.");
      }
    },
    [router]
  );

  React.useEffect(() => {
    let mounted = true;

    // Cold start: get the initial URL
    Linking.getInitialURL()
      .then((u) => {
        if (!mounted) return;
        if (u) setCapturedUrl(u);
      })
      .catch(() => {});

    // Resume / events: listen for URL opens
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (!mounted) return;
      if (url) setCapturedUrl(url);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const pending = await getPendingAuthState();
      if (!isMounted) return;
      if (pending && isPendingAuthExpired(pending)) {
        await clearPendingAuthState();
      }
    };

    void initialize();

    const timeoutId = setTimeout(() => {
      if (!isMounted) return;
      setInitialLoadComplete(true);
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  React.useEffect(() => {
    const resolved = urlFromHook ?? capturedUrl;
    if (!resolved) return;
    setInitialLoadComplete(true);
    void handleAuthUrl(resolved);
  }, [handleAuthUrl, urlFromHook, capturedUrl]);

  React.useEffect(() => {
    const resolved = urlFromHook ?? capturedUrl;
    if (resolved) return;

    const code = getParam(params.code);
    const accessToken = getParam((params as any).access_token);
    const refreshToken = getParam((params as any).refresh_token);
    const error = getParam(params.error);
    const errorDescription = getParam((params as any).error_description);

    if (!code && !accessToken && !refreshToken && !error && !errorDescription) {
      return;
    }

    const search = new URLSearchParams();
    if (code) search.set("code", code);
    if (accessToken) search.set("access_token", accessToken);
    if (refreshToken) search.set("refresh_token", refreshToken);
    if (error) search.set("error", error);
    if (errorDescription) search.set("error_description", errorDescription);

    const fallbackUrl = `avovibe://auth/callback?${search.toString()}`;
    setInitialLoadComplete(true);
    void handleAuthUrl(fallbackUrl);
  }, [capturedUrl, getParam, handleAuthUrl, params, urlFromHook]);

  React.useEffect(() => {
    if (user) {
      router.replace("/post-login-gate");
    }
  }, [router, user]);

  React.useEffect(() => {
    if (!initialLoadComplete) return;
    const resolved = urlFromHook ?? capturedUrl;
    if (!resolved && !loading && !user) {
      setBusy(false);
      setDetail("No callback URL received. Please try again.");
    }
  }, [capturedUrl, initialLoadComplete, loading, urlFromHook, user]);

  return (
    <Screen padding={spacing.xl}>
      <View style={styles.container}>
        <Card>
          <View style={styles.cardBody}>
            <Text variant="title" style={styles.title}>
              Completing sign-in…
            </Text>
            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator size="small" />
                <Text tone="muted">Please wait while we finish signing you in.</Text>
              </View>
            ) : null}
            {detail ? <Text tone="danger">{detail}</Text> : null}
            {!busy ? (
              <Button
                title="Back to login"
                variant="secondary"
                onPress={() => router.replace("/login")}
              />
            ) : null}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  cardBody: {
    gap: spacing.md,
  },
  title: {
    textAlign: "center",
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
