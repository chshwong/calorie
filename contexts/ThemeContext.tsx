import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme as useRNColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'auto';

type ThemeContextType = {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'auto',
  colorScheme: 'light',
  setThemeMode: async () => {},
});

const THEME_STORAGE_KEY = 'app_theme_mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function getInitialWebThemeMode(): ThemeMode {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'auto';
  try {
    const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {
    // ignore storage failures and fall back to auto
  }
  return 'auto';
}

function getInitialWebColorScheme(themeMode: ThemeMode): 'light' | 'dark' {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'light';
  if (themeMode !== 'auto') return themeMode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getInitialWebThemeMode());
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() =>
    getInitialWebColorScheme(getInitialWebThemeMode())
  );

  // Load theme preference from storage
  useEffect(() => {
    // Web initializes synchronously to avoid first-paint light flash.
    if (Platform.OS === 'web') return;
    loadThemeMode();
  }, []);

  // Update color scheme when theme mode or system scheme changes
  useEffect(() => {
    if (themeMode === 'auto') {
      setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setColorScheme(themeMode);
    }
  }, [themeMode, systemColorScheme]);

  const loadThemeMode = async () => {
    try {
      let stored: string | null = null;
      if (Platform.OS === 'web') {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
      } else {
        stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
      }

      if (isThemeMode(stored)) {
        setThemeModeState(stored);
      }
    } catch (error) {
      console.error('Error loading theme mode:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      if (Platform.OS === 'web') {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } else {
        await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
      }
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ themeMode, colorScheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

