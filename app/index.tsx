import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDebugLoading } from '@/contexts/DebugLoadingContext';

export default function Index() {
  const {
    session,
    user,
    loading,
    isPasswordRecovery,
    profile,
    onboardingComplete,
    refreshProfile,
  } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { setDebugLoading } = useDebugLoading();

  // Simple timeout for startup (hard cap)
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = user?.id || session?.user?.id;
  const cachedProfile = userId
    ? queryClient.getQueryData(['userProfile', userId])
    : null;

  // 1) Global timeout for initial loading (5 seconds)
  useEffect(() => {
    // If auth is done loading, clear any timeout and reset state
    if (!loading) {
      setHasTimedOut(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // If still loading and we haven't timed out yet, start a 5s timer
    if (loading && !hasTimedOut) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        // After 5 seconds, stop "waiting forever"
        setHasTimedOut(true);
      }, 5000);
    }

    // Cleanup on unmount / dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [loading, hasTimedOut]);

  // 2) Drive the debug overlay with clear messages
  useEffect(() => {
    if (hasTimedOut && loading) {
      setDebugLoading(true, 'Startup timeout – server is slow or unreachable…');
    } else if (loading) {
      if (!session && !userId) {
        setDebugLoading(true, 'Checking for existing login session…');
      } else {
        setDebugLoading(true, 'Initializing app – loading your profile…');
      }
    } else {
      setDebugLoading(false);
    }
  }, [loading, hasTimedOut, setDebugLoading, session, userId]);

  // 3) Core redirect logic (small and deterministic)
  useEffect(() => {
  // Block only while we truly don't know auth state:
  // still loading AND not timed out AND no session AND no cached profile.
  if (loading && !hasTimedOut && !session && !cachedProfile) {
    return;
  }

    const inRecoveryMode = isPasswordRecovery();

    // Password recovery takes precedence
    if (inRecoveryMode) {
      router.replace('/reset-password');
      return;
    }

    const effectiveProfile: any = profile || cachedProfile;

    // If we have a usable session/profile, decide onboarding vs tabs
    if (session || effectiveProfile) {
      if (
        effectiveProfile &&
        (effectiveProfile.is_active === false ||
          effectiveProfile.is_active === null)
      ) {
        // Inactive user – safest is to send to login
        router.replace('/login');
        return;
      }

      const effectiveOnboardingComplete =
        (effectiveProfile && effectiveProfile.onboarding_complete) ??
        onboardingComplete ??
        false;

      if (!effectiveProfile || !effectiveOnboardingComplete) {
        router.replace('/onboarding');
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        sessionStorage.removeItem('password_recovery_mode');
      }

      router.replace('/(tabs)');
      return;
    }

    // No session and no profile → go to login (especially after timeout)
    router.replace('/login');
  }, [
    loading,
    hasTimedOut,
    router,
    session,
    cachedProfile,
    profile,
    onboardingComplete,
    isPasswordRecovery,
  ]);

  const handleRetry = () => {
    setHasTimedOut(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    refreshProfile();
  };

  // 4) Timeout fallback UI when we are stuck online with no cached profile
  if (hasTimedOut && loading && !cachedProfile) {
    return (
      <ThemedView style={styles.fallbackContainer}>
        <ThemedText type="subtitle" style={styles.fallbackMessage}>
          Unable to connect. Please check your connection and try again.
        </ThemedText>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.tint }]}
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
        >
          <ThemedText
            style={[styles.retryButtonText, { color: colors.background }]}
          >
            Retry
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // 5) Default loading UI while redirecting
  return (
    <ThemedView
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
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
