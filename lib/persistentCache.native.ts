import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Native persistent cache module.
 *
 * NOTE: The existing JSON+TTL cache helpers are currently no-ops on native because
 * they were previously implemented with web-only localStorage. We keep behavior
 * consistent to avoid surprising cache assumptions.
 *
 * We DO provide raw string helpers backed by AsyncStorage for tiny startup-critical flags.
 */

export const DEFAULT_CACHE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

type CacheEntry<T> = {
  data: T;
  savedAt: number;
};

const CACHE_PREFIX = 'fitbud_cache_v1';

export function buildKey(key: string) {
  return `${CACHE_PREFIX}:${key}`;
}

export function setPersistentCache<T>(_key: string, _data: T) {
  // No-op on native (existing behavior prior to introducing this platform file).
}

export function getPersistentCache<T>(_key: string, _maxAgeMs?: number): T | null {
  // No-op on native (existing behavior prior to introducing this platform file).
  return null;
}

export function removePersistentCache(_key: string) {
  // No-op on native (existing behavior prior to introducing this platform file).
}

export function getRawStringSyncWeb(_key: string): string | null {
  return null;
}

export async function getRawString(key: string): Promise<string | null> {
  return await AsyncStorage.getItem(key);
}

export async function setRawString(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function removeRawString(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}


