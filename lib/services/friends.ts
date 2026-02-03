/**
 * DATA ACCESS SERVICE - Friends
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';

export type IncomingFriendRequest = {
  id: string;
  requester_user_id: string;
  requester_avoid: string | null;
  requester_first_name: string | null;
  requester_avatar_url?: string | null;
  note_key: string | null;
  created_at: string;
};

export type OutgoingFriendRequest = {
  id: string;
  target_user_id: string | null;
  target_avoid: string | null;
  target_email: string | null;
  requested_via: string;
  created_at: string;
};

export type Friend = {
  friend_user_id: string;
  friend_avoid: string | null;
  friend_first_name: string | null;
  friend_avatar_url: string | null;
  created_at: string;
};

export type FriendTargetState = 'none' | 'started' | 'halfway' | 'almost' | 'win';

export type FriendCard = {
  friend_user_id: string;
  first_name: string | null;
  avatar_url: string | null;
  avoid: string | null;
  protein_state: FriendTargetState | null;
  fibre_state: FriendTargetState | null;
  water_state: FriendTargetState | null;
  steps: number | null;
  food_streak_days: number | null;
  logged_today: boolean;
  entry_date: string;
};

export async function fetchIncomingFriendRequests(userId: string): Promise<IncomingFriendRequest[]> {
  if (!userId) return [];

  const { data, error } = await supabase.rpc('rpc_get_incoming_friend_requests');

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fetchIncomingFriendRequests] RPC failed:', error);
    }
    return [];
  }

  // Map new RPC shape (friend_request_id) onto existing UI shape (id)
  return (data ?? []).map((row: any) => ({
    id: String(row.friend_request_id),
    requester_user_id: String(row.requester_user_id),
    requester_avoid: row.requester_avoid ?? null,
    requester_first_name: row.requester_first_name ?? null,
    requester_avatar_url: row.requester_avatar_url ?? null,
    note_key: null,
    created_at: String(row.created_at),
  })) as IncomingFriendRequest[];
}

export async function fetchOutgoingFriendRequests(userId: string): Promise<OutgoingFriendRequest[]> {
  if (!userId) return [];

  const { data, error } = await supabase.rpc('get_outgoing_friend_requests');

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fetchOutgoingFriendRequests] RPC failed:', error);
    }
    return [];
  }

  return (data ?? []) as OutgoingFriendRequest[];
}

export async function fetchFriends(userId: string): Promise<Friend[]> {
  if (!userId) return [];

  const { data, error } = await supabase.rpc('get_my_friends');

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fetchFriends] RPC failed:', error);
    }
    return [];
  }

  return (data ?? []) as Friend[];
}

/**
 * Normalize RPC response to FriendCard shape.
 * Handles both schemas: friend_first_name/friend_avatar_url/friend_avoid (legacy)
 * and first_name/avatar_url/avoid (current).
 */
function normalizeFriendCardRow(row: Record<string, unknown>): FriendCard {
  const first_name =
    (row.first_name as string | null) ?? (row.friend_first_name as string | null) ?? null;
  const avatar_url =
    (row.avatar_url as string | null) ?? (row.friend_avatar_url as string | null) ?? null;
  const avoid = (row.avoid as string | null) ?? (row.friend_avoid as string | null) ?? null;

  return {
    friend_user_id: String(row.friend_user_id ?? ''),
    first_name,
    avatar_url,
    avoid,
    protein_state: (row.protein_state as FriendCard['protein_state']) ?? null,
    fibre_state: (row.fibre_state as FriendCard['fibre_state']) ?? null,
    water_state: (row.water_state as FriendCard['water_state']) ?? null,
    steps: (row.steps as number | null) ?? null,
    food_streak_days: (row.food_streak_days as number | null) ?? null,
    logged_today: Boolean(row.logged_today ?? false),
    entry_date: row.entry_date != null ? String(row.entry_date) : '',
  };
}

export async function fetchFriendCards(params: { date?: string }): Promise<FriendCard[]> {
  const { date } = params;

  const { data, error } = await supabase.rpc('rpc_get_friend_cards', {
    p_date: date ?? null,
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fetchFriendCards] RPC failed:', error);
    }
    return [];
  }

  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  return rows.map((row: Record<string, unknown>) => normalizeFriendCardRow(row));
}

export async function sendFriendRequest(params: {
  targetType: 'avoid' | 'email';
  targetValue: string;
  noteKey?: string | null;
}): Promise<void> {
  const { targetType, targetValue, noteKey } = params;

  const { error } = await supabase.rpc('rpc_send_friend_request', {
    p_target_type: targetType,
    p_target_value: targetValue.trim(),
    p_note_key: noteKey ?? null,
  });

  if (error) {
    if (error.code === 'P0003') throw new Error('FRIENDS_CANNOT_REQUEST_SELF');
    if (error.code === 'P0002') throw new Error('FRIENDS_TARGET_REQUIRED');
    if (error.code === 'P0010') throw new Error('FRIENDS_BLOCKED');
    if (error.code === 'P0011') throw new Error('FRIENDS_ALREADY_FRIENDS');
    if (error.code === 'P0012') throw new Error('FRIENDS_REQUEST_ALREADY_SENT');
    if (error.code === 'P0013') throw new Error('FRIENDS_THEY_SENT_YOU_REQUEST');
    throw error;
  }
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_accept_friend_request', {
    p_request_id: requestId,
  });

  if (error) {
    if (error.code === 'P0010') throw new Error('FRIENDS_BLOCKED');
    throw error;
  }
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_decline_friend_request', {
    p_request_id: requestId,
  });

  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_cancel_friend_request', {
    p_request_id: requestId,
  });

  if (error) throw error;
}

