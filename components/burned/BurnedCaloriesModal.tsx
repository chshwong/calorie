import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InlineEditableNumberChip } from '@/components/ui/InlineEditableNumberChip';
import { BURNED, RANGES } from '@/constants/constraints';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useResetDailySumBurned, useSaveDailySumBurned, useSaveWearableTotalBurned } from '@/hooks/use-burned-mutations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDailySumBurned } from '@/hooks/use-daily-sum-burned';
import { useFitbitConnectPopup } from '@/hooks/use-fitbit-connect-popup';
import { useDisconnectFitbit, useFitbitConnectionPublic } from '@/hooks/use-fitbit-connection';
import { useFitbitSyncOrchestrator } from '@/hooks/use-fitbit-sync-orchestrator';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { useUserConfig } from '@/hooks/use-user-config';
import { isWearableCaloriesEnabled } from '@/lib/domain/fitbit/isWearableCaloriesEnabled';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { getTodayKey, getYesterdayKey, toDateKey } from '@/utils/dateKey';

import FitbitLogo from '@/assets/images/fitbit_logo.svg';
import { BurnReductionModal } from '@/components/burned/BurnReductionModal';
import { FitbitConnectModal } from '@/components/burned/FitbitConnectModal';
import { FitbitConnectionCard } from '@/components/fitbit/FitbitConnectionCard';
import { FitbitSyncToggles } from '@/components/fitbit/FitbitSyncToggles';

type Props = {
  visible: boolean;
  onClose: () => void;
  entryDate: string; // YYYY-MM-DD
};

type Field = 'bmr' | 'active' | 'tdee';

