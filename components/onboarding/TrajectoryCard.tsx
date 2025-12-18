import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';

interface TrajectoryCardProps {
  titleKey?: string;
  currentWeightLabel: string;
  targetWeightLabel: string;
  startLabel: string;
  endLabel: string;
  paceLabel?: string;
  isNoDeadline?: boolean;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

export const TrajectoryCard: React.FC<TrajectoryCardProps> = ({
  titleKey = 'onboarding.timeline.trajectory_title',
  currentWeightLabel,
  targetWeightLabel,
  startLabel,
  endLabel,
  paceLabel,
  isNoDeadline = false,
  accentColor,
  backgroundColor,
  textColor,
}) => {
  const { t } = useTranslation();
  const colors = Colors.light;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor: `${colors.border}40`,
        },
        Platform.OS === 'web'
          ? ({ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' } as any)
          : Shadows.sm,
      ]}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text variant="h4" style={[styles.title, { color: textColor }]}>
          {t(titleKey)}
        </Text>
        {paceLabel && (
          <View style={[styles.pacePill, { backgroundColor: `${accentColor}30` }]}>
            <Text variant="body" style={[styles.paceText, { color: accentColor }]}>
              {paceLabel}
            </Text>
          </View>
        )}
      </View>

      {/* Main Bar Area */}
      <View style={styles.barContainer}>
        {/* Track Background */}
        <View
          style={[
            styles.track,
            {
              backgroundColor: `${colors.textSecondary || colors.border}15`,
            },
            isNoDeadline && styles.trackDashed,
          ]}
        >
          {/* Layer 1: Full-width accent bar with low opacity */}
          <View
            style={[
              styles.filledLayer1,
              {
                backgroundColor: `${accentColor}18`,
              },
            ]}
          />

          {/* Layer 2: Thinner accent bar centered vertically */}
          <View
            style={[
              styles.filledLayer2,
              {
                backgroundColor: `${accentColor}35`,
              },
            ]}
          />
        </View>

        {/* Endpoints */}
        <View style={styles.endpointsContainer}>
          {/* Left Dot */}
          <View style={[styles.dot, { backgroundColor: accentColor }]}>
            <View style={styles.dotInner} />
          </View>

          {/* Right Dot */}
          <View
            style={[
              styles.dot,
              isNoDeadline
                ? {
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: accentColor,
                  }
                : { backgroundColor: accentColor },
            ]}
          >
            {!isNoDeadline && <View style={styles.dotInner} />}
          </View>
        </View>
      </View>

      {/* Labels Under Bar */}
      <View style={styles.labelsRow}>
        {/* Left Column */}
        <View style={styles.labelColumn}>
          <Text variant="h3" style={[styles.weightLabel, { color: textColor }]}>
            {currentWeightLabel}
          </Text>
          <Text variant="body" style={[styles.dateLabel, { color: colors.textSecondary }]}>
            {startLabel}
          </Text>
        </View>

        {/* Right Column */}
        <View style={[styles.labelColumn, styles.labelColumnRight]}>
          <Text variant="h3" style={[styles.weightLabel, styles.weightLabelRight, { color: textColor }]}>
            {targetWeightLabel}
          </Text>
          <Text variant="body" style={[styles.dateLabel, styles.dateLabelRight, { color: colors.textSecondary }]}>
            {endLabel}
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
    borderWidth: 1,
    gap: Spacing.md,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: FontWeight.bold,
  },
  pacePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  paceText: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  barContainer: {
    position: 'relative',
    height: 12,
    justifyContent: 'center',
    marginVertical: Spacing.xs,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trackDashed: {
    ...Platform.select({
      web: {
        borderStyle: 'dashed',
      },
      default: {
        // On native, use a workaround for dashed border
        borderStyle: 'solid',
        opacity: 0.5,
      },
    }),
  },
  filledLayer1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  filledLayer2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 2,
    bottom: 2,
  },
  endpointsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#fff',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  labelColumn: {
    flex: 1,
  },
  labelColumnRight: {
    alignItems: 'flex-end',
  },
  weightLabel: {
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs / 2,
  },
  weightLabelRight: {
    textAlign: 'right',
  },
  dateLabel: {
    fontSize: FontSize.sm,
    opacity: 0.7,
  },
  dateLabelRight: {
    textAlign: 'right',
  },
});

