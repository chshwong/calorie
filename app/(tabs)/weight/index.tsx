import { WearableSyncSlot } from '@/components/burned/DailyBurnWearableSyncSlot';
import { FitbitConnectModal } from '@/components/burned/FitbitConnectModal';
import { FitbitConnectionCard } from '@/components/fitbit/FitbitConnectionCard';
import { FitbitSyncToggles } from '@/components/fitbit/FitbitSyncToggles';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ConfirmModal } from '@/components/ui';
import { showAppToast } from '@/components/ui/app-toast';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WeightChartCarousel } from '@/components/weight/WeightChartCarousel';
import { WeightSettingsModal } from '@/components/weight/WeightSettingsModal';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useClampedDateParam } from '@/hooks/use-clamped-date-param';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFitbitConnectPopup } from '@/hooks/use-fitbit-connect-popup';
import { useDisconnectFitbit, useFitbitConnectionQuery } from '@/hooks/use-fitbit-connection';
import { useFitbitSyncOrchestrator } from '@/hooks/use-fitbit-sync-orchestrator';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { useUserConfig } from '@/hooks/use-user-config';
import {
    getLatestBodyFatEntry,
    getLatestWeightEntry,
    useWeightLogs366d,
} from '@/hooks/use-weight-logs';
import { clampDateKey, dateKeyToLocalStartOfDay, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { deriveDailyLatestWeight } from '@/lib/derive/daily-latest-weight';
import { getButtonAccessibilityProps } from '@/utils/accessibility';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { getTodayKey, toDateKey } from '@/utils/dateKey';
import { getLocalDateKey } from '@/utils/dateTime';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import FitbitLogo from '@/assets/images/fitbit_logo.svg';
import { useResetDailySumBurned } from '@/hooks/use-burned-mutations';

export default function WeightHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, profile: authProfile } = useAuth();
  const todayLocal = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [selectedDate, setSelectedDate] = useState<Date>(todayLocal);
  const rawDate = params?.date;
  const hasDateParam = Array.isArray(rawDate) ? typeof rawDate[0] === 'string' : typeof rawDate === 'string';
  const { dateKey: routeDateKey } = useClampedDateParam({ paramKey: 'date', toastOnPreMin: false });

  // If we were navigated here with a ?date= param (e.g., from Day Weight back),
  // honor it once and display that day.
  // Note: the Weight home screen otherwise manages date locally and does not persist it to the URL.
  useEffect(() => {
    if (!hasDateParam) return;
    setSelectedDate(dateKeyToLocalStartOfDay(routeDateKey));
  }, [hasDateParam, routeDateKey]);
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  const effectiveProfile = userConfig || authProfile; // For avatar
  // Settings modal must own its own mutation instance (avoid cross-screen pending-state mismatch).
  const updateProfileForSettings = useUpdateProfile();
  const resetBurnedToday = useResetDailySumBurned();
  const [showMenu, setShowMenu] = useState(false);
  const [fitbitModalVisible, setFitbitModalVisible] = useState(false);
  const [disconnectConfirmVisible, setDisconnectConfirmVisible] = useState(false);
  const [isFitbitSyncing, setIsFitbitSyncing] = useState(false);
  const fitbitEnabled = Platform.OS === 'web';
  const fitbit = useFitbitConnectionQuery({ enabled: fitbitEnabled });
  const fitbitConn = fitbit.data ?? null;
  const fitbitConnLoading = fitbit.isLoading;
  const fitbitConnFetching = fitbit.isFetching;
  const disconnectFitbit = useDisconnectFitbit();
  const connectFitbit = useFitbitConnectPopup();
  const fitbitOrchestrator = useFitbitSyncOrchestrator();
  const weight366Query = useWeightLogs366d();
  const rawLogs = weight366Query.data ?? [];
  const dailyLatest = useMemo(() => deriveDailyLatestWeight(rawLogs), [rawLogs]);
  const isLoading = weight366Query.isLoading;
  const isFetching = weight366Query.isFetching;
  const todayKey = getLocalDateKey(todayLocal);
  const isToday = getLocalDateKey(selectedDate) === getLocalDateKey(todayLocal);
  const minDateKey = useMemo(() => {
    const signupAt = user?.created_at;
    if (!signupAt) return toDateKey(todayLocal);
    return getMinAllowedDateKeyFromSignupAt(signupAt);
  }, [todayLocal, user?.created_at]);
  const minDate = useMemo(() => dateKeyToLocalStartOfDay(minDateKey), [minDateKey]);
  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const canGoBack = selectedDateKey > minDateKey;

  const setSelectedDateClamped = (date: Date) => {
    const clampedKey = clampDateKey(toDateKey(date), minDateKey, toDateKey(todayLocal));
    setSelectedDate(dateKeyToLocalStartOfDay(clampedKey));
  };

  const unit: 'kg' | 'lbs' = profile?.weight_unit === 'kg' ? 'kg' : 'lbs';
  const weightSyncProvider: 'none' | 'fitbit' =
    profile?.weight_sync_provider === 'fitbit' ? 'fitbit' : 'none';
  const weightSyncEnabled = weightSyncProvider === 'fitbit';

  const [draftUnit, setDraftUnit] = useState<'lbs' | 'kg'>(unit);
  const [draftWeightProvider, setDraftWeightProvider] = useState<'none' | 'fitbit'>(weightSyncProvider);
  const [draftSyncActivityBurn, setDraftSyncActivityBurn] = useState<boolean>(userConfig?.sync_activity_burn ?? true);
  const [draftSyncSteps, setDraftSyncSteps] = useState<boolean>(userConfig?.exercise_sync_steps ?? false);

  useEffect(() => {
    if (!showMenu) return;
    setDraftUnit(unit);
    setDraftWeightProvider(weightSyncProvider);
    setDraftSyncActivityBurn(userConfig?.sync_activity_burn ?? true);
    setDraftSyncSteps(userConfig?.exercise_sync_steps ?? false);
  }, [showMenu, unit, weightSyncProvider, userConfig?.sync_activity_burn, userConfig?.exercise_sync_steps]);

  const hasDraftChanges =
    draftUnit !== unit ||
    draftWeightProvider !== weightSyncProvider ||
    draftSyncActivityBurn !== (userConfig?.sync_activity_burn ?? true) ||
    draftSyncSteps !== (userConfig?.exercise_sync_steps ?? false);

  const fitbitStatusLine = useMemo(() => {
    if (!fitbitEnabled) return null;
    if (!fitbitConn) return 'Not connected';
    const last = fitbitConn.last_sync_at;
    if (fitbitConn.status === 'active' && last) {
      let ts = last;
      try {
        ts = new Date(last).toLocaleString();
      } catch {
        // keep original
      }
      return `Connected • Last sync ${ts}`;
    }
    if (fitbitConn.status === 'active') return 'Connected';
    return 'Not connected';
  }, [fitbitConn, fitbitEnabled]);
  const latestEntry = weight366Query.data ? getLatestWeightEntry(weight366Query.data) : null;
  const latestBodyFatEntry = weight366Query.data ? getLatestBodyFatEntry(weight366Query.data) : null;
  const latestWeightValueLb = latestEntry?.weight_lb ?? null;
  const latestWeightDisplay =
    latestWeightValueLb !== null
      ? unit === 'kg'
        ? `${roundTo1(lbToKg(latestWeightValueLb)).toFixed(1)} kg`
        : `${roundTo1(latestWeightValueLb).toFixed(1)} lbs`
      : '—';
  const latestBodyFatDisplay =
    latestBodyFatEntry?.body_fat_percent !== null && latestBodyFatEntry?.body_fat_percent !== undefined
      ? `${roundTo1(latestBodyFatEntry.body_fat_percent).toFixed(1)}%`
      : '—';
  const latestTimestamp = latestEntry ? new Date(latestEntry.weighed_at) : null;

  const days = useMemo(() => {
    return deriveWeightHomeDaysFromLogs({
      rawLogs,
      selectedDate,
      rangeDays: 7,
      fetchWindowDays: 14,
      moduleStartMinDateKey: minDateKey,
      moduleStartUserCreatedAtISO: user?.created_at ?? null,
      todayLocal,
    });
  }, [minDateKey, rawLogs, selectedDate, todayLocal, user?.created_at]);

  const renderWeight = (weightLb: number | null) => {
    if (weightLb === null) return 'No data yet';
    const value = unit === 'kg' ? roundTo1(lbToKg(weightLb)) : roundTo1(weightLb);
    const displayUnit = unit === 'kg' ? 'kg' : 'lbs';
    return `${value.toFixed(1)} ${displayUnit}`;
  };

  // Format date for display (same logic as index.tsx)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const selectedDateNormalized = new Date(selectedDate);
  selectedDateNormalized.setHours(0, 0, 0, 0);
  const currentYear = todayDate.getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  const dateOptions: Intl.DateTimeFormatOptions = {
    ...(isToday || selectedDateNormalized.getTime() === yesterday.getTime() ? {} : { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  const dateText = isToday
    ? `${t('common.today')}, ${formattedDate}`
    : selectedDateNormalized.getTime() === yesterday.getTime()
    ? `${t('common.yesterday')}, ${formattedDate}`
    : formattedDate;

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <CollapsibleModuleHeader
        dateText={dateText}
        rightAvatarUri={effectiveProfile?.avatar_url ?? undefined}
        preferredName={effectiveProfile?.first_name ?? undefined}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <DatePickerButton
              selectedDate={selectedDate}
              onDateSelect={setSelectedDateClamped}
              today={todayLocal}
              minimumDate={minDate}
              maximumDate={todayLocal}
            />
            <TouchableOpacity
              style={styles.gearButton}
              onPress={() => setShowMenu((prev) => !prev)}
              activeOpacity={0.7}
              disabled={false}
            >
              <IconSymbol name="gearshape" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
        goBackOneDay={
          canGoBack
            ? () => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDateClamped(newDate);
              }
            : undefined
        }
        goForwardOneDay={() => {
          if (!isToday) {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            setSelectedDateClamped(newDate);
          }
        }}
        isToday={isToday}
        module="weight"
      >
        <DesktopPageContainer>
          <WeightChartCarousel
            dailyLatest={dailyLatest}
            selectedDate={selectedDate}
            todayLocal={todayLocal}
            unit={unit}
            headerRightSlot={
              fitbitEnabled && weightSyncEnabled && fitbit.isConnected ? (
                <WearableSyncSlot
                  isConnected={fitbit.isConnected}
                  lastSyncAt={fitbit.lastSyncAt}
                  onSync={async () => {
                    const res = await fitbitOrchestrator.syncFitbitAllNow({ includeBurnApply: false });
                    if (res.weightOk === false && res.weightErrorCode === 'INSUFFICIENT_SCOPE') {
                      showAppToast(t('weight.settings.wearable.toast.reconnect_to_enable_weight_sync'));
                    }
                  }}
                  willSyncWeight={userConfig?.weight_sync_provider === 'fitbit'}
                  willSyncSteps={userConfig?.exercise_sync_steps === true}
                />
              ) : null
            }
          />

            <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.tint} />
                </View>
              ) : (
                <View style={{ gap: Spacing.md }}>
                  {days.map((day) => {
                    const dateLabel = formatDateLabel(day.date, todayLocal);
                    const weightDisplay = renderWeight(day.weightLb);
                    const isCarried = day.carriedForward && day.weightLb !== null;
                    const weightColor = day.weightLb === null ? colors.textSecondary : isCarried ? colors.textSecondary : colors.text;
                    return (
                      <TouchableOpacity
                        key={day.date}
                        style={[styles.row, { borderBottomColor: colors.border }]}
                        onPress={() => {
                        if (day.hasEntry && day.entryId) {
                          router.push({
                            pathname: '/weight/entry',
                            params: {
                              date: day.date,
                              weightLb: day.weightLb?.toString() ?? '',
                              bodyFatPercent:
                                day.bodyFatPercent !== null && day.bodyFatPercent !== undefined
                                  ? day.bodyFatPercent.toString()
                                  : '',
                              entryId: day.entryId,
                              weighedAt: day.weighedAt ?? '',
                            },
                          });
                        } else if (day.carriedForward && day.date !== todayKey) {
                          router.push({
                            pathname: '/weight/entry',
                            params: {
                              mode: 'add_for_date',
                              date: day.date,
                            },
                          });
                        } else {
                          router.push({
                            pathname: '/weight/entry',
                            params: { mode: 'add_today' },
                          });
                        }
                        }}
                      >
                        <View style={{ gap: Spacing.xs }}>
                          <ThemedText style={{ color: colors.text, fontWeight: '600' }}>
                            {dateLabel}
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                            {day.entryCount > 1 && (
                              <TouchableOpacity
                                style={[styles.multiEntryClue, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                                onPress={(e: any) => {
                                  e?.stopPropagation?.();
                                  router.push({
                                    pathname: '/weight/day',
                                    params: { date: day.date, fromDate: selectedDateKey },
                                  });
                                }}
                                onPressIn={(e: any) => {
                                  e?.stopPropagation?.();
                                }}
                                activeOpacity={0.8}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700' }}>
                                  {'📚'} {day.entryCount}
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                            <ThemedText style={{ color: weightColor, fontSize: FontSize.lg, fontWeight: FontWeight.semibold }}>
                              {weightDisplay}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm, textAlign: 'right' }}>
                            {day.bodyFatPercent !== null && day.bodyFatPercent !== undefined
                              ? t('weight.body_fat', { value: roundTo1(day.bodyFatPercent).toFixed(1) })
                              : '—'}
                          </ThemedText>
                          {isCarried && (
                            <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.xs }}>
                              carried forward
                            </ThemedText>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Spacer so the last row can scroll above the floating action button */}
            <View style={{ height: Layout.bottomTabBarHeight + Spacing.md }} />
        </DesktopPageContainer>
      </CollapsibleModuleHeader>

      {/* Floating action button: Log weigh */}
      <View pointerEvents="box-none" style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: colors.tint, opacity: isFetching ? 0.95 : 1 }]}
          onPress={() => router.push('/weight/entry')}
          disabled={isFetching || isLoading}
          activeOpacity={0.85}
          {...getButtonAccessibilityProps(t('weight.fab.log_weight_a11y'))}
        >
          <ThemedText style={[styles.fabButtonText, { color: colors.textInverse }]}>
            {t('weight.fab.log_weight')}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <WeightSettingsModal
        visible={showMenu}
        title={t('weight.settings.title')}
        onClose={() => {
          setShowMenu(false);
          setDisconnectConfirmVisible(false);
        }}
        onSave={async () => {
          if (updateProfileForSettings.isPending) return;
          const wasCaloriesOn = (userConfig?.sync_activity_burn ?? true) !== false;
          const turningCaloriesOff = wasCaloriesOn && draftSyncActivityBurn === false;
          const updates: Record<string, unknown> = {};
          if (draftUnit !== unit) updates.weight_unit = draftUnit;
          if (draftWeightProvider !== weightSyncProvider) updates.weight_sync_provider = draftWeightProvider;
          if (draftSyncActivityBurn !== (userConfig?.sync_activity_burn ?? true)) updates.sync_activity_burn = draftSyncActivityBurn;
          if (draftSyncSteps !== (userConfig?.exercise_sync_steps ?? false)) updates.exercise_sync_steps = draftSyncSteps;
          if (Object.keys(updates).length === 0) {
            setShowMenu(false);
            return;
          }
          try {
            await updateProfileForSettings.mutateAsync(updates);
            if (turningCaloriesOff) {
              try {
                await resetBurnedToday.mutateAsync({ entryDate: getTodayKey() });
              } catch {
                // non-blocking; settings save should still succeed
              }
            }
            setShowMenu(false);
          } catch {
            showAppToast(t('common.unexpected_error'));
          }
        }}
        isSaving={updateProfileForSettings.isPending}
        disableSave={!hasDraftChanges}
      >
        <ThemedText style={[styles.sectionHeader, { color: colors.textSecondary }]}>Weight unit</ThemedText>
        <View style={styles.menuOptions}>
          {(['lbs', 'kg'] as const).map((opt) => {
            const isActive = draftUnit === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.menuOption,
                  isActive && { backgroundColor: colors.tint + '15', borderColor: colors.tint },
                ]}
                onPress={() => setDraftUnit(opt)}
                activeOpacity={0.8}
              >
                <ThemedText style={{ color: colors.text }}>
                  {opt === 'lbs' ? 'lbs' : 'kg'}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

        <ThemedText style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          {t('weight.settings.wearable.title')}
        </ThemedText>

        {!fitbitEnabled ? (
          <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('weight.settings.wearable.web_only')}
          </ThemedText>
        ) : (
          <>
            <FitbitConnectionCard
              layout="stacked"
              statusLine={fitbitStatusLine ?? 'Not connected'}
              connected={fitbitConn?.status === 'active'}
              logo={<FitbitLogo width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />}
              primaryAction={
                fitbitConn?.status === 'active'
                  ? {
                      label: t('weight.settings.wearable.actions.sync_weight'),
                      onPress: async () => {
                        if (fitbitConn?.status !== 'active') {
                          setFitbitModalVisible(true);
                          return;
                        }
                        setIsFitbitSyncing(true);
                        try {
                          const res = await fitbitOrchestrator.syncFitbitAllNow({ includeBurnApply: false });
                          if (res.weightOk === false) {
                            showAppToast(t('weight.settings.wearable.toast.reconnect_to_enable_weight_sync'));
                            setFitbitModalVisible(true);
                          } else {
                            showAppToast(t('weight.settings.wearable.toast.weight_updated'));
                          }
                        } catch (e: any) {
                          const msg = String(e?.message ?? '');
                          if (msg === 'INSUFFICIENT_SCOPE') {
                            showAppToast(t('weight.settings.wearable.toast.reconnect_to_enable_weight_sync'));
                            setFitbitModalVisible(true);
                          } else if (msg === 'RATE_LIMIT') {
                            showAppToast(t('burned.fitbit.errors.rate_limit_15m'));
                          } else if (msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKENS') {
                            showAppToast(t('burned.fitbit.errors.reconnect_required'));
                            setFitbitModalVisible(true);
                          } else {
                            showAppToast(t('burned.fitbit.toast.sync_failed'));
                          }
                        } finally {
                          setIsFitbitSyncing(false);
                        }
                      },
                      disabled: isFitbitSyncing,
                      loading: isFitbitSyncing,
                    }
                  : {
                      label: t('weight.settings.wearable.actions.connect'),
                      onPress: () => setFitbitModalVisible(true),
                      disabled: connectFitbit.isPending,
                    }
              }
              secondaryAction={
                fitbitConn?.status === 'active'
                  ? {
                      label: t('burned.fitbit.actions.disconnect'),
                      onPress: () => setDisconnectConfirmVisible(true),
                      disabled: disconnectFitbit.isPending || disconnectConfirmVisible,
                    }
                  : null
              }
              secondaryActionVariant="tertiary"
            >
              <FitbitSyncToggles
                value={{
                  activityBurn: draftSyncActivityBurn,
                  weight: draftWeightProvider === 'fitbit',
                  steps: draftSyncSteps,
                }}
                onChange={(patch) => {
                  if (patch.activityBurn !== undefined) setDraftSyncActivityBurn(patch.activityBurn);
                  if (patch.weight !== undefined) setDraftWeightProvider(patch.weight ? 'fitbit' : 'none');
                  if (patch.steps !== undefined) setDraftSyncSteps(patch.steps);
                }}
                disabled={fitbitConn?.status !== 'active'}
              />
            </FitbitConnectionCard>

            {fitbitEnabled && (fitbitConnLoading || fitbitConnFetching) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <ActivityIndicator size="small" color={colors.tint} />
                <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.xs }}>
                  {t('common.loading')}
                </ThemedText>
              </View>
            ) : null}
          </>
        )}
      </WeightSettingsModal>

      <FitbitConnectModal
        visible={fitbitModalVisible}
        onClose={() => setFitbitModalVisible(false)}
        mode="connectOnly"
        fitbitEnabled={fitbitEnabled}
        connection={fitbitConn ?? null}
        isFetching={fitbitConnLoading || fitbitConnFetching}
        isBusy={connectFitbit.isPending}
        onConnect={async () => {
          try {
            const res = await connectFitbit.mutateAsync();
            if (res.ok) {
              showAppToast(t('burned.fitbit.toast.connected'));
              setFitbitModalVisible(false);
              return;
            }
            const msg =
              res.errorCode === 'popup_blocked'
                ? t('burned.fitbit.errors.popup_blocked')
                : res.errorCode === 'timeout'
                  ? t('burned.fitbit.errors.popup_timeout')
                  : res.errorCode === 'closed'
                    ? t('burned.fitbit.errors.popup_closed')
                    : null;
            showAppToast(msg ?? res.message ?? t('burned.fitbit.toast.connect_failed'));
          } catch {
            showAppToast(t('burned.fitbit.toast.connect_failed'));
          }
        }}
      />

      <ConfirmModal
        visible={disconnectConfirmVisible}
        title={t('burned.fitbit.confirm_disconnect.title')}
        message={t('burned.fitbit.confirm_disconnect.message')}
        confirmText={t('burned.fitbit.actions.disconnect')}
        cancelText={t('common.cancel')}
        confirmButtonStyle={{ backgroundColor: colors.error }}
        confirmDisabled={disconnectFitbit.isPending}
        onConfirm={async () => {
          if (disconnectFitbit.isPending) return;
          try {
            await disconnectFitbit.mutateAsync();
            showAppToast(t('burned.fitbit.toast.disconnected'));
            setDisconnectConfirmVisible(false);
            setFitbitModalVisible(false);
          } catch {
            showAppToast(t('burned.fitbit.toast.disconnect_failed'));
          }
        }}
        onCancel={() => {
          if (disconnectFitbit.isPending) return;
          setDisconnectConfirmVisible(false);
        }}
      />
    </ThemedView>
  );
}

