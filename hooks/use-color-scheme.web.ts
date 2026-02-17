import { useTheme } from '@/contexts/ThemeContext';

/**
 * Web color scheme comes from ThemeContext.
 * ThemeContext now initializes synchronously on web to avoid light-mode flash.
 */
export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useTheme();
  return colorScheme;
}
