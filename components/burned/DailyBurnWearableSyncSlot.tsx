import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps } from '@/utils/accessibility';

type Props = {
  isConnected: boolean;
  lastSyncAt?: string | null;
  onSync: () => Promise<void>;
};

const SUCCESS_RESET_MS = 1200;

export function DailyBurnWearableSyncSlot({ isConnected, onSync }: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const isMountedRef = useRef(true);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const linkColor = useMemo(() => `${colors.chartOrange}B3`, [colors.chartOrange]);

  const label = status === 'syncing'
    ? '↻ Syncing…'
    : status === 'success'
      ? t('wearable_updated_label')
      : t('wearable_sync_label');

  const handleErrorToast = (error: unknown) => {
    const msg = String((error as { message?: string })?.message ?? '');
    if (msg === 'RATE_LIMIT') {
      showAppToast(t('burned.fitbit.errors.rate_limit_15m'));
    } else if (msg === 'MISSING_ACTIVITY_CALORIES') {
      showAppToast(t('burned.fitbit.errors.missing_activity_calories'));
    } else if (msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKENS') {
      showAppToast(t('burned.fitbit.errors.reconnect_required'));
    } else {
      showAppToast(t('burned.fitbit.toast.sync_failed'));
    }
  };

  const handleSync = async () => {
    if (status === 'syncing') return;
    setStatus('syncing');
    try {
      await onSync();
      if (!isMountedRef.current) return;
      setStatus('success');
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setStatus('idle');
      }, SUCCESS_RESET_MS);
    } catch (error) {
      if (isMountedRef.current) setStatus('idle');
      handleErrorToast(error);
    }
  };

  return (
    <View style={styles.slotContainer}>
      {isConnected ? (
        <Pressable
          style={[
            styles.link,
            status === 'syncing' ? styles.linkDisabled : null,
            Platform.OS === 'web' ? ({ cursor: status === 'syncing' ? 'default' : 'pointer' } as any) : null,
          ]}
          onPress={handleSync}
          disabled={status === 'syncing'}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          {...getButtonAccessibilityProps(t('wearable_sync_label'), undefined, status === 'syncing')}
        >
          <ThemedText style={[styles.linkText, { color: linkColor }]} numberOfLines={1}>
            {label}
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText style={[styles.placeholderText, { color: colors.textMuted }]} numberOfLines={1}>
          {t('wearable_none_short')}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slotContainer: {
    minHeight: 26,
    justifyContent: 'center',
    paddingTop: Spacing.xxs,
  },
  link: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  linkDisabled: {
    opacity: 0.6,
  },
  linkText: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.1,
  },
  placeholderText: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: FontWeight.medium,
  },
});
