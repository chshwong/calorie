import React, { useState } from 'react';
import { View, StyleSheet, Modal, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface BodyFatRangesModalProps {
  visible: boolean;
  onClose: () => void;
  sex: 'male' | 'female' | '' | null;
  colors: typeof Colors.light;
}

type AgeGroup = '15_29' | '30s' | '40_50s' | '60_plus';

interface BodyFatRange {
  category: string;
  range: string;
}

// Chart data - hardcoded
const BODY_FAT_DATA: Record<'male' | 'female', Record<AgeGroup, BodyFatRange[]>> = {
  male: {
    '15_29': [
      { category: 'Athlete', range: '6–10%' },
      { category: 'Ideal', range: '11–14%' },
      { category: 'Average', range: '15–20%' },
      { category: 'Above Average', range: '21–24%' },
      { category: 'Overweight', range: '25%+' },
    ],
    '30s': [
      { category: 'Athlete', range: '7–11%' },
      { category: 'Ideal', range: '12–15%' },
      { category: 'Average', range: '16–22%' },
      { category: 'Above Average', range: '23–26%' },
      { category: 'Overweight', range: '27%+' },
    ],
    '40_50s': [
      { category: 'Athlete', range: '8–12%' },
      { category: 'Ideal', range: '13–16%' },
      { category: 'Average', range: '17–23%' },
      { category: 'Above Average', range: '24–27%' },
      { category: 'Overweight', range: '28%+' },
    ],
    '60_plus': [
      { category: 'Athlete', range: '9–13%' },
      { category: 'Ideal', range: '14–17%' },
      { category: 'Average', range: '18–24%' },
      { category: 'Above Average', range: '25–28%' },
      { category: 'Overweight', range: '29%+' },
    ],
  },
  female: {
    '15_29': [
      { category: 'Athlete', range: '14–19%' },
      { category: 'Ideal', range: '20–24%' },
      { category: 'Average', range: '25–31%' },
      { category: 'Above Average', range: '32–35%' },
      { category: 'Overweight', range: '36%+' },
    ],
    '30s': [
      { category: 'Athlete', range: '15–20%' },
      { category: 'Ideal', range: '21–25%' },
      { category: 'Average', range: '26–32%' },
      { category: 'Above Average', range: '33–36%' },
      { category: 'Overweight', range: '37%+' },
    ],
    '40_50s': [
      { category: 'Athlete', range: '16–21%' },
      { category: 'Ideal', range: '22–26%' },
      { category: 'Average', range: '27–33%' },
      { category: 'Above Average', range: '34–37%' },
      { category: 'Overweight', range: '38%+' },
    ],
    '60_plus': [
      { category: 'Athlete', range: '17–22%' },
      { category: 'Ideal', range: '23–27%' },
      { category: 'Average', range: '28–34%' },
      { category: 'Above Average', range: '35–38%' },
      { category: 'Overweight', range: '39%+' },
    ],
  },
};

const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  '15_29': '15–29',
  '30s': '30s',
  '40_50s': '40s–50s',
  '60_plus': '60+',
};

const DISCLAIMER_TEXT =
  'These ranges are broad population estimates based on fitness and health references. Individual body fat percentage varies by genetics, measurement method, and other factors. Use this only as a rough guide.';

export function BodyFatRangesModal({ visible, onClose, sex, colors }: BodyFatRangesModalProps) {
  const { t } = useTranslation();
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup>('15_29');

  const normalizedSex = sex === 'male' || sex === 'female' ? sex : null;
  const chartData = normalizedSex ? BODY_FAT_DATA[normalizedSex][selectedAgeGroup] : [];

  const ageGroups: AgeGroup[] = ['15_29', '30s', '40_50s', '60_plus'];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          {...getButtonAccessibilityProps('Close modal', 'Double tap to close', false)}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              {`Typical body fat % ranges${normalizedSex === 'male' ? ' ♂' : normalizedSex === 'female' ? ' ♀' : ''}`}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Broad population ranges by age.
            </ThemedText>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              {...getButtonAccessibilityProps('Close', 'Double tap to close', false)}
            >
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Age Group Selector */}
          {normalizedSex && (
            <View style={styles.ageGroupContainer}>
              {ageGroups.map((ageGroup) => (
                <TouchableOpacity
                  key={ageGroup}
                  style={[
                    styles.ageGroupButton,
                    {
                      backgroundColor:
                        selectedAgeGroup === ageGroup ? colors.tint : colors.backgroundSecondary,
                      borderColor: selectedAgeGroup === ageGroup ? colors.tint : colors.border,
                    },
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  onPress={() => setSelectedAgeGroup(ageGroup)}
                  {...getButtonAccessibilityProps(
                    AGE_GROUP_LABELS[ageGroup],
                    `Double tap to select ${AGE_GROUP_LABELS[ageGroup]}`,
                    false
                  )}
                >
                  <Text
                    variant="body"
                    style={{
                      color: selectedAgeGroup === ageGroup ? Colors.light.textInverse : colors.text,
                      fontWeight: selectedAgeGroup === ageGroup ? FontWeight.semibold : FontWeight.normal,
                    }}
                  >
                    {AGE_GROUP_LABELS[ageGroup]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Chart Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>
            {!normalizedSex ? (
              <View style={styles.noSexContainer}>
                <ThemedText style={[styles.noSexText, { color: colors.textSecondary }]}>
                  Select sex in onboarding to view ranges.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                {chartData.map((row, index) => (
                  <View
                    key={index}
                    style={[
                      styles.chartRow,
                      index < chartData.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={styles.chartCell}>
                      <ThemedText style={[styles.categoryText, { color: colors.text }]}>
                        {row.category}
                      </ThemedText>
                    </View>
                    <View style={[styles.chartCell, styles.chartCellRight]}>
                      <ThemedText style={[styles.rangeText, { color: colors.text }]}>
                        {row.range}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Disclaimer */}
            <View style={styles.disclaimerContainer}>
              <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                {DISCLAIMER_TEXT}
              </ThemedText>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: BorderRadius.xl,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: Shadows.lg,
    }),
    overflow: 'hidden',
  },
  header: {
    padding: Spacing.xl,
    paddingBottom: Spacing.lg,
    position: 'relative',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm + 2,
    lineHeight: (FontSize.sm + 2) * LineHeight.normal,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  ageGroupContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  ageGroupButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  scrollContent: {
    flex: 1,
  },
  noSexContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  noSexText: {
    fontSize: FontSize.base,
    textAlign: 'center',
  },
  chartContainer: {
    paddingHorizontal: Spacing.xl,
  },
  chartRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  chartCell: {
    flex: 1,
    justifyContent: 'center',
  },
  chartCellRight: {
    alignItems: 'flex-end',
  },
  categoryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.normal,
  },
  rangeText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  disclaimerContainer: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    marginTop: Spacing.md,
  },
  disclaimerText: {
    fontSize: FontSize.sm + 2,
    lineHeight: (FontSize.sm + 2) * LineHeight.relaxed,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

