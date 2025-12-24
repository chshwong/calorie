/**
 * StartupGate Component
 * 
 * Prevents "Home flash then jump to onboarding" by:
 * 1. Showing LoadingScreen while boot decisions are unknown
 * 2. Routing directly to correct destination (login/onboarding/home) without flashing
 * 
 * Decisions made:
 * - Auth session restored (signed in/out known)
 * - Onboarding status known (from userConfig)
 * 
 * Safeguards:
 * - Minimum display time: 300ms (avoid flicker)
 * - Maximum wait: 2000ms (then route even if some queries still loading)
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserConfig } from '@/hooks/use-user-config';
import LoadingScreen from '@/app/(minimal)/loading-screen';

const MIN_DISPLAY_TIME_MS = 300;
const MAX_WAIT_TIME_MS = 2000;

export default function StartupGate() {
  const router = useRouter();
  const { session, loading: authLoading, isPasswordRecovery } = useAuth();
  const { data: userConfig, isLoading: userConfigLoading } = useUserConfig();
  
  const [hasNavigated, setHasNavigated] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_TIME_MS);

    return () => clearTimeout(timer);
  }, []);

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

    // 2) Wait for auth to be ready
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

    // 4) Have session: need to check onboarding status
    // If userConfig is still loading and we don't have cached data, wait
    if (userConfigLoading && !userConfig) {
      // Set max wait timeout
      if (!navigationTimeoutRef.current) {
        navigationTimeoutRef.current = setTimeout(() => {
          // After max wait, if onboarding is still unknown, treat as not onboarded
          // (safer to send to onboarding than to home)
          router.replace('/onboarding');
          setHasNavigated(true);
        }, MAX_WAIT_TIME_MS);
      }
      return;
    }

    // 5) Onboarding decision can be made
    const onboardingComplete = userConfig?.onboarding_complete ?? false;
    
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
  }, [
    router,
    hasNavigated,
    authLoading,
    session,
    userConfig,
    userConfigLoading,
    isPasswordRecovery,
    minTimeElapsed,
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Show loading screen while decisions are being made
  return <LoadingScreen />;
}

