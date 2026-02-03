import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import { Colors, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { getButtonAccessibilityProps } from '@/utils/accessibility';

type Props = {
  isConnected: boolean;
  lastSyncAt?: string | null;
  onSync: () => Promise<void>;
  /** 'full' = default slot; 'compact' = smaller for inline (e.g. Steps row). */
  variant?: 'full' | 'compact';
  /** When set, used for phase rotation (same logic as orchestrator). Fallback: userConfig. */
  willSyncWeight?: boolean;
  willSyncSteps?: boolean;
};

const SUCCESS_RESET_MS = 1200;
const PHASE_INTERVAL_MS = 2000;

export function DailyBurnWearableSyncSlot({
  isConnected,
  onSync,
  variant = 'full',
  willSyncWeight,
  willSyncSteps,
}: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const { data: userConfig } = useUserConfig();
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [syncPhaseLabel, setSyncPhaseLabel] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIndexRef = useRef(0);

  const syncWeight = willSyncWeight ?? (userConfig?.weight_sync_provider === 'fitbit');
  const syncSteps = willSyncSteps ?? (userConfig?.exercise_sync_steps === true);
  const phases = useMemo(() => {
    const list: { key: string; label: string }[] = [
      { key: 'burn', label: t('wearable_sync_phase_burn') },
      ...(syncWeight ? [{ key: 'weight', label: t('wearable_sync_phase_weight') }] : []),
      ...(syncSteps ? [{ key: 'steps', label: t('wearable_sync_phase_steps') }] : []),
    ];
    return list;
  }, [t, syncWeight, syncSteps]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (phaseIntervalRef.current) clearInterval(phaseIntervalRef.current);
    };
  }, []);

  // Light mode: solid darker salmon for contrast on white; dark mode: tint with slight transparency.
  const linkColor = useMemo(
    () => (scheme === 'light' ? colors.tint : `${colors.tint}B3`),
    [scheme, colors.tint],
  );

  const label =
    status === 'syncing'
      ? (syncPhaseLabel ?? t('wearable_syncing_label'))
      : status === 'success'
        ? t('wearable_updated_label')
        : t('wearable_sync_label');

  const handleErrorToast = (error: unknown) => {
    const msg = String((error as { message?: string })?.message ?? '');
    if (msg === 'RATE_LIMIT') {
      showAppToast(t('burned.fitbit.errors.rate_limit_15m'));
    } else if (msg === 'MISSING_TOTAL_CALORIES' || msg === 'MISSING_ACTIVITY_CALORIES') {
      showAppToast(t('burned.fitbit.errors.missing_activity_calories'));
    } else if (msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKENS') {
      showAppToast(t('burned.fitbit.errors.reconnect_required'));
    } else {
      showAppToast(t('burned.fitbit.toast.sync_failed'));
    }
  };

  const stopPhaseRotation = () => {
    if (phaseIntervalRef.current) {
      clearInterval(phaseIntervalRef.current);
      phaseIntervalRef.current = null;
    }
    setSyncPhaseLabel(null);
  };

  const handleSync = async () => {
    if (status === 'syncing') return;
    stopPhaseRotation();
    setStatus('syncing');
    phaseIndexRef.current = 0;
    setSyncPhaseLabel(phases[0]?.label ?? t('wearable_syncing_label'));
    if (phases.length > 1) {
      phaseIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        const next = (phaseIndexRef.current + 1) % phases.length;
        phaseIndexRef.current = next;
        setSyncPhaseLabel(phases[next].label);
      }, PHASE_INTERVAL_MS);
    }
    try {
      await onSync();
      if (!isMountedRef.current) return;
      stopPhaseRotation();
      setStatus('success');
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setStatus('idle');
      }, SUCCESS_RESET_MS);
    } catch (error) {
      if (isMountedRef.current) {
        stopPhaseRotation();
        setStatus('idle');
      }
      handleErrorToast(error);
    }
  };

  const isCompact = variant === 'compact';

  return (
    <View style={[styles.slotContainer, isCompact && styles.slotContainerCompact]}>
      {isConnected ? (
        <Pressable
          style={[
            styles.link,
            isCompact && styles.linkCompact,
            status === 'syncing' ? styles.linkDisabled : null,
            Platform.OS === 'web' ? ({ cursor: status === 'syncing' ? 'default' : 'pointer' } as any) : null,
          ]}
          onPress={handleSync}
          disabled={status === 'syncing'}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          {...getButtonAccessibilityProps(t('wearable_sync_label'), undefined, status === 'syncing')}
        >
          <ThemedText
            style={[styles.linkText, isCompact && styles.linkTextCompact, { color: linkColor }]}
            numberOfLines={1}
          >
            {label}
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText
          style={[
            styles.placeholderText,
            isCompact && styles.placeholderTextCompact,
            { color: colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {t('wearable_none_short')}
        </ThemedText>
      )}
    </View>
  );
}

// Generic alias (preferred for reuse outside Daily Burn).
// Keep the DailyBurnWearableSyncSlot export to avoid churn.
export const WearableSyncSlot = DailyBurnWearableSyncSlot;

const styles = StyleSheet.create({
  slotContainer: {
    minHeight: 0,
    justifyContent: 'center',
    paddingTop: 0,
  },
  slotContainerCompact: {
    paddingVertical: 0,
  },
  link: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  linkCompact: {
    paddingVertical: 0,
  },
  linkDisabled: {
    opacity: 0.6,
  },
  linkText: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.1,
  },
  linkTextCompact: {
    fontSize: Platform.select({ web: FontSize.xs, default: FontSize.xs }),
  },
  placeholderText: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: FontWeight.medium,
  },
  placeholderTextCompact: {
    fontSize: Platform.select({ web: FontSize.xs, default: FontSize.xs }),
  },
});
