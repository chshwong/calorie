/**
 * Shared "Daily Burn − Eaten = Deficit" block.
 * Reused on Food Diary (horizontal) and Dashboard (vertical).
 * Uses same hooks as Food Diary: useDailySumBurned, useDailyFoodSummary, Fitbit sync.
 */

import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DailyBurnWearableSyncSlot } from '@/components/burned/DailyBurnWearableSyncSlot';
import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDailyFoodSummary } from '@/hooks/use-dashboard-data';
import { useDailySumBurned } from '@/hooks/use-daily-sum-burned';
import { useFitbitConnectionQuery } from '@/hooks/use-fitbit-connection';
import { useFitbitSyncOrchestrator } from '@/hooks/use-fitbit-sync-orchestrator';
import { useUserConfig } from '@/hooks/use-user-config';
import { ensureContrast } from '@/theme/contrast';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { toDateKey } from '@/utils/dateKey';

function formatWholeNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export type EnergyEquationLayout = 'horizontal' | 'vertical';

export type EnergyEquationVariant = 'default' | 'minimalVertical';

export type EnergyEquationProps = {
  /** Date key (YYYY-MM-DD) to display; drives burned, eaten, deficit. */
  dateKey: string;
  layout: EnergyEquationLayout;
  /** When layout is vertical: 'minimalVertical' = icon+number only, no labels, sync on top, compact. */
  variant?: EnergyEquationVariant;
  showSync: boolean;
  onEditBurned?: () => void;
  tourContainerRef?: React.RefObject<View | null>;
  tourBurnedPencilRef?: React.RefObject<View | null>;
  /** When vertical, use slightly smaller text to fit narrow widths */
  compact?: boolean;
};

