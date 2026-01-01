import { Platform } from 'react-native';

type PendingLinkStage = 'google_reauth_required' | 'google_authed' | 'linking';

export type PendingLinkState = {
  provider: 'facebook';
  stage: PendingLinkStage;
  startedAt: number;
};

const PENDING_LINK_KEY = 'avovibe.auth.pendingLink';
const PENDING_LINK_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function getOAuthRedirectTo(): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  // Native support will use deep links later.
  return undefined;
}

export function isPendingLinkExpired(state: PendingLinkState): boolean {
  return Date.now() - state.startedAt > PENDING_LINK_MAX_AGE_MS;
}

export function getPendingLinkState(): PendingLinkState | null {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(PENDING_LINK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingLinkState;
    if (!parsed?.provider || !parsed?.stage || !parsed?.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setPendingLinkState(state: PendingLinkState): void {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.sessionStorage.setItem(PENDING_LINK_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearPendingLinkState(): void {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.sessionStorage.removeItem(PENDING_LINK_KEY);
  } catch {
    // ignore
  }
}


