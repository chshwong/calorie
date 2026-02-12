import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    fetchFounderCurrentUsage,
    fetchFounderDailyGrowth,
    fetchFounderErrorsRecent,
    fetchFounderErrorsSummary,
    fetchFounderGrowthMomentum,
    fetchFounderNewUsersSummary,
    fetchFounderSettings,
    fetchFounderSystemHealth,
    fetchPlatformLimits,
    isFounder,
    saveFounderSettings,
    type FounderDailyGrowthRow,
    type FounderErrorsSummary,
    type FounderGrowthMomentum,
    type FounderRecentError,
    type FounderSystemHealth,
} from '@/lib/services/founderAnalytics';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type FounderMetricsState = {
  summary: { new_today: number; new_7d: number; new_30d: number } | null;
  growth: FounderDailyGrowthRow[];
  errorsSummary: FounderErrorsSummary | null;
  growthMomentum: FounderGrowthMomentum | null;
  systemHealth: FounderSystemHealth | null;
  recentErrors: FounderRecentError[];
  dbBytes: number;
  storageBytes: number;
  supabaseLimits: Record<string, number>;
  vercelLimits: Record<string, number>;
};

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

function bytesLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.round(bytes)} B`;
}

function percent(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

function formatTime(value?: string | null): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return date.toLocaleString();
}

function avgDailyNetUsers(rows: FounderDailyGrowthRow[], lookbackDays = 7): number | null {
  if (!rows.length) return null;
  const recent = rows.slice(-Math.max(2, lookbackDays));
  if (recent.length < 2) return null;
  const total = recent.reduce((sum, row) => sum + row.new_users - row.deleted_users, 0);
  return total > 0 ? total / recent.length : null;
}

function SimpleBars({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.chartBars}>
      {values.map((v, idx) => (
        <View key={idx} style={styles.chartBarWrap}>
          <View
            style={[
              styles.chartBar,
              {
                backgroundColor: color,
                height: `${Math.max(8, (v / max) * 100)}%`,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export default function FounderPage() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [newUserAlertsEnabled, setNewUserAlertsEnabled] = useState(false);
  const [errorAlertsEnabled, setErrorAlertsEnabled] = useState(true);
  const [errorThresholdInput, setErrorThresholdInput] = useState('10');
  const [state, setState] = useState<FounderMetricsState>({
    summary: null,
    growth: [],
    errorsSummary: null,
    growthMomentum: null,
    systemHealth: null,
    recentErrors: [],
    dbBytes: 0,
    storageBytes: 0,
    supabaseLimits: {},
    vercelLimits: {},
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const founder = await isFounder();
      if (!founder) {
        setAuthorized(false);
        router.replace('/');
        return;
      }

      setAuthorized(true);

      const [
        summary,
        growth,
        usage,
        settings,
        limits,
        errorsSummary,
        growthMomentum,
        systemHealth,
        recentErrors,
      ] = await Promise.all([
        fetchFounderNewUsersSummary(),
        fetchFounderDailyGrowth(60),
        fetchFounderCurrentUsage(),
        fetchFounderSettings(),
        fetchPlatformLimits(),
        fetchFounderErrorsSummary(),
        fetchFounderGrowthMomentum(),
        fetchFounderSystemHealth(),
        fetchFounderErrorsRecent(20),
      ]);

      const supabaseLimits = limits.find((l) => l.platform === 'supabase')?.limits ?? {};
      const vercelLimits = limits.find((l) => l.platform === 'vercel')?.limits ?? {};

      setState({
        summary,
        growth,
        errorsSummary,
        growthMomentum,
        systemHealth,
        recentErrors,
        dbBytes: usage?.db_bytes ?? 0,
        storageBytes: usage?.storage_bytes ?? 0,
        supabaseLimits,
        vercelLimits,
      });
      setWebhookInput(settings?.slack_webhook_url ?? '');
      setNewUserAlertsEnabled(settings?.slack_new_user_alerts_enabled === true);
      setErrorAlertsEnabled(settings?.slack_error_alerts_enabled !== false);
      setErrorThresholdInput(String(settings?.error_spike_threshold_per_hour ?? 10));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const delete7d = useMemo(
    () => state.growth.slice(-7).reduce((sum, row) => sum + row.deleted_users, 0),
    [state.growth]
  );

  const newSeries = useMemo(() => state.growth.map((row) => row.new_users), [state.growth]);
  const deleteSeries = useMemo(() => state.growth.map((row) => row.deleted_users), [state.growth]);

  const dbLimit = Number(state.supabaseLimits.database_size_bytes ?? 0);
  const storageLimit = Number(state.supabaseLimits.storage_size_bytes ?? 0);
  const dbPercent = percent(state.dbBytes, dbLimit);
  const storagePercent = percent(state.storageBytes, storageLimit);

  const avgNetUsersPerDay = avgDailyNetUsers(state.growth, 7);
  const totalUsersEstimate = Math.max(
    1,
    state.growth.length ? state.growth[state.growth.length - 1].cumulative_users : 0
  );
  const dbBytesPerUser = totalUsersEstimate > 0 ? state.dbBytes / totalUsersEstimate : 0;
  const storageBytesPerUser = totalUsersEstimate > 0 ? state.storageBytes / totalUsersEstimate : 0;
  const dbDailyGrowth = avgNetUsersPerDay && dbBytesPerUser > 0 ? avgNetUsersPerDay * dbBytesPerUser : null;
  const storageDailyGrowth =
    avgNetUsersPerDay && storageBytesPerUser > 0 ? avgNetUsersPerDay * storageBytesPerUser : null;
  const dbRunwayDays =
    dbDailyGrowth && dbLimit > 0 ? Math.floor((dbLimit - state.dbBytes) / Math.max(dbDailyGrowth, 1)) : null;
  const storageRunwayDays =
    storageDailyGrowth && storageLimit > 0
      ? Math.floor((storageLimit - state.storageBytes) / Math.max(storageDailyGrowth, 1))
      : null;
  const momentumPct = state.growthMomentum?.pct_change_7d;
  const momentumLabel =
    momentumPct == null ? 'vs prev 7d: N/A' : `vs prev 7d: ${momentumPct >= 0 ? '+' : ''}${momentumPct.toFixed(1)}%`;

  const saveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      const threshold = Number.parseInt(errorThresholdInput, 10);
      const ok = await saveFounderSettings({
        slackWebhookUrl: webhookInput.trim() || null,
        slackNewUserAlertsEnabled: newUserAlertsEnabled,
        slackErrorAlertsEnabled: errorAlertsEnabled,
        errorSpikeThresholdPerHour: Number.isFinite(threshold) ? threshold : 10,
      });
      if (!ok) {
        Alert.alert('Save failed', 'Unable to save founder settings.');
        return;
      }
      Alert.alert('Saved', 'Founder settings updated.');
      await loadData();
    } finally {
      setSavingSettings(false);
    }
  }, [errorAlertsEnabled, errorThresholdInput, loadData, newUserAlertsEnabled, webhookInput]);

  const handleBack = useCallback(() => {
    const canGoBackViaRouter =
      typeof (router as any).canGoBack === 'function' && Boolean((router as any).canGoBack());

    if (canGoBackViaRouter) {
      router.back();
      return;
    }

    const canGoBackWeb =
      typeof window !== 'undefined' &&
      typeof window.history !== 'undefined' &&
      window.history.length > 1;

    if (canGoBackWeb) {
      router.back();
      return;
    }

    router.replace('/settings');
  }, [router]);

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!authorized) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Not authorized.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          onPress={handleBack}
          {...getButtonAccessibilityProps('Go back', 'Double tap to return to settings')}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText type="title">Founder</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <View style={[styles.card, { borderColor: colors.separator }]}>
            <ThemedText style={styles.metricLabel}>New Users Today</ThemedText>
            <ThemedText type="title">{state.summary?.new_today ?? 0}</ThemedText>
          </View>
          <View style={[styles.card, { borderColor: colors.separator }]}>
            <ThemedText style={styles.metricLabel}>New Users 7d</ThemedText>
            <ThemedText type="title">{state.summary?.new_7d ?? 0}</ThemedText>
            <ThemedText style={[styles.metricSub, { color: colors.textSecondary }]}>{momentumLabel}</ThemedText>
          </View>
          <View style={[styles.card, { borderColor: colors.separator }]}>
            <ThemedText style={styles.metricLabel}>New Users 30d</ThemedText>
            <ThemedText type="title">{state.summary?.new_30d ?? 0}</ThemedText>
          </View>
          <View style={[styles.card, { borderColor: colors.separator }]}>
            <ThemedText style={styles.metricLabel}>Deletes 7d</ThemedText>
            <ThemedText type="title">{delete7d}</ThemedText>
          </View>
          <View style={[styles.card, { borderColor: colors.separator }]}>
            <ThemedText style={styles.metricLabel}>Errors 24h</ThemedText>
            <ThemedText type="title">{state.errorsSummary?.errors_24h ?? 0}</ThemedText>
            <ThemedText style={[styles.metricSub, { color: colors.textSecondary }]}>
              1h: {state.errorsSummary?.errors_1h ?? 0}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.section, { borderColor: colors.separator }]}>
          <ThemedText type="subtitle">System Health</ThemedText>
          <ThemedText style={styles.lineText}>
            Last digest day: {state.systemHealth?.last_digest_sent_for_day ?? 'never'}
          </ThemedText>
          <ThemedText style={styles.lineText}>
            Slack last success: {formatTime(state.systemHealth?.slack_last_success_at)}
          </ThemedText>
          <ThemedText style={styles.lineText}>
            Slack last transport error: {formatTime(state.systemHealth?.slack_last_transport_error_at)}
          </ThemedText>
          <ThemedText style={styles.lineText}>
            Slack last spike alert: {formatTime(state.systemHealth?.slack_last_spike_alert_at)}
          </ThemedText>
          <ThemedText style={styles.lineText}>Errors 1h: {state.systemHealth?.errors_1h ?? 0}</ThemedText>
          <ThemedText style={styles.lineText}>DB usage: {dbPercent.toFixed(1)}%</ThemedText>
          <ThemedText style={styles.lineText}>Storage usage: {storagePercent.toFixed(1)}%</ThemedText>
        </View>

        <View style={[styles.section, { borderColor: colors.separator }]}>
          <ThemedText type="subtitle">Daily New Users (60d)</ThemedText>
          <SimpleBars values={newSeries} color={colors.tint} />
        </View>

        <View style={[styles.section, { borderColor: colors.separator }]}>
          <ThemedText type="subtitle">Daily Deletes (60d)</ThemedText>
          <SimpleBars values={deleteSeries} color="#ef4444" />
        </View>

        <View style={[styles.section, { borderColor: colors.separator }]}>
          <ThemedText type="subtitle">Free-tier Watchdog</ThemedText>
          <ThemedText style={styles.lineText}>
            Supabase DB: {bytesLabel(state.dbBytes)} / {bytesLabel(dbLimit)} ({dbPercent.toFixed(1)}%)
          </ThemedText>
          <ThemedText style={styles.lineText}>
            Supabase Storage: {bytesLabel(state.storageBytes)} / {bytesLabel(storageLimit)} ({storagePercent.toFixed(1)}%)
          </ThemedText>
          <ThemedText style={styles.lineText}>
            DB runway: {dbRunwayDays != null && Number.isFinite(dbRunwayDays) && dbRunwayDays >= 0 ? `${dbRunwayDays} days` : 'N/A'}
          </ThemedText>
          <ThemedText style={styles.lineText}>
            Storage runway: {storageRunwayDays != null && Number.isFinite(storageRunwayDays) && storageRunwayDays >= 0 ? `${storageRunwayDays} days` : 'N/A'}
          </ThemedText>
          <ThemedText style={[styles.note, { color: colors.textSecondary }]}>
            Vercel limits (static): data transfer {bytesLabel(Number(state.vercelLimits.fast_data_transfer_bytes ?? 0))}, edge requests {Number(state.vercelLimits.edge_requests_monthly ?? 0).toLocaleString()}, invocations {Number(state.vercelLimits.function_invocations ?? 0).toLocaleString()}.
          </ThemedText>
          <ThemedText style={[styles.note, { color: colors.textSecondary }]}>
            Vercel/Supabase egress and function quotas must also be checked in provider dashboards.
          </ThemedText>
        </View>

        <View style={[styles.section, { borderColor: colors.separator }]}>
          <ThemedText type="subtitle">Recent Errors</ThemedText>
          {state.recentErrors.length === 0 ? (
            <ThemedText style={[styles.note, { color: colors.textSecondary }]}>No recent errors.</ThemedText>
          ) : (
            state.recentErrors.slice(0, 20).map((err, idx) => (
              <View key={`${err.created_at}-${idx}`} style={[styles.errorRow, { borderBottomColor: colors.separator }]}>
                <ThemedText style={styles.errorText}>
                  {new Date(err.created_at).toLocaleTimeString()} • {err.error_type} • {err.message.length > 120 ? `${err.message.slice(0, 120)}...` : err.message}
                </ThemedText>
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, { borderColor: colors.separator }]}>
          <ThemedText type="subtitle">Slack + Alert Settings</ThemedText>
          <ThemedText style={[styles.note, { color: colors.textSecondary }]}>Slack Webhook URL</ThemedText>
          <TextInput
            value={webhookInput}
            onChangeText={setWebhookInput}
            placeholder="https://hooks.slack.com/services/..."
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                borderColor: colors.separator,
                color: colors.text,
              },
            ]}
          />
          <View style={styles.toggleRow}>
            <ThemedText style={styles.lineText}>Enable instant new user alerts</ThemedText>
            <Switch
              value={newUserAlertsEnabled}
              onValueChange={setNewUserAlertsEnabled}
              trackColor={{ false: colors.border, true: `${colors.tint}66` }}
              thumbColor={newUserAlertsEnabled ? colors.tint : colors.textMuted}
            />
          </View>
          <View style={styles.toggleRow}>
            <ThemedText style={styles.lineText}>Enable error spike alerts</ThemedText>
            <Switch
              value={errorAlertsEnabled}
              onValueChange={setErrorAlertsEnabled}
              trackColor={{ false: colors.border, true: `${colors.tint}66` }}
              thumbColor={errorAlertsEnabled ? colors.tint : colors.textMuted}
            />
          </View>
          <ThemedText style={[styles.note, { color: colors.textSecondary }]}>
            Error spike threshold per hour
          </ThemedText>
          <TextInput
            value={errorThresholdInput}
            onChangeText={setErrorThresholdInput}
            placeholder="10"
            keyboardType="number-pad"
            style={[
              styles.input,
              {
                borderColor: colors.separator,
                color: colors.text,
              },
            ]}
          />
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.tint }]}
            onPress={() => void saveSettings()}
            disabled={savingSettings}
          >
            <ThemedText style={styles.saveButtonText}>{savingSettings ? 'Saving...' : 'Save Settings'}</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 8,
  },
  metricSub: {
    fontSize: 11,
    marginTop: 4,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 110,
    marginTop: 8,
  },
  chartBarWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 8,
  },
  lineText: {
    fontSize: 14,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  errorRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
