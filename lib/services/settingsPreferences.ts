import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { storage } from '@/lib/storage';

export type SettingsPreferences = {
  notifications: boolean;
};

const SETTINGS_STORAGE_KEY = 'app_settings';

/**
 * Load Settings preferences from platform storage.
 *
 * Engineering guidelines:
 * - Persistent storage access must be centralized (component should not touch localStorage/SecureStore).
 */
export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  try {
    if (Platform.OS === 'web') {
      const stored = storage.get(SETTINGS_STORAGE_KEY);
      if (!stored) {
        return { notifications: true };
      }
      const parsed = JSON.parse(stored);
      return {
        notifications: parsed?.notifications !== undefined ? Boolean(parsed.notifications) : true,
      };
    }

    const stored = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return { notifications: true };
    }
    const parsed = JSON.parse(stored);
    return {
      notifications: parsed?.notifications !== undefined ? Boolean(parsed.notifications) : true,
    };
  } catch {
    return { notifications: true };
  }
}

export async function saveSettingsPreferences(next: SettingsPreferences): Promise<void> {
  const value = JSON.stringify(next);
  if (Platform.OS === 'web') {
    storage.set(SETTINGS_STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(SETTINGS_STORAGE_KEY, value);
}


