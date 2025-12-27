import { Platform } from 'react-native';

/**
 * PERSISTENT CACHE UTILITY
 *
 * Per engineering guidelines:
 * - Persistent storage access is centralized here.
 * - Platform branching is contained to this module (no localStorage / AsyncStorage usage elsewhere).
 */

export const DEFAULT_CACHE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

type CacheEntry<T> = {
  data: T;
  savedAt: number;
};

const CACHE_PREFIX = 'fitbud_cache_v1';

function getStorage() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  // For now, no native AsyncStorage wiring.
  // Later you can replace this with @react-native-async-storage/async-storage.
  return null;
}

export function buildKey(key: string) {
  return `${CACHE_PREFIX}:${key}`;
}

/**
 * Raw storage helpers (NO key prefix):
 *
 * Used for tiny, startup-critical flags that must be readable without waiting for React Query
 * cache hydration. This still adheres to the "persistent storage access only via this module"
 * guideline, while allowing keys that must remain unprefixed by design.
 */
export function getRawStringSyncWeb(key: string): string | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(key);
}

export async function getRawString(key: string): Promise<string | null> {
  // Web resolves synchronously; native implementation lives in `persistentCache.native.ts`.
  return getRawStringSyncWeb(key);
}

export async function setRawString(key: string, value: string): Promise<void> {
  // Web resolves synchronously; native implementation lives in `persistentCache.native.ts`.
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(key, value);
}

export async function removeRawString(key: string): Promise<void> {
  // Web resolves synchronously; native implementation lives in `persistentCache.native.ts`.
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(key);
}

/**
 * Save any JSON-serializable data to persistent cache.
 */
export function setPersistentCache<T>(key: string, data: T) {
  try {
    const storage = getStorage();
    if (!storage) return;

    const entry: CacheEntry<T> = {
      data,
      savedAt: Date.now(),
    };

    storage.setItem(buildKey(key), JSON.stringify(entry));
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[persistentCache] set failed for key', key, e);
    }
  }
}

/**
 * Load from persistent cache.
 *
 * - maxAgeMs: optional TTL; if entry is older, return null.
 */
export function getPersistentCache<T>(key: string, maxAgeMs?: number): T | null {
  try {
    const storage = getStorage();
    if (!storage) {
      return null;
    }

    const raw = storage.getItem(buildKey(key));
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (maxAgeMs && Date.now() - entry.savedAt > maxAgeMs) {
      return null;
    }

    return entry.data;
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[persistentCache] get failed for key', key, e);
    }
    return null;
  }
}

/**
 * Remove a single cache entry.
 */
export function removePersistentCache(key: string) {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(buildKey(key));
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[persistentCache] remove failed for key', key, e);
    }
  }
}

