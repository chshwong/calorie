import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  // Load theme preference from storage
  useEffect(() => {
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
      
      if (stored && (stored === 'light' || stored === 'dark' || stored === 'auto')) {
        setThemeModeState(stored as ThemeMode);
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

