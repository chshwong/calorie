import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { FitbitConnectionPublic } from '@/utils/types';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** If omitted, defaults to web-only gating (Platform.OS === 'web'). */
  fitbitEnabled?: boolean;
  mode?: 'burned' | 'connectOnly';
  connection: FitbitConnectionPublic | null;
  isFetching?: boolean;
  isBusy?: boolean;
  onConnect: () => void | Promise<void>;
  /** Only used in burned mode; connectOnly hides sync actions entirely. */
  onSyncNow?: () => void | Promise<void>;
};

/**
 * UI-only Fitbit connect modal.
 * Must not import burned/weight hooks; it only calls callbacks provided by callers.
 */
export function FitbitConnectModal({
  visible,
  onClose,
  fitbitEnabled: fitbitEnabledProp,
  mode = 'burned',
  connection,
  isFetching,
  isBusy,
  onConnect,
  onSyncNow,
}: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const fitbitEnabled = fitbitEnabledProp ?? Platform.OS === 'web';
  const busy = Boolean(isBusy);

  const statusText = useMemo(() => {
    if (!fitbitEnabled) return t('burned.fitbit.web_only');
    if (!connection) return t('burned.fitbit.status.not_connected');
    if (connection.status === 'active') return t('burned.fitbit.status.connected');
    if (connection.status === 'error') return t('burned.fitbit.status.needs_attention');
    return t('burned.fitbit.status.other', { status: connection.status });
  }, [connection, fitbitEnabled, t]);

  const lastSyncText = useMemo(() => {
    if (!connection?.last_sync_at) return null;
    try {
      return new Date(connection.last_sync_at).toLocaleString();
    } catch {
      return connection.last_sync_at;
    }
  }, [connection?.last_sync_at]);

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
              {connection?.last_sync_at ? (
                <ThemedText style={[styles.subText, { color: colors.textSecondary }]}>
                  {t('burned.fitbit.status.last_sync', { at: lastSyncText ?? connection.last_sync_at })}
                </ThemedText>
              ) : null}
              {connection?.status === 'error' && connection.last_error_message ? (
                <ThemedText style={[styles.errorText, { color: colors.chartRed }]}>
                  {connection.last_error_message}
                </ThemedText>
              ) : null}
            </View>

            {fitbitEnabled && (busy || isFetching) ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.tint} />
                <ThemedText style={[styles.subText, { color: colors.textSecondary }]}>{t('common.loading')}</ThemedText>
              </View>
            ) : null}

            {fitbitEnabled && (
              <View style={styles.actionsCol}>
                {!connection ? (
                  <TouchableOpacity
                    onPress={onConnect}
                    disabled={busy}
                    activeOpacity={0.85}
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: colors.tint, opacity: busy ? 0.6 : 1 },
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
                    {mode === 'burned' && typeof onSyncNow === 'function' ? (
                      <TouchableOpacity
                        onPress={onSyncNow}
                        disabled={busy || connection.status !== 'active'}
                        activeOpacity={0.85}
                        style={[
                          styles.secondaryBtn,
                          {
                            backgroundColor: colors.backgroundSecondary,
                            borderColor: colors.border,
                            opacity: busy || connection.status !== 'active' ? 0.6 : 1,
                          },
                          Platform.OS === 'web' && getFocusStyle(colors.tint),
                        ]}
                        {...getButtonAccessibilityProps(t('burned.fitbit.actions.sync_now'))}
                      >
                        <ThemedText style={[styles.secondaryBtnText, { color: colors.text }]}>
                          {t('burned.fitbit.actions.sync_now')}
                        </ThemedText>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={connection.status === 'error' ? onConnect : onClose}
                      disabled={busy}
                      activeOpacity={0.85}
                      style={[
                        styles.secondaryBtn,
                        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: busy ? 0.6 : 1 },
                        Platform.OS === 'web' && getFocusStyle(colors.tint),
                      ]}
                      {...getButtonAccessibilityProps(
                        connection.status === 'error'
                          ? t('burned.fitbit.actions.reconnect')
                          : t('common.close')
                      )}
                    >
                      <ThemedText style={[styles.secondaryBtnText, { color: colors.text }]}>
                        {connection.status === 'error'
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

