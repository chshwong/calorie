import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  inboxNotificationsQueryKeyBase,
  unreadNotificationCountQueryKey,
} from '@/hooks/use-notifications';
import {
  acceptFriendRequest,
  ackRecentNudges,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendCards,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchOutgoingFriendRequests,
  fetchRecentNudges,
  getBlockedUsers,
  removeFriend,
  sendFriendNudge,
  sendFriendRequest,
  unblockUser,
} from '@/lib/services/friends';

export const friendRequestsQueryKey = (userId: string | undefined) => ['friendRequests', userId];
export const friendsQueryKey = (userId: string | undefined) => ['friends', userId];
export const friendCardsQueryKey = (userId: string | undefined, dateStr: string) => [
  'friendCards',
  userId,
  dateStr,
];
export const incomingRequestsQueryKey = (userId: string | undefined) => ['friends', 'incomingRequests', userId];
export const friendsFriendCardsQueryKey = (userId: string | undefined, dateKey: string) => [
  'friends',
  'friendCards',
  userId,
  dateKey,
];
export const blockedUsersQueryKey = (userId: string | undefined) => ['friends', 'blockedUsers', userId];
export const recentNudgesQueryKey = (userId: string | undefined) => ['friends', 'recentNudges', userId];

/** Invalidate all friends-related queries so UI never shows stale friends/requests/blocks. */
export function invalidateFriendsQueries(queryClient: QueryClient, userId: string | undefined): void {
  if (!userId) return;
  queryClient.invalidateQueries({ queryKey: incomingRequestsQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: friendRequestsQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: friendsQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: ['friends', 'friendCards', userId] });
  queryClient.invalidateQueries({ queryKey: blockedUsersQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: recentNudgesQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: inboxNotificationsQueryKeyBase(userId) });
}

export function useFriendRequests() {
  const { user } = useAuth();
  const userId = user?.id;

  const incoming = useQuery({
    queryKey: incomingRequestsQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return fetchIncomingFriendRequests(userId);
    },
    staleTime: 60 * 1000,
  });

  const outgoing = useQuery({
    queryKey: [...friendRequestsQueryKey(userId), 'outgoing'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return fetchOutgoingFriendRequests(userId);
    },
    staleTime: 60 * 1000,
  });

  return {
    incoming: incoming.data ?? [],
    outgoing: outgoing.data ?? [],
    isLoading: incoming.isLoading || outgoing.isLoading,
    isError: incoming.isError || outgoing.isError,
    refetch: () => {
      incoming.refetch();
      outgoing.refetch();
    },
  };
}

export function useFriends() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: friendsQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return fetchFriends(userId);
    },
    staleTime: 60 * 1000,
  });
}

export function useFriendCards(date?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const dateKey = date ?? 'today';

  return useQuery({
    // Include userId to avoid cross-account cache leakage and to comply with engineering-guidelines.md
    // (query keys must include user_id where applicable).
    queryKey: friendsFriendCardsQueryKey(userId, dateKey),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return fetchFriendCards({ date });
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useSendFriendRequest() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useAcceptFriendRequest() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useDeclineFriendRequest() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useCancelFriendRequest() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelFriendRequest,
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useRemoveFriend() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFriend,
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useBlockUser() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: blockUser,
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useBlockedUsers(open: boolean) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: blockedUsersQueryKey(userId),
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return getBlockedUsers();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnblockUser() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unblockUser,
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useRecentNudges(open: boolean) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: recentNudgesQueryKey(userId),
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return fetchRecentNudges();
    },
    staleTime: 90 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useSendNudge() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ receiverUserId, emoji }: { receiverUserId: string; emoji: import('@/lib/services/friends').NudgeEmoji }) =>
      sendFriendNudge(receiverUserId, emoji),
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}

export function useAckNudges() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => ackRecentNudges(ids),
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  });
}
