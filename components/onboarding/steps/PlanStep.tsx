import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Modal, Pressable, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ColoredBrandName } from '@/components/brand/ColoredBrandName';
import { DONATION_URL } from '@/constants/links';
import { Colors, Spacing, BorderRadius, Typography, Shadows, FontSize, FontWeight, SemanticColors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { showAppToast } from '@/components/ui/app-toast';

export type PlanSelection = 'free' | 'premium';

interface PlanStepProps {
  selectedPlan: PlanSelection;
  onSelectedPlanChange: (plan: PlanSelection) => void;
  onPremiumInsist: () => void;
  loading: boolean;
  colors: typeof Colors.light;
}

export const PlanStep: React.FC<PlanStepProps> = ({
  selectedPlan,
  onSelectedPlanChange,
  onPremiumInsist,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const [donationOpen, setDonationOpen] = useState(false);

  const freeSelected = selectedPlan === 'free';
  const premiumSelected = selectedPlan === 'premium';

  const freeBullets = useMemo(
    () => [
      t('onboarding.plan.free_bullet_1'),
      t('onboarding.plan.free_bullet_2'),
      t('onboarding.plan.free_bullet_3'),
      t('onboarding.plan.free_bullet_4'),
      t('onboarding.plan.free_bullet_5'),
    ],
    [t]
  );

  const premiumBullets = useMemo(
    () => [
      t('onboarding.plan.premium_bullet_1'),
      t('onboarding.plan.premium_bullet_2'),
      t('onboarding.plan.premium_bullet_3'),
      t('onboarding.plan.premium_bullet_4'),
      t('onboarding.plan.premium_bullet_5'),
      t('onboarding.plan.premium_bullet_6'),
    ],
    [t]
  );

  const openDonationLink = async () => {
    if (!DONATION_URL) {
      showAppToast(t('onboarding.plan.donation_missing'));
      return;
    }

    try {
      if (Platform.OS === 'web') {
        window.open(DONATION_URL, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(DONATION_URL);
      }
    } catch {
      showAppToast(t('common.unexpected_error'));
    }
  };

  return (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.plan.title')}
      </ThemedText>

      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.plan.subtitle_prefix')}
        <ColoredBrandName withSpaceBefore={true} />
        {t('onboarding.plan.subtitle_suffix')}
      </ThemedText>

      {/* Free plan */}
      {(() => {
        const { accessibilityRole: _role, accessibilityState: _state, ...a11y } = getButtonAccessibilityProps(
          t('onboarding.plan.free_accessibility_label'),
          t('onboarding.plan.tap_to_select'),
          loading
        );
        return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          freeSelected ? styles.cardSelected : styles.cardUnselected,
          {
            borderColor: freeSelected ? onboardingColors.primary : colors.border,
            backgroundColor: freeSelected ? `${onboardingColors.primary}10` : colors.background,
            opacity: pressed ? 0.96 : 1,
          },
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        onPress={() => onSelectedPlanChange('free')}
        disabled={loading}
        accessibilityRole="radio"
        accessibilityState={{ selected: freeSelected, disabled: loading }}
        {...a11y}
      >
        <View style={styles.badgeRow}>
          <View style={[styles.badgePill, { backgroundColor: onboardingColors.primaryDark }]}>
            <IconSymbol name="sparkles" size={16} color={Colors.light.textInverse} decorative={true} />
            <ThemedText style={[styles.badgeText, { color: Colors.light.textInverse }]}>
              {t('onboarding.plan.badge_recommended')}
            </ThemedText>
          </View>
        </View>

        <View style={styles.planHeaderRow}>
          <Text variant="h4" style={[styles.planTitle, { color: colors.text }]}>
            <ColoredBrandName /> {t('onboarding.plan.free_name_suffix')}
          </Text>
        </View>

        <ThemedText style={[styles.valueStatement, { color: colors.textSecondary }]}>
          {t('onboarding.plan.free_value')}
        </ThemedText>

        <View style={styles.bullets}>
          {freeBullets.map((b, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <IconSymbol name="checkmark.circle.fill" size={18} color={onboardingColors.primaryDark} decorative={true} />
              <ThemedText style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</ThemedText>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.innerCtaPrimary, { backgroundColor: onboardingColors.primary }]}
          onPress={() => onSelectedPlanChange('free')}
          disabled={loading}
          {...getButtonAccessibilityProps(t('onboarding.plan.free_cta'), t('onboarding.plan.tap_to_select'), loading)}
        >
          <ThemedText style={[styles.innerCtaText, { color: Colors.light.textInverse }]}>
            {t('onboarding.plan.free_cta')}
          </ThemedText>
        </TouchableOpacity>
      </Pressable>
        );
      })()}

      {/* Premium plan */}
      {(() => {
        const { accessibilityRole: _role, accessibilityState: _state, ...a11y } = getButtonAccessibilityProps(
          t('onboarding.plan.premium_accessibility_label'),
          t('onboarding.plan.tap_to_select'),
          loading
        );
        return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          premiumSelected ? styles.cardSelected : styles.cardUnselected,
          {
            borderColor: premiumSelected ? SemanticColors.warning : colors.border,
            backgroundColor: premiumSelected ? `${SemanticColors.warning}10` : colors.background,
            opacity: pressed ? 0.96 : 1,
          },
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        onPress={() => onSelectedPlanChange('premium')}
        disabled={loading}
        accessibilityRole="radio"
        accessibilityState={{ selected: premiumSelected, disabled: loading }}
        {...a11y}
      >
        <View style={styles.badgeRow}>
          <View style={[styles.badgePill, { backgroundColor: `${SemanticColors.warning}` }]}>
            <IconSymbol name="info.circle.fill" size={16} color={Colors.light.textInverse} decorative={true} />
            <ThemedText style={[styles.badgeText, { color: Colors.light.textInverse }]}>
              {t('onboarding.plan.badge_do_not_select')}
            </ThemedText>
          </View>
        </View>

        <View style={styles.planHeaderRow}>
          <Text variant="h4" style={[styles.planTitle, { color: colors.text }]}>
            <ColoredBrandName /> {t('onboarding.plan.premium_name_suffix')}
          </Text>
        </View>

        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          {t('onboarding.plan.premium_why_title')}
        </ThemedText>

        <View style={styles.bullets}>
          {premiumBullets.map((b, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <IconSymbol name="info.circle.fill" size={18} color={SemanticColors.warning} decorative={true} />
              <ThemedText style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</ThemedText>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.innerCtaSecondary, { borderColor: SemanticColors.warning }]}
          onPress={() => {
            onPremiumInsist();
            setDonationOpen(true);
          }}
          disabled={loading}
          {...getButtonAccessibilityProps(t('onboarding.plan.premium_cta'), t('onboarding.plan.premium_cta_hint'), loading)}
        >
          <ThemedText style={[styles.innerCtaText, { color: SemanticColors.warning }]}>
            {t('onboarding.plan.premium_cta')}
          </ThemedText>
        </TouchableOpacity>
      </Pressable>
        );
      })()}

      {/* Donation modal */}
      <Modal
        visible={donationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDonationOpen(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setDonationOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="h4" style={[styles.modalTitle, { color: colors.text }]}>
              {t('onboarding.plan.donation_title')}
            </Text>
            <ThemedText style={[styles.modalBody, { color: colors.textSecondary }]}>
              {t('onboarding.plan.donation_body')}
            </ThemedText>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalPrimary, { backgroundColor: onboardingColors.primary }]}
                onPress={openDonationLink}
                {...getButtonAccessibilityProps(t('onboarding.plan.donation_open'), t('onboarding.plan.donation_open'), false)}
              >
                <ThemedText style={[styles.modalPrimaryText, { color: Colors.light.textInverse }]}>
                  {t('onboarding.plan.donation_open')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSecondary, { borderColor: colors.border }]}
                onPress={() => setDonationOpen(false)}
                {...getButtonAccessibilityProps(t('onboarding.plan.donation_not_now'), t('onboarding.plan.donation_not_now'), false)}
              >
                <ThemedText style={[styles.modalSecondaryText, { color: colors.textSecondary }]}>
                  {t('onboarding.plan.donation_not_now')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  stepContent: {
    gap: Spacing.xl,
  },
  stepTitle: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    ...Typography.bodyLarge,
    textAlign: 'center',
    marginTop: -Spacing.sm,
  },
  card: {
    borderWidth: 1.5, // Standard border width (matches onboarding inputs); no token currently exists
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
    ...Shadows.sm,
  },
  cardSelected: {
    ...Shadows.lg,
  },
  cardUnselected: {},
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
  },
  badgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  planHeaderRow: {
    marginBottom: Spacing.xs,
  },
  planTitle: {
    fontWeight: FontWeight.bold, // Override h4 variant's semibold to bold
  },
  valueStatement: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.labelLarge,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  bullets: {
    gap: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  bulletText: {
    ...Typography.bodySmall,
    flex: 1,
  },
  innerCtaPrimary: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  innerCtaSecondary: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  innerCtaText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  modalTitle: {
    marginBottom: Spacing.sm,
  },
  modalBody: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    gap: Spacing.md,
  },
  modalPrimary: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalPrimaryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  modalSecondary: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
  },
  modalSecondaryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
});