export async function removeFriend(friendUserId: string): Promise<void> {
  if (!friendUserId) throw new Error('Friend user ID is required');

  const { error } = await supabase.rpc('rpc_remove_friend', {
    p_friend_user_id: friendUserId,
  });

  if (error) throw error;
}

export type BlockedUser = {
  blocked_user_id: string;
  first_name: string | null;
  avatar_url: string | null;
  avoid: string | null;
  created_at: string;
};

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('rpc_get_blocked_users');

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[getBlockedUsers] RPC failed:', error);
    }
    return [];
  }

  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  return rows.map((row: any) => ({
    blocked_user_id: String(row.blocked_user_id ?? ''),
    first_name: row.first_name ?? null,
    avatar_url: row.avatar_url ?? null,
    avoid: row.avoid ?? null,
    created_at: row.created_at != null ? String(row.created_at) : '',
  }));
}

export async function blockUser(blockedUserId: string): Promise<void> {
  if (!blockedUserId) throw new Error('Blocked user ID is required');

  const { error } = await supabase.rpc('rpc_block_user', {
    p_blocked_user_id: blockedUserId,
  });

  if (error) throw error;
}

export async function unblockUser(blockedUserId: string): Promise<boolean> {
  if (!blockedUserId) return false;

  const { data, error } = await supabase.rpc('rpc_unblock_user', {
    p_blocked_user_id: blockedUserId,
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[unblockUser] RPC failed:', error);
    }
    throw error;
  }

  return data === true;
}

/**
 * Mask email for display (e.g. j***@g***.com).
 * Use this everywhere in UI for consistency; do not reveal full email.
 */
export function maskEmail(email: string | null): string {
  if (!email || !email.includes('@')) return '•••@•••.com';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 1 ? '*' : local[0] + '***';
  const dotIdx = domain.lastIndexOf('.');
  const domainName = dotIdx >= 0 ? domain.slice(0, dotIdx) : domain;
  const ext = dotIdx >= 0 ? domain.slice(dotIdx) : '';
  const maskedDomain = domainName.length <= 1 ? '*' : domainName[0] + '***';
  return `${maskedLocal}@${maskedDomain}${ext}`;
}

/**
 * Canonical helper for displaying email in UI (masked).
 * Use for outgoing request display and anywhere we show email without revealing it.
 */
export function maskEmailForDisplay(email: string | null): string {
  return maskEmail(email);
}

// ---------------------------------------------------------------------------
// Friend nudges
// ---------------------------------------------------------------------------

export const NUDGE_EMOJIS = ['👋', '💧', '💪', '🔥'] as const;
export type NudgeEmoji = (typeof NUDGE_EMOJIS)[number];

export type RecentNudge = {
  id: string;
  sender_user_id: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  emoji: string;
  created_at: string;
};

export async function sendFriendNudge(receiverUserId: string, emoji: NudgeEmoji): Promise<void> {
  if (!receiverUserId || !NUDGE_EMOJIS.includes(emoji)) {
    throw new Error('Invalid nudge params');
  }

  const { error } = await supabase.rpc('rpc_send_friend_nudge', {
    p_receiver_user_id: receiverUserId,
    p_emoji: emoji,
  });

  if (error) {
    if (error.code === 'P0020') throw new Error('NUDGE_THROTTLED');
    if (error.code === 'P0010') throw new Error('FRIENDS_NOT_FRIENDS');
    if (error.code === 'P0011') throw new Error('FRIENDS_BLOCKED');
    throw error;
  }
}

export async function fetchRecentNudges(): Promise<RecentNudge[]> {
  const { data, error } = await supabase.rpc('rpc_get_recent_nudges');

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fetchRecentNudges] RPC failed:', error);
    }
    return [];
  }

  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  return rows.map((row: any) => ({
    id: String(row.id ?? ''),
    sender_user_id: String(row.sender_user_id ?? ''),
    sender_name: row.sender_name ?? null,
    sender_avatar_url: row.sender_avatar_url ?? null,
    emoji: row.emoji ?? '👋',
    created_at: row.created_at != null ? String(row.created_at) : '',
  }));
}

export async function ackRecentNudges(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;

  const { error } = await supabase.rpc('rpc_ack_recent_nudges', {
    p_ids: ids,
  });

  if (error) throw error;
}
