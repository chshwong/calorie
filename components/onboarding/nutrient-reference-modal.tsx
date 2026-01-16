import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Modal, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

export type NutrientType = 'protein' | 'fiber' | 'carbs' | 'sugar' | 'sodium';

interface NutrientReferenceModalProps {
  visible: boolean;
  onClose: () => void;
  nutrientType: NutrientType;
  sexAtBirth: 'male' | 'female' | '' | null;
  colors: typeof Colors.light;
}

interface NutrientReferenceContent {
  titleKey: string;
  whyTrackKey: string;
  whatToAimForKey: string;
  typicalRanges?: {
    maleKey?: string;
    femaleKey?: string;
    combinedKey?: string;
  };
  realisticStartKey?: string;
  whenThisMayNotApplyKey?: string;
  disclaimerKey: string;
}

const NUTRIENT_REFERENCES: Record<NutrientType, NutrientReferenceContent> = {
  protein: {
    titleKey: 'onboarding.daily_targets.reference.protein.title',
    whyTrackKey: 'onboarding.daily_targets.reference.protein.why_track',
    whatToAimForKey: 'onboarding.daily_targets.reference.protein.what_to_aim_for',
    typicalRanges: {
      femaleKey: 'onboarding.daily_targets.reference.protein.typical_ranges.female',
      combinedKey: 'onboarding.daily_targets.reference.protein.typical_ranges.combined',
    },
    disclaimerKey: 'onboarding.daily_targets.reference.protein.disclaimer',
  },
  fiber: {
    titleKey: 'onboarding.daily_targets.reference.fiber.title',
    whyTrackKey: 'onboarding.daily_targets.reference.fiber.why_track',
    whatToAimForKey: 'onboarding.daily_targets.reference.fiber.what_to_aim_for',
    typicalRanges: {
      maleKey: 'onboarding.daily_targets.reference.fiber.typical_ranges.male',
      femaleKey: 'onboarding.daily_targets.reference.fiber.typical_ranges.female',
      combinedKey: 'onboarding.daily_targets.reference.fiber.typical_ranges.combined',
    },
    realisticStartKey: 'onboarding.daily_targets.reference.fiber.realistic_start',
    disclaimerKey: 'onboarding.daily_targets.reference.fiber.disclaimer',
  },
  carbs: {
    titleKey: 'onboarding.daily_targets.reference.carbs.title',
    whyTrackKey: 'onboarding.daily_targets.reference.carbs.why_track',
    whatToAimForKey: 'onboarding.daily_targets.reference.carbs.what_to_aim_for',
    typicalRanges: {
      combinedKey: 'onboarding.daily_targets.reference.carbs.typical_ranges.combined',
    },
    disclaimerKey: 'onboarding.daily_targets.reference.carbs.disclaimer',
  },
  sugar: {
    titleKey: 'onboarding.daily_targets.reference.sugar.title',
    whyTrackKey: 'onboarding.daily_targets.reference.sugar.why_track',
    whatToAimForKey: 'onboarding.daily_targets.reference.sugar.what_to_aim_for',
    disclaimerKey: 'onboarding.daily_targets.reference.sugar.disclaimer',
  },
  sodium: {
    titleKey: 'onboarding.daily_targets.reference.sodium.title',
    whyTrackKey: 'onboarding.daily_targets.reference.sodium.why_track',
    whatToAimForKey: 'onboarding.daily_targets.reference.sodium.what_to_aim_for',
    whenThisMayNotApplyKey: 'onboarding.daily_targets.reference.sodium.when_not_apply',
    disclaimerKey: 'onboarding.daily_targets.reference.sodium.disclaimer',
  },
};

export function NutrientReferenceModal({
  visible,
  onClose,
  nutrientType,
  sexAtBirth,
  colors,
}: NutrientReferenceModalProps) {
  const { t } = useTranslation();
  const content = NUTRIENT_REFERENCES[nutrientType];
  const normalizedSex = sexAtBirth === 'male' || sexAtBirth === 'female' ? sexAtBirth : null;

  // Determine which ranges to show
  const showRanges = content.typicalRanges && (
    (normalizedSex === 'male' && content.typicalRanges.maleKey) ||
    (normalizedSex === 'female' && content.typicalRanges.femaleKey) ||
    content.typicalRanges.combinedKey
  );

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
              {t(content.titleKey)}
            </ThemedText>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              {...getButtonAccessibilityProps('Close', 'Double tap to close', false)}
            >
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>
            <View style={styles.contentContainer}>
              {/* Why track */}
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('onboarding.daily_targets.reference.sections.why_track')}
                </ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {t(content.whyTrackKey)}
                </ThemedText>
              </View>

              {/* What to aim for */}
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('onboarding.daily_targets.reference.sections.what_to_aim_for')}
                </ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {t(content.whatToAimForKey)}
                </ThemedText>

                {/* Typical ranges */}
                {showRanges && (
                  <View style={styles.rangesContainer}>
                    {normalizedSex === 'male' && content.typicalRanges?.male && (
                      <ThemedText style={[styles.rangeText, { color: colors.textSecondary }]}>
                        {t(content.typicalRanges.maleKey)}
                      </ThemedText>
                    )}
                    {normalizedSex === 'female' && content.typicalRanges?.femaleKey && (
                      <ThemedText style={[styles.rangeText, { color: colors.textSecondary }]}>
                        {t(content.typicalRanges.femaleKey)}
                      </ThemedText>
                    )}
                    {content.typicalRanges?.combinedKey && (
                      <ThemedText style={[styles.rangeText, { color: colors.textSecondary }]}>
                        {t(content.typicalRanges.combinedKey)}
                      </ThemedText>
                    )}
                  </View>
                )}

                {/* Realistic start (for fiber) */}
                {content.realisticStartKey && (
                  <View style={styles.realisticStartContainer}>
                    <ThemedText style={[styles.realisticStartTitle, { color: colors.text }]}>
                      {t('onboarding.daily_targets.reference.sections.realistic_start')}
                    </ThemedText>
                    <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                      {t(content.realisticStartKey)}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* When this may not apply (for sodium) */}
              {content.whenThisMayNotApplyKey && (
                <View style={styles.section}>
                  <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('onboarding.daily_targets.reference.sections.when_not_apply')}
                  </ThemedText>
                  <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                    {t(content.whenThisMayNotApplyKey)}
                  </ThemedText>
                </View>
              )}

              {/* Disclaimer */}
              <View style={styles.disclaimerContainer}>
                <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                  {t(content.disclaimerKey)}
                </ThemedText>
              </View>
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
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  sectionText: {
    fontSize: FontSize.sm + 2,
    lineHeight: (FontSize.sm + 2) * LineHeight.relaxed,
  },
  rangesContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  rangeText: {
    fontSize: FontSize.sm + 2,
    lineHeight: (FontSize.sm + 2) * LineHeight.relaxed,
  },
  realisticStartContainer: {
    marginTop: Spacing.md,
  },
  realisticStartTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  disclaimerContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  disclaimerText: {
    fontSize: FontSize.sm + 2,
    lineHeight: (FontSize.sm + 2) * LineHeight.relaxed,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

