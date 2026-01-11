import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { I18nextProvider } from 'react-i18next';
import i18n, { loadStoredLanguage } from '@/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppFonts } from '@/hooks/use-fonts';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OfflineModeProvider } from '@/contexts/OfflineModeContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { DebugLoadingProvider } from '@/contexts/DebugLoadingContext';
import { Colors } from '@/constants/theme';
import { ToastProvider } from '@/components/ui/app-toast';
import { DebugOverlay } from '@/components/DebugOverlay';
import { setupFocusWarmup } from '@/lib/utils/session-warmup';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { TourProvider } from '@/features/tour/TourProvider';
import { TourOverlay } from '@/features/tour/TourOverlay';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';

// Import QueryClient from separate module to avoid circular dependency with AuthContext
import { queryClient } from '@/lib/query-client';

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

// Enable cache persistence on web
if (typeof window !== 'undefined') {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 180 * 24 * 60 * 60 * 1000, // 180 days - ensures userConfig and logs persist
    // Do NOT exclude userConfig - it should be persisted
    // Only exclude truly volatile/huge/sensitive queries if needed
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

export default function RootLayout() {
  const mountRef = useRef(false);
  const { fontsLoaded, fontError } = useAppFonts();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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

  // Show branded loader while fonts are loading
  const isFontsBlocking = !fontsLoaded && !fontError;

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <DebugLoadingProvider>
          <AppThemeProvider>
            <OfflineModeProvider>
              <BlockingBrandedLoader enabled={isFontsBlocking} timeoutMs={8000} overlay={true} />
              <ThemeProviderWrapper />
            </OfflineModeProvider>
          </AppThemeProvider>
        </DebugLoadingProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function ThemeProviderWrapper() {
  const colorScheme = useColorScheme();
  const navigationMountRef = useRef(false);

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
      <AuthLoadingGuard />
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
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <TourOverlay />
          <StatusBar style="auto" />
        </ThemeProvider>
        </ToastProvider>
      </TourProvider>
    </AuthProvider>
  );
}

/**
 * Guard component that monitors auth loading state and shows BlockingBrandedLoader
 * if auth is blocking (authLoading is true).
 */
function AuthLoadingGuard() {
  const { loading: authLoading } = useAuth();
  return <BlockingBrandedLoader enabled={authLoading} timeoutMs={8000} overlay={true} />;
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

