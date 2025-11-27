import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/themed-view';

export default function Index() {
  const { session, loading, isPasswordRecovery, profile, onboardingComplete } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const hasRedirected = useRef(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              console.log('[Index] Redirecting to /reset-password (recovery mode)');
            }
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
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                console.log('[Index] User is inactive, not navigating');
              }
              return;
            }
            
            // Check if onboarding is complete
            // If no profile OR onboarding_complete is false, redirect to onboarding
            if (!profile || !onboardingComplete) {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                console.log('[Index] Redirecting to /onboarding (onboarding not complete)');
              }
              router.replace('/onboarding');
              return;
            }
            
            // Normal login - clear any recovery mode flag that might be lingering
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              sessionStorage.removeItem('password_recovery_mode');
              console.log('[Index] Redirecting to /(tabs) (authenticated)');
            }
            router.replace('/(tabs)');
          } else {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              console.log('[Index] Redirecting to /login (not authenticated)');
            }
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

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </ThemedView>
  );
}

