import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight } from '@/constants/theme';

interface TrajectorySummaryProps {
  startWeightLabel: string;
  endWeightLabel: string;
  startSubLabel: string;
  endSubLabel: string;
  paceLabel?: string;
  accentColor?: string;
  textColor?: string;
}

export const TrajectorySummary: React.FC<TrajectorySummaryProps> = ({
  startWeightLabel,
  endWeightLabel,
  startSubLabel,
  endSubLabel,
  paceLabel,
  accentColor = '#16A1B8',
  textColor = Colors.light.text,
}) => {
  const { t } = useTranslation();
  const colors = Colors.light;
  
  // Subtle tinted background using primary color at ~5% opacity
  const tintedBackground = `${accentColor}0D`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tintedBackground,
        },
      ]}
      accessibilityLabel={`${t('onboarding.timeline.trajectory_title')}: ${startWeightLabel} to ${endWeightLabel}, ${startSubLabel} to ${endSubLabel}${paceLabel ? `, ${paceLabel}` : ''}`}
    >
      {/* Title Row */}
      <View style={styles.titleRow}>
        <Text variant="h4" style={[styles.title, { color: textColor }]}>
          {t('onboarding.timeline.trajectory_title')}
        </Text>
        {paceLabel && (
          <Text variant="caption" style={[styles.paceText, { color: colors.textSecondary }]}>
            {paceLabel}
          </Text>
        )}
      </View>

      {/* Chips + Arrow Row */}
      <View style={styles.chipsRow}>
        {/* Start Chip */}
        <View style={[styles.chip, { backgroundColor: colors.backgroundSecondary || colors.backgroundTertiary }]}>
          <Text variant="h3" style={[styles.chipText, { color: textColor }]}>
            {startWeightLabel}
          </Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Text style={[styles.arrow, { color: colors.textSecondary }]}>→</Text>
        </View>

        {/* End Chip */}
        <View style={[styles.chip, { backgroundColor: colors.backgroundSecondary || colors.backgroundTertiary }]}>
          <Text variant="h3" style={[styles.chipText, { color: textColor }]}>
            {endWeightLabel}
          </Text>
        </View>
      </View>

      {/* Sublabels Row */}
      <View style={styles.sublabelsRow}>
        <View style={styles.sublabelContainer}>
          <Text variant="caption" style={[styles.sublabel, { color: colors.textSecondary }]}>
            {startSubLabel}
          </Text>
        </View>
        <View style={styles.sublabelSpacer} />
        <View style={styles.sublabelContainer}>
          <Text variant="caption" style={[styles.sublabel, { color: colors.textSecondary }]}>
            {endSubLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    // No border, no shadow - informational only
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: FontWeight.bold,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xs / 2,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxWidth: 140,
  },
  chipText: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize['xl'],
    textAlign: 'center',
  },
  arrowContainer: {
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.regular,
    lineHeight: FontSize['2xl'] * LineHeight.normal,
  },
  sublabelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginTop: Spacing.none,
  },
  sublabelContainer: {
    flex: 1,
    maxWidth: 140,
    alignItems: 'center',
  },
  sublabelSpacer: {
    width: Spacing.md + (Spacing.sm * 2), // Match arrow container width
  },
  sublabel: {
    fontSize: FontSize.md -1, // 12px + 1pt = 13px
    lineHeight: (FontSize.sm + 1) * LineHeight.normal,
    textAlign: 'center',
    opacity: 0.8,
  },
  paceText: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
    opacity: 0.7,
  },
});

