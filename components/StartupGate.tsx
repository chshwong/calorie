/**
 * StartupGate Component
 * 
 * Optimized for fast startup (< 1-2s):
 * 1. Shows LoadingScreen only while routing decisions are unknown
 * 2. Reads cached onboarding flag immediately (no network wait)
 * 3. Routes directly to correct destination without flashing
 * 
 * Decisions made (in order):
 * - Auth session restored (signed in/out known)
 * - Onboarding status from cache (immediate) or network (max 1.5s wait)
 * 
 * Safeguards:
 * - Minimum display time: 300ms (avoid flicker)
 * - Maximum wait: 1000ms (then route even if network still loading)
 * - Never blocks on heavy data queries (logs, goals, etc.)
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserConfig, userConfigQueryKey } from '@/hooks/use-user-config';
import type { UserConfig } from '@/lib/services/userConfig';
import LoadingScreen from '@/app/(minimal)/loading-screen';

const MIN_DISPLAY_TIME_MS = 300;
const MAX_WAIT_TIME_MS = 1000; // Reduced from 2000ms for faster startup

export default function StartupGate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, user, loading: authLoading, isPasswordRecovery } = useAuth();
  
  // Trigger userConfig query in background (for refetch), but don't wait for it
  const { data: userConfig, isLoading: userConfigLoading } = useUserConfig();
  
  const [hasNavigated, setHasNavigated] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_TIME_MS);

    return () => clearTimeout(timer);
  }, []);

  // Helper: Get onboarding status from cache immediately, fallback to network data
  const getOnboardingStatus = (): boolean | null => {
    if (!user?.id) return null;
    
    // First try: read from React Query cache immediately (no network wait)
    const cachedConfig = queryClient.getQueryData<UserConfig | null>(
      userConfigQueryKey(user.id)
    );
    
    if (cachedConfig !== undefined) {
      return cachedConfig?.onboarding_complete ?? false;
    }
    
    // Second try: use network data if available (may still be loading)
    if (userConfig !== undefined) {
      return userConfig?.onboarding_complete ?? false;
    }
    
    // Unknown: cache miss and network not ready
    return null;
  };

  // Navigation logic
  useEffect(() => {
    if (hasNavigated || !router) return;

    // 1) Password recovery takes precedence
    if (isPasswordRecovery()) {
      const elapsed = Date.now() - startTimeRef.current;
      const delay = Math.max(0, MIN_DISPLAY_TIME_MS - elapsed);
      
      navigationTimeoutRef.current = setTimeout(() => {
        router.replace('/reset-password');
        setHasNavigated(true);
      }, delay);
      return;
    }

    // 2) Wait for auth to be ready (session restore complete)
    if (authLoading) {
      return; // Still loading auth state
    }

    // 3) No session: route to login
    if (!session) {
      const elapsed = Date.now() - startTimeRef.current;
      const delay = Math.max(0, MIN_DISPLAY_TIME_MS - elapsed);
      
      navigationTimeoutRef.current = setTimeout(() => {
        router.replace('/login');
        setHasNavigated(true);
      }, delay);
      return;
    }

    // 4) Have session: check onboarding status from cache first
    const onboardingStatus = getOnboardingStatus();
    
    // If we have onboarding status (from cache or network), decide immediately
    if (onboardingStatus !== null) {
      const onboardingComplete = onboardingStatus;
      
      // Only navigate if minimum time has elapsed
      if (minTimeElapsed) {
        if (!onboardingComplete) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
        setHasNavigated(true);
      } else {
        // Wait for minimum time, then navigate
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, MIN_DISPLAY_TIME_MS - elapsed);
        
        navigationTimeoutRef.current = setTimeout(() => {
          if (!onboardingComplete) {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
          setHasNavigated(true);
        }, remaining);
      }
      return;
    }

    // 5) Onboarding status unknown (cache miss, network still loading)
    // Set max wait timeout - after this, route to onboarding (safer default)
    if (!maxWaitTimeoutRef.current) {
      maxWaitTimeoutRef.current = setTimeout(() => {
        // After max wait, if onboarding is still unknown, treat as not onboarded
        // (safer to send to onboarding than to home)
        if (minTimeElapsed && !hasNavigated) {
          router.replace('/onboarding');
          setHasNavigated(true);
        }
      }, MAX_WAIT_TIME_MS);
    }
  }, [
    router,
    queryClient,
    hasNavigated,
    authLoading,
    session,
    user,
    userConfig,
    userConfigLoading,
    isPasswordRecovery,
    minTimeElapsed,
  ]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
      }
    };
  }, []);

  // Show loading screen while decisions are being made
  return <LoadingScreen />;
}

