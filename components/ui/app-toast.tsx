/**
 * AppToast - Global Toast Notification System
 * 
 * Reusable, lightweight toast component for non-blocking status messages.
 * Provides centralized styling, animations, and behavior that can be updated
 * in one place to affect all screens.
 * 
 * Per engineering guidelines:
 * - Uses shared theme tokens (Colors, Spacing, BorderRadius, etc.)
 * - AODA-compliant touch targets and accessibility
 * - Smooth fade animations
 * - Auto-dismiss with configurable timing
 * - Prevents stacking/overlapping
 * - Platform-aware styling
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Toast configuration
const TOAST_DURATION = 1750; // 1.75 seconds
const ANIMATION_DURATION = 250; // Fade in/out duration

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Hook to show toast messages
 * 
 * @example
 * const { showToast } = useAppToast();
 * showToast("Cloning…");
 */
export function useAppToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useAppToast must be used within ToastProvider');
  }
  return context;
}

/**
 * Global function to show toast from anywhere
 * 
 * @example
 * import { showAppToast } from '@/components/ui/app-toast';
 * showAppToast("Cloning…");
 */
let showToastRef: ((message: string) => void) | null = null;

export function showAppToast(message: string) {
  if (showToastRef) {
    showToastRef(message);
  } else {
    console.warn('ToastProvider not mounted. Toast message:', message);
  }
}

/**
 * Toast Provider Component
 * Must be added to the app root layout
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Expose showToast function globally
  useEffect(() => {
    showToastRef = (msg: string) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new message
      setMessage(msg);

      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      // Auto-dismiss after duration
      timeoutRef.current = setTimeout(() => {
        // Fade out
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => {
          setMessage(null);
        });
      }, TOAST_DURATION);
    };

    return () => {
      showToastRef = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fadeAnim]);

  const showToast = useCallback((msg: string) => {
    showAppToast(msg);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              top: insets.top + Spacing.md,
              backgroundColor: colors.card,
              ...Shadows.lg,
            },
          ]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Text style={[styles.toastText, { color: colors.text }]}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    ...Platform.select({
      web: {
        maxWidth: 400,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  toastText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
});

