import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useSaveDailySumBurned } from '@/hooks/use-burned-mutations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { getTodayKey, toDateKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  entryDate: string; // YYYY-MM-DD
  burnedRow: DailySumBurned | null;
  refetchBurned: () => void | Promise<void>;
};

export function BurnReductionModal({ visible, onClose, entryDate, burnedRow, refetchBurned }: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const saveMutation = useSaveDailySumBurned();

  const [pct, setPct] = useState<number>(0);
  const [lastNonZeroPct, setLastNonZeroPct] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setValidationError(null);
      return;
    }
    const nextPct = burnedRow?.burn_reduction_pct_int ?? 0;
    const clamped = Math.max(0, Math.min(50, Math.trunc(nextPct)));
    setPct(clamped);
    setLastNonZeroPct(clamped > 0 ? clamped : null);
    setValidationError(null);
  }, [visible, burnedRow?.id]);

  const setPctClamped = (next: number) => {
    const clamped = Math.max(0, Math.min(50, Math.trunc(next)));
    setPct(clamped);
    // Option 2: raw_burn is always present; do not clear it when pct returns to 0.
    setValidationError(null);
  };

  const burnCorrectionEnabled = pct > 0;
  const isToday = toDateKey(entryDate) === getTodayKey();

  useEffect(() => {
    if (pct > 0) {
      setLastNonZeroPct(pct);
    }
  }, [pct]);

  const handleToggleEnabled = (nextEnabled: boolean) => {
    if (!nextEnabled) {
      setPctClamped(0);
      return;
    }
    // Turning ON: default to last non-zero value if we have it; otherwise start at 10%.
    setPctClamped(lastNonZeroPct ?? 10);
  };

  const isBusy = saveMutation.isPending;

  const validate = () => {
    if (!burnedRow) {
      setValidationError(t('burned.burn_correction.errors.missing_row'));
      return false;
    }
    if (!Number.isFinite(pct) || Math.trunc(pct) !== pct || pct < 0 || pct > 50) {
      setValidationError(t('burned.burn_correction.errors.pct_invalid'));
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!burnedRow) return;

    try {
      const result = await saveMutation.mutateAsync({
        entryDate,
        touched: { bmr: false, active: false, tdee: false },
        values: {
          bmr_cal: burnedRow.bmr_cal,
          active_cal: burnedRow.active_cal,
          tdee_cal: burnedRow.tdee_cal,
        },
        reduction: {
          burn_reduction_pct_int: pct,
          // This modal controls ONLY the correction percent. Base activity is managed elsewhere.
          raw_burn: null,
          raw_tdee: null,
        },
      });

      if (result) {
        showAppToast(t('burned.burn_correction.toast.applied'));
        await Promise.resolve(refetchBurned());
        onClose();
      } else {
        setValidationError(t('burned.errors.save_failed'));
      }
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg === 'BURNED_REDUCTION_PCT_INVALID') {
        setValidationError(t('burned.burn_correction.errors.pct_invalid'));
      } else {
        setValidationError(t('burned.errors.save_failed'));
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.separator }]}>
            <ThemedText style={[styles.title, { color: colors.text }]}>{t('burned.burn_correction.title')}</ThemedText>
            <TouchableOpacity
              style={[styles.iconBtn, getMinTouchTargetStyle(), Platform.OS === 'web' && getFocusStyle(colors.tint)]}
              onPress={onClose}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('common.close'))}
            >
              <IconSymbol name="xmark" size={18} color={colors.text} decorative />
            </TouchableOpacity>
          </View>

          {!burnedRow ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : (
            <>
              <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollContent} showsVerticalScrollIndicator={false}>
                {/* Section 1: Controls */}
                <View style={[styles.controlsCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <View style={styles.controlBlock}>
                    <View style={styles.toggleHeaderRow}>
                      <ThemedText style={[styles.label, { color: colors.text }]}>
                        {t('burned.burn_correction.title')}
                      </ThemedText>
                      <View style={styles.toggleRight}>
                        <ThemedText style={[styles.toggleLabel, { color: colors.textSecondary }]}>
                          {burnCorrectionEnabled
                            ? t('burned.burn_correction.toggle.on')
                            : t('burned.burn_correction.toggle.off')}
                        </ThemedText>
                        <Switch
                          value={burnCorrectionEnabled}
                          onValueChange={handleToggleEnabled}
                          disabled={isBusy}
                          trackColor={{ false: colors.border, true: colors.tint }}
                          thumbColor={colors.card}
                        />
                      </View>
                    </View>

                    <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
                      {t('burned.burn_correction.pct_helper')}
                    </ThemedText>
                    <ThemedText style={[styles.appliesText, { color: colors.textSecondary }]}>
                      {isToday
                        ? t('burned.burn_correction.applies_today_and_future')
                        : t('burned.burn_correction.applies_this_day_only')}
                    </ThemedText>

                    <View style={[styles.sliderWrap, !burnCorrectionEnabled && styles.sliderWrapDisabled]}>
                      <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={50}
                        step={1}
                        value={pct}
                        onValueChange={(next) => setPctClamped(next)}
                        disabled={!burnCorrectionEnabled || isBusy}
                        minimumTrackTintColor={colors.tint}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.tint}
                      />
                      <View style={[styles.percentValueWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText style={[styles.percentValueText, { color: colors.text }]}>{pct}%</ThemedText>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Section 2 + 3: Context + benchmarks */}
                <View style={[styles.infoCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('burned.burn_correction.why_title')}
                  </ThemedText>
                  <ThemedText style={[styles.bodyText, { color: colors.text }]}>
                    {t('burned.burn_correction.why_body')}
                  </ThemedText>
                  <ThemedText style={[styles.mutedText, { color: colors.textSecondary }]}>
                    {t('burned.burn_correction.why_footer')}
                  </ThemedText>

                  <View style={styles.benchmarksSpacer} />

                  <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('burned.burn_correction.benchmarks_title')}
                  </ThemedText>
                  <ThemedText style={[styles.benchmarkLine, { color: colors.text }]}>
                    {t('burned.burn_correction.benchmarks.run_walk')}
                  </ThemedText>
                  <ThemedText style={[styles.benchmarkLine, { color: colors.text }]}>
                    {t('burned.burn_correction.benchmarks.cycling')}
                  </ThemedText>
                  <ThemedText style={[styles.benchmarkLine, { color: colors.text }]}>
                    {t('burned.burn_correction.benchmarks.strength_hiit')}
                  </ThemedText>
                  <ThemedText style={[styles.mutedText, { color: colors.textSecondary }]}>
                    {t('burned.burn_correction.benchmarks.footer')}
                  </ThemedText>
                </View>

                {validationError && (
                  <ThemedText style={[styles.errorText, { color: colors.chartRed }]}>{validationError}</ThemedText>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.secondaryBtn,
                    { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: isBusy ? 0.6 : 1 },
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  onPress={onClose}
                  disabled={isBusy}
                  activeOpacity={0.8}
                  {...getButtonAccessibilityProps(t('common.cancel'))}
                >
                  <ThemedText style={[styles.secondaryBtnText, { color: colors.text }]}>{t('common.cancel')}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: colors.tint, opacity: isBusy ? 0.6 : 1 },
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' && getFocusStyle('#fff'),
                  ]}
                  onPress={handleSave}
                  disabled={isBusy}
                  activeOpacity={0.85}
                  {...getButtonAccessibilityProps(t('burned.burn_correction.apply_button'))}
                >
                  <ThemedText style={[styles.primaryBtnText, { color: colors.textInverse }]}>
                    {t('burned.burn_correction.apply_button')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
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
  loading: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  bodyText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  mutedText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  benchmarkLine: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: 2,
  },
  benchmarksSpacer: {
    height: Spacing.md,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  controlsCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  controlBlock: {
    gap: Spacing.xs,
  },
  helperText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  appliesText: {
    marginTop: 4,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  controlDivider: {
    height: 1,
    opacity: 0.6,
  },
  toggleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  toggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  toggleLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  sliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sliderWrapDisabled: {
    opacity: 0.5,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  percentValueWrap: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentValueText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  rawHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  sourceHint: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  previewTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  previewLine: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  previewDivider: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  previewValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});

