import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InlineEditableNumberChip } from '@/components/ui/InlineEditableNumberChip';
import { BURNED, RANGES } from '@/constants/constraints';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useResetDailySumBurned, useSaveDailySumBurned } from '@/hooks/use-burned-mutations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDailySumBurned } from '@/hooks/use-daily-sum-burned';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { getTodayKey, getYesterdayKey, toDateKey } from '@/utils/dateKey';
import { validateBurnedTdeeKcal } from '@/utils/validation';

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

  const titleText = useMemo(() => {
    const key = toDateKey(entryDate);
    if (key === getTodayKey()) return t('burned.modal.title_today');
    if (key === getYesterdayKey()) return t('burned.modal.title_yesterday');
    return t('burned.modal.title_default');
  }, [entryDate, t]);

  // MUST call getOrCreate before rendering (spec) — enable only when visible.
  const { data: burnedRow, isLoading, isFetching, error } = useDailySumBurned(entryDate, { enabled: visible });
  const saveMutation = useSaveDailySumBurned();
  const resetMutation = useResetDailySumBurned();

  const [systemDefaults, setSystemDefaults] = useState<{ bmr: number; active: number; tdee: number } | null>(null);
  const [bmrText, setBmrText] = useState('');
  const [activeText, setActiveText] = useState('');
  const [tdeeText, setTdeeText] = useState('');
  const [touched, setTouched] = useState({ bmr: false, active: false, tdee: false });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [didResetToSystem, setDidResetToSystem] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTouched({ bmr: false, active: false, tdee: false });
      setValidationError(null);
      setDidResetToSystem(false);
      setSystemDefaults(null);
      return;
    }
    if (burnedRow) {
      // Capture system defaults once per row (stable for reset behavior).
      setSystemDefaults({
        bmr: burnedRow.system_bmr_cal,
        active: burnedRow.system_active_cal,
        tdee: burnedRow.system_tdee_cal,
      });
      setBmrText(String(burnedRow.bmr_cal));
      setActiveText(String(burnedRow.active_cal));
      setTdeeText(String(burnedRow.tdee_cal));
      setTouched({ bmr: false, active: false, tdee: false });
      setValidationError(null);
      setDidResetToSystem(false);
    }
  }, [visible, burnedRow?.id]);

  const isBusy = isLoading || isFetching || saveMutation.isPending || resetMutation.isPending;

  const parsed = useMemo(() => {
    const bmr = parseInt(bmrText, 10);
    const active = parseInt(activeText, 10);
    const tdee = parseInt(tdeeText, 10);
    return { bmr, active, tdee };
  }, [bmrText, activeText, tdeeText]);

  const candidateTdeeToSave = useMemo(() => {
    if (!burnedRow) return null;
    const bmr = Number.isFinite(parsed.bmr) ? parsed.bmr : burnedRow.bmr_cal;
    const active = Number.isFinite(parsed.active) ? parsed.active : burnedRow.active_cal;
    // Spec invariant: tdee = bmr + active when saving manual overrides via this modal UI.
    return bmr + active;
  }, [burnedRow?.id, parsed.bmr, parsed.active]);

  const isTooHighBurn =
    candidateTdeeToSave !== null && candidateTdeeToSave >= BURNED.TDEE_KCAL.MAX;

  const shouldWarnHighBurn =
    candidateTdeeToSave !== null &&
    candidateTdeeToSave >= BURNED.WARNING_KCAL &&
    candidateTdeeToSave < BURNED.TDEE_KCAL.MAX;

  const validate = (): boolean => {
    if (!didResetToSystem && !touched.bmr && !touched.active && !touched.tdee) {
      setValidationError(t('burned.errors.no_changes'));
      return false;
    }

    if (
      (touched.bmr && (!Number.isFinite(parsed.bmr) || parsed.bmr < RANGES.CALORIES_KCAL.MIN)) ||
      (touched.active && (!Number.isFinite(parsed.active) || parsed.active < RANGES.CALORIES_KCAL.MIN)) ||
      (touched.tdee && (!Number.isFinite(parsed.tdee) || parsed.tdee < RANGES.CALORIES_KCAL.MIN))
    ) {
      setValidationError(t('burned.errors.invalid_number'));
      return false;
    }

    if (touched.tdee && burnedRow && Number.isFinite(parsed.tdee) && parsed.tdee < burnedRow.system_bmr_cal) {
      setValidationError(t('burned.errors.tdee_below_bmr'));
      return false;
    }

    if (candidateTdeeToSave !== null) {
      const res = validateBurnedTdeeKcal(candidateTdeeToSave);
      if (!res.valid) {
        setValidationError(t(res.errorKey ?? 'burned.errors.save_failed'));
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  const markTouched = (field: Field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setValidationError(null);
    setDidResetToSystem(false);
  };

  const handleResetLocal = () => {
    if (!systemDefaults) return;
    setBmrText(String(systemDefaults.bmr));
    setActiveText(String(systemDefaults.active));
    setTdeeText(String(systemDefaults.tdee));
    setTouched({ bmr: false, active: false, tdee: false });
    setDidResetToSystem(true);
    setValidationError(null);
    // IMPORTANT: no onClose(), no network calls.
  };

  const persistSave = async () => {
    if (!burnedRow) return;
    if (!validate()) return;

    // If user reset to system defaults (local) and hasn't changed them, persist via RESET service on Save.
    if (
      didResetToSystem &&
      systemDefaults &&
      Number.isFinite(parsed.bmr) &&
      Number.isFinite(parsed.active) &&
      Number.isFinite(parsed.tdee) &&
      parsed.bmr === systemDefaults.bmr &&
      parsed.active === systemDefaults.active &&
      parsed.tdee === systemDefaults.tdee
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

    const values = {
      bmr_cal: Number.isFinite(parsed.bmr) ? parsed.bmr : burnedRow.bmr_cal,
      active_cal: Number.isFinite(parsed.active) ? parsed.active : burnedRow.active_cal,
      tdee_cal: Number.isFinite(parsed.tdee) ? parsed.tdee : burnedRow.tdee_cal,
    };

    try {
      const result = await saveMutation.mutateAsync({
        entryDate,
        touched,
        values,
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

  const handleSave = async () => {
    if (!burnedRow) return;

    // UI guard: do not allow saving at/above the hard threshold; user must correct first.
    if (isTooHighBurn) return;

    const isManualSaveAttempt = touched.bmr || touched.active || touched.tdee;
    if (isManualSaveAttempt && shouldWarnHighBurn) {
      Alert.alert(t('burned.warning.title'), t('burned.warning.body'), [
        { text: t('burned.warning.cancel'), style: 'cancel' },
        { text: t('burned.warning.save_anyway'), style: 'destructive', onPress: () => void persistSave() },
      ]);
      return;
    }

    await persistSave();
  };

  const handleReset = async () => {
    // Deprecated: reset is now local only. Kept name for minimal diff.
    handleResetLocal();
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
            <View style={styles.body}>
              <View style={styles.row}>
                <View style={styles.labelWrap}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>{t('burned.fields.bmr')}</ThemedText>
                </View>
                <View style={styles.chipWrap}>
                  <InlineEditableNumberChip
                    value={Number.isFinite(parsed.bmr) ? parsed.bmr : null}
                    disabled
                    onCommit={(next) => {
                      const nextBmr = next ?? 0;
                      markTouched('bmr');
                      setBmrText(String(nextBmr));
                      if (!touched.tdee) {
                        const active = Number.isFinite(parsed.active) ? parsed.active : 0;
                        setTdeeText(String(nextBmr + active));
                      }
                    }}
                    placeholder={t('burned.fields.placeholder')}
                    unitSuffix={t('home.food_log.kcal')}
                    min={RANGES.CALORIES_KCAL.MIN}
                    allowNull={false}
                    colors={colors}
                    badgeBackgroundColor={colors.backgroundSecondary}
                    badgeBorderColor={colors.border}
                    badgeTextColor={colors.text}
                    badgeTextStyle={{ fontSize: FontSize.sm + 2 }}
                    inputTextStyle={{ fontSize: FontSize.xs + 2 }}
                    accessibilityLabel={t('burned.fields.bmr')}
                    inputWidth={64}
                    commitOnBlur
                  />
                </View>
              </View>

              <View style={styles.row}>
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
                      value={Number.isFinite(parsed.active) ? parsed.active : null}
                      showEditIcon
                      onCommit={(next) => {
                        const nextActive = next ?? 0;
                        markTouched('active');
                        setActiveText(String(nextActive));
                        if (!touched.tdee) {
                          const bmr = Number.isFinite(parsed.bmr) ? parsed.bmr : 0;
                          setTdeeText(String(bmr + nextActive));
                        }
                      }}
                      placeholder={t('burned.fields.placeholder')}
                      unitSuffix={t('home.food_log.kcal')}
                      min={RANGES.CALORIES_KCAL.MIN}
                      allowNull={false}
                      colors={colors}
                      badgeBackgroundColor={colors.backgroundSecondary}
                      badgeBorderColor={colors.border}
                      badgeTextColor={colors.text}
                      badgeTextStyle={{ fontSize: FontSize.sm + 2 }}
                      inputTextStyle={{ fontSize: FontSize.xs + 2 }}
                      accessibilityLabel={t('burned.fields.active')}
                      inputWidth={64}
                      commitOnBlur
                    />
                  </View>
                </View>
              </View>

              <View style={styles.row}>
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
                      value={Number.isFinite(parsed.tdee) ? parsed.tdee : null}
                      showEditIcon
                      onCommit={(next) => {
                        const bmr = Number.isFinite(parsed.bmr) ? parsed.bmr : 0;
                        const requestedTdee = next ?? 0;
                        const nextTdee = Math.max(bmr, requestedTdee);
                        const nextActive = nextTdee - bmr;

                        // Treat "edit TDEE" as "solve for Activity" so that TDEE always equals BMR + Activity.
                        // This also ensures save uses the BMR/Active branch where TDEE is derived.
                        markTouched('active');
                        setActiveText(String(nextActive));
                        setTdeeText(String(nextTdee));
                      }}
                      placeholder={t('burned.fields.placeholder')}
                      unitSuffix={t('home.food_log.kcal')}
                      min={RANGES.CALORIES_KCAL.MIN}
                      allowNull={false}
                      colors={colors}
                      badgeBackgroundColor={colors.backgroundSecondary}
                      badgeBorderColor={colors.border}
                      badgeTextColor={colors.text}
                      badgeTextStyle={{ fontSize: FontSize.sm + 2 }}
                      inputTextStyle={{ fontSize: FontSize.xs + 2 }}
                      accessibilityLabel={t('burned.fields.tdee')}
                      inputWidth={64}
                      commitOnBlur
                    />
                  </View>
                </View>
              </View>

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
  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
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
    fontWeight: '800',
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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


