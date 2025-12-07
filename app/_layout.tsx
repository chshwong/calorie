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
import { AuthProvider } from '@/contexts/AuthContext';
import { OfflineModeProvider } from '@/contexts/OfflineModeContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { DebugLoadingProvider } from '@/contexts/DebugLoadingContext';
import { Colors } from '@/constants/theme';
import { ToastProvider } from '@/components/ui/app-toast';
import { DebugOverlay } from '@/components/DebugOverlay';

// Create QueryClient with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Enable cache persistence on web
if (typeof window !== 'undefined') {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
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

export const unstable_settings = {
  initialRouteName: 'index',
};

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

  // Show loading indicator while fonts are loading
  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <DebugLoadingProvider>
          <AppThemeProvider>
            <OfflineModeProvider>
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
      <ToastProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="register-confirmation" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="mealtype-log" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="create-custom-food" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="create-bundle" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="scanned-item" options={{ title: 'Scanned Item', presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
          <Stack.Screen name="my-goals" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