export function EnergyEquation({
  dateKey,
  layout,
  variant = 'default',
  showSync,
  onEditBurned,
  tourContainerRef,
  tourBurnedPencilRef,
  compact = false,
}: EnergyEquationProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const modeKey = (scheme ?? 'light') as 'light' | 'dark';
  const colors = Colors[modeKey];

  const normalizedDateKey = toDateKey(dateKey);
  const { data: dailyBurned } = useDailySumBurned(normalizedDateKey, { enabled: !!normalizedDateKey });
  const foodSummary = useDailyFoodSummary(normalizedDateKey);
  const userConfig = useUserConfig();
  const goalType = (userConfig?.goal_type ?? 'maintain') as 'lose' | 'maintain' | 'recomp' | 'gain';

  const fitbitEnabled = showSync && Platform.OS === 'web';
  const fitbit = useFitbitConnectionQuery({ enabled: fitbitEnabled });
  const fitbitOrchestrator = useFitbitSyncOrchestrator();

  const burnedCal = dailyBurned?.tdee_cal ?? null;
  const eatenCal = Number(foodSummary?.caloriesTotal ?? 0);

  const net = burnedCal == null ? null : burnedCal - eatenCal;
  const netAbs = net == null ? null : Math.abs(net);
  const isDeficit = net == null ? true : net >= 0;

  const netColorRaw = (() => {
    if (net == null) return colors.text;
    if (goalType !== 'lose') return colors.text;
    if (net >= 200) return colors.chartGreen;
    if (net >= 0) return colors.chartOrange;
    if (net > -500) return colors.chartPink;
    return colors.chartRed;
  })();
  const netColor = ensureContrast(netColorRaw, colors.card, modeKey, 4.5);
  const showCheckmark = goalType === 'lose' && net != null && net >= 200;
  const netLabel = isDeficit ? t('burned.energy_balance.labels.deficit') : t('burned.energy_balance.labels.surplus');

  const [isBurnedHover, setIsBurnedHover] = useState(false);
  const burnedPressableProps = onEditBurned
    ? {
        onPress: onEditBurned,
        activeOpacity: 0.8,
        hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
        ...getButtonAccessibilityProps(t('burned.energy_balance.accessibility.edit_burned')),
        onHoverIn: () => setIsBurnedHover(true),
        onHoverOut: () => setIsBurnedHover(false),
      }
    : {};

  const wearableSyncSlot =
    fitbitEnabled && showSync ? (
      <DailyBurnWearableSyncSlot
        isConnected={fitbit.isConnected}
        lastSyncAt={fitbit.lastSyncAt}
        onSync={async () => {
          const res = await fitbitOrchestrator.syncFitbitAllNow({
            dateKey: normalizedDateKey,
            includeBurnApply: true,
          });
          if (res.weightOk === false && res.weightErrorCode === 'INSUFFICIENT_SCOPE') {
            showAppToast(t('weight.settings.wearable.toast.reconnect_to_enable_weight_sync'));
          }
        }}
      />
    ) : null;

  // Minimal vertical: equation container (Sync → Burn − Eaten = Result). Same data/sync.
  if (layout === 'vertical' && variant === 'minimalVertical') {
    return (
      <View
        ref={tourContainerRef as React.RefObject<View>}
        style={[styles.minimalVerticalWrap, compact && styles.minimalVerticalWrapCompact]}
      >
        <View style={styles.eqContainer}>
          {wearableSyncSlot ? (
            <View style={styles.minimalSyncRow}>{wearableSyncSlot}</View>
          ) : null}
          <View style={styles.minimalRow}>
            <Text style={styles.eqEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              🔥
            </Text>
            <ThemedText style={[styles.eqValue, { color: colors.textSecondary }]} numberOfLines={1}>
              {burnedCal == null ? t('burned.week.placeholder') : formatWholeNumber(burnedCal)}
            </ThemedText>
          </View>
          <View style={styles.eqRowTight}>
            <ThemedText style={[styles.eqMinusInline, { color: colors.textSecondary }]}>−</ThemedText>
            <Text style={styles.eqEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              🍴
            </Text>
            <ThemedText style={[styles.eqValue, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatWholeNumber(eatenCal)}
            </ThemedText>
          </View>
          <View style={[styles.eqLine, { backgroundColor: colors.separator }]} />
          <View style={styles.eqResultBlock}>
            <View style={styles.eqResultTopRow}>
              <ThemedText style={[styles.eqEquals, { color: colors.textSecondary }]}>=</ThemedText>
              <ThemedText style={[styles.eqResultValue, { color: netColor }]} numberOfLines={1}>
                {netAbs == null ? t('burned.week.placeholder') : formatWholeNumber(netAbs)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.eqResultLabelBelow, { color: netColor }]} numberOfLines={1}>
              {netLabel}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  }

  if (layout === 'vertical') {
    return (
      <View
        ref={tourContainerRef as React.RefObject<View>}
        style={[styles.verticalWrap, compact && styles.verticalWrapCompact]}
      >
        <View style={styles.verticalCol}>
          <TouchableOpacity
            ref={tourBurnedPencilRef as React.RefObject<any>}
            style={[
              styles.verticalTapTarget,
              Platform.OS === 'web' && onEditBurned ? ({ cursor: 'pointer' } as any) : null,
              Platform.OS === 'web' && onEditBurned ? getFocusStyle(colors.tint) : null,
            ]}
            {...burnedPressableProps}
          >
            <ThemedText
              style={[
                styles.verticalNumber,
                compact && styles.verticalNumberCompact,
                { color: colors.text },
                Platform.OS === 'web' && isBurnedHover && onEditBurned ? styles.underline : null,
              ]}
              numberOfLines={1}
            >
              {burnedCal == null ? t('burned.week.placeholder') : formatWholeNumber(burnedCal)}
            </ThemedText>
          </TouchableOpacity>
          <ThemedText style={[styles.verticalLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('burned.energy_balance.labels.burned')}
          </ThemedText>
        </View>

        <ThemedText style={[styles.verticalOp, { color: colors.textSecondary }]}>−</ThemedText>

        <View style={styles.verticalCol}>
          <ThemedText
            style={[styles.verticalNumber, compact && styles.verticalNumberCompact, { color: colors.text }]}
            numberOfLines={1}
          >
            {formatWholeNumber(eatenCal)}
          </ThemedText>
          <ThemedText style={[styles.verticalLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            <Text style={styles.emojiInline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              🍴
            </Text>{' '}
            {t('burned.energy_balance.words.eaten')}
          </ThemedText>
        </View>

        <View style={[styles.verticalResultRow, { borderTopColor: colors.textSecondary }]}>
          <ThemedText
            style={[
              styles.verticalNumber,
              compact && styles.verticalNumberCompact,
              { color: netColor },
            ]}
            numberOfLines={1}
          >
            {netAbs == null ? t('burned.week.placeholder') : formatWholeNumber(netAbs)}
          </ThemedText>
          <ThemedText style={[styles.verticalLabel, { color: netColor }]} numberOfLines={1}>
            {showCheckmark ? (
              <>
                <Text style={styles.emojiInline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  ✅
                </Text>{' '}
              </>
            ) : null}
            {netLabel}
          </ThemedText>
        </View>

        {wearableSyncSlot ? <View style={styles.verticalSyncRow}>{wearableSyncSlot}</View> : null}
      </View>
    );
  }

  // Horizontal (Food Diary) layout
  return (
    <View
      ref={tourContainerRef as React.RefObject<View>}
      style={[styles.wrap, { borderTopColor: colors.separator, borderBottomColor: colors.separator }]}
    >
      <View style={styles.rowNumbers}>
        <View style={styles.col}>
          <TouchableOpacity
            ref={tourBurnedPencilRef as React.RefObject<any>}
            style={[
              styles.burnedTapTarget,
              Platform.OS === 'web' && onEditBurned ? ({ cursor: 'pointer' } as any) : null,
              Platform.OS === 'web' && onEditBurned ? getFocusStyle(colors.tint) : null,
            ]}
            {...burnedPressableProps}
          >
            <View style={styles.burnedNumberRow}>
              <ThemedText
                style={[
                  styles.number,
                  { color: colors.text },
                  Platform.OS === 'web' && isBurnedHover ? styles.underline : null,
                ]}
                numberOfLines={1}
              >
                {burnedCal == null ? t('burned.week.placeholder') : formatWholeNumber(burnedCal)}
              </ThemedText>
              <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                ✏️
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        <ThemedText style={[styles.op, { color: colors.textSecondary }]}>–</ThemedText>
        <View style={styles.col}>
          <ThemedText style={[styles.number, { color: colors.text }]} numberOfLines={1}>
            {formatWholeNumber(eatenCal)}
          </ThemedText>
        </View>
        <ThemedText style={[styles.op, { color: colors.textSecondary }]}>=</ThemedText>
        <View style={styles.col}>
          <ThemedText style={[styles.number, { color: netColor }]} numberOfLines={1}>
            {netAbs == null ? t('burned.week.placeholder') : formatWholeNumber(netAbs)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.rowLabels}>
        <View style={styles.col}>
          <TouchableOpacity
            style={[
              styles.burnedTapTarget,
              Platform.OS === 'web' && onEditBurned ? ({ cursor: 'pointer' } as any) : null,
              Platform.OS === 'web' && onEditBurned ? getFocusStyle(colors.tint) : null,
            ]}
            {...burnedPressableProps}
          >
            <ThemedText style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('burned.energy_balance.labels.burned')}
            </ThemedText>
          </TouchableOpacity>
        </View>
        <ThemedText style={[styles.op, { color: colors.textSecondary }]}> </ThemedText>
        <View style={styles.col}>
          <ThemedText style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
            <Text style={styles.emojiInline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              🍴
            </Text>{' '}
            {t('burned.energy_balance.words.eaten')}
          </ThemedText>
        </View>
        <ThemedText style={[styles.op, { color: colors.textSecondary }]}> </ThemedText>
        <View style={styles.col}>
          <ThemedText style={[styles.label, { color: netColor }]} numberOfLines={1}>
            {showCheckmark ? (
              <>
                <Text style={styles.emojiInline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  ✅
                </Text>{' '}
              </>
            ) : null}
            {netLabel}
          </ThemedText>
        </View>
      </View>
      {wearableSyncSlot ? (
        <View style={styles.rowAccessory}>
          <View style={styles.col}>{wearableSyncSlot}</View>
          <View style={styles.opSpacer} />
          <View style={styles.col} />
          <View style={styles.opSpacer} />
          <View style={styles.col} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: Spacing.xs,
  },
  rowNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rowAccessory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -4,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  op: {
    width: 16,
    textAlign: 'center',
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: '600',
  },
  opSpacer: {
    width: 16,
  },
  number: {
    fontSize: Platform.select({ web: FontSize.md, default: FontSize.md }),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  burnedTapTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  burnedNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    marginLeft: 5,
    fontSize: 13,
    ...Platform.select({
      web: { fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' },
      default: {},
    }),
  },
  emojiInline: {
    fontSize: 12,
    ...Platform.select({
      web: { fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' },
      default: {},
    }),
  },
  label: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: '500',
  },
  // Vertical layout
  verticalWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  verticalWrapCompact: {
    maxWidth: 100,
  },
  verticalCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalNumber: {
    fontSize: Platform.select({ web: FontSize.md, default: FontSize.sm }),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  verticalNumberCompact: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
  },
  verticalLabel: {
    fontSize: Platform.select({ web: FontSize.xs, default: FontSize.xs }),
    fontWeight: '500',
    marginTop: 2,
  },
  verticalOp: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: '600',
    marginVertical: 2,
  },
  verticalResultRow: {
    alignItems: 'center',
    borderTopWidth: 1, // subtraction line between Eaten and Deficit
    paddingTop: 4,
    marginTop: 4,
  },
  verticalSyncRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  verticalTapTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Minimal vertical (Dashboard: icon + number only, sync on top)
  minimalVerticalWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    maxWidth: 96,
  },
  minimalVerticalWrapCompact: {
    minWidth: 52,
    maxWidth: 88,
  },
  minimalSyncRow: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  minimalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginBottom: 2,
  },
  minimalEmoji: {
    fontSize: 14,
    ...Platform.select({
      web: { fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' },
      default: {},
    }),
  },
  eqEmoji: {
    width: 14,
    textAlign: 'center',
    fontSize: 14,
    ...Platform.select({
      web: { fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' },
      default: {},
    }),
  },
  eqValue: {
    width: 48,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.2,
  },
  eqRowTight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginBottom: 2,
  },
  eqMinusInline: {
    width: 12,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: FontWeight.bold,
  },
  minimalDivider: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: 2,
    marginHorizontal: 4,
  },
  eqLine: {
    height: 2,
    width: 66,
    borderRadius: 2,
    marginTop: 2,
    marginBottom: 6,
    alignSelf: 'flex-end',
  },
  eqContainer: {
    alignItems: 'flex-end',
    paddingVertical: 2,
  },
  eqResultBlock: {
    alignItems: 'flex-end',
  },
  eqResultTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
  },
  eqEquals: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    marginRight: 0,
    opacity: 0.7,
  },
  eqResultValue: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  eqResultLabelBelow: {
    marginTop: 0,
    lineHeight: 12,
    fontSize: 11,
    fontWeight: FontWeight.semibold,
  },
});
