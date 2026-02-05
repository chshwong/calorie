import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_WEB_PATH,
  isBlockedPath,
  isSameOrigin,
  WEB_BASE_URL,
} from "@/lib/webWrapper/webConfig";

function coercePathParam(input: unknown): string {
  const value = Array.isArray(input) ? input[0] : input;
  if (typeof value !== "string") return DEFAULT_WEB_PATH;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_WEB_PATH;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function safeParseUrl(urlString: string): URL | null {
  try {
    // Most WebView requests are absolute; base handles any edge relative cases.
    return new URL(urlString, WEB_BASE_URL);
  } catch {
    return null;
  }
}

export default function WebWrapperScreen() {
  const params = useLocalSearchParams();
  const { user, session, loading: authLoading } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#000000" : "#ffffff";
  const safeAreaEdges = Platform.OS === "android" ? ([] as const) : (["top"] as const);
  const androidStatusBarHeight = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

  const StatusBarChrome = useMemo(() => {
    // iOS: leave as-is. Android: edge-to-edge can make the StatusBar background effectively transparent.
    if (Platform.OS !== "android") {
      return <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />;
    }

    // Android: Render a background "shim" under the status icons and reserve space,
    // so wrapped web content never overlaps the status bar.
    return (
      <>
        <StatusBar
          hidden={false}
          translucent={true}
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
        />
        <View style={{ height: androidStatusBarHeight, backgroundColor }} />
      </>
    );
  }, [androidStatusBarHeight, backgroundColor, isDark]);

  const requestedPath = useMemo(() => coercePathParam(params.path), [params.path]);

  const initialUrl = useMemo(() => `${WEB_BASE_URL}${requestedPath}`, [requestedPath]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A) Native-session guard: never allow /web when unauthenticated.
  useEffect(() => {
    if (authLoading) return;
    if (!session || !user) {
      router.replace("/post-login-gate");
    }
  }, [authLoading, session, user]);

  // B) Initial blocklist guard: never load web login/onboarding screens.
  useEffect(() => {
    if (isBlockedPath(requestedPath)) {
      router.replace("/post-login-gate");
    }
  }, [requestedPath]);

  const injectedJavaScriptBeforeContentLoaded = useMemo(() => {
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : Platform.OS;
    return `
      window.__AVOVIBE_CONTAINER__ = { type: "native", platform: ${JSON.stringify(platform)} };
      (function () {
        try {
          window.__AVOVIBE_NATIVE_SESSION__ = window.__AVOVIBE_NATIVE_SESSION__ || null;

          function handleNativeMessage(event) {
            try {
              var raw = event && event.data != null ? String(event.data) : "";
              if (!raw) return;

              var msg = null;
              try {
                msg = JSON.parse(raw);
              } catch (e) {
                // non-JSON messages are ignored here
                return;
              }

              if (msg && msg.type === "NATIVE_SESSION") {
                window.__AVOVIBE_NATIVE_SESSION__ = msg;
                if (typeof window.__AVOVIBE_APPLY_NATIVE_SESSION__ === "function") {
                  window.__AVOVIBE_APPLY_NATIVE_SESSION__(msg);
                }
              }
            } catch (e) {
              // ignore
            }
          }

          // iOS uses window; Android often uses document.
          window.addEventListener("message", handleNativeMessage);
          document.addEventListener("message", handleNativeMessage);
        } catch (e) {
          // ignore
        }
      })();
      true;
    `;
  }, []);

  const sendNativeSession = useCallback(
    (reason: string) => {
      const accessToken = session?.access_token;
      const refreshToken = session?.refresh_token;
      if (!accessToken || !refreshToken) return;

      const payload = JSON.stringify({
        type: "NATIVE_SESSION",
        reason,
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      webViewRef.current?.postMessage(payload);
    },
    [session?.access_token, session?.refresh_token]
  );

  const handleMessage = useCallback((event: any) => {
    const data = String(event?.nativeEvent?.data ?? "");

    if (data === "REQUEST_NATIVE_SESSION") {
      sendNativeSession("requested_by_web");
      return;
    }
    if (data === "NEED_NATIVE_LOGIN") {
      router.replace("/login");
      return;
    }
    if (data === "NEED_POST_LOGIN_GATE") {
      router.replace("/post-login-gate");
    }
  }, [sendNativeSession]);

  const openExternally = useCallback((urlString: string) => {
    // Fire-and-forget: external apps / OS handlers.
    Linking.openURL(urlString).catch(() => {
      // ignore
    });
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      const urlString = request.url ?? "";
      const parsed = safeParseUrl(urlString);

      // If we can't parse, block (defensive).
      if (!parsed) {
        setTimeout(() => router.replace("/post-login-gate"), 0);
        return false;
      }

      const protocol = parsed.protocol.toLowerCase();

      // Non-http(s): open externally (mailto:, tel:, intent:, etc.)
      if (protocol !== "http:" && protocol !== "https:") {
        openExternally(urlString);
        return false;
      }

      // Off-origin navigation: open externally.
      if (!isSameOrigin(parsed)) {
        openExternally(urlString);
        return false;
      }

      // Block web login/onboarding/auth paths (native must own these).
      if (isBlockedPath(parsed.pathname)) {
        const shouldGoToNativeLogin =
          parsed.pathname.startsWith("/login") || parsed.pathname.startsWith("/auth");

        // If we have a native session, try to apply it to the web app instead of bouncing
        // the user back to native login (prevents web login UI from ever appearing).
        if (shouldGoToNativeLogin && session?.access_token && session?.refresh_token) {
          setTimeout(() => sendNativeSession("web_attempted_login_route"), 0);
          return false;
        }

        setTimeout(() => router.replace(shouldGoToNativeLogin ? "/login" : "/post-login-gate"), 0);
        return false;
      }

      return true;
    },
    [openExternally, sendNativeSession, session?.access_token, session?.refresh_token]
  );

  // If guards are about to redirect, keep UI minimal.
  if (!authLoading && (!session || !user)) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={safeAreaEdges}>
        {StatusBarChrome}
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (isBlockedPath(requestedPath)) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={safeAreaEdges}>
        {StatusBarChrome}
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const androidCookieProps =
    Platform.OS === "android"
      ? ({
          thirdPartyCookiesEnabled: true,
        } as const)
      : ({} as const);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={safeAreaEdges}>
      {StatusBarChrome}
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <WebView
          ref={webViewRef}
          source={{ uri: initialUrl }}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
          onMessage={handleMessage}
          onLoadStart={() => {
            setLoadError(null);
            setIsLoading(true);
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            // Proactively send session after load so web can bootstrap without showing login.
            sendNativeSession("web_load_end");
          }}
          onError={(e) => {
            const desc = String(e?.nativeEvent?.description ?? "Unknown error");
            setLoadError(desc);
            setIsLoading(false);
          }}
          onHttpError={(e) => {
            const status = e?.nativeEvent?.statusCode;
            setLoadError(`HTTP error${typeof status === "number" ? ` (${status})` : ""}`);
            setIsLoading(false);
          }}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          {...androidCookieProps}
        />

        {loadError ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Could not load wrapped web app</Text>
            <Text style={styles.errorText}>{initialUrl}</Text>
            <Text style={styles.errorText}>{loadError}</Text>

            <View style={styles.errorActions}>
              <Pressable onPress={() => router.replace("/post-login-gate")} style={styles.errorButton}>
                <Text style={styles.errorButtonText}>Back</Text>
              </Pressable>
              <Pressable onPress={() => openExternally(initialUrl)} style={styles.errorButtonSecondary}>
                <Text style={styles.errorButtonText}>Open in browser</Text>
              </Pressable>
            </View>
          </View>
        ) : isLoading ? (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.98)",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    opacity: 0.75,
    textAlign: "center",
  },
  errorActions: {
    marginTop: 6,
    width: "100%",
    gap: 10,
  },
  errorButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#111827",
  },
  errorButtonSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#374151",
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

