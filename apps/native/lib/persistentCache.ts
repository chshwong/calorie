import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_CACHE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

type CacheEntry<T> = {
  data: T;
  savedAt: number;
};

const CACHE_PREFIX = "fitbud_cache_v1";
const memoryCache = new Map<string, CacheEntry<unknown>>();

export function buildKey(key: string) {
  return `${CACHE_PREFIX}:${key}`;
}

export function getPersistentCache<T>(key: string, maxAgeMs?: number): T | null {
  const entry = memoryCache.get(buildKey(key)) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (maxAgeMs && Date.now() - entry.savedAt > maxAgeMs) {
    memoryCache.delete(buildKey(key));
    return null;
  }
  return entry.data;
}

export async function hydratePersistentCache<T>(
  key: string,
  maxAgeMs?: number
): Promise<T | null> {
  const fullKey = buildKey(key);
  const entry = memoryCache.get(fullKey) as CacheEntry<T> | undefined;
  if (entry) {
    if (maxAgeMs && Date.now() - entry.savedAt > maxAgeMs) {
      memoryCache.delete(fullKey);
      return null;
    }
    return entry.data;
  }

  const raw = await AsyncStorage.getItem(fullKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (maxAgeMs && Date.now() - parsed.savedAt > maxAgeMs) {
      await AsyncStorage.removeItem(fullKey);
      return null;
    }
    memoryCache.set(fullKey, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export async function setPersistentCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, savedAt: Date.now() };
  const fullKey = buildKey(key);
  memoryCache.set(fullKey, entry);
  await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
}

export async function removePersistentCache(key: string): Promise<void> {
  const fullKey = buildKey(key);
  memoryCache.delete(fullKey);
  await AsyncStorage.removeItem(fullKey);
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
