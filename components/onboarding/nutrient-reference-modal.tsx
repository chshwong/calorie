import React from 'react';
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
  title: string;
  whyTrack: string;
  whatToAimFor: string;
  typicalRanges?: {
    male?: string;
    female?: string;
    combined?: string;
  };
  realisticStart?: string;
  whenThisMayNotApply?: string;
  disclaimer: string;
}

const NUTRIENT_REFERENCES: Record<NutrientType, NutrientReferenceContent> = {
  protein: {
    title: 'Protein',
    whyTrack: 'Protein helps preserve and build muscle and keeps you fuller for longer.',
    whatToAimFor: 'Most people do well around 0.7–1.0 g per lb of body weight per day.',
    typicalRanges: {
      female: 'Females: often ~70–140 g/day',
      combined: 'Exact needs vary with size and activity.',
    },
    disclaimer: 'General guidance only, not medical advice. Needs vary with age, activity level, kidney or liver conditions, medications, and other factors.',
  },
  fiber: {
    title: 'Fiber',
    whyTrack: 'Supports digestion, fullness, and steadier energy.',
    whatToAimFor: 'Health guidelines suggest:',
    typicalRanges: {
      male: 'Males: ~30–38 g/day',
      female: 'Females: ~25–30 g/day',
      combined: 'Most adults today average only ~15–20 g/day.',
    },
    realisticStart: '~20 g/day could be a great first goal. You can build from there.',
    disclaimer: 'General guidance only, not medical advice.',
  },
  carbs: {
    title: 'Carbs',
    whyTrack: 'Capping carbs helps limit easy calorie creep and encourages better carb choices.',
    whatToAimFor: 'Many people do well around 30–55% of daily calories from carbs.',
    typicalRanges: {
      combined: 'Intake may be much lower if you follow approaches like keto.',
    },
    disclaimer: 'General guidance only, not medical advice. Needs vary with training, diabetes/prediabetes, medications, and other conditions.',
  },
  sugar: {
    title: 'Sugar',
    whyTrack: 'Capping sugar helps limit ultra-processed calories and supports heart and dental health.',
    whatToAimFor: 'A practical range for many people is under ~25–50 g/day.',
    disclaimer: 'General guidance only, not medical advice. Individual needs vary.',
  },
  sodium: {
    title: 'Sodium',
    whyTrack: 'Capping sodium helps support healthy blood pressure and reduces hidden salt from processed foods.',
    whatToAimFor: 'Many people do well around ~2,000–2,300 mg/day.',
    whenThisMayNotApply: 'This tracking is for those who want to limit sodium.\nSome very active individuals may need extra sodium to stay safe. If that applies to you, it\'s reasonable to opt out of this target.',
    disclaimer: 'General guidance only, not medical advice. Sodium needs vary with blood pressure, kidney or heart conditions, sweating, and medications.',
  },
};

export function NutrientReferenceModal({
  visible,
  onClose,
  nutrientType,
  sexAtBirth,
  colors,
}: NutrientReferenceModalProps) {
  const content = NUTRIENT_REFERENCES[nutrientType];
  const normalizedSex = sexAtBirth === 'male' || sexAtBirth === 'female' ? sexAtBirth : null;

  // Determine which ranges to show
  const showRanges = content.typicalRanges && (
    (normalizedSex === 'male' && content.typicalRanges.male) ||
    (normalizedSex === 'female' && content.typicalRanges.female) ||
    content.typicalRanges.combined
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
              {content.title}
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
                  Why track
                </ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {content.whyTrack}
                </ThemedText>
              </View>

              {/* What to aim for */}
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                  What to aim for
                </ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {content.whatToAimFor}
                </ThemedText>

                {/* Typical ranges */}
                {showRanges && (
                  <View style={styles.rangesContainer}>
                    {normalizedSex === 'male' && content.typicalRanges?.male && (
                      <ThemedText style={[styles.rangeText, { color: colors.textSecondary }]}>
                        {content.typicalRanges.male}
                      </ThemedText>
                    )}
                    {normalizedSex === 'female' && content.typicalRanges?.female && (
                      <ThemedText style={[styles.rangeText, { color: colors.textSecondary }]}>
                        {content.typicalRanges.female}
                      </ThemedText>
                    )}
                    {content.typicalRanges?.combined && (
                      <ThemedText style={[styles.rangeText, { color: colors.textSecondary }]}>
                        {content.typicalRanges.combined}
                      </ThemedText>
                    )}
                  </View>
                )}

                {/* Realistic start (for fiber) */}
                {content.realisticStart && (
                  <View style={styles.realisticStartContainer}>
                    <ThemedText style={[styles.realisticStartTitle, { color: colors.text }]}>
                      A realistic start
                    </ThemedText>
                    <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                      {content.realisticStart}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* When this may not apply (for sodium) */}
              {content.whenThisMayNotApply && (
                <View style={styles.section}>
                  <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                    When this may not apply
                  </ThemedText>
                  <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                    {content.whenThisMayNotApply}
                  </ThemedText>
                </View>
              )}

              {/* Disclaimer */}
              <View style={styles.disclaimerContainer}>
                <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                  {content.disclaimer}
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

