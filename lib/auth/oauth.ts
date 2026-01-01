import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export type AuthProvider = 'google' | 'facebook';

type PendingLinkStage =
  | 'auth_start'
  | 'needs_verification'
  | 'verifying_google'
  | 'verifying_magic'
  | 'verified'
  | 'linking';

export type PendingLinkState = {
  /**
   * The provider the user originally tried to use (the one we want to link after verifying ownership).
   * This lets us support Google/Facebook permutations while keeping the UX simple.
   */
  targetProvider: AuthProvider;
  stage: PendingLinkStage;
  startedAt: number;
  /**
   * Optional: last error we observed during the flow (used only for UX copy).
   */
  lastError?: 'account_exists' | 'missing_email' | 'cancelled' | 'unknown';
};

const PENDING_LINK_KEY = 'avovibe.auth.pendingLink';
const PENDING_LINK_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function getOAuthRedirectTo(): string | undefined {
  // Engineering guideline #14: avoid using window.location directly.
  // expo-linking builds a platform-correct absolute URL for the current environment.
  if (Platform.OS === 'web') {
    return Linking.createURL('auth/callback');
  }
  // Native support will use deep links later (createURL will produce a scheme URL),
  // but we keep it off until native OAuth flow is implemented.
  return undefined;
}

export function isPendingLinkExpired(state: PendingLinkState): boolean {
  return Date.now() - state.startedAt > PENDING_LINK_MAX_AGE_MS;
}

export function getPendingLinkState(): PendingLinkState | null {
  try {
    // Note: We intentionally use sessionStorage (web-only) for ephemeral linking state.
    // This is NOT user data and should not be persisted long-term (see persistent cache rules).
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(PENDING_LINK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingLinkState;
    if (!parsed?.targetProvider || !parsed?.stage || !parsed?.startedAt) return null;
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


