/**
 * Shared "What to sync" section for Fitbit: Activity Burn, Weight, Steps.
 * Used inside FitbitConnectionCard in Burn, Weight, and Exercise so the UI never drifts.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type FitbitSyncTogglesValue = {
  activityBurn: boolean;
  weight: boolean;
  steps: boolean;
};

type Props = {
  value: FitbitSyncTogglesValue;
  onChange: (patch: Partial<FitbitSyncTogglesValue>) => void;
  disabled?: boolean;
};

const OFF = 'none';
const FITBIT = 'fitbit';

export function FitbitSyncToggles({ value, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const wrap = (opacity: number) => (disabled ? { opacity, pointerEvents: 'none' as const } : undefined);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.sectionTitle}>{t('burned.fitbit.what_to_sync')}</ThemedText>
      <View style={[styles.row, wrap(0.6)]}>
        <ThemedText style={styles.rowLabel}>{t('burned.fitbit.activity_burn')}</ThemedText>
        <SegmentedToggle<'none' | 'fitbit'>
          options={[
            { key: OFF, label: t('burned.fitbit.off') },
            { key: FITBIT, label: t('burned.fitbit.fitbit') },
          ]}
          value={value.activityBurn ? FITBIT : OFF}
          onChange={(next) => onChange({ activityBurn: next === FITBIT })}
        />
      </View>
      <View style={[styles.row, wrap(0.6)]}>
        <ThemedText style={styles.rowLabel}>{t('burned.fitbit.weight')}</ThemedText>
        <SegmentedToggle<'none' | 'fitbit'>
          options={[
            { key: OFF, label: t('burned.fitbit.off') },
            { key: FITBIT, label: t('burned.fitbit.fitbit') },
          ]}
          value={value.weight ? FITBIT : OFF}
          onChange={(next) => onChange({ weight: next === FITBIT })}
        />
      </View>
      <View style={[styles.row, wrap(0.6)]}>
        <ThemedText style={styles.rowLabel}>{t('burned.fitbit.steps')}</ThemedText>
        <SegmentedToggle<'none' | 'fitbit'>
          options={[
            { key: OFF, label: t('burned.fitbit.off') },
            { key: FITBIT, label: t('burned.fitbit.fitbit') },
          ]}
          value={value.steps ? FITBIT : OFF}
          onChange={(next) => onChange({ steps: next === FITBIT })}
        />
      </View>
      <ThemedText style={[styles.helper, { color: colors.textSecondary }]}>
        {t('burned.fitbit.sync_uses_fitbit_helper')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
    alignSelf: 'stretch',
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: Spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rowLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flexShrink: 0,
  },
  helper: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: Spacing.xxs,
  },
});
