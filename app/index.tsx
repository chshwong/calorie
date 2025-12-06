import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Platform, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function Index() {
  const { session, user, loading, isPasswordRecovery, profile, onboardingComplete, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { setIsOfflineMode } = useOfflineMode();
  const router = useRouter();
  const segments = useSegments();
  const hasRedirected = useRef(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  
  const userId = user?.id || session?.user?.id;
  const cachedProfile = userId ? queryClient.getQueryData(['userProfile', userId]) : null;
  
  // Global timeout for initial loading (12 seconds)
  useEffect(() => {
    // Reset timeout state and offline mode when loading completes
    if (!loading) {
      setHasTimedOut(false);
      setIsOfflineMode(false);
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
        // Before showing error, check if we have cached profile data
        const userId = user?.id || session?.user?.id;
        let hasCachedProfile = false;
        
        if (userId) {
          const cachedProfile = queryClient.getQueryData(['userProfile', userId]);
          if (cachedProfile) {
            hasCachedProfile = true;
            // Set offline mode and allow app to render with cached data
            setIsOfflineMode(true);
          }
        }
        
        // Only set timeout if we don't have cached data
        // If we have cached data, we'll allow normal rendering
        if (!hasCachedProfile) {
          setHasTimedOut(true);
        }
      }, 12000); // 12 seconds
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [loading, hasTimedOut, user, session, queryClient, setIsOfflineMode]);

  const handleRetry = () => {
    // Reset timeout state and offline mode
    setHasTimedOut(false);
    setIsOfflineMode(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Retry initialization
    refreshProfile();
  };

  useEffect(() => {
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
      // Check for cached profile if Supabase is slow
      const userId = user?.id || session?.user?.id;
      const cachedProfile = userId ? queryClient.getQueryData(['userProfile', userId]) : null;
      
      // If we're in offline mode (have cached data but still loading), allow redirect
      const shouldProceed = !loading || cachedProfile;
      
      // Don't redirect while loading unless we have cached data
      if (loading && !cachedProfile) {        
        return;
      } else {
        
      }
      
      
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
          } else if (session || cachedProfile) {
            // Use cached profile if available, otherwise use profile from AuthContext
            const effectiveProfile = profile || cachedProfile;
            
            // Check if user is active before navigating
            // If profile exists and is_active is false/null, don't navigate (user should be signed out by AuthContext)
            if (effectiveProfile && (effectiveProfile.is_active === false || effectiveProfile.is_active === null)) {
              // User is inactive - don't navigate, AuthContext should handle sign out
              return;
            }
            
            // Check if onboarding is complete
            // If no profile OR onboarding_complete is false, redirect to onboarding
            const effectiveOnboardingComplete = effectiveProfile?.onboarding_complete ?? false;
            if (!effectiveProfile || !effectiveOnboardingComplete) {
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
  }, [session, loading, profile, router, segments, user, queryClient]); // Include segments but use hasRedirected to prevent loops

  // Handle cached profile when timeout occurs - move state updates to useEffect
  useEffect(() => {
    if (hasTimedOut && loading) {
      const userId = user?.id || session?.user?.id;
      const cachedProfile = userId ? queryClient.getQueryData(['userProfile', userId]) : null;
      
      // If we have cached profile, clear timeout state since we're using cached data
      if (cachedProfile) {
        setHasTimedOut(false);
        setIsOfflineMode(true);
      }
    }
  }, [hasTimedOut, loading, user, session, queryClient, setIsOfflineMode]);

  // Show fallback UI if timeout occurred and still loading
  // Only show if we have no session AND no cached profile
  if (hasTimedOut && loading) {
    const userId = user?.id || session?.user?.id;
    const cachedProfile = userId ? queryClient.getQueryData(['userProfile', userId]) : null;
    
    // If we have cached profile, don't show error screen - allow normal rendering
    if (cachedProfile) {
      // Continue to normal rendering below
    } else if (!session && !userId) {
      // Only show error screen if we truly have no session and no cache
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
  }
  
  // Skip rendering once we're routed away from the index
  
  if (segments?.[0] && segments[0] !== 'index') {    
    return null;
  }
  
  // Failsafe: If stuck on index for too long with cachedProfile, force redirect
  useEffect(() => {
    if (!hasRedirected.current && cachedProfile && loading) {    
      hasRedirected.current = true;
      router.replace('/(tabs)');
    }
  }, [cachedProfile, loading, router]);
  

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

