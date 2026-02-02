import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchFriendVisibilityPrefs,
  type FriendVisibilityPrefs,
  upsertFriendVisibilityPrefs,
} from '@/lib/services/friendVisibilityPrefs';

export const friendVisibilityPrefsQueryKey = (userId: string | undefined) => [
  'friends',
  'visibilityPrefs',
  userId,
];

export function useFriendVisibilityPrefs(open: boolean) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: friendVisibilityPrefsQueryKey(userId),
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return fetchFriendVisibilityPrefs();
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpsertFriendVisibilityPrefs() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefs: FriendVisibilityPrefs) => upsertFriendVisibilityPrefs(prefs),
    onSuccess: async (_, prefs) => {
      queryClient.setQueryData(friendVisibilityPrefsQueryKey(userId), prefs);
      // Friend cards are user-scoped; invalidate only the current viewer's cache.
      queryClient.invalidateQueries({ queryKey: ['friends', 'friendCards', userId] });
    },
  });
}

