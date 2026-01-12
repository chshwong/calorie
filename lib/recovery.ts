/**
 * Recovery Utilities
 * 
 * Functions for recovering from stuck states, including resetting local data.
 */

import { Platform } from 'react-native';
import { hardReloadNow } from './hardReload';

/**
 * Reset all local data (caches, storage, etc.)
 * 
 * This will sign the user out and clear local cached data on this device.
 * After reset, performs a hard reload.
 */
export async function resetLocalData(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      // Clear all localStorage keys used by the app
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        // Clear React Query persister keys
        if (key === 'REACT_QUERY_OFFLINE_CACHE' || key.startsWith('REACT_QUERY_')) {
          keysToRemove.push(key);
        }
        
        // Clear persistent cache keys
        if (key.startsWith('fitbud_cache_v1:')) {
          keysToRemove.push(key);
        }
        
        // Clear Supabase auth keys
        if (key.includes('supabase') || key.includes('sb-')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors (private browsing, etc.)
        }
      });
    } catch (e) {
      // Ignore errors
    }
  } else {
    // Native: clear AsyncStorage
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage').catch(() => null);
      if (AsyncStorage?.default) {
        // Clear all keys (or be selective if needed)
        await AsyncStorage.default.clear();
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // Perform hard reload after clearing data
  await hardReloadNow('recovery_reset');
}
