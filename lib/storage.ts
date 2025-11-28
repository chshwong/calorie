/**
 * PLATFORM STORAGE ADAPTER
 * 
 * Per engineering guidelines section 7:
 * - No browser-only APIs (localStorage) in domain/service code
 * - Wrap browser APIs in adapter modules
 * 
 * This adapter provides a unified interface for storage that can be
 * swapped out for different platform implementations (web vs mobile).
 */

import { Platform } from 'react-native';

/**
 * Storage adapter interface - implement for different platforms
 */
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Web storage implementation using localStorage
 */
const webStorage: StorageAdapter = {
  getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  
  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  
  removeItem(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

/**
 * Mobile storage implementation
 * TODO: Implement using AsyncStorage or SecureStore for React Native
 */
const mobileStorage: StorageAdapter = {
  getItem(_key: string): string | null {
    // For now, return null - implement with AsyncStorage for React Native
    return null;
  },
  
  setItem(_key: string, _value: string): void {
    // TODO: Implement with AsyncStorage for React Native
  },
  
  removeItem(_key: string): void {
    // TODO: Implement with AsyncStorage for React Native
  },
};

/**
 * Get the appropriate storage adapter for the current platform
 */
function getStorageAdapter(): StorageAdapter {
  return Platform.OS === 'web' ? webStorage : mobileStorage;
}

/**
 * Platform-agnostic storage API
 */
export const storage = {
  /**
   * Get a value from storage
   */
  get(key: string): string | null {
    return getStorageAdapter().getItem(key);
  },

  /**
   * Set a value in storage
   */
  set(key: string, value: string): void {
    getStorageAdapter().setItem(key, value);
  },

  /**
   * Remove a value from storage
   */
  remove(key: string): void {
    getStorageAdapter().removeItem(key);
  },

  /**
   * Get a boolean value from storage
   */
  getBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = getStorageAdapter().getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return value === 'true';
  },

  /**
   * Set a boolean value in storage
   */
  setBoolean(key: string, value: boolean): void {
    getStorageAdapter().setItem(key, String(value));
  },
};

// Storage keys used throughout the app
export const STORAGE_KEYS = {
  SUMMARY_EXPANDED: 'summaryExpanded',
  REMEMBERED_EMAIL: 'remembered_email',
  SHOW_ENTRY_DETAILS: 'showEntryDetails',
  SHOW_MACROS: 'showMacros',
  SHOW_FATTY_ACIDS: 'showFattyAcids',
} as const;

