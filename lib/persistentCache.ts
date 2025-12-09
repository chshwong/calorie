/**
 * PERSISTENT CACHE UTILITY
 * 
 * Provides a simple caching layer on top of platform storage (localStorage/AsyncStorage)
 * with automatic JSON serialization and optional TTL support.
 * 
 * Per engineering guidelines:
 * - Wraps browser APIs in adapter modules
 * - Platform-agnostic (web vs mobile ready)
 */

export const DEFAULT_CACHE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

import { Platform } from 'react-native';

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
    console.warn('[persistentCache] set failed for key', key, e);
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
    if (!storage) return null;

    const raw = storage.getItem(buildKey(key));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (maxAgeMs && Date.now() - entry.savedAt > maxAgeMs) {
      return null;
    }

    return entry.data;
  } catch (e) {
    console.warn('[persistentCache] get failed for key', key, e);
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
    console.warn('[persistentCache] remove failed for key', key, e);
  }
}

