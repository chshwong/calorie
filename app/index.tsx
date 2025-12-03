import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Platform, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function Index() {
  const { session, loading, isPasswordRecovery, profile, onboardingComplete, refreshProfile } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const hasRedirected = useRef(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Global timeout for initial loading (12 seconds)
  useEffect(() => {
    // Reset timeout state when loading completes
    if (!loading) {
      setHasTimedOut(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Set timeout if we're still loading
    if (loading && !hasTimedOut) {
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setHasTimedOut(true);
      }, 12000); // 12 seconds
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [loading, hasTimedOut]);

  const handleRetry = () => {
    // Reset timeout state
    setHasTimedOut(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Retry initialization
    refreshProfile();
  };

  useEffect(() => {
    // Don't redirect while loading
    if (loading) {
      return;
    }

    // If we've already redirected, don't redirect again
    if (hasRedirected.current) {
      return;
    }

    // Get current route - segments might be empty initially
    const currentRoute = segments?.[0];
    
    // If we're already on a specific route (not index), mark as redirected and don't redirect
    // This prevents redirect loops and preserves navigation state
    if (currentRoute && currentRoute !== 'index') {
      hasRedirected.current = true;
      return;
    }

    // Only redirect from index route (or when route is undefined/empty)
    // This should only happen once on initial load
    if (!currentRoute || currentRoute === 'index') {
      // Mark as redirected immediately to prevent multiple redirects
      hasRedirected.current = true;
      
      // Call the function inside the effect, don't include it in dependencies
      const inRecoveryMode = isPasswordRecovery();
      
      // Clear any pending redirects
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      
      // Use a small timeout to ensure navigation state is ready
      redirectTimeoutRef.current = setTimeout(() => {
        try {
          if (inRecoveryMode) {
            // SECURITY: If in recovery mode, redirect to reset-password
            // Recovery sessions should NOT grant access to the app
            router.replace('/reset-password');
          } else if (session) {
            // If we have a session but profile is still loading, wait
            if (loading) {
              // Still loading profile, wait
              hasRedirected.current = false; // Reset so we can redirect once profile loads
              return;
            }
            
            // Check if user is active before navigating
            // If profile exists and is_active is false/null, don't navigate (user should be signed out by AuthContext)
            if (profile && (profile.is_active === false || profile.is_active === null)) {
              // User is inactive - don't navigate, AuthContext should handle sign out
              return;
            }
            
            // Check if onboarding is complete
            // If no profile OR onboarding_complete is false, redirect to onboarding
            if (!profile || !onboardingComplete) {
              router.replace('/onboarding');
              return;
            }
            
            // Normal login - clear any recovery mode flag that might be lingering
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              sessionStorage.removeItem('password_recovery_mode');
            }
            router.replace('/(tabs)');
          } else {
            router.replace('/login');
          }
        } catch (error) {
          console.error('[Index] Error during redirect:', error);
        } finally {
          redirectTimeoutRef.current = null;
        }
      }, 50);
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [session, loading, router, segments]); // Include segments but use hasRedirected to prevent loops

  // Show fallback UI if timeout occurred and still loading
  if (hasTimedOut && loading) {
    return (
      <ThemedView style={styles.fallbackContainer}>
        <ThemedText type="subtitle" style={styles.fallbackMessage}>
          Unable to connect. Please try again.
        </ThemedText>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.tint }]}
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
        >
          <ThemedText style={[styles.retryButtonText, { color: colors.background }]}>
            Retry
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackMessage: {
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

