import { Router } from 'expo-router';

/**
 * Navigate back from any My-Goal edit modal.
 * - If coming from home: navigates back to home page
 * - Otherwise: navigates to /settings/my-goal (default behavior for settings/onboarding)
 * Uses router.dismiss() if available, otherwise falls back to router.replace().
 */
export function returnToMyGoal(router: Router, source?: string): void {
  // If coming from home, navigate back to home
  if (source === 'home') {
    try {
      // Try dismiss first (works for modals)
      if (typeof router.dismiss === 'function') {
        router.dismiss();
        return;
      }
    } catch {
      // If dismiss fails, fall through to replace
    }
    // Fallback: navigate to home tabs
    router.replace('/(tabs)');
    return;
  }
  
  // Default behavior: navigate to /settings/my-goal
  try {
    // Try dismiss first (works for modals)
    if (typeof router.dismiss === 'function') {
      router.dismiss();
    }
  } catch {
    // If dismiss fails or doesn't exist, use replace
  }
  
  // Always ensure we navigate to the correct route
  router.replace('/settings/my-goal');
}

// Default export for Expo Router (this file is a utility, not a route component)
export default function ReturnToMyGoalRoute() {
  return null;
}
