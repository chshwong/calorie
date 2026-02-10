import i18n, { loadStoredLanguage } from '@/i18n';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/system/AppErrorBoundary';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';
import { FriendlyErrorScreen } from '@/components/system/FriendlyErrorScreen';
import { ToastProvider } from '@/components/ui/app-toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DebugLoadingProvider } from '@/contexts/DebugLoadingContext';
import { OfflineModeProvider } from '@/contexts/OfflineModeContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { TourOverlay } from '@/features/tour/TourOverlay';
import { TourProvider } from '@/features/tour/TourProvider';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppFonts } from '@/hooks/use-fonts';
import { setupNativeWrapperAuthBridgeOnce } from '@/lib/nativeWrapperAuth';
import { setupFocusWarmup } from '@/lib/utils/session-warmup';
import { initInstallPromptCapture } from '@/src/features/install/installPromptStore';

// Import QueryClient from separate module to avoid circular dependency with AuthContext
import { queryClient } from '@/lib/query-client';

if (typeof window !== 'undefined' && Platform.OS === 'web') {
  initInstallPromptCapture();
}

// TEMPORARY: Add global query logging via event system
if (typeof window !== 'undefined') {
  queryClient.getQueryCache().subscribe((event) => {
    // if (event.type === 'updated') {
    //   const query = (event as any).query;
    //   if (query?.state?.status === 'success') {
    //     console.log('[RQ] query success', query.queryKey);
    //   } else if (query?.state?.status === 'error') {
    //     console.log('[RQ] query error', query.queryKey, query.state.error);
    //   }
    // } else if (event.type === 'added') {
    //   const query = (event as any).query;
    //   console.log('[RQ] query added', query?.queryKey);
    // } else if (event.type === 'removed') {
    //   const query = (event as any).query;
    //   console.log('[RQ] query removed', query?.queryKey);
    // }
  });
}

// Keep the splash screen visible while fonts are loading
SplashScreen.preventAutoHideAsync();

