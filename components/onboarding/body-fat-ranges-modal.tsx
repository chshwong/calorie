import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { BorderRadius, Colors, FontSize, FontWeight, LineHeight, Shadows, Spacing } from '@/constants/theme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface BodyFatRangesModalProps {
  visible: boolean;
  onClose: () => void;
  sex: 'male' | 'female' | '' | null;
  ageYears?: number | null;
  colors: typeof Colors.light;
}

type AgeGroup = '15_29' | '30s' | '40_50s' | '60_plus';

interface BodyFatRange {
  categoryKey: string;
  range: string;
}

// Chart data - labels resolved via i18n
const BODY_FAT_DATA: Record<'male' | 'female', Record<AgeGroup, BodyFatRange[]>> = {
  male: {
    '15_29': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '6–10%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '11–14%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '15–20%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '21–24%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '25%+' },
    ],
    '30s': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '7–11%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '12–15%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '16–22%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '23–26%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '27%+' },
    ],
    '40_50s': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '8–12%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '13–16%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '17–23%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '24–27%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '28%+' },
    ],
    '60_plus': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '9–13%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '14–17%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '18–24%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '25–28%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '29%+' },
    ],
  },
  female: {
    '15_29': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '14–19%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '20–24%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '25–31%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '32–35%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '36%+' },
    ],
    '30s': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '15–20%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '21–25%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '26–32%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '33–36%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '37%+' },
    ],
    '40_50s': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '16–21%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '22–26%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '27–33%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '34–37%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '38%+' },
    ],
    '60_plus': [
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.athlete', range: '17–22%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.ideal', range: '23–27%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.average', range: '28–34%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.above_average', range: '35–38%' },
      { categoryKey: 'onboarding.current_weight.body_fat_modal.categories.overweight', range: '39%+' },
    ],
  },
};

const AGE_GROUP_KEYS: Record<AgeGroup, string> = {
  '15_29': 'onboarding.current_weight.body_fat_modal.age_groups.15_29',
  '30s': 'onboarding.current_weight.body_fat_modal.age_groups.30s',
  '40_50s': 'onboarding.current_weight.body_fat_modal.age_groups.40_50s',
  '60_plus': 'onboarding.current_weight.body_fat_modal.age_groups.60_plus',
};

function mapAgeToDefaultAgeGroup(ageYears: number | null | undefined): AgeGroup | null {
  if (ageYears === null || ageYears === undefined || !isFinite(ageYears)) return null;
  if (ageYears <= 29) return '15_29';
  if (ageYears >= 30 && ageYears <= 39) return '30s';
  if (ageYears >= 40 && ageYears <= 59) return '40_50s';
  if (ageYears >= 60) return '60_plus';
  return null;
}

export function BodyFatRangesModal({ visible, onClose, sex, ageYears, colors }: BodyFatRangesModalProps) {
  const { t } = useTranslation();
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup>('15_29');
  const wasVisibleRef = useRef(false);

  const normalizedSex = sex === 'male' || sex === 'female' ? sex : null;
  const chartData = normalizedSex ? BODY_FAT_DATA[normalizedSex][selectedAgeGroup] : [];

  const ageGroups: AgeGroup[] = ['15_29', '30s', '40_50s', '60_plus'];

  // On open: preselect age group based on user's age (do not override while open)
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      const mapped = mapAgeToDefaultAgeGroup(ageYears);
      if (mapped) {
        setSelectedAgeGroup(mapped);
      }
      wasVisibleRef.current = true;
    } else if (!visible && wasVisibleRef.current) {
      wasVisibleRef.current = false;
    }
  }, [visible, ageYears]);

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
              {t('onboarding.current_weight.body_fat_modal.title', {
                symbol: normalizedSex
                  ? t(`onboarding.current_weight.body_fat_modal.symbols.${normalizedSex}`)
                  : '',
              })}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('onboarding.current_weight.body_fat_modal.subtitle')}
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
              {ageGroups.map((ageGroup) => {
                const ageLabel = t(AGE_GROUP_KEYS[ageGroup]);
                return (
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
                    ageLabel,
                    `Double tap to select ${ageLabel}`,
                    false
                  )}
                >
                  <Text
                    variant="body"
                    style={{
                      color: selectedAgeGroup === ageGroup ? Colors.light.textInverse : colors.text,
                      fontWeight: selectedAgeGroup === ageGroup ? FontWeight.semibold : FontWeight.regular,
                    }}
                  >
                    {ageLabel}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Chart Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>
            {!normalizedSex ? (
              <View style={styles.noSexContainer}>
                <ThemedText style={[styles.noSexText, { color: colors.textSecondary }]}>
                  {t('onboarding.current_weight.body_fat_modal.no_sex')}
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
                        {t(row.categoryKey)}
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
                {t('onboarding.current_weight.body_fat_modal.disclaimer')}
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
    fontWeight: FontWeight.regular,
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

