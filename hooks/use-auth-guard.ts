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
}) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const requireAuth = options?.requireAuth ?? true;
  const redirectTo = options?.redirectTo;

  useEffect(() => {
    // Don't redirect while loading
    if (loading) {
      return;
    }

    const currentRoute = segments[0];

    // Handle authentication requirement
    if (requireAuth && !session) {
      // Not authenticated, redirect to login
      if (currentRoute !== 'login') {
        router.replace(redirectTo || '/login');
      }
      return;
    }

    // If authenticated but on auth screens, redirect to home
    if (session) {
      const isAuthScreen = currentRoute === 'login';
      if (isAuthScreen && currentRoute !== 'index') {
        router.replace('/(tabs)');
      }
    }
  }, [session, loading, requireAuth, redirectTo, router, segments]);
}











