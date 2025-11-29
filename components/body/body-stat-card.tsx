/**
 * Reusable component for displaying a single body metric stat card
 * 
 * Per engineering guidelines:
 * - Uses theme tokens for all styling
 * - All text via i18n
 * - Theme-aware (dark/light mode)
 */

import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius, Shadows, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type BodyStatCardProps = {
  labelKey: string;
  value: number | string | null;
  unitKey?: string;
  subLabelKey?: string;
  subLabel?: string;
  highlight?: boolean;
  highlightColor?: string;
};

export function BodyStatCard({
  labelKey,
  value,
  unitKey,
  subLabelKey,
  subLabel,
  highlight = false,
  highlightColor,
}: BodyStatCardProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Determine highlight color based on BMI classification if not provided
  const accentColor = highlightColor || (highlight ? colors.tint : colors.text);

  // Background color for highlight (subtle tint)
  const backgroundColor = highlight && highlightColor
    ? highlightColor + '12' // 12 hex = ~7% opacity
    : colors.card;

  const displayValue = value !== null ? (typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value) : '--';
  const displayUnit = unitKey ? t(unitKey) : '';
  const displaySubLabel = subLabelKey ? t(subLabelKey) : subLabel || '';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          ...Shadows.md,
        },
      ]}
    >
      <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
        {t(labelKey)}
      </ThemedText>
      <ThemedText style={[styles.value, { color: highlight ? accentColor : colors.text }]}>
        {displayValue}
      </ThemedText>
      {displayUnit && (
        <ThemedText style={[styles.unit, { color: highlight ? accentColor : colors.textTertiary }]}>
          {displayUnit}
        </ThemedText>
      )}
      {displaySubLabel && (
        <ThemedText style={[styles.subLabel, { color: highlight ? accentColor : colors.textSecondary }]}>
          {displaySubLabel}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    minWidth: 80,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  value: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xxs,
    textAlign: 'center',
  },
  unit: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    marginBottom: Spacing.xxs,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    opacity: 0.85,
  },
});

