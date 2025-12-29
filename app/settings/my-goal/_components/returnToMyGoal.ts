import { Router } from 'expo-router';

/**
 * Navigate back to /settings/my-goal from any My-Goal edit modal.
 * Uses router.dismiss() if available, otherwise falls back to router.replace().
 */
export function returnToMyGoal(router: Router): void {
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

