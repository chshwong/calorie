/**
 * Blocking Branded Loader with Stall Watchdog
 * 
 * Displays the branded LoadingScreen while blocking is enabled.
 * After timeoutMs (default 8s), triggers a hard reload if the guard is not set.
 * If guard is already set (meaning we already auto-reloaded once), shows a manual
 * "Reload App" button instead of auto-reloading again.
 * 
 * This prevents infinite reload loops while still allowing recovery from stalls.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LoadingScreen from '@/app/(minimal)/loading-screen';
import { hardReloadNow, isReloadGuardSet, setReloadGuard, clearReloadGuard } from '@/lib/hardReload';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';

interface BlockingBrandedLoaderProps {
  /** Whether blocking is currently active */
  enabled: boolean;
  /** Timeout in milliseconds before triggering hard reload (default 8000) */
  timeoutMs?: number;
  /** Whether to render as an overlay (absolute positioned) or full-screen replacement (flex: 1) */
  overlay?: boolean;
}

export function BlockingBrandedLoader({ enabled, timeoutMs = 8000, overlay = false }: BlockingBrandedLoaderProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showManualReload, setShowManualReload] = useState(false);

  useEffect(() => {
    if (!enabled) {
      // Clear timeout if blocking ends
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Clear guard when blocking ends (per-incident behavior)
      clearReloadGuard();
      setShowManualReload(false);
      return;
    }

    // When enabled becomes true, start the timeout
    setShowManualReload(false); // Reset state

    // Check if guard is already set (meaning we already auto-reloaded once this incident)
    if (isReloadGuardSet()) {
      // Guard already set: don't auto-reload again, just show manual button
      setShowManualReload(true);
      return;
    }

    // Start timeout for auto-reload
    timeoutRef.current = setTimeout(() => {
      // Check guard again before reloading (may have been set by another instance)
      if (isReloadGuardSet()) {
        setShowManualReload(true);
        return;
      }

      // Set guard and trigger hard reload
      setReloadGuard();
      hardReloadNow('stall_watchdog').catch(() => {
        // If reload fails, show manual button as fallback
        setShowManualReload(true);
      });
    }, timeoutMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, timeoutMs]);

  // Don't render anything if not enabled
  if (!enabled) {
    return null;
  }

  return (
    <View style={overlay ? styles.overlayContainer : styles.fullScreenContainer}>
      <LoadingScreen />
      {showManualReload && (
        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            size="lg"
            onPress={() => {
              hardReloadNow('manual_button').catch(() => {
                // If reload fails, user can try again
              });
            }}
          >
            Reload App
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: Spacing['2xl'] + 40, // Below the loading text with extra space
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
  },
});
