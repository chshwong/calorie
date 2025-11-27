/**
 * Font Loading Hook
 * 
 * Loads the Inter font family using Expo Google Fonts.
 * This hook should be used at the app root to ensure fonts are loaded
 * before rendering any text.
 */

import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export type FontFamily = 
  | 'Inter_400Regular'
  | 'Inter_500Medium'
  | 'Inter_600SemiBold'
  | 'Inter_700Bold';

/**
 * Hook to load Inter font family
 * 
 * @returns Object with fontsLoaded boolean and error if any
 * 
 * @example
 * ```tsx
 * const { fontsLoaded, fontError } = useAppFonts();
 * 
 * if (!fontsLoaded && !fontError) {
 *   return <SplashScreen />;
 * }
 * ```
 */
export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return { fontsLoaded, fontError };
}

/**
 * Font family names for use in styles
 * Maps font weights to loaded font names
 */
export const InterFont = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Get the Inter font family name for a given weight
 */
export function getInterFont(weight: '400' | '500' | '600' | '700' | 'regular' | 'medium' | 'semibold' | 'bold'): string {
  switch (weight) {
    case '400':
    case 'regular':
      return InterFont.regular;
    case '500':
    case 'medium':
      return InterFont.medium;
    case '600':
    case 'semibold':
      return InterFont.semibold;
    case '700':
    case 'bold':
      return InterFont.bold;
    default:
      return InterFont.regular;
  }
}