// Import global CSS for web focus styles and tab bar constraints
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    /* Modern, accessible focus styles - AODA 2.0 AA compliant */
    *:focus-visible {
      outline: 2px solid #0a7ea4;
      outline-offset: 2px;
      border-radius: 4px;
    }
    *:focus:not(:focus-visible) {
      outline: none;
    }
    button, a, [role="button"], [role="link"], input, textarea, select {
      transition: all 0.2s ease;
    }
    
    /* Tab bar content width constraint for large desktop screens */
    /* Note: This is handled by ConstrainedTabBar component, but keeping as fallback */
    @media (min-width: 1024px) {
      /* Ensure tab bar content wrapper respects max-width */
      /* The ConstrainedTabBar component handles this, but this provides additional safety */
    }
  `;
  document.head.appendChild(style);
}

// avoid refreshing back to home every time
// export const unstable_settings = {
//   initialRouteName: 'index',
// };

function isFontTimeoutError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  const fn = error instanceof Error ? (error.stack ?? '') : '';
  return (
    msg.includes('timeout') ||
    msg.includes('6000ms') ||
    msg.includes('exceeded') ||
    fn.includes('fontfaceobserver')
  );
}

function normalizeFatalError(payload: unknown): Error {
  if (payload instanceof Error) return payload;
  if (typeof payload === 'string') return new Error(payload);
  return new Error(String(payload));
}

export default function RootLayout() {
  const mountRef = useRef(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const { fontsLoaded, fontError } = useAppFonts();

  // Production-only: catch non-React fatal errors (web + native)
  useEffect(() => {
    if (__DEV__) return;

    const handleError = (event: ErrorEvent) => {
      const err = event.error ?? event.message;
      const normalized = normalizeFatalError(err);
      if (isFontTimeoutError(normalized)) return;
      setFatalError(normalized);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason ?? event;
      const normalized = normalizeFatalError(err);
      if (isFontTimeoutError(normalized)) return;
      setFatalError(normalized);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }

    // Native: ErrorUtils.setGlobalHandler
    const ErrorUtils = (global as any).ErrorUtils;
    if (ErrorUtils?.setGlobalHandler) {
      const original = ErrorUtils.getGlobalHandler?.() ?? (() => {});
      ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        const normalized = normalizeFatalError(error);
        if (isFontTimeoutError(normalized)) {
          original(error, isFatal);
          return;
        }
        setFatalError(normalized);
      });
      return () => {
        ErrorUtils.setGlobalHandler(original);
      };
    }

    return () => {};
  }, []);

  // Load stored language preference on app startup
  useEffect(() => {
    loadStoredLanguage().catch(console.error);
  }, []);

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Setup focus warm-up for session/network (prevents slow mutations after tab blur/focus)
  useEffect(() => {
    const cleanup = setupFocusWarmup();
    return cleanup;
  }, []);

  // Web: Add online/offline listener for automatic query invalidation on reconnect
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => {
      // Invalidate critical queries when coming back online
      // This enables automatic recovery via refetchOnReconnect
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['userConfig'] });
      queryClient.invalidateQueries({ queryKey: ['frequentFoods'] });
      queryClient.invalidateQueries({ queryKey: ['recentFoods'] });
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Monitor for navigation lifecycle (web only)
  useEffect(() => {
    if (!mountRef.current) {
      mountRef.current = true;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Monitor for navigation that causes full page reloads
        const handleBeforeUnload = () => {
          // Track navigation events if needed
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // Monitor for page visibility changes (which might indicate reloads)
        const handleVisibilityChange = () => {
          // Track visibility changes if needed
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      }
    }
    
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <DebugLoadingProvider>
          <AppThemeProvider>
            <OfflineModeProvider>
              {fatalError ? (
                <ToastProvider>
                  <FriendlyErrorScreen
                    error={fatalError}
                    onRetry={() => setFatalError(null)}
                    onGoHome={() => {
                      setFatalError(null);
                      router.replace('/(tabs)');
                    }}
                  />
                </ToastProvider>
              ) : (
                <ThemeProviderWrapper fontsLoaded={fontsLoaded} fontError={fontError} />
              )}
            </OfflineModeProvider>
          </AppThemeProvider>
        </DebugLoadingProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function ThemeProviderWrapper({ fontsLoaded, fontError }: { fontsLoaded: boolean; fontError: Error | null }) {
  const colorScheme = useColorScheme();
  const navigationMountRef = useRef(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!navigationMountRef.current) {
      navigationMountRef.current = true;
    }
    
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <AuthProvider>
      <NativeWrapperBridgeInstaller />
      <AppErrorBoundary>
      <BlockingGateWithRetry
        fontsLoaded={fontsLoaded}
        fontError={fontError}
        retryToken={retryToken}
        setRetryToken={setRetryToken}
      >
        <TourProvider>
          <ToastProvider>
            <GlobalAuthGuard />
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(minimal)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="create-custom-food" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="create-bundle" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="quick-log" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="scanned-item" options={{ title: 'Scanned Item', presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
              <Stack.Screen name="my-goals" options={{ headerShown: false }} />
              <Stack.Screen name="settings/my-goal" options={{ headerShown: false }} />
              <Stack.Screen name="settings/my-goal/edit-goal" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="settings/my-goal/edit-calories" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="settings/my-goal/edit-targets" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="inbox" options={{ headerShown: false }} />
              <Stack.Screen name="inbox/announcements/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="support/index" options={{ headerShown: false }} />
              <Stack.Screen name="support/cases/index" options={{ headerShown: false }} />
              <Stack.Screen name="support/cases/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="settings/admin/support-cases" options={{ headerShown: false }} />
              <Stack.Screen name="settings/admin/support-cases/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <TourOverlay />
            <StatusBar style="auto" />
          </ThemeProvider>
          </ToastProvider>
        </TourProvider>
      </BlockingGateWithRetry>
      </AppErrorBoundary>
    </AuthProvider>
  );
}

function NativeWrapperBridgeInstaller() {
  useEffect(() => {
    setupNativeWrapperAuthBridgeOnce();
  }, []);
  return null;
}

/**
 * Blocking gate that prevents the app from rendering when fonts or auth are loading.
 * There is exactly ONE instance of BlockingBrandedLoader to prevent guard conflicts.
 * When blocking, replaces the entire app (not overlay) to prevent state conflicts.
 */
function BlockingGateWithRetry({ 
  fontsLoaded, 
  fontError, 
  children,
  retryToken,
  setRetryToken
}: { 
  fontsLoaded: boolean; 
  fontError: Error | null; 
  children: React.ReactNode;
  retryToken: number;
  setRetryToken: (updater: (x: number) => number) => void;
}) {
  const { loading: authLoading, authInitError, retryAuthInit } = useAuth();
  const isFontsBlocking = !fontsLoaded && !fontError;
  // Block if fonts are loading, auth is loading, OR there's an auth init error
  // (authInitError keeps the loader visible so Recovery UI can appear via timeout)
  const isGlobalBlocking = isFontsBlocking || authLoading || !!authInitError;
  
  // Handle "Try again" - retry auth init, then increment retry token to force re-evaluation
  const handleTryAgain = () => {
    retryAuthInit().then(() => {
      setRetryToken((x) => x + 1);
    }).catch(() => {
      // Even if retry fails, increment token to allow UI to update
      setRetryToken((x) => x + 1);
    });
  };

  // Re-evaluate blocking state when retryToken changes (forces re-check)
  useEffect(() => {
    // This effect ensures the gate re-evaluates when retry is triggered
    // The actual blocking check happens in the render below
  }, [retryToken]);

  if (isGlobalBlocking) {
    return (
      <BlockingBrandedLoader 
        enabled={true} 
        timeoutMs={8000} 
        overlay={false}
        onTryAgain={handleTryAgain}
      />
    );
  }

  return <>{children}</>;
}

function GlobalAuthGuard() {
  // Allow unauthenticated access to a small set of public routes.
  // Everything else will redirect to /login when logged out.
  useAuthGuard({
    requireAuth: true,
    redirectTo: '/login',
    publicSegments: ['login', 'auth', 'legal', 'data-deletion', '(minimal)'],
  });
  return null;
}

