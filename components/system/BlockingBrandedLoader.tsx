import { hardReloadNow } from '@/lib/hardReload';
import LoadingScreen from '@/app/(minimal)/loading-screen';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

type Props = {
  enabled: boolean;
  timeoutMs?: number;
};

const WEB_GUARD_KEY = 'avovibe_hard_reload_once';

// Native has no sessionStorage; use an in-memory flag (per runtime / app session).
let nativeReloadedOnce = false;

function getHasReloadedOnce(): boolean {
  if (Platform.OS === 'web') {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(WEB_GUARD_KEY) === '1';
    } catch {
      return false;
    }
  }
  return nativeReloadedOnce;
}

function setHasReloadedOnce(value: boolean) {
  if (Platform.OS === 'web') {
    try {
      if (typeof sessionStorage === 'undefined') return;
      if (value) sessionStorage.setItem(WEB_GUARD_KEY, '1');
      else sessionStorage.removeItem(WEB_GUARD_KEY);
    } catch {
      // ignore
    }
    return;
  }

  nativeReloadedOnce = value;
}

/**
 * A global, blocking, branded loader with a 5s watchdog.
 *
 * - Reuses existing branded `LoadingScreen`.
 * - After timeoutMs, performs a one-shot hard reload per incident.
 * - If already auto-reloaded once, shows a manual "Reload App" button (no auto loop).
 *
 * Note: This component is safe to mount/unmount; unmount clears guard (end of incident).
 */
export function BlockingBrandedLoader({ enabled, timeoutMs = 5000 }: Props) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didTriggerReloadRef = useRef(false);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const hasReloadedOnce = getHasReloadedOnce();

  useEffect(() => {
    // End-of-incident behavior
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      didTriggerReloadRef.current = false;
      setHasReloadedOnce(false);
      return;
    }

    // enabled=true: start watchdog
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!getHasReloadedOnce()) {
        setHasReloadedOnce(true);
        didTriggerReloadRef.current = true;
        hardReloadNow();
      }
    }, timeoutMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, timeoutMs]);

  // If this component unmounts without having triggered a reload, treat it as
  // the end of the incident and clear the guard so future incidents can auto-recover.
  useEffect(() => {
    return () => {
      if (!didTriggerReloadRef.current) {
        setHasReloadedOnce(false);
      }
    };
  }, []);

  if (!enabled) return null;

  // If we've already auto-reloaded once for this incident, never auto-loop.
  // Show manual reload affordance immediately.
  const showManualReload = hasReloadedOnce;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <LoadingScreen />

      {showManualReload ? (
        <View style={styles.manualReload}>
          <Pressable
            onPress={hardReloadNow}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.reloadButton,
              {
                backgroundColor: colors.tint,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.reloadButtonText, { color: colors.textInverse }]}>
              Reload App
            </ThemedText>
          </Pressable>

          <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>
            If you keep seeing this screen, your connection or session may be stuck.
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
  },
  manualReload: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing['4xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  reloadButton: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 520,
    opacity: 0.85,
  },
});


