import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';

/**
 * Hook to protect routes based on authentication state
 * Redirects to appropriate screens without causing remounts
 */
export function useAuthGuard(options?: {
  requireAuth?: boolean;
  redirectTo?: string;
  allowInRecovery?: boolean;
}) {
  const { session, loading, isPasswordRecovery } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const requireAuth = options?.requireAuth ?? true;
  const redirectTo = options?.redirectTo;
  const allowInRecovery = options?.allowInRecovery ?? false;

  useEffect(() => {
    // Don't redirect while loading
    if (loading) {
      return;
    }

    const currentRoute = segments[0];
    const inRecoveryMode = isPasswordRecovery();

    // Handle password recovery mode
    if (inRecoveryMode && !allowInRecovery) {
      // SECURITY: If in recovery mode, redirect to reset-password
      // Recovery sessions should NOT grant access to protected routes
      if (currentRoute !== 'reset-password' && currentRoute !== 'login') {
        router.replace('/reset-password');
      }
      return;
    }

    // Handle authentication requirement
    if (requireAuth && !session) {
      // Not authenticated, redirect to login
      if (currentRoute !== 'login' && currentRoute !== 'register' && currentRoute !== 'forgot-password' && currentRoute !== 'register-confirmation') {
        router.replace(redirectTo || '/login');
      }
      return;
    }

    // If authenticated but on auth screens (and not in recovery), redirect to home
    if (session && !inRecoveryMode) {
      const isAuthScreen = currentRoute === 'login' || currentRoute === 'register' || currentRoute === 'forgot-password' || currentRoute === 'register-confirmation';
      if (isAuthScreen && currentRoute !== 'index') {
        router.replace('/(tabs)');
      }
    }
  }, [session, loading, isPasswordRecovery, requireAuth, redirectTo, allowInRecovery, router, segments]);
}





