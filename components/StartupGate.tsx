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

// Navigation timing constants
// Note: These are component-specific timing values, not validation limits.
// Validation limits would go in constants/constraints.ts per guideline 7.
const MIN_DISPLAY_TIME_MS = 300;
const MAX_WAIT_TIME_MS = 1000;
const MAX_DURATION_MS = 10000; // 10s guaranteed fallback - never hang forever

// Route mapping for decision-based navigation
const ROUTE_MAP: Record<"login" | "onboarding" | "home", "/login" | "/onboarding" | "/(tabs)"> = {
  login: '/login' as const,
  onboarding: '/onboarding' as const,
  home: '/(tabs)' as const,
} as const;

export default function StartupGate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, user, loading: authLoading, isPasswordRecovery } = useAuth();
  
  // Trigger userConfig query in background (for refetch), but don't wait for it
  // Uses React Query hook per guideline 4: All UI data loaded via React Query
  const { data: userConfig } = useUserConfig();
  
  const [hasNavigated, setHasNavigated] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_TIME_MS);

    return () => clearTimeout(timer);
  }, []);

  // Setup maxDuration fallback timer (10s) - ALWAYS routes somewhere, never hangs
  useEffect(() => {
    if (maxDurationTimeoutRef.current) return;
    
    maxDurationTimeoutRef.current = setTimeout(() => {
      if (hasNavigated) return;
      
      // Force navigation after maxDuration - choose safest route
      if (authLoading) {
        // Auth not ready => route to login (safe)
        router.replace('/login');
      } else if (!session || !user) {
        // No session => route to login
        router.replace('/login');
      } else {
        // Have session but onboarding unknown => route to onboarding (safer than home)
        router.replace('/onboarding');
      }
      setHasNavigated(true);
    }, MAX_DURATION_MS);

    return () => {
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
      }
    };
  }, [router, hasNavigated, authLoading, session, user]);

  // Helper: Get onboarding status from cache immediately, fallback to network data
  // Per guideline 4: UI must NOT block while cached data refetches in background
  // Per guideline 10: UI must NEVER block rendering if cached data exists
  const getOnboardingStatus = (): boolean | null => {
    if (!user?.id) return null;
    
    // First try: read from React Query cache immediately (no network wait)
    // This respects guideline 4.1: Startup-critical data MUST render from cache if available
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

  // Single decision function: returns route or null (unknown)
  const getDecision = (): "login" | "onboarding" | "home" | null => {
    // A) If auth is not ready => return null
    if (authLoading) {
      return null;
    }

    // B) If auth ready and no session/user => return "login"
    if (!session || !user) {
      return "login";
    }

    // C) If signed in: check onboarding_complete
    const onboardingStatus = getOnboardingStatus();
    
    // If onboarding_complete is explicitly true/false => return route
    if (onboardingStatus === true) {
      return "home";
    }
    if (onboardingStatus === false) {
      return "onboarding";
    }
    
    // Else return null (unknown)
    return null;
  };

  // STEP 3: Early-exit effect (no timers) - routes immediately when decision is known
  useEffect(() => {
    if (hasNavigated || !router) return;

    // Password recovery takes precedence
    if (isPasswordRecovery()) {
      const elapsed = Date.now() - startTimeRef.current;
      const delay = Math.max(0, MIN_DISPLAY_TIME_MS - elapsed);
      
      navigationTimeoutRef.current = setTimeout(() => {
        router.replace('/reset-password');
        setHasNavigated(true);
      }, delay);
      return;
    }

    // Get decision
    const decision = getDecision();
    
    // If decision is known, route immediately (after min time if needed)
    if (decision !== null) {
      if (minTimeElapsed) {
        // Navigate immediately
        router.replace(ROUTE_MAP[decision]);
        setHasNavigated(true);
      } else {
        // Wait for minimum time, then navigate
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, MIN_DISPLAY_TIME_MS - elapsed);
        
        navigationTimeoutRef.current = setTimeout(() => {
          router.replace(ROUTE_MAP[decision]);
          setHasNavigated(true);
        }, remaining);
      }
      return;
    }

    // Decision is null (unknown) - set max wait timeout
    // After MAX_WAIT_TIME_MS, route to onboarding (safer default)
    if (!maxWaitTimeoutRef.current) {
      maxWaitTimeoutRef.current = setTimeout(() => {
        // Check decision one more time before routing
        const finalDecision = getDecision();
        
        if (minTimeElapsed && !hasNavigated) {
          if (finalDecision !== null) {
            router.replace(ROUTE_MAP[finalDecision]);
          } else {
            // Still unknown => route to onboarding (safer than home)
            router.replace('/onboarding');
          }
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
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
      }
    };
  }, []);

  // Show loading screen while decisions are being made
  return <LoadingScreen />;
}

