import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useApplyRawToFinals } from '@/hooks/use-burned-mutations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFitbitConnectionPublic, useStartFitbitOAuth, useSyncFitbitNow } from '@/hooks/use-fitbit-connection';
import { getFitbitConnectionPublic } from '@/lib/services/fitbit/fitbitConnection';
import { openFitbitConnectPopup } from '@/lib/services/fitbit/openFitbitConnectPopup';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type Props = {
  visible: boolean;
  onClose: () => void;
  entryDate: string; // YYYY-MM-DD
  refetchBurned: () => void | Promise<void>;
};

const FUNCTIONS_ORIGIN = 'https://bnntatjspjtaxusruggl.functions.supabase.co';

export function FitbitConnectModal({ visible, onClose, entryDate, refetchBurned }: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const [centerToastText, setCenterToastText] = useState<string | null>(null);
  const centerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCenterToast = (msg: string) => {
    setCenterToastText(msg);
    if (centerToastTimerRef.current) clearTimeout(centerToastTimerRef.current);
    centerToastTimerRef.current = setTimeout(() => setCenterToastText(null), 2600);
  };
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const fitbitEnabled = Platform.OS === 'web';
  const { data: fitbitConn, isLoading, isFetching } = useFitbitConnectionPublic({ enabled: visible && fitbitEnabled });
  const startFitbit = useStartFitbitOAuth();
  const syncFitbit = useSyncFitbitNow();
  const applyFromRawMutation = useApplyRawToFinals();

  const isBusy =
    isLoading ||
    isFetching ||
    startFitbit.isPending ||
    syncFitbit.isPending ||
    applyFromRawMutation.isPending;

  const statusText = useMemo(() => {
    if (!fitbitEnabled) return t('burned.fitbit.web_only');
    if (!fitbitConn) return t('burned.fitbit.status.not_connected');
    if (fitbitConn.status === 'active') return t('burned.fitbit.status.connected');
    if (fitbitConn.status === 'error') return t('burned.fitbit.status.needs_attention');
    return t('burned.fitbit.status.other', { status: fitbitConn.status });
  }, [fitbitConn, fitbitEnabled, t]);

  const lastSyncText = useMemo(() => {
    if (!fitbitConn?.last_sync_at) return null;
    try {
      return new Date(fitbitConn.last_sync_at).toLocaleString();
    } catch {
      return fitbitConn.last_sync_at;
    }
  }, [fitbitConn?.last_sync_at]);

  const invalidateConnection = () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
  };

  const handleConnect = async () => {
    if (!fitbitEnabled) return;
    if (typeof window === 'undefined') return;
    try {
      const { authorizeUrl } = await startFitbit.mutateAsync();
      const result = await openFitbitConnectPopup(authorizeUrl, {
        functionsOrigin: FUNCTIONS_ORIGIN,
        pollConnected: async () => {
          if (!userId) return false;
          const row = await getFitbitConnectionPublic(userId);
          return row?.status === 'active';
        },
      });

      if (result.ok) {
        showAppToast(t('burned.fitbit.toast.connected'));
        invalidateConnection();
        await Promise.resolve(refetchBurned());
      } else {
        const msg =
          result.errorCode === 'popup_blocked'
            ? t('burned.fitbit.errors.popup_blocked')
            : result.errorCode === 'timeout'
              ? t('burned.fitbit.errors.popup_timeout')
              : result.errorCode === 'closed'
                ? t('burned.fitbit.errors.popup_closed')
                : null;
        showAppToast(msg ?? result.message ?? t('burned.fitbit.toast.connect_failed'));
      }
    } catch {
      showAppToast(t('burned.fitbit.toast.connect_failed'));
    }
  };

  const handleSyncNow = async () => {
    if (!fitbitEnabled) return;
    try {
      await syncFitbit.mutateAsync();
      invalidateConnection();
      await Promise.resolve(refetchBurned());
      await applyFromRawMutation.mutateAsync({ entryDate });
      await Promise.resolve(refetchBurned());
      showAppToast(t('burned.fitbit.toast.synced_applied'));
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg === 'RATE_LIMIT') {
        showCenterToast(t('burned.fitbit.errors.rate_limit_15m'));
      } else if (msg === 'MISSING_ACTIVITY_CALORIES') {
        showAppToast(t('burned.fitbit.errors.missing_activity_calories'));
      } else if (msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKENS') {
        showAppToast(t('burned.fitbit.errors.reconnect_required'));
      } else {
        showAppToast(t('burned.fitbit.toast.sync_failed'));
      }
    }
  };

  useEffect(() => {
    if (!visible) {
      setCenterToastText(null);
      if (centerToastTimerRef.current) clearTimeout(centerToastTimerRef.current);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (centerToastTimerRef.current) clearTimeout(centerToastTimerRef.current);
    };
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.separator }]}>
            <ThemedText style={[styles.title, { color: colors.text }]}>{t('burned.fitbit.title')}</ThemedText>
            <TouchableOpacity
              style={[styles.iconBtn, getMinTouchTargetStyle(), Platform.OS === 'web' && getFocusStyle(colors.tint)]}
              onPress={onClose}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('common.close'))}
            >
              <IconSymbol name="xmark" size={18} color={colors.text} decorative />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollContent} showsVerticalScrollIndicator={false}>
            {!fitbitEnabled ? (
              <View style={[styles.noteCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <ThemedText style={[styles.noteText, { color: colors.textSecondary }]}>
                  {t('burned.fitbit.web_only_detail')}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.statusBlock}>
              <ThemedText style={[styles.statusText, { color: colors.textSecondary }]}>{statusText}</ThemedText>
              {fitbitConn?.last_sync_at ? (
                <ThemedText style={[styles.subText, { color: colors.textSecondary }]}>
                  {t('burned.fitbit.status.last_sync', { at: lastSyncText ?? fitbitConn.last_sync_at })}
                </ThemedText>
              ) : null}
              {fitbitConn?.status === 'error' && fitbitConn.last_error_message ? (
                <ThemedText style={[styles.errorText, { color: colors.chartRed }]}>
                  {fitbitConn.last_error_message}
                </ThemedText>
              ) : null}
            </View>

            {fitbitEnabled && (isBusy || isFetching) ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.tint} />
                <ThemedText style={[styles.subText, { color: colors.textSecondary }]}>{t('common.loading')}</ThemedText>
              </View>
            ) : null}

            {fitbitEnabled && (
              <View style={styles.actionsCol}>
                {!fitbitConn ? (
                  <TouchableOpacity
                    onPress={handleConnect}
                    disabled={isBusy}
                    activeOpacity={0.85}
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: colors.tint, opacity: isBusy ? 0.6 : 1 },
                      Platform.OS === 'web' && getFocusStyle('#fff'),
                    ]}
                    {...getButtonAccessibilityProps(t('burned.fitbit.actions.connect'))}
                  >
                    <ThemedText style={[styles.primaryBtnText, { color: colors.textInverse }]}>
                      {t('burned.fitbit.actions.connect')}
                    </ThemedText>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={handleSyncNow}
                      disabled={isBusy || fitbitConn.status !== 'active'}
                      activeOpacity={0.85}
                      style={[
                        styles.secondaryBtn,
                        {
                          backgroundColor: colors.backgroundSecondary,
                          borderColor: colors.border,
                          opacity: isBusy || fitbitConn.status !== 'active' ? 0.6 : 1,
                        },
                        Platform.OS === 'web' && getFocusStyle(colors.tint),
                      ]}
                      {...getButtonAccessibilityProps(t('burned.fitbit.actions.sync_now'))}
                    >
                      <ThemedText style={[styles.secondaryBtnText, { color: colors.text }]}>
                        {t('burned.fitbit.actions.sync_now')}
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={fitbitConn.status === 'error' ? handleConnect : onClose}
                      disabled={isBusy}
                      activeOpacity={0.85}
                      style={[
                        styles.secondaryBtn,
                        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: isBusy ? 0.6 : 1 },
                        Platform.OS === 'web' && getFocusStyle(colors.tint),
                      ]}
                      {...getButtonAccessibilityProps(
                        fitbitConn.status === 'error'
                          ? t('burned.fitbit.actions.reconnect')
                          : t('common.close')
                      )}
                    >
                      <ThemedText style={[styles.secondaryBtnText, { color: colors.text }]}>
                        {fitbitConn.status === 'error'
                          ? t('burned.fitbit.actions.reconnect')
                          : t('common.close')}
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {centerToastText ? (
        <View style={styles.centerToastOverlay} pointerEvents="none">
          <View style={[styles.centerToastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText style={[styles.centerToastText, { color: colors.text }]}>{centerToastText}</ThemedText>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  centerToastOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerToastCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: 320,
  },
  centerToastText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  iconBtn: {
    padding: Spacing.xs,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  noteText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  statusBlock: {
    gap: 4,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  subText: {
    fontSize: FontSize.xs,
  },
  errorText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionsCol: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  secondaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});

