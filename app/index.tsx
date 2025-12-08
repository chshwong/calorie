import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

/**
 * Root route ("/") auth gate.
 *
 * - No manual timeouts.
 * - Decide as soon as possible:
 *   - password recovery  -> /reset-password
 *   - logged in          -> /onboarding or /(tabs)
 *   - not logged in      -> /login (when loading is done)
 *
 * Onboarding rule:
 * - Only send to /onboarding when we explicitly know onboarding is NOT complete
 *   (profile.onboarding_complete === false, or stored onboardingComplete === false).
 * - If we have a session but no profile yet, bias toward sending the user to /(tabs)
 *   instead of /onboarding to avoid flicker.
 */
export default function RootIndex() {
  const router = useRouter();
  const { session, profile, loading, onboardingComplete, isPasswordRecovery } = useAuth();

  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    if (!router || hasNavigated) return;

    // 1) Password recovery takes precedence
    if (isPasswordRecovery()) {
      router.replace('/reset-password');
      setHasNavigated(true);
      return;
    }

    // 2) If we have a session, decide onboarding vs tabs
    if (session) {
      const effectiveProfile: any = profile || null;
      const completedFromProfile = effectiveProfile?.onboarding_complete;

      // Explicit onboarding-complete flag:
      // - If profile says true -> definitely done
      // - If profile says false -> definitely NOT done
      // - If profile is missing, fall back to in-memory onboardingComplete flag
      const isOnboardingDone =
        completedFromProfile === true
          ? true
          : completedFromProfile === false
          ? false
          : onboardingComplete ?? false;

      // Only send to /onboarding when we explicitly know onboarding is NOT done.
      // If profile is still null (not loaded yet) or we have no explicit "false",
      // bias toward sending to /(tabs) to avoid flashing the onboarding screen.
      if (effectiveProfile && isOnboardingDone === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }

      setHasNavigated(true);
      return;
    }

    // 3) No session yet:
    //    - If still loading, wait (spinner below).
    //    - If not loading AND still no session, go to login.
    if (!loading && !session) {
      router.replace('/login');
      setHasNavigated(true);
      return;
    }
  }, [
    router,
    hasNavigated,
    session,
    profile,
    loading,
    onboardingComplete,
    isPasswordRecovery,
  ]);

  // Minimal fallback UI while we don't know yet
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <ActivityIndicator size="small" />
        <ThemedText style={{ marginTop: 8 }}>Loading…</ThemedText>
      </View>
    </ThemedView>
  );
}
