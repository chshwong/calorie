import type { Router } from 'expo-router';

/**
 * Open the existing My Goals edit flow that reuses onboarding step components.
 * We keep this as a thin navigation helper so Settings and My Goals can share
 * the same entry points without duplicating route/param logic.
 */
export type MyGoalEditStart = 'goal' | 'activity';

export function openMyGoalEdit(router: Router, start: MyGoalEditStart = 'goal') {
  if (start === 'goal') {
    router.push('/settings/my-goal/edit-goal');
    return;
  }

  router.push({
    pathname: '/settings/my-goal/edit-goal',
    params: { start },
  });
}


