import { Redirect } from 'expo-router';

/**
 * DEPRECATED ROUTE: `/my-goals`
 *
 * This screen previously performed direct Supabase reads/writes and manual data fetching,
 * which violates engineering guidelines. The canonical goals/settings flow is:
 * `/settings/my-goal` + its edit screens, backed by `useUserConfig` + React Query mutations.
 *
 * We keep this route as a redirect so any deep links/bookmarks remain valid.
 */
export default function MyGoalsScreen() {
  return <Redirect href="/settings/my-goal" />;
}


