/**
 * AppToast - Global Toast Notification System
 * 
 * Reusable, lightweight toast component for non-blocking status messages.
 * Provides centralized styling, animations, and behavior that can be updated
 * in one place to affect all screens.
 * 
 * Features:
 * - Horizontally centered on screen
 * - Queue system: only one toast visible at a time, others queued (FIFO)
 * - Standardized 3-second duration with smooth fade-out
 * - Auto-advances to next toast in queue after fade completes
 * 
 * Per engineering guidelines:
 * - Uses shared theme tokens (Colors, Spacing, BorderRadius, etc.)
 * - AODA-compliant touch targets and accessibility
 * - Smooth fade animations
 * - Platform-aware styling
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Toast configuration - standardized duration
const TOAST_DURATION = 3000; // 3 seconds (standardized)
const ANIMATION_DURATION = 300; // Fade in/out duration (smooth)

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
type ToastItem = { message: string; durationMs?: number };

let showToastRef: ((item: ToastItem) => void) | null = null;

export function showAppToast(message: string, options?: { durationMs?: number }) {
  if (showToastRef) {
    showToastRef({ message, durationMs: options?.durationMs });
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
  const queueRef = useRef<ToastItem[]>([]);
  const isShowingRef = useRef(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Process next toast in queue
  const processNextToast = useCallback(() => {
    if (queueRef.current.length === 0) {
      isShowingRef.current = false;
      return;
    }

    const nextItem = queueRef.current.shift();
    if (!nextItem) {
      isShowingRef.current = false;
      return;
    }

    isShowingRef.current = true;
    setMessage(nextItem.message);
    const effectiveDurationMs =
      typeof nextItem.durationMs === 'number' && nextItem.durationMs > 0 ? nextItem.durationMs : TOAST_DURATION;

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ANIMATION_DURATION,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // Auto-dismiss after standardized duration
    timeoutRef.current = setTimeout(() => {
      // Fade out smoothly
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setMessage(null);
        // Process next toast in queue after fade completes
        setTimeout(() => {
          processNextToast();
        }, 50); // Small delay to ensure clean transition
      });
    }, effectiveDurationMs);
  }, [fadeAnim]);

  // Expose showToast function globally
  useEffect(() => {
    showToastRef = (item: ToastItem) => {
      // Add to queue
      queueRef.current.push(item);

      // If no toast is currently showing, process immediately
      if (!isShowingRef.current) {
        processNextToast();
      }
      // Otherwise, it will be processed after current toast finishes
    };

    return () => {
      showToastRef = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      queueRef.current = [];
      isShowingRef.current = false;
    };
  }, [processNextToast]);

  const showToast = useCallback((msg: string) => {
    showAppToast(msg);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <View style={styles.toastWrapper} pointerEvents="none">
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
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={[styles.toastText, { color: colors.text }]}>{message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  toastContainer: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
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

