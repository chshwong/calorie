import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, BackHandler, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { WebViewNavigation } from "react-native-webview";
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

type WrappedWebViewProps = {
  initialPath: unknown;
  allowOnboardingPaths?: boolean;
  webRef?: React.RefObject<WebView>;
  canGoBackRef?: React.MutableRefObject<boolean>;
  onWebMessage?: (data: string) => void;
  onWebNavigationStateChange?: (navState: WebViewNavigation) => void;
  /**
   * Container type injected into `window.__AVOVIBE_CONTAINER__`.
   *
   * - `/web` MUST use `"native"` (normal wrapper runtime)
   * - `/web-onboarding` MUST use `"native_onboarding"` (so web onboarding is not blocked)
   */
  containerType: "native" | "native_onboarding";
};

export function WrappedWebView({
  initialPath,
  allowOnboardingPaths = false,
  containerType,
  webRef: externalWebRef,
  canGoBackRef: externalCanGoBackRef,
  onWebMessage,
  onWebNavigationStateChange,
}: WrappedWebViewProps) {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const webRef = externalWebRef ?? useRef<WebView>(null);
  const canGoBackRef = externalCanGoBackRef ?? useRef(false);
  const forcingNativeLoginRef = useRef(false);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#000000" : "#ffffff";
  const safeAreaEdges = ["top"] as const;
  const [lastNavUrl, setLastNavUrl] = useState<string | null>(null);

  const StatusBarChrome = useMemo(() => {
    return (
      <StatusBar
        hidden={false}
        translucent={false}
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={backgroundColor}
      />
    );
  }, [backgroundColor, isDark]);

  const requestedPath = useMemo(() => coercePathParam(initialPath), [initialPath]);

  const initialUrl = useMemo(() => `${WEB_BASE_URL}${requestedPath}`, [requestedPath]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [canPullToRefresh, setCanPullToRefresh] = useState(true);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A) Native-session guard: never allow /web when unauthenticated.
  useEffect(() => {
    if (authLoading) return;
    if (!session || !user) {
      router.replace("/post-login-gate");
    }
  }, [authLoading, session, user]);

  // B) Initial blocklist guard: never load web login/onboarding screens.
  useEffect(() => {
    if (isBlockedPath(requestedPath, { allowOnboardingPaths })) {
      router.replace("/post-login-gate");
    }
  }, [allowOnboardingPaths, requestedPath]);

  const injectedJavaScriptBeforeContentLoaded = useMemo(() => {
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : Platform.OS;
    return `
      window.__AVOVIBE_CONTAINER__ = { type: ${JSON.stringify(containerType)}, platform: ${JSON.stringify(platform)} };
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

      webRef.current?.postMessage(payload);
    },
    [session?.access_token, session?.refresh_token]
  );

  // Proactively (re)send session whenever tokens become available/refresh.
  useEffect(() => {
    if (authLoading) return;
    if (forcingNativeLoginRef.current) return;
    if (session?.access_token && session?.refresh_token) {
      sendNativeSession("native_tokens_available");
    }
  }, [authLoading, sendNativeSession, session?.access_token, session?.refresh_token]);

  const handleMessage = useCallback((event: any) => {
    const data = String(event?.nativeEvent?.data ?? "");
    if (__DEV__ && data) {
      console.log("[WrappedWebView]", containerType, "msg:", data);
    }

    if (data === "REQUEST_NATIVE_SESSION") {
      // If we're forcing native login, do not continue the bridge loop.
      if (forcingNativeLoginRef.current) {
        router.replace("/login");
        return;
      }
      // Web is asking for native tokens. If we're signed out, bounce to true-native login.
      if (!session?.access_token || !session?.refresh_token) {
        router.replace("/login");
        return;
      }
      sendNativeSession("requested_by_web");
      return;
    }
    if (data === "NEED_NATIVE_LOGIN") {
      // Web couldn't apply the session (expired/invalid tokens). Keep native+web in sync by
      // signing out native, then showing the true-native login screen.
      if (forcingNativeLoginRef.current) return;
      forcingNativeLoginRef.current = true;

      // Stop any in-flight loads to prevent repeated /login navigations inside the WebView.
      try {
        webRef.current?.stopLoading?.();
      } catch {
        // ignore
      }

      void signOut().finally(() => {
        router.replace("/login");
      });
      return;
    }
    if (data === "NEED_POST_LOGIN_GATE") {
      if (forcingNativeLoginRef.current) return;
      router.replace("/post-login-gate");
      return;
    }
    onWebMessage?.(data);
  }, [containerType, onWebMessage, sendNativeSession, session?.access_token, session?.refresh_token, signOut]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webRef.current?.reload();
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshing(false);
    }, 9000);
  }, [webRef]);

  const handleScroll = useCallback((event: any) => {
    if (Platform.OS !== "android") return;
    const offsetY = event?.nativeEvent?.contentOffset?.y;
    if (typeof offsetY !== "number") return;
    const atTop = offsetY <= 0;
    setCanPullToRefresh(atTop);
  }, []);

  const androidRefreshProps =
    Platform.OS === "android"
      ? ({
          pullToRefreshEnabled: canPullToRefresh,
          refreshing,
          onRefresh,
        } as const)
      : ({} as const);

  const openExternally = useCallback((urlString: string) => {
    // Fire-and-forget: external apps / OS handlers.
    Linking.openURL(urlString).catch(() => {
      // ignore
    });
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
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
      if (isBlockedPath(parsed.pathname, { allowOnboardingPaths })) {
        const shouldGoToNativeLogin =
          parsed.pathname.startsWith("/login") || parsed.pathname.startsWith("/auth");

        // If the web app tries to hit /login or /auth while wrapped, NEVER navigate away
        // (unmounting/remounting causes flicker + repeated full reloads). Instead, block
        // and inject the native session so the web app can continue without showing web login.
        if (shouldGoToNativeLogin) {
          if (forcingNativeLoginRef.current) {
            setTimeout(() => router.replace("/login"), 0);
            return false;
          }
          // If we have tokens, inject them and keep the WebView mounted (prevents login flicker).
          if (session?.access_token && session?.refresh_token) {
            setTimeout(() => sendNativeSession("web_attempted_login_route"), 0);
            return false;
          }

          // If we don't have tokens (e.g. user signed out), bounce to true-native login.
          setTimeout(() => router.replace("/login"), 0);
          return false;
        }

        // Non-login blocked path (e.g. /onboarding when not allowed): return to the gate.
        setTimeout(() => router.replace("/post-login-gate"), 0);
        return false;
      }

      return true;
    },
    [allowOnboardingPaths, openExternally, sendNativeSession, session?.access_token, session?.refresh_token]
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

  if (isBlockedPath(requestedPath, { allowOnboardingPaths })) {
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
          ref={webRef}
          source={{ uri: initialUrl }}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
          onMessage={handleMessage}
          onScroll={handleScroll}
          {...androidRefreshProps}
          onNavigationStateChange={(navState: WebViewNavigation) => {
            canGoBackRef.current = !!navState.canGoBack;
            onWebNavigationStateChange?.(navState);
            const nextUrl = String(navState?.url ?? "");
            setLastNavUrl(nextUrl || null);
            // Android WebView can occasionally miss `onLoadEnd` for same-origin navigations.
            // Use navigation state's `loading` as an additional signal to clear the overlay spinner.
            if (navState && navState.loading === false) {
              setIsLoading(false);
            }
            if (__DEV__ && nextUrl) {
              console.log("[WrappedWebView]", containerType, "nav:", nextUrl, "loading:", !!navState?.loading);
            }
          }}
          onLoadStart={() => {
            setLoadError(null);
            setIsLoading(true);
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            setRefreshing(false);
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
            {lastNavUrl ? <Text style={styles.errorText}>{lastNavUrl}</Text> : null}
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

export default function WebWrapperScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const webRef = React.useRef<any>(null);
  const canGoBackRef = React.useRef(false);
  const pendingPreExitRef = React.useRef(false);
  const preExitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tourActiveRef = React.useRef(false);
  const pendingTourBackRef = React.useRef(false);
  const tourBackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showExitModal = React.useCallback(() => {
    Alert.alert(t("native.exit_app.title"), t("native.exit_app.body"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("native.exit_app.confirm"), style: "destructive", onPress: () => BackHandler.exitApp() },
    ]);
  }, [t]);

  const requestPreExitBack = React.useCallback(() => {
    pendingPreExitRef.current = true;
    webRef.current?.postMessage?.(JSON.stringify({ type: "NATIVE_PRE_EXIT_BACK" }));
    if (preExitTimerRef.current) {
      clearTimeout(preExitTimerRef.current);
    }
    preExitTimerRef.current = setTimeout(() => {
      if (!pendingPreExitRef.current) return;
      pendingPreExitRef.current = false;
      showExitModal();
    }, 500);
  }, [showExitModal]);

  const requestTourBack = React.useCallback(() => {
    pendingTourBackRef.current = true;
    webRef.current?.postMessage?.(JSON.stringify({ type: "NATIVE_TOUR_BACK" }));

    if (tourBackTimerRef.current) {
      clearTimeout(tourBackTimerRef.current);
    }
    tourBackTimerRef.current = setTimeout(() => {
      if (!pendingTourBackRef.current) return;
      pendingTourBackRef.current = false;
      // If the web doesn't reply, do nothing (tour owns back).
    }, 350);
  }, []);

  const handleWebMessage = React.useCallback(
    (data: string) => {
      let msg: any = null;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      if (msg?.type === "NATIVE_PRE_EXIT_BACK_RESULT") {
        pendingPreExitRef.current = false;
        if (preExitTimerRef.current) {
          clearTimeout(preExitTimerRef.current);
          preExitTimerRef.current = null;
        }
        if (msg.handled === false) {
          showExitModal();
        }
        return;
      }

      if (msg?.type === "TOUR_ACTIVE") {
        tourActiveRef.current = !!msg.active;
        return;
      }

      if (msg?.type === "NATIVE_TOUR_BACK_RESULT") {
        pendingTourBackRef.current = false;
        if (tourBackTimerRef.current) {
          clearTimeout(tourBackTimerRef.current);
          tourBackTimerRef.current = null;
        }
        if (msg.handled === true) return;

        Alert.alert(t("native.exit_tour.title"), t("native.exit_tour.body"), [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("native.exit_tour.confirm"),
            style: "destructive",
            onPress: () => {
              webRef.current?.postMessage?.(JSON.stringify({ type: "NATIVE_TOUR_EXIT" }));
            },
          },
        ]);
        return;
      }
    },
    [showExitModal, t]
  );

  React.useEffect(() => {
    return () => {
      if (preExitTimerRef.current) {
        clearTimeout(preExitTimerRef.current);
        preExitTimerRef.current = null;
      }
      if (tourBackTimerRef.current) {
        clearTimeout(tourBackTimerRef.current);
        tourBackTimerRef.current = null;
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== "android") return;

      const onBackPress = () => {
        if (tourActiveRef.current) {
          requestTourBack();
          return true;
        }

        if (canGoBackRef.current && webRef.current?.goBack) {
          webRef.current.goBack();
          return true;
        }

        requestPreExitBack();
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [])
  );

  return (
    <WrappedWebView
      initialPath={params.path}
      allowOnboardingPaths={false}
      containerType="native"
      webRef={webRef}
      canGoBackRef={canGoBackRef}
      onWebMessage={handleWebMessage}
    />
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

