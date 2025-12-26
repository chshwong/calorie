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
 * - Onboarding status from cache (immediate) or network (when available)
 * 
 * Safeguards:
 * - Early-exit as soon as destination is known (no timers)
 * - Guaranteed maxDuration fallback (10s): never hangs forever
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserConfig, userConfigQueryKey } from '@/hooks/use-user-config';
import type { UserConfig } from '@/lib/services/userConfig';
import LoadingScreen from '@/app/(minimal)/loading-screen';

// Navigation timing constants
// Note: MAX_DURATION_MS is a guaranteed safety fallback. Do not remove.
const MAX_DURATION_MS = 10000; // 10s guaranteed fallback - never hang forever

// Route mapping for decision-based navigation
const ROUTE_MAP: Record<"login" | "onboarding" | "home", "/login" | "/onboarding" | "/(tabs)"> = {
  login: '/login' as const,
  onboarding: '/onboarding' as const,
  home: '/(tabs)' as const,
} as const;

export default function StartupGate() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { session, user, loading: authLoading, isPasswordRecovery } = useAuth();
  
  // Trigger userConfig query in background (for refetch), but don't wait for it
  // Uses React Query hook per guideline 4: All UI data loaded via React Query
  const { data: userConfig } = useUserConfig();
  
  const [hasNavigated, setHasNavigated] = useState(false);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedRef = useRef(false);

  const authReady = !authLoading;
  const hasSession = !!session && !!user;
  const userId = user?.id ?? null;

  // Keep latest values available to the 10s timeout callback (avoid stale closures)
  const latestRef = useRef<{
    authReady: boolean;
    hasSession: boolean;
    userId: string | null;
    onboardingComplete: boolean | null;
    pathname: string | null;
  }>({
    authReady,
    hasSession,
    userId,
    onboardingComplete: null,
    pathname: pathname ?? null,
  });

  // Helper: Read onboarding_complete from the SAME source as today:
  // - React Query cache first, then `useUserConfig()`
  // Per guideline 4: UI must NOT block while cached data refetches in background
  // Per guideline 10: UI must NEVER block rendering if cached data exists
  const getOnboardingComplete = (): boolean | null => {
    if (!user?.id) return null;
    
    // First try: read from React Query cache immediately (no network wait)
    // This respects guideline 4.1: Startup-critical data MUST render from cache if available
    const cachedConfig = queryClient.getQueryData<UserConfig | null>(
      userConfigQueryKey(user.id)
    );
    
    if (cachedConfig !== undefined) {
      const value = cachedConfig?.onboarding_complete;
      return typeof value === 'boolean' ? value : null;
    }
    
    // Second try: use network data if available (may still be loading)
    if (userConfig !== undefined) {
      const value = userConfig?.onboarding_complete;
      return typeof value === 'boolean' ? value : null;
    }
    
    // Unknown: cache miss and network not ready
    return null;
  };

  const onboardingComplete = useMemo(() => getOnboardingComplete(), [queryClient, user?.id, userConfig]);

  // Single decision function: returns route or null (unknown)
  const getDecision = (): "login" | "onboarding" | "home" | null => {
    // A) If auth is not ready => return null
    if (!authReady) {
      return null;
    }

    // B) If auth ready and no session/user => return "login"
    if (!hasSession) {
      return "login";
    }

    // C) If signed in: check onboarding_complete
    const onboardingStatus = onboardingComplete;
    
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

  const clearMaxDurationTimeout = () => {
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
  };

  const navigateOnce = (decision: "login" | "onboarding" | "home") => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    clearMaxDurationTimeout();
    router.replace(ROUTE_MAP[decision]);
    setHasNavigated(true);
  };

  // STEP 6 — Minimal production console diagnostics (TEMP): once per mount
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      // One log per mount to debug startup hangs in production environments (e.g. Vercel)
      console.log('[StartupGate] mount', {
        authReady: latestRef.current.authReady,
        hasSession: latestRef.current.hasSession,
        userId: latestRef.current.userId,
        onboarding_complete: latestRef.current.onboardingComplete,
        pathname: latestRef.current.pathname,
      });
    }
  }, []);

  // Keep latest values updated for logging + timeout routing decisions
  useEffect(() => {
    latestRef.current = {
      authReady,
      hasSession,
      userId,
      onboardingComplete,
      pathname: pathname ?? null,
    };
  }, [authReady, hasSession, userId, onboardingComplete, pathname]);

  // STEP 4/5 — Keep the maxDuration timeout, but make it safe + reliable (start once)
  useEffect(() => {
    if (maxDurationTimeoutRef.current) return;

    maxDurationTimeoutRef.current = setTimeout(() => {
      if (hasNavigatedRef.current) return;

      const snap = latestRef.current;

      if (process.env.NODE_ENV === 'production') {
        console.log('[StartupGate] maxDuration timeout', {
          authReady: snap.authReady,
          hasSession: snap.hasSession,
          userId: snap.userId,
          onboarding_complete: snap.onboardingComplete,
          pathname: snap.pathname,
        });
      }

      // On timeout, ALWAYS route somewhere safe:
      // - If auth not ready => "/login"
      // - Else if signed in but onboarding_complete unknown => "/onboarding"
      // - Else use normal decision
      if (!snap.authReady) {
        hasNavigatedRef.current = true;
        router.replace('/login');
        setHasNavigated(true);
        return;
      }

      if (!snap.hasSession) {
        hasNavigatedRef.current = true;
        router.replace('/login');
        setHasNavigated(true);
        return;
      }

      if (snap.onboardingComplete === null) {
        hasNavigatedRef.current = true;
        router.replace('/onboarding');
        setHasNavigated(true);
        return;
      }

      navigateOnce(snap.onboardingComplete ? 'home' : 'onboarding');
    }, MAX_DURATION_MS);

    return () => {
      clearMaxDurationTimeout();
    };
  }, [router]);

  // STEP 3 — Early-exit effect (no timers): route immediately when decision becomes known
  useEffect(() => {
    if (hasNavigatedRef.current || hasNavigated) return;

    // Password recovery takes precedence
    if (isPasswordRecovery()) {
      hasNavigatedRef.current = true;
      clearMaxDurationTimeout();
      router.replace('/reset-password');
      setHasNavigated(true);
      return;
    }

    // Get decision
    const decision = getDecision();
    
    // If decision is known, route immediately (after min time if needed)
    if (decision !== null) {
      navigateOnce(decision);
      return;
    }
  }, [
    hasNavigated,
    session,
    user,
    isPasswordRecovery,
    authReady,
    hasSession,
    onboardingComplete,
  ]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
      }
    };
  }, []);

  // Show loading screen while decisions are being made
  return <LoadingScreen />;
}

