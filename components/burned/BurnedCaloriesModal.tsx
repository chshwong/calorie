import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getMinTouchTargetStyle, getFocusStyle, getButtonAccessibilityProps } from '@/utils/accessibility';
import { useDailySumBurned } from '@/hooks/use-daily-sum-burned';
import { useResetDailySumBurned, useSaveDailySumBurned } from '@/hooks/use-burned-mutations';
import { showAppToast } from '@/components/ui/app-toast';

type Props = {
  visible: boolean;
  onClose: () => void;
  entryDate: string; // YYYY-MM-DD
  hasFoodEntries: boolean;
};

type Field = 'bmr' | 'active' | 'tdee';

export function BurnedCaloriesModal({ visible, onClose, entryDate, hasFoodEntries }: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

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

  const validate = (): boolean => {
    if (!didResetToSystem && !touched.bmr && !touched.active && !touched.tdee) {
      setValidationError(t('burned.errors.no_changes'));
      return false;
    }

    if ((touched.bmr && (!Number.isFinite(parsed.bmr) || parsed.bmr < 0)) ||
        (touched.active && (!Number.isFinite(parsed.active) || parsed.active < 0)) ||
        (touched.tdee && (!Number.isFinite(parsed.tdee) || parsed.tdee < 0))) {
      setValidationError(t('burned.errors.invalid_number'));
      return false;
    }

    if (touched.tdee && burnedRow && Number.isFinite(parsed.tdee) && parsed.tdee < burnedRow.system_bmr_cal) {
      setValidationError(t('burned.errors.tdee_below_bmr'));
      return false;
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

  const handleSave = async () => {
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
      } else if (msg === 'BURNED_NEGATIVE_NOT_ALLOWED' || msg === 'BURNED_INVALID_NUMBER') {
        setValidationError(t('burned.errors.invalid_number'));
      } else {
        setValidationError(t('burned.errors.save_failed'));
      }
    }
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
            <ThemedText style={[styles.title, { color: colors.text }]}>{t('burned.modal.title')}</ThemedText>
            <TouchableOpacity
              style={[styles.iconBtn, getMinTouchTargetStyle(), Platform.OS === 'web' && getFocusStyle(colors.tint)]}
              onPress={onClose}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('common.close'))}
            >
              <IconSymbol name="xmark" size={18} color={colors.text} decorative />
            </TouchableOpacity>
          </View>

          {!hasFoodEntries && (
            <View style={[styles.banner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <ThemedText style={[styles.bannerText, { color: colors.textSecondary }]}>
                {t('burned.modal.estimated_banner')}
              </ThemedText>
            </View>
          )}

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
              <FieldRow
                label={t('burned.fields.bmr')}
                value={bmrText}
                onChangeText={(v) => {
                  markTouched('bmr');
                  setBmrText(v.replace(/[^\d]/g, ''));
                }}
                placeholder={t('burned.fields.placeholder')}
                unitSuffix={t('home.food_log.kcal')}
                colors={colors}
              />
              <FieldRow
                label={t('burned.fields.active')}
                value={activeText}
                onChangeText={(v) => {
                  markTouched('active');
                  setActiveText(v.replace(/[^\d]/g, ''));
                }}
                placeholder={t('burned.fields.placeholder')}
                unitSuffix={t('home.food_log.kcal')}
                colors={colors}
              />
              <FieldRow
                label={t('burned.fields.tdee')}
                value={tdeeText}
                onChangeText={(v) => {
                  markTouched('tdee');
                  setTdeeText(v.replace(/[^\d]/g, ''));
                }}
                placeholder={t('burned.fields.placeholder')}
                unitSuffix={t('home.food_log.kcal')}
                colors={colors}
              />

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
                  onPress={handleReset}
                  disabled={isBusy}
                  activeOpacity={0.8}
                  {...getButtonAccessibilityProps(t('burned.actions.reset'))}
                >
                  <ThemedText style={[styles.resetText, { color: colors.text }]}>{t('burned.actions.reset')}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: colors.tint },
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle('#fff'),
                  ]}
                  onPress={handleSave}
                  disabled={isBusy}
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

function FieldRow(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  unitSuffix: string;
  colors: typeof Colors.light | typeof Colors.dark;
}) {
  const { label, value, onChangeText, placeholder, unitSuffix, colors } = props;
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <ThemedText style={[styles.label, { color: colors.text }]}>{label}</ThemedText>
      </View>
      <View style={styles.inputWrap}>
        <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType={Platform.OS === 'web' ? 'text' : 'number-pad'}
            style={[
              styles.input,
              { color: colors.text },
              Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
            ]}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
          />
          <ThemedText style={[styles.inputSuffix, { color: colors.textSecondary }]}>{unitSuffix}</ThemedText>
        </View>
      </View>
    </View>
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
  inputWrap: {
    // Previously 30% — shrink another 30% → ~21% and keep all rows identical.
    width: '21%',
    minWidth: 72,
  },
  inputGroup: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingRight: Spacing.xs,
  },
  input: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.select({ web: Spacing.sm, default: Spacing.sm }),
    fontSize: FontSize.md,
    textAlign: 'right',
    backgroundColor: 'transparent',
  },
  inputSuffix: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginLeft: 2,
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


