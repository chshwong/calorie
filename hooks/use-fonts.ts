/**
 * Font Loading Hook
 * 
 * Loads the Inter font family using Expo Google Fonts.
 * This hook should be used at the app root to ensure fonts are loaded
 * before rendering any text.
 * 
 * On web, FontFaceObserver is used internally and may timeout.
 * This hook includes error handling to prevent crashes and ensures
 * the app continues to work even if fonts fail to load.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Font from 'expo-font';
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
  // On web, use Font.loadAsync directly with error handling to prevent crashes
  // On native, use useFonts hook which works reliably
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);

  // Use useFonts on native platforms (iOS/Android)
  const [nativeFontsLoaded, nativeFontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // On native, use the useFonts hook result directly
      setFontsLoaded(nativeFontsLoaded);
      setFontError(nativeFontError);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    // On web, load fonts manually with proper error handling
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let fontsResolved = false; // Track if fonts have been resolved (loaded or errored)

    // Global error handlers as safety net for FontFaceObserver errors
    // that might escape the try/catch
    const handleError = (event: ErrorEvent) => {
      const isFontTimeoutError =
        event.error?.message?.includes('timeout') ||
        event.error?.message?.includes('6000ms') ||
        event.error?.message?.includes('exceeded') ||
        event.message?.includes('timeout') ||
        event.message?.includes('6000ms') ||
        event.message?.includes('exceeded') ||
        event.filename?.includes('fontfaceobserver');

      if (isFontTimeoutError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Fonts] Web font failed to load within timeout (global handler), falling back to system fonts.',
            event.error || event.message
          );
        }
        if (isMounted && !fontsResolved) {
          fontsResolved = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setFontsLoaded(true);
          setFontError(null);
        }
        // Prevent the error from crashing the app
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const isFontTimeoutError =
        error?.message?.includes('timeout') ||
        error?.message?.includes('6000ms') ||
        error?.message?.includes('exceeded') ||
        String(error).includes('timeout') ||
        String(error).includes('6000ms');

      if (isFontTimeoutError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Fonts] Font loading promise rejected (global handler), falling back to system fonts.',
            error
          );
        }
        if (isMounted && !fontsResolved) {
          fontsResolved = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setFontsLoaded(true);
          setFontError(null);
        }
        event.preventDefault();
      }
    };

    // Add global error listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const loadFonts = async () => {
      try {
        // Set up a timeout to force fonts to be "ready" after 5 seconds
        // This prevents indefinite blocking if fonts fail to load
        timeoutId = setTimeout(() => {
          if (isMounted && !fontsResolved) {
            fontsResolved = true;
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                '[Fonts] Font loading timeout reached (5s), continuing with system fonts.'
              );
            }
            setFontsLoaded(true);
            setFontError(null);
          }
        }, 5000);

        // Try to load fonts, but DO NOT let errors crash the app
        try {
          await Font.loadAsync({
            Inter_400Regular,
            Inter_500Medium,
            Inter_600SemiBold,
            Inter_700Bold,
          });

          if (isMounted && !fontsResolved) {
            fontsResolved = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            setFontsLoaded(true);
            setFontError(null);
          }
        } catch (err) {
          // IMPORTANT: Do NOT rethrow the error. Just log and continue.
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[Fonts] Web fonts failed to load or timed out. Falling back to system fonts.',
              err
            );
          }
          
          if (isMounted && !fontsResolved) {
            fontsResolved = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            // Always set fontsLoaded to true even on error
            // This ensures the app continues rendering
            setFontsLoaded(true);
            setFontError(null);
          }
        }
      } catch (err) {
        // Catch any unexpected errors in the outer try block
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Fonts] Unexpected error during font loading. Falling back to system fonts.',
            err
          );
        }
        if (isMounted && !fontsResolved) {
          fontsResolved = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setFontsLoaded(true);
          setFontError(null);
        }
      }
    };

    loadFonts();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [nativeFontsLoaded, nativeFontError]); // Depend on native font state for native platforms

  // On native, return the useFonts hook result
  // On web, return our manually managed state
  if (Platform.OS !== 'web') {
    return {
      fontsLoaded: nativeFontsLoaded,
      fontError: nativeFontError,
    };
  }

  // On web, return our error-handled state
  return {
    fontsLoaded,
    fontError,
  };
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

