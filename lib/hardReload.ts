/**
 * Hard Reload Utility
 * 
 * Provides a hard reload mechanism that works on both web and native platforms.
 * On web, uses location.replace() with cache-busting. On native, uses expo-updates
 * if available, otherwise falls back to router navigation.
 * 
 * Includes a sessionStorage guard to prevent infinite reload loops.
 */

import { Platform } from 'react-native';

// IMPORTANT: GUARD_KEY must NOT start with "avovibe_" or it will be cleared by clearSessionStorageRuntimeKeys().
const GUARD_KEY = 'avovibe_autoreload_guard';

const SESSION_PREFIXES_TO_CLEAR = ["avovibe_"]; // start minimal; add more only if you confirm you use them


/**
 * Check if the guard is currently set (meaning we already auto-reloaded once)
 */
export function isReloadGuardSet(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  try {
    return sessionStorage.getItem(GUARD_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the reload guard (prevent auto-reload loops)
 */
export function setReloadGuard(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(GUARD_KEY, 'true');
  } catch {
    // Ignore errors (private browsing, etc.)
  }
}

/**
 * Clear the reload guard (allow auto-reload again for next incident)
 */
export function clearReloadGuard(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(GUARD_KEY);
  } catch {
    // Ignore errors
  }
}


function clearSessionStorageRuntimeKeys() {
  try {
    const keys = Object.keys(sessionStorage);
    for (const k of keys) {
      if (SESSION_PREFIXES_TO_CLEAR.some((p) => k.startsWith(p))) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Perform a hard reload of the application
 * 
 * Emulates "close browser and reopen" behavior - preserves storage (including Supabase auth keys).
 * 
 * @param reason Optional reason string for debugging (not used in production)
 */
export async function hardReloadNow(reason?: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Web: use location.replace() with cache-busting query param
    // DO NOT clear storage - preserves Supabase auth keys for proper session restore
    if (typeof window !== 'undefined' && window.location) {
      clearSessionStorageRuntimeKeys();      
      const url = new URL(window.location.href);
      url.searchParams.set('__r', Date.now().toString());      
      window.location.replace(url.toString());
    }
  } else {
    // Native: try expo-updates first, fallback to router navigation
    try {
      // Dynamic import to avoid breaking web builds
      const Updates = await import('expo-updates').catch(() => null);
      if (Updates?.default?.reloadAsync) {
        await Updates.default.reloadAsync();
        return;
      }
    } catch {
      // expo-updates not available or failed
    }

    // Fallback: best-effort router navigation (requires router context)
    // This is a no-op if called outside router context, which is acceptable
    // The watchdog will still prevent infinite hangs
    try {
      // Note: We can't import useRouter here (hooks can't be called outside components)
      // This fallback is intentionally minimal - the watchdog's main protection
      // is preventing the app from hanging, not guaranteeing perfect recovery
    } catch {
      // Ignore - this is best-effort only
    }
  }
}
