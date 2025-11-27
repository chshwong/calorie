import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import en from './en.json';
import fr from './fr.json';

// Supported languages - add more as needed
export type SupportedLanguage = 'en' | 'fr';

// Language display names for the UI
export const languageNames: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
};

// Storage key for persisting language preference
const LANGUAGE_STORAGE_KEY = 'app_language';

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    lng: 'en', // Default language (will be overwritten by loadStoredLanguage)
    fallbackLng: 'en', // Fallback language
    compatibilityJSON: 'v3', // Required for React Native
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for React Native compatibility
    },
  });

/**
 * Load the stored language from persistent storage and apply it.
 * Should be called once at app startup.
 */
export const loadStoredLanguage = async (): Promise<SupportedLanguage> => {
  try {
    let storedLanguage: string | null = null;
    
    if (Platform.OS === 'web') {
      storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } else {
      storedLanguage = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
    }
    
    if (storedLanguage && isLanguageSupported(storedLanguage)) {
      await i18n.changeLanguage(storedLanguage);
      return storedLanguage;
    }
  } catch (error) {
    console.error('Error loading stored language:', error);
  }
  return 'en';
};

/**
 * Change the current language and persist it to storage.
 * 
 * @param lng - The language code to switch to
 * @returns Promise that resolves when language is changed and saved
 * 
 * @example
 * import { setLanguage } from '@/i18n';
 * 
 * // Switch to French
 * await setLanguage('fr');
 */
export const setLanguage = async (lng: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(lng);
  
  // Persist the language selection
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } else {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lng);
    }
  } catch (error) {
    console.error('Error saving language preference:', error);
  }
};

/**
 * Get the current language code.
 * 
 * @returns The current language code
 */
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

/**
 * Check if a language is supported.
 * 
 * @param lng - The language code to check
 * @returns True if the language is supported
 */
export const isLanguageSupported = (lng: string): lng is SupportedLanguage => {
  return ['en', 'fr'].includes(lng);
};

export default i18n;