function formatDateLabel(dateStr: string, today: Date) {
  const date = new Date(`${dateStr}T00:00:00`);
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayCopy);
  yesterday.setDate(yesterday.getDate() - 1);

  const baseLabel = normalized.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (normalized.getTime() === todayCopy.getTime()) {
    return `Today · ${baseLabel}`;
  }
  if (normalized.getTime() === yesterday.getTime()) {
    return `Yesterday · ${baseLabel}`;
  }
  return baseLabel;
}

type WeightDay = {
  entryId: string | null;
  date: string;
  weightLb: number | null;
  bodyFatPercent: number | null;
  weighedAt?: string | null;
  carriedForward: boolean;
  hasEntry: boolean;
  entryCount: number;
};

function deriveWeightHomeDaysFromLogs(input: {
  rawLogs: Array<{ id: string; weighed_at: string; weight_lb: number; body_fat_percent: number | null }>;
  selectedDate: Date;
  rangeDays: number;
  fetchWindowDays: number;
  moduleStartMinDateKey: string;
  moduleStartUserCreatedAtISO: string | null;
  todayLocal: Date;
}): WeightDay[] {
  const { rawLogs, selectedDate, rangeDays, fetchWindowDays, moduleStartMinDateKey, moduleStartUserCreatedAtISO, todayLocal } = input;

  const today = new Date(selectedDate);
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (fetchWindowDays - 1));
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  // Filter logs to the same window the previous implementation fetched from the DB (14d minimum).
  const windowLogs = rawLogs.filter((log) => {
    const ms = new Date(log.weighed_at).getTime();
    return ms >= startDate.getTime() && ms <= endDate.getTime();
  });

  // Count entries per local day (for multi-entry indicator + day view)
  const countByDate = new Map<string, number>();
  windowLogs.forEach((log) => {
    const key = getLocalDateKey(new Date(log.weighed_at));
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  });

  // Map latest entry per day
  const latestByDate = new Map<string, (typeof windowLogs)[number]>();
  windowLogs.forEach((log) => {
    const key = getLocalDateKey(new Date(log.weighed_at));
    const existing = latestByDate.get(key);
    if (!existing || new Date(log.weighed_at).getTime() > new Date(existing.weighed_at).getTime()) {
      latestByDate.set(key, log);
    }
  });

  // Determine module start day for filtering/carry-forward:
  // - If the account was created within our 366d fetch window, the earliest log we have is also the earliest possible log.
  // - Otherwise, use the min allowed date key (signup clamp) so we don't incorrectly hide days for long-time users with older logs.
  const startOfFetch = new Date(todayLocal);
  startOfFetch.setDate(startOfFetch.getDate() - 365);
  startOfFetch.setHours(0, 0, 0, 0);
  const createdAtMs = moduleStartUserCreatedAtISO ? new Date(moduleStartUserCreatedAtISO).getTime() : null;
  const canTrustWindowAsFullHistory = createdAtMs !== null && createdAtMs >= startOfFetch.getTime();
  const earliestLogKey = rawLogs.length > 0 ? getLocalDateKey(new Date(rawLogs[0].weighed_at)) : null;
  const firstEntryDateKey = canTrustWindowAsFullHistory && earliestLogKey ? earliestLogKey : moduleStartMinDateKey;

  // Build date list ascending to compute carry-forward correctly
  const allDateKeys: string[] = [];
  for (let i = 0; i < fetchWindowDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    allDateKeys.push(getLocalDateKey(d));
  }

  let lastKnownWeight: number | null = null;
  const timeline: WeightDay[] = allDateKeys.map((dateKey) => {
    const entry = latestByDate.get(dateKey);
    const hasEntry = !!entry;
    const weightFromEntry = entry?.weight_lb ?? null;
    const bodyFatFromEntry = entry?.body_fat_percent ?? null;
    const entryId = entry?.id ?? null;
    const entryCount = countByDate.get(dateKey) ?? 0;

    if (hasEntry && weightFromEntry !== null) {
      lastKnownWeight = weightFromEntry;
    }

    const shouldCarryForward = !hasEntry && lastKnownWeight !== null && dateKey >= firstEntryDateKey;

    return {
      date: dateKey,
      entryId,
      weightLb: hasEntry ? weightFromEntry : shouldCarryForward ? lastKnownWeight : null,
      bodyFatPercent: hasEntry ? bodyFatFromEntry : null,
      weighedAt: entry?.weighed_at ?? null,
      carriedForward: shouldCarryForward && !hasEntry,
      hasEntry,
      entryCount,
    };
  });

  const windowDays = timeline.slice(-rangeDays).reverse(); // Today first

  // Hide days before the first-ever weigh-in day (module start day).
  // NOTE: Without an extra DB call, we cannot know whether a long-time user has weight logs older than the 366d window.
  // This strategy avoids incorrectly hiding days for those users while still hiding pre-first-entry days for new accounts.
  if (canTrustWindowAsFullHistory && earliestLogKey) {
    return windowDays.filter((d) => d.date >= earliestLogKey);
  }

  return windowDays;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    ...Platform.select({
      web: { minHeight: '100%' },
    }),
  },
  scrollContent: {
    width: '100%',
    paddingTop: Spacing.none, // 0px - minimal gap between logo and greeting
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    ...(Platform.OS !== 'web' && {
      paddingBottom: 100, // match home mobile bottom padding
    }),
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding on web/desktop
    }),
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  chartWrap: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2000,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.none,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  multiEntryClue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  fabContainer: {
    position: 'absolute',
    right: Layout.screenPadding,
    bottom: Layout.bottomTabBarHeight + Spacing.md,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
  fabButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  gearButton: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '90%',
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  sectionHeader: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: Spacing.xs,
    marginBottom: -Spacing.xs,
  },
  menuTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  menuOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  menuOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: Spacing.sm,
  },
  helperText: {
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs + 4,
  },
  menuActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    flex: 1,
  },
});