export function BurnedCaloriesModal({ visible, onClose, entryDate }: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const logoChipBg = scheme === 'dark' ? Colors.light.card : colors.backgroundSecondary;
  const [centerToastText, setCenterToastText] = useState<string | null>(null);
  const centerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCenterToast = (msg: string) => {
    setCenterToastText(msg);
    if (centerToastTimerRef.current) clearTimeout(centerToastTimerRef.current);
    centerToastTimerRef.current = setTimeout(() => setCenterToastText(null), 2600);
  };

  const titleText = useMemo(() => {
    const key = toDateKey(entryDate);
    if (key === getTodayKey()) return t('burned.modal.title_today');
    if (key === getYesterdayKey()) return t('burned.modal.title_yesterday');
    return t('burned.modal.title_default');
  }, [entryDate, t]);

  // MUST call getOrCreate before rendering (spec) — enable only when visible.
  const { data: burnedRow, isLoading, isFetching, error, refetch: refetchBurned } = useDailySumBurned(entryDate, { enabled: visible });
  const saveMutation = useSaveDailySumBurned();
  const saveWearableMutation = useSaveWearableTotalBurned();
  const resetMutation = useResetDailySumBurned();

  const fitbitEnabled = Platform.OS === 'web';
  const {
    data: fitbitConn,
    isLoading: fitbitConnLoading,
    isFetching: fitbitConnFetching,
    refetch: refetchFitbitConn,
  } = useFitbitConnectionPublic({ enabled: fitbitEnabled && visible });
  const disconnectFitbit = useDisconnectFitbit();
  const connectFitbit = useFitbitConnectPopup();
  const fitbitOrchestrator = useFitbitSyncOrchestrator();
  const [fitbitSyncing, setFitbitSyncing] = useState(false);
  const [disconnectConfirmVisible, setDisconnectConfirmVisible] = useState(false);
  const { data: userConfig } = useUserConfig();
  const updateProfile = useUpdateProfile();
  const wearableCaloriesEnabled = isWearableCaloriesEnabled(userConfig);
  const wearableCaloriesMode = Boolean(fitbitEnabled && fitbitConn?.status === 'active' && wearableCaloriesEnabled);

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
    // Treat non-active as “not connected” for this lightweight card UI.
    return 'Not connected';
  }, [fitbitConn, fitbitEnabled]);

  const [systemDefaults, setSystemDefaults] = useState<{ bmr: number; active: number; tdee: number } | null>(null);
  const [bmrText, setBmrText] = useState('');
  const [activeText, setActiveText] = useState('');
  const [tdeeText, setTdeeText] = useState('');
  const [baseActivityText, setBaseActivityText] = useState('');
  const [hasUserEditedThisSession, setHasUserEditedThisSession] = useState(false);
  const [touched, setTouched] = useState({ bmr: false, active: false, tdee: false });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [didResetToSystem, setDidResetToSystem] = useState(false);
  const [fitbitModalVisible, setFitbitModalVisible] = useState(false);
  const [burnCorrectionModalVisible, setBurnCorrectionModalVisible] = useState(false);
  const [draftSyncActivityBurn, setDraftSyncActivityBurn] = useState(true);
  const [draftWeightProvider, setDraftWeightProvider] = useState<'none' | 'fitbit'>('none');
  const [draftSyncSteps, setDraftSyncSteps] = useState(false);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      prevVisibleRef.current = false;
      setTouched({ bmr: false, active: false, tdee: false });
      setValidationError(null);
      setDidResetToSystem(false);
      setSystemDefaults(null);
      setBaseActivityText('');
      setHasUserEditedThisSession(false);
      setFitbitModalVisible(false);
      setBurnCorrectionModalVisible(false);
      setDisconnectConfirmVisible(false);
      setCenterToastText(null);
      if (centerToastTimerRef.current) clearTimeout(centerToastTimerRef.current);
      return;
    }
    if (!prevVisibleRef.current) {
      prevVisibleRef.current = true;
      setDraftSyncActivityBurn(userConfig?.sync_activity_burn ?? true);
      setDraftWeightProvider(userConfig?.weight_sync_provider === 'fitbit' ? 'fitbit' : 'none');
      setDraftSyncSteps(userConfig?.exercise_sync_steps ?? false);
    }
    if (burnedRow) {
      // Capture system defaults once per row (stable for reset behavior).
      setSystemDefaults({
        bmr: burnedRow.system_bmr_cal,
        active: burnedRow.system_active_cal,
        tdee: burnedRow.system_tdee_cal,
      });

      const shouldHydrateFromRow =
        !hasUserEditedThisSession && !touched.bmr && !touched.active && !touched.tdee;

      if (shouldHydrateFromRow) {
        const base =
          typeof burnedRow.raw_burn === 'number'
            ? burnedRow.raw_burn
            : typeof burnedRow.active_cal === 'number'
              ? burnedRow.active_cal
              : typeof burnedRow.system_active_cal === 'number'
                ? burnedRow.system_active_cal
                : 0;
        const pct = burnedRow.burn_reduction_pct_int ?? 0;
        const f = 1 - pct / 100;
        const derivedActive = Math.round(base * f);
        const derivedTdee = Math.round(burnedRow.bmr_cal + derivedActive);

        setBaseActivityText(String(base));
        setBmrText(String(burnedRow.bmr_cal));
        setActiveText(String(derivedActive));
        setTdeeText(String(derivedTdee));
        setTouched({ bmr: false, active: false, tdee: false });
        setValidationError(null);
        setDidResetToSystem(false);
      }
    }
  }, [
    visible,
    userConfig?.sync_activity_burn,
    userConfig?.weight_sync_provider,
    userConfig?.exercise_sync_steps,
    burnedRow?.id,
    burnedRow?.updated_at,
    burnedRow?.bmr_cal,
    burnedRow?.active_cal,
    burnedRow?.tdee_cal,
    hasUserEditedThisSession,
    baseActivityText,
    touched.active,
    touched.bmr,
    touched.tdee,
  ]);

  useEffect(() => {
    return () => {
      if (centerToastTimerRef.current) clearTimeout(centerToastTimerRef.current);
    };
  }, []);

  const reductionPct = burnedRow?.burn_reduction_pct_int ?? 0;
  const reductionEnabled = reductionPct > 0;
  const factor = 1 - reductionPct / 100;

  const isBusy =
    isLoading ||
    isFetching ||
    saveMutation.isPending ||
    saveWearableMutation.isPending ||
    resetMutation.isPending ||
    fitbitSyncing ||
    disconnectFitbit.isPending ||
    updateProfile.isPending;

  const parsed = useMemo(() => {
    const bmr = parseInt(bmrText, 10);
    const active = parseInt(activeText, 10);
    const tdee = parseInt(tdeeText, 10);
    return { bmr, active, tdee };
  }, [bmrText, activeText, tdeeText]);

  const baseActivity = useMemo(() => {
    const n = parseFloat(baseActivityText);
    if (Number.isFinite(n)) return n;
    if (typeof burnedRow?.raw_burn === 'number' && Number.isFinite(burnedRow.raw_burn)) return burnedRow.raw_burn;
    if (typeof burnedRow?.active_cal === 'number' && Number.isFinite(burnedRow.active_cal)) return burnedRow.active_cal;
    if (typeof burnedRow?.system_active_cal === 'number' && Number.isFinite(burnedRow.system_active_cal)) return burnedRow.system_active_cal;
    return 0;
  }, [baseActivityText, burnedRow?.active_cal, burnedRow?.raw_burn, burnedRow?.system_active_cal]);

  const derivedFinalActive = useMemo(() => Math.round(baseActivity * factor), [baseActivity, factor]);
  const derivedFinalTdee = useMemo(() => {
    const bmrForCalc =
      Number.isFinite(parsed.bmr) ? parsed.bmr : typeof burnedRow?.bmr_cal === 'number' ? burnedRow.bmr_cal : 0;
    return Math.round(bmrForCalc + derivedFinalActive);
  }, [burnedRow?.bmr_cal, burnedRow?.id, derivedFinalActive, parsed.bmr]);

  // Keep displayed finals in sync with the underlying base activity + pct factor.
  useEffect(() => {
    if (!visible) return;
    if (!burnedRow) return;
    setActiveText(String(derivedFinalActive));
    setTdeeText(String(derivedFinalTdee));
    // NOTE: we intentionally do not touch baseActivityText here.
  }, [burnedRow?.id, derivedFinalActive, derivedFinalTdee, visible]);

  const candidateTdeeToSave = useMemo(() => {
    if (!burnedRow) return null;
    return derivedFinalTdee;
  }, [burnedRow?.id, derivedFinalTdee]);

  const isTooHighBurn =
    candidateTdeeToSave !== null && candidateTdeeToSave >= BURNED.TDEE_KCAL.MAX;

  const shouldWarnHighBurn =
    candidateTdeeToSave !== null &&
    candidateTdeeToSave >= BURNED.WARNING_KCAL &&
    candidateTdeeToSave < BURNED.TDEE_KCAL.MAX;

  const validate = (): 'ok' | 'no_changes' | 'error' => {
    if (!burnedRow) {
      setValidationError(t('burned.errors.save_failed'));
      return 'error';
    }

    if (!didResetToSystem && !touched.bmr && !touched.active && !touched.tdee) {
      // UX: saving with no changes should just close (no error message).
      setValidationError(null);
      return 'no_changes';
    }

    if (
      (touched.bmr && (!Number.isFinite(parsed.bmr) || parsed.bmr < RANGES.CALORIES_KCAL.MIN)) ||
      ((touched.active || touched.tdee) && (!Number.isFinite(baseActivity) || baseActivity < RANGES.CALORIES_KCAL.MIN))
    ) {
      setValidationError(t('burned.errors.invalid_number'));
      return 'error';
    }

    // Only validate against hard limit (>= 15000). Warning for 6000-14999 is non-blocking.
    if (candidateTdeeToSave !== null) {
      if (candidateTdeeToSave >= BURNED.TDEE_KCAL.MAX) {
        setValidationError(t('burned.errors.max_kcal'));
        return 'error';
      }
      // Check for invalid values (negative or non-finite)
      if (!Number.isFinite(candidateTdeeToSave) || candidateTdeeToSave < BURNED.TDEE_KCAL.MIN) {
        setValidationError(t('burned.errors.invalid_number'));
        return 'error';
      }
    }

    setValidationError(null);
    return 'ok';
  };

  const markTouched = (field: Field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setValidationError(null);
    setDidResetToSystem(false);
  };

  const handleResetLocal = () => {
    if (!systemDefaults) return;
    setBmrText(String(systemDefaults.bmr));
    setBaseActivityText(String(systemDefaults.active));
    // Mark touched so Save persists even if user tweaks after reset.
    setTouched({ bmr: true, active: true, tdee: true });
    setHasUserEditedThisSession(false);
    setDidResetToSystem(true);
    setValidationError(null);
    // IMPORTANT: no onClose(), no network calls.
  };

  const persistSave = async () => {
    if (!burnedRow) return;
    const v = validate();
    if (v === 'no_changes') {
      onClose();
      return;
    }
    if (v !== 'ok') return;

    // If user reset to system defaults (local) and hasn't changed them, persist via RESET service on Save.
    if (
      didResetToSystem &&
      systemDefaults &&
      Number.isFinite(parsed.bmr) &&
      Math.round(parsed.bmr) === systemDefaults.bmr &&
      Math.round(baseActivity) === systemDefaults.active &&
      Math.round(derivedFinalTdee) === systemDefaults.tdee
    ) {
      try {
        const result = await resetMutation.mutateAsync({ entryDate });
        if (result) {
          showAppToast(t('burned.toast.reset'));
          onClose();
        } else {
          setValidationError(t('burned.errors.save_failed'));
        }
      } catch {
        setValidationError(t('burned.errors.save_failed'));
      }
      return;
    }

    if (wearableCaloriesMode) {
      try {
        const tdeeToSave = derivedFinalTdee;
        const result = await saveWearableMutation.mutateAsync({
          entryDate,
          tdee_cal: tdeeToSave,
        });
        if (result) {
          showAppToast(t('burned.toast.saved'));
          onClose();
        } else {
          setValidationError(t('burned.errors.save_failed'));
        }
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (msg === 'BURNED_MAX_EXCEEDED') {
          setValidationError(t('burned.errors.max_kcal'));
        } else if (msg === 'BURNED_NEGATIVE_NOT_ALLOWED' || msg === 'BURNED_INVALID_NUMBER') {
          setValidationError(t('burned.errors.invalid_number'));
        } else if (msg === 'BURNED_REDUCTION_PCT_INVALID') {
          setValidationError(t('burned.errors.save_failed'));
        } else {
          setValidationError(t('burned.errors.save_failed'));
        }
      }
      return;
    }

    const bmrCal = Number.isFinite(parsed.bmr) ? Math.round(parsed.bmr) : burnedRow.bmr_cal;
    const rawToSave = baseActivity;

    // Keep payload consistent with what will be stored/derived.
    const nextFinalActive = Math.round(rawToSave * factor);
    const nextFinalTdee = Math.round(bmrCal + nextFinalActive);
    const values = {
      bmr_cal: bmrCal,
      active_cal: nextFinalActive,
      tdee_cal: nextFinalTdee,
    };

    try {
      const result = await saveMutation.mutateAsync({
        entryDate,
        touched,
        values,
        reduction: {
          burn_reduction_pct_int: reductionPct,
          raw_burn: rawToSave,
          raw_tdee: null,
          raw_burn_source: didResetToSystem ? 'system' : 'manual',
        },
      });

      if (result) {
        showAppToast(t('burned.toast.saved'));
        onClose();
      } else {
        setValidationError(t('burned.errors.save_failed'));
      }
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg === 'BURNED_TDEE_BELOW_BMR') {
        setValidationError(t('burned.errors.tdee_below_bmr'));
      } else if (msg === 'BURNED_MAX_EXCEEDED') {
        setValidationError(t('burned.errors.max_kcal'));
      } else if (msg === 'BURNED_NEGATIVE_NOT_ALLOWED' || msg === 'BURNED_INVALID_NUMBER') {
        setValidationError(t('burned.errors.invalid_number'));
      } else {
        setValidationError(t('burned.errors.save_failed'));
      }
    }
  };

  const fitbitDraftChanged =
    draftSyncActivityBurn !== (userConfig?.sync_activity_burn ?? true) ||
    draftWeightProvider !== (userConfig?.weight_sync_provider === 'fitbit' ? 'fitbit' : 'none') ||
    draftSyncSteps !== (userConfig?.exercise_sync_steps ?? false);

  const handleSave = async () => {
    if (!burnedRow) return;

    // UI guard: do not allow saving at/above the hard threshold (>= 15000); user must correct first.
    if (isTooHighBurn) return;

    if (fitbitDraftChanged) {
      const wasCaloriesOn = wearableCaloriesEnabled;
      const turningCaloriesOff = wasCaloriesOn && draftSyncActivityBurn === false;
      try {
        await updateProfile.mutateAsync({
          sync_activity_burn: draftSyncActivityBurn,
          weight_sync_provider: draftWeightProvider,
          exercise_sync_steps: draftSyncSteps,
        });
        showAppToast(t('burned.fitbit.toast.saved'));
        if (turningCaloriesOff) {
          // UX: when Calories is turned OFF, reset today back to system authoritative so estimate mode is consistent.
          const todayKey = getTodayKey();
          try {
            await resetMutation.mutateAsync({ entryDate: todayKey });
          } catch {
            // non-blocking: settings save succeeded; reset failure will self-heal next time user opens modal.
          }
          if (toDateKey(entryDate) === todayKey) {
            onClose();
            return;
          }
        }
      } catch {
        showAppToast(t('common.unexpected_error'));
        return;
      }
    }
    await persistSave();
  };

  const handleReset = async () => {
    // Deprecated: reset is now local only. Kept name for minimal diff.
    handleResetLocal();
  };

  // Debug UI removed.

  const handleSyncAndApply = async () => {
    if (!fitbitEnabled) return;
    if (fitbitConn?.status !== 'active') {
      setFitbitModalVisible(true);
      return;
    }
    try {
      setFitbitSyncing(true);
      const orch = await fitbitOrchestrator.syncFitbitAllNow({ dateKey: entryDate, includeBurnApply: true });
      const res = await refetchBurned();
      const row = res.data ?? null;
      if (row && !hasUserEditedThisSession && !touched.active && !touched.tdee) {
        const base =
          typeof row.raw_burn === 'number'
            ? row.raw_burn
            : typeof row.active_cal === 'number'
              ? row.active_cal
              : typeof row.system_active_cal === 'number'
                ? row.system_active_cal
                : 0;
        setBaseActivityText(String(base));
      }
      // Use in-modal toast so it's visible above the modal overlay.
      showCenterToast(t('burned.fitbit.toast.synced_applied'));
      if (orch.weightOk === false && orch.weightErrorCode === 'INSUFFICIENT_SCOPE') {
        showCenterToast(t('weight.settings.wearable.toast.reconnect_to_enable_weight_sync'));
      }
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg === 'RATE_LIMIT') {
        showCenterToast(t('burned.fitbit.errors.rate_limit_15m'));
      } else if (msg === 'MISSING_TOTAL_CALORIES' || msg === 'MISSING_ACTIVITY_CALORIES') {
        showCenterToast(t('burned.fitbit.errors.missing_activity_calories'));
      } else if (msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKENS') {
        showCenterToast(t('burned.fitbit.errors.reconnect_required'));
      } else {
        showCenterToast(t('burned.fitbit.toast.sync_failed'));
      }
    } finally {
      setFitbitSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!fitbitEnabled) return;
    if (disconnectFitbit.isPending) return;
    try {
      await disconnectFitbit.mutateAsync();
      setDisconnectConfirmVisible(false);
      // Ensure UI flips to disconnected state (Fitbit card / actions).
      try {
        await refetchFitbitConn();
      } catch {
        // ignore
      }
      const res = await refetchBurned();
      const row = res.data ?? null;
      if (row && !hasUserEditedThisSession && !touched.active && !touched.tdee) {
        const base =
          typeof row.raw_burn === 'number'
            ? row.raw_burn
            : typeof row.active_cal === 'number'
              ? row.active_cal
              : typeof row.system_active_cal === 'number'
                ? row.system_active_cal
                : 0;
        setBaseActivityText(String(base));
      }
      showCenterToast(t('burned.fitbit.toast.disconnected'));
    } catch {
      showCenterToast(t('burned.fitbit.toast.disconnect_failed'));
    }
  };

  const handleConnectFromModal = async () => {
    if (!fitbitEnabled) return;
    try {
      const res = await connectFitbit.mutateAsync();
      if (res.ok) {
        showCenterToast(t('burned.fitbit.toast.connected'));
        setFitbitModalVisible(false);
        await Promise.resolve(refetchBurned());
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
      showCenterToast(msg ?? res.message ?? t('burned.fitbit.toast.connect_failed'));
    } catch {
      showCenterToast(t('burned.fitbit.toast.connect_failed'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.separator }]}>
            <ThemedText style={[styles.title, { color: colors.text }]}>{titleText}</ThemedText>
            <TouchableOpacity
              style={[styles.iconBtn, getMinTouchTargetStyle(), Platform.OS === 'web' && getFocusStyle(colors.tint)]}
              onPress={onClose}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('common.close'))}
            >
              <IconSymbol name="xmark" size={18} color={colors.text} decorative />
            </TouchableOpacity>
          </View>

          <View style={[styles.banner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <ThemedText style={[styles.bannerText, { color: colors.textSecondary }]}>
              {t('burned.modal.estimated_banner')}
            </ThemedText>
          </View>

          {isBusy && !burnedRow ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.loading}>
              <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('burned.errors.load_failed')}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.bodyShell}>
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.bodyScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {wearableCaloriesMode ? (
                  <View style={[styles.wearableSourceRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <ThemedText style={[styles.wearableSourceText, { color: colors.textSecondary }]}>
                      {t('burned.fitbit.source_total_badge')}
                    </ThemedText>
                    {reductionEnabled ? (
                      <ThemedText style={[styles.wearableSourceSubtext, { color: colors.textSecondary }]}>
                        {t('burned.fitbit.correction_may_differ')}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.row}>
                <View style={styles.labelWrap}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('burned.fields.bmr')}</ThemedText>
                </View>
                <View style={styles.chipWrap}>
                  <InlineEditableNumberChip
                    value={Number.isFinite(parsed.bmr) ? parsed.bmr : null}
                    disabled
                    onCommit={() => {}}
                    placeholder={t('burned.fields.placeholder')}
                    unitSuffix={t('home.food_log.kcal')}
                    min={RANGES.CALORIES_KCAL.MIN}
                    allowNull={false}
                    colors={colors}
                    badgeBackgroundColor={colors.backgroundSecondary}
                    badgeBorderColor={colors.border}
                    badgeTextColor={colors.text}
                    badgeTextStyle={{ fontSize: FontSize.sm + 2, lineHeight: FontSize.sm + 20 }}
                    inputTextStyle={{ fontSize: FontSize.xs + 2, lineHeight: FontSize.xs + 20 }}
                    accessibilityLabel={t('burned.fields.bmr')}
                    inputWidth={64}
                    commitOnBlur
                  />
                </View>
              </View>

              <View style={[styles.row, styles.activityRowTight]}>
                <View style={styles.labelWrap}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('burned.fields.active')}</ThemedText>
                </View>
                <View style={styles.chipWrap}>
                  <View style={styles.chipEquationWrap}>
                    <View style={styles.operatorWrap} accessible={false}>
                      <ThemedText style={[styles.operatorText, { color: colors.textSecondary }]} accessible={false}>
                        +
                      </ThemedText>
                    </View>
                    <InlineEditableNumberChip
                      value={derivedFinalActive}
                      disabled={wearableCaloriesMode}
                      showEditIcon={!wearableCaloriesMode}
                      onCommit={(next) => {
                        if (wearableCaloriesMode) return;
                        const base = next ?? 0;
                        markTouched('active');
                        setHasUserEditedThisSession(true);
                        const bmr =
                          Number.isFinite(parsed.bmr) ? parsed.bmr : typeof burnedRow?.bmr_cal === 'number' ? burnedRow.bmr_cal : 0;
                        const nextFinalActive = Math.round(base * factor);
                        const nextFinalTdee = Math.round(bmr + nextFinalActive);
                        setBaseActivityText(String(base));
                        setActiveText(String(nextFinalActive));
                        setTdeeText(String(nextFinalTdee));
                      }}
                      placeholder={t('burned.fields.placeholder')}
                      unitSuffix={t('home.food_log.kcal')}
                      min={RANGES.CALORIES_KCAL.MIN}
                      allowNull={false}
                      colors={colors}
                      badgeBackgroundColor={colors.backgroundSecondary}
                      badgeBorderColor={colors.border}
                      badgeTextColor={colors.text}
                      badgeTextStyle={{ fontSize: FontSize.sm + 2, lineHeight: FontSize.sm + 20 }}
                      inputTextStyle={{ fontSize: FontSize.xs + 2, lineHeight: FontSize.xs + 20 }}
                      accessibilityLabel={t('burned.fields.active')}
                      inputWidth={64}
                      commitOnBlur
                    />
                  </View>
                </View>
              </View>

              {reductionEnabled && (
                <View style={[styles.burnCorrectionRow, styles.burnHintTight]}>
                  <ThemedText
                    style={[styles.helperText, styles.burnCorrectionText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {t('burned.burn_correction.applied_hint', { pct: reductionPct, base: Math.round(baseActivity) })}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setBurnCorrectionModalVisible(true)}
                    hitSlop={8}
                    disabled={isBusy}
                    activeOpacity={0.7}
                    style={Platform.OS === 'web' ? getFocusStyle(colors.tint) : undefined}
                    {...getButtonAccessibilityProps(t('burned.burn_correction.title'))}
                  >
                    <IconSymbol name="gearshape.fill" size={14} color={colors.textSecondary} decorative />
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.row, styles.tdeeRowTight]}>
                <View style={styles.labelWrap}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('burned.fields.tdee')}</ThemedText>
                </View>
                <View style={styles.chipWrap}>
                  <View style={styles.chipEquationWrap}>
                    <View style={styles.operatorWrap} accessible={false}>
                      <ThemedText style={[styles.operatorText, { color: colors.textSecondary }]} accessible={false}>
                        =
                      </ThemedText>
                    </View>
                    <InlineEditableNumberChip
                      value={derivedFinalTdee}
                      disabled={false}
                      showEditIcon
                      onCommit={(next) => {
                        const bmr =
                          Number.isFinite(parsed.bmr) ? parsed.bmr : typeof burnedRow?.bmr_cal === 'number' ? burnedRow.bmr_cal : 0;
                        const requestedTdee = next ?? 0;
                        const desiredTdee = Math.max(bmr, requestedTdee);
                        const desiredFinalActivity = Math.max(0, desiredTdee - bmr);
                        const base = desiredFinalActivity;
                        const nextFinalActive = Math.round(base * factor);
                        const nextFinalTdee = Math.round(bmr + nextFinalActive);

                        markTouched('tdee');
                        setHasUserEditedThisSession(true);
                        setBaseActivityText(String(base));
                        setActiveText(String(nextFinalActive));
                        setTdeeText(String(nextFinalTdee));
                      }}
                      placeholder={t('burned.fields.placeholder')}
                      unitSuffix={t('home.food_log.kcal')}
                      min={RANGES.CALORIES_KCAL.MIN}
                      allowNull={false}
                      colors={colors}
                      badgeBackgroundColor={colors.backgroundSecondary}
                      badgeBorderColor={colors.border}
                      badgeTextColor={colors.text}
                      badgeTextStyle={{ fontSize: FontSize.sm + 2, lineHeight: FontSize.sm + 20 }}
                      inputTextStyle={{ fontSize: FontSize.xs + 2, lineHeight: FontSize.xs + 20 }}
                      accessibilityLabel={t('burned.fields.tdee')}
                      inputWidth={64}
                      commitOnBlur
                    />
                  </View>
                </View>
              </View>

              {/* Wearable device card (web-only) */}
              {fitbitEnabled && (
                <>
                  <ThemedText style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                    {t('burned.modal.wearable_integration')}
                  </ThemedText>
                  <FitbitConnectionCard
                    layout="stacked"
                    statusLine={fitbitStatusLine ?? 'Not connected'}
                    connected={fitbitConn?.status === 'active'}
                    logo={<FitbitLogo width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />}
                    primaryAction={
                      fitbitConn?.status === 'active'
                        ? {
                            label: t('burned.fitbit.actions.sync_now'),
                            onPress: handleSyncAndApply,
                            disabled: isBusy,
                          }
                        : {
                            label: t('burned.fitbit.actions.connect'),
                            onPress: () => setFitbitModalVisible(true),
                            disabled: isBusy,
                          }
                    }
                    secondaryAction={
                      fitbitConn?.status === 'active'
                        ? {
                            label: t('burned.fitbit.actions.disconnect'),
                            onPress: () => setDisconnectConfirmVisible(true),
                            disabled: isBusy || disconnectConfirmVisible,
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
                      disabled={!fitbitEnabled || fitbitConn?.status !== 'active'}
                    />
                  </FitbitConnectionCard>
                </>
              )}

              {/* Advanced section */}
              <ThemedText style={[styles.sectionHeader, { color: colors.textSecondary }]}>Advanced</ThemedText>
              <TouchableOpacity
                onPress={() => setBurnCorrectionModalVisible(true)}
                disabled={isBusy}
                activeOpacity={0.85}
                style={[
                  styles.advancedRow,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: isBusy ? 0.7 : 1 },
                  Platform.OS === 'web' && getFocusStyle(colors.tint),
                ]}
                {...getButtonAccessibilityProps('Burn correction', 'Adjust how wearable burn is applied')}
              >
                <View style={styles.advancedRowText}>
                  <ThemedText style={[styles.advancedRowTitle, { color: colors.text }]}>
                    {t('burned.burn_correction.title')}
                  </ThemedText>
                  <ThemedText style={[styles.advancedRowSubtitle, { color: colors.textSecondary }]}>
                    {t('burned.burn_correction.row_subtitle')}
                  </ThemedText>
                </View>
                <View style={styles.advancedRowRight}>
                  {reductionEnabled ? (
                    <View style={[styles.statusPill, { backgroundColor: colors.tint + '20', borderColor: colors.tint }]}>
                      <ThemedText style={[styles.statusPillTextOn, { color: colors.tint }]}>
                        {t('burned.burn_correction.status.on_with_pct', { pct: reductionPct })}
                      </ThemedText>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
                      ]}
                    >
                      <ThemedText style={[styles.statusPillTextOff, { color: colors.textSecondary }]}>
                        {t('burned.burn_correction.status.off')}
                      </ThemedText>
                    </View>
                  )}
                  <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} decorative />
                </View>
              </TouchableOpacity>

              {!reductionEnabled && (
                <TouchableOpacity
                  onPress={handleReset}
                  disabled={isBusy}
                  activeOpacity={0.8}
                  style={[styles.resetLinkWrap, Platform.OS === 'web' && getFocusStyle(colors.info)]}
                  {...getButtonAccessibilityProps(t('burned.actions.reset_estimates'))}
                >
                  <ThemedText style={[styles.resetLinkText, { color: colors.info }]}>
                    {t('burned.actions.reset_estimates')}
                  </ThemedText>
                </TouchableOpacity>
              )}

              {shouldWarnHighBurn && (
                <View style={[styles.warnRow, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.warning} decorative />
                  <ThemedText style={[styles.warnText, { color: colors.warning }]}>
                    {t('burned.modal.high_value_warning')}
                  </ThemedText>
                </View>
              )}

              {isTooHighBurn && (
                <View style={[styles.warnRow, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error} decorative />
                  <ThemedText style={[styles.warnText, { color: colors.error }]}>
                    {t('burned.modal.too_high')}
                  </ThemedText>
                </View>
              )}

              {validationError && (
                <ThemedText style={[styles.errorText, { color: colors.chartRed }]}>{validationError}</ThemedText>
              )}

              {/* Debug card removed */}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.resetBtn,
                    { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  onPress={onClose}
                  disabled={isBusy}
                  activeOpacity={0.8}
                  {...getButtonAccessibilityProps(t('common.cancel'))}
                >
                  <ThemedText style={[styles.resetText, { color: colors.text }]}>{t('common.cancel')}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: colors.tint },
                    isTooHighBurn && { opacity: 0.45 },
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle('#fff'),
                  ]}
                  onPress={handleSave}
                  disabled={isBusy || isTooHighBurn}
                  activeOpacity={0.85}
                  {...getButtonAccessibilityProps(t('common.save'))}
                >
                  <ThemedText style={[styles.saveText, { color: colors.textInverse }]}>{t('common.save')}</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {centerToastText ? (
        <View style={styles.centerToastOverlay} pointerEvents="none">
          <View style={[styles.centerToastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText style={[styles.centerToastText, { color: colors.text }]}>{centerToastText}</ThemedText>
          </View>
        </View>
      ) : null}

      <FitbitConnectModal
        visible={fitbitModalVisible}
        onClose={() => setFitbitModalVisible(false)}
        mode="burned"
        fitbitEnabled={fitbitEnabled}
        connection={fitbitConn ?? null}
        isFetching={fitbitConnLoading || fitbitConnFetching}
        isBusy={connectFitbit.isPending}
        onConnect={handleConnectFromModal}
        onSyncNow={async () => {
          // Close the modal before syncing so in-modal errors don't get buried.
          setFitbitModalVisible(false);
          await handleSyncAndApply();
        }}
      />
      <BurnReductionModal
        visible={burnCorrectionModalVisible}
        onClose={() => setBurnCorrectionModalVisible(false)}
        entryDate={entryDate}
        burnedRow={burnedRow ?? null}
        refetchBurned={async () => {
          await refetchBurned();
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
        onConfirm={handleDisconnect}
        onCancel={() => {
          if (disconnectFitbit.isPending) return;
          setDisconnectConfirmVisible(false);
        }}
      />
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
  banner: {
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  loading: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  bodyShell: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  fitbitCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fitbitCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  fitbitLogoWrap: {
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logoChip: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitbitLogoBox: {
    height: 34,
    aspectRatio: 3.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitbitMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    alignItems: 'flex-start',
  },
  fitbitStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fitbitStatus: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  fitbitActionRow: {
    marginTop: Spacing.sm,
  },
  fitbitBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fitbitPrimaryBtn: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...getMinTouchTargetStyle(),
  },
  fitbitPrimaryBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  fitbitSecondaryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...getMinTouchTargetStyle(),
  },
  fitbitSecondaryBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: Spacing.xs,
    marginBottom: -Spacing.xs,
  },
  advancedRow: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    ...getMinTouchTargetStyle(),
  },
  advancedRowText: {
    flex: 1,
    minWidth: 0,
  },
  advancedRowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  advancedRowSubtitle: {
    fontSize: FontSize.xs - 1,
    fontWeight: '600',
    marginTop: 2,
  },
  advancedRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillTextOn: {
    fontSize: FontSize.xs - 1,
    fontWeight: '800',
  },
  statusPillTextOff: {
    fontSize: FontSize.xs - 1,
    fontWeight: '800',
  },
  resetLinkWrap: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
    ...getMinTouchTargetStyle(),
  },
  resetLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: -Spacing.xs,
  },
  warnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  wearableSourceRow: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  wearableSourceText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  wearableSourceSubtext: {
    fontSize: FontSize.xs - 1,
    fontWeight: '600',
  },
  advancedCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  advancedHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  advancedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  advancedTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  advancedTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  advancedHelper: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  advancedBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  fitbitHeaderRow: {
    marginTop: Spacing.xs,
  },
  fitbitStatusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginTop: -Spacing.xs,
  },
  fitbitErrorText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginTop: -Spacing.xs,
  },
  fitbitActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  smallBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...getMinTouchTargetStyle(),
  },
  smallBtnText: {
    fontSize: FontSize.xs + 1,
    fontWeight: '800',
  },
  advancedDivider: {
    borderTopWidth: 1,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sectionHeading: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: Spacing.xs,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  stepperBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    lineHeight: FontSize.lg + 2,
  },
  stepperValueWrap: {
    minWidth: 64,
    height: 34,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  stepperValueText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  labelWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '400',
  },
  helperText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  // Tighten spacing between Activity → hint → TDEE (without affecting other sections).
  activityRowTight: {
    marginBottom: -Spacing.sm,
  },
  burnHintTight: {
    marginTop: -Spacing.md + 3, // results in ~3px after parent gap
    marginBottom: -Spacing.md + 6, // results in ~6px before next row
  },
  burnCorrectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  burnCorrectionText: {
    flexShrink: 1,
  },
  tdeeRowTight: {
    marginTop: -Spacing.xs,
  },
  chipWrap: {
    width: '30%',
    minWidth: 110,
    alignItems: 'flex-end',
  },
  chipEquationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  operatorWrap: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorText: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md,
    fontWeight: '800',
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  debugCard: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    opacity: 0.7,
  },
  debugTitle: {
    fontSize: FontSize.xs - 1,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  debugLine: {
    fontSize: FontSize.xs - 1,
    marginTop: 2,
  },
  debugDivider: {
    fontSize: FontSize.xs - 1,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});


