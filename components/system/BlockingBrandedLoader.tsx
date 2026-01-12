/**
 * Blocking Branded Loader with Stall Watchdog and Recovery UI
 * 
 * Displays the branded LoadingScreen while blocking is enabled.
 * After timeoutMs (default 8s), allows at most ONE automatic recovery attempt per session.
 * After that, shows a Recovery UI with user-controlled actions.
 * 
 * This prevents infinite reload loops while providing recovery options.
 */

import LoadingScreen from '@/app/(minimal)/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { clearReloadGuard, hardReloadNow } from '@/lib/hardReload';
import { resetLocalData } from '@/lib/recovery';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';

// Auto-recovery session flag helpers
const AUTO_RECOVERY_KEY = 'avovibe_auto_recovered_once';

function canAutoRecover(): boolean {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return true; // Default to allowing one attempt if sessionStorage unavailable
    }
    return sessionStorage.getItem(AUTO_RECOVERY_KEY) !== '1';
  } else {
    // Native: use module-level variable (resets on app restart)
    return !(global as any).__avovibe_didAutoRecoverOnce;
  }
}

function markAutoRecovered(): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(AUTO_RECOVERY_KEY, '1');
      } catch {
        // Ignore errors (private browsing, etc.)
      }
    }
  } else {
    // Native: set module-level variable
    (global as any).__avovibe_didAutoRecoverOnce = true;
  }
}

interface BlockingBrandedLoaderProps {
  /** Whether blocking is currently active */
  enabled: boolean;
  /** Timeout in milliseconds before triggering recovery (default 8000) */
  timeoutMs?: number;
  /** Whether to render as an overlay (absolute positioned) or full-screen replacement (flex: 1) */
  overlay?: boolean;
  /** Callback when "Try again" is pressed - should trigger a retry */
  onTryAgain?: () => void;
}

export function BlockingBrandedLoader({ enabled, timeoutMs = 8000, overlay = false, onTryAgain }: BlockingBrandedLoaderProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'] as typeof Colors.light;

  useEffect(() => {
    if (!enabled) {
      // Clear timeout if blocking ends
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Clear guard when blocking ends (per-incident behavior)
      clearReloadGuard();
      setShowRecovery(false);
      return;
    }

    // When enabled becomes true, reset recovery state
    setShowRecovery(false);

    // Start timeout for recovery attempt
    timeoutRef.current = setTimeout(() => {
      // Check if we can auto-recover (only once per session)
      if (canAutoRecover()) {
        // First timeout: mark as recovered and attempt one hard reload
        markAutoRecovered();
        hardReloadNow('auto_timeout').catch(() => {
          // If reload fails, show recovery UI
          setShowRecovery(true);
        });
      } else {
        // Already attempted auto-recovery: show Recovery UI (no more auto reloads)
        setShowRecovery(true);
      }
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

  // Show Recovery UI if recovery mode is active
  if (showRecovery) {
    return (
      <View style={overlay ? styles.overlayContainer : styles.fullScreenContainer}>
        <ThemedView style={styles.recoveryContainer}>
          <View style={styles.recoveryContent}>
            <ThemedText style={[styles.recoveryTitle, { color: colors.text }]}>
              {t('recovery.title') || 'Trouble loading Avovibe'}
            </ThemedText>
            <ThemedText style={[styles.recoveryBody, { color: colors.textSecondary }]}>
              {t('recovery.body') || 'Avovibe is taking longer than expected to start. This can happen after an update or when the network is unstable. You can try again, restart the app, or reset local data.'}
            </ThemedText>
            
            <View style={styles.recoveryButtons}>
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  setShowRecovery(false);
                  // Trigger retry via callback
                  onTryAgain?.();
                }}
                style={styles.recoveryButton}
              >
                {t('recovery.try_again') || 'Try again'}
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                onPress={() => {
                  hardReloadNow('recovery_restart').catch(() => {
                    // If reload fails, user can try again
                  });
                }}
                style={styles.recoveryButton}
              >
                {t('recovery.restart_app') || 'Restart app'}
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onPress={() => {
                  Alert.alert(
                    t('recovery.reset_confirm_title') || 'Reset local data?',
                    t('recovery.reset_confirm_message') || 'This will sign you out and clear local cached data on this device.',
                    [
                      {
                        text: t('common.cancel') || 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: t('recovery.reset_confirm_button') || 'Reset',
                        style: 'destructive',
                        onPress: () => {
                          resetLocalData().catch(() => {
                            // If reset fails, show error
                            Alert.alert(
                              t('recovery.reset_error_title') || 'Reset failed',
                              t('recovery.reset_error_message') || 'Could not reset local data. Please try restarting the app manually.'
                            );
                          });
                        },
                      },
                    ]
                  );
                }}
                style={styles.recoveryButton}
              >
                {t('recovery.reset_data') || 'Reset local data'}
              </Button>
            </View>
          </View>
        </ThemedView>
      </View>
    );
  }

  // Show branded loading screen
  return (
    <View style={overlay ? styles.overlayContainer : styles.fullScreenContainer}>
      <LoadingScreen />
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
  recoveryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  recoveryContent: {
    maxWidth: 500,
    width: '100%',
    alignItems: 'center',
  },
  recoveryTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  recoveryBody: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.5,
    marginBottom: Spacing['2xl'],
  },
  recoveryButtons: {
    width: '100%',
    gap: Spacing.md,
  },
  recoveryButton: {
    width: '100%',
  },
});
