import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";

export type PendingAuthState = {
  stage: "auth_start" | "awaiting_callback" | "processing" | "done";
  provider: "google" | "magic";
  startedAt: number;
  lastUrl?: string;
};

const PENDING_AUTH_KEY = "avovibe.auth.pendingAuth";
const PENDING_AUTH_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function getOAuthRedirectTo(): string {
  return Linking.createURL("auth/callback");
}

export function isPendingAuthExpired(state: PendingAuthState): boolean {
  return Date.now() - state.startedAt > PENDING_AUTH_MAX_AGE_MS;
}

export async function getPendingAuthState(): Promise<PendingAuthState | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAuthState;
    if (!parsed?.stage || !parsed?.provider || !parsed?.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setPendingAuthState(state: PendingAuthState): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export async function clearPendingAuthState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_AUTH_KEY);
  } catch {
    // ignore
  }
}
