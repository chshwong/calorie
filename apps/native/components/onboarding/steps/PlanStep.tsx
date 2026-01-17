import Feather from "@expo/vector-icons/Feather";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Modal, Pressable, StyleSheet, View } from "react-native";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";
import { DONATION_URL } from "../../../constants/links";

export type PlanSelection = "free" | "premium";

type PlanStepProps = {
  selectedPlan: PlanSelection;
  onSelectedPlanChange: (plan: PlanSelection) => void;
  onPremiumInsist: () => void;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
};

export function PlanStep({
  selectedPlan,
  onSelectedPlanChange,
  onPremiumInsist,
  loading,
  onBack,
  onContinue,
}: PlanStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [donationOpen, setDonationOpen] = useState(false);

  const freeSelected = selectedPlan === "free";
  const premiumSelected = selectedPlan === "premium";

  const freeBullets = useMemo(
    () => [
      t("onboarding.plan.free_bullet_1"),
      t("onboarding.plan.free_bullet_2"),
      t("onboarding.plan.free_bullet_3"),
      t("onboarding.plan.free_bullet_4"),
      t("onboarding.plan.free_bullet_5"),
    ],
    [t]
  );

  const premiumBullets = useMemo(
    () => [
      t("onboarding.plan.premium_bullet_1"),
      t("onboarding.plan.premium_bullet_2"),
      t("onboarding.plan.premium_bullet_3"),
      t("onboarding.plan.premium_bullet_4"),
      t("onboarding.plan.premium_bullet_5"),
      t("onboarding.plan.premium_bullet_6"),
    ],
    [t]
  );

  const openDonationLink = async () => {
    if (!DONATION_URL) {
      Alert.alert(t("onboarding.plan.donation_missing"));
      return;
    }

    try {
      await Linking.openURL(DONATION_URL);
    } catch {
      Alert.alert(t("common.unexpected_error"));
    }
  };

  return (
    <OnboardingShell
      step={11}
      totalSteps={12}
      title={t("onboarding.plan.title")}
      subtitle={`${t("onboarding.plan.subtitle_prefix")}${t("auth.login.brand_name")}${t("onboarding.plan.subtitle_suffix")}\n${t("onboarding.plan.subtitle_do_not_pay")}`}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <Feather name="award" size={112} color={theme.primary} />
          </View>
        </HeroCard>
      }
      footer={
        <View style={styles.actions}>
          <Button title={t("common.back")} variant="secondary" onPress={onBack} disabled={loading} />
          <Button
            title={t("common.next")}
            onPress={onContinue}
            disabled={loading || selectedPlan !== "free"}
            loading={loading}
          />
        </View>
      }
    >
      <View style={styles.section}>
        <Pressable
          onPress={() => onSelectedPlanChange("free")}
          disabled={loading}
          accessibilityRole="radio"
          accessibilityState={{ selected: freeSelected, disabled: loading }}
          accessibilityLabel={t("onboarding.plan.free_accessibility_label")}
          accessibilityHint={t("onboarding.plan.tap_to_select")}
          style={({ pressed }) => [
            styles.pressable,
            pressed && styles.pressablePressed,
            loading && styles.pressableDisabled,
          ]}
        >
          <Card
            style={[
              styles.card,
              {
                borderColor: freeSelected ? theme.primary : theme.border,
                backgroundColor: freeSelected ? theme.surface : theme.card,
                shadowColor: theme.text,
              },
            ]}
          >
            <View style={styles.badgeRow}>
              <View style={[styles.badgePill, { backgroundColor: theme.primary }]}>
                <Feather name="star" size={14} color={theme.primaryText} />
                <Text style={[styles.badgeText, { color: theme.primaryText }]}>
                  {t("onboarding.plan.badge_recommended")}
                </Text>
              </View>
            </View>

            <Text variant="label" style={styles.planTitle}>
              {t("auth.login.brand_name")} {t("onboarding.plan.free_name_suffix")}
            </Text>
            <Text tone="muted" style={styles.planValue}>
              {t("onboarding.plan.free_value")}
            </Text>

            <View style={styles.bullets}>
              {freeBullets.map((bullet, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Feather name="check-circle" size={16} color={theme.primary} />
                  <Text tone="muted" style={styles.bulletText}>
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>

            <Button
              title={t("onboarding.plan.free_cta")}
              onPress={() => onSelectedPlanChange("free")}
              loading={loading}
              disabled={loading}
              style={styles.innerButton}
            />
          </Card>
        </Pressable>

        <Pressable
          onPress={() => onSelectedPlanChange("premium")}
          disabled={loading}
          accessibilityRole="radio"
          accessibilityState={{ selected: premiumSelected, disabled: loading }}
          accessibilityLabel={t("onboarding.plan.premium_accessibility_label")}
          accessibilityHint={t("onboarding.plan.tap_to_select")}
          style={({ pressed }) => [
            styles.pressable,
            pressed && styles.pressablePressed,
            loading && styles.pressableDisabled,
          ]}
        >
          <Card
            style={[
              styles.card,
              {
                borderColor: premiumSelected ? theme.danger : theme.border,
                backgroundColor: premiumSelected ? theme.surface : theme.card,
                shadowColor: theme.text,
              },
            ]}
          >
            <View style={styles.badgeRow}>
              <View style={[styles.badgePill, { backgroundColor: theme.danger }]}>
                <Feather name="alert-circle" size={14} color={theme.dangerText} />
                <Text style={[styles.badgeText, { color: theme.dangerText }]}>
                  {t("onboarding.plan.badge_do_not_select")}
                </Text>
              </View>
            </View>

            <Text variant="label" style={styles.planTitle}>
              {t("auth.login.brand_name")} {t("onboarding.plan.premium_name_suffix")}
            </Text>
            <Text variant="label" style={styles.sectionTitle}>
              {t("onboarding.plan.premium_why_title")}
            </Text>

            <View style={styles.bullets}>
              {premiumBullets.map((bullet, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Feather name="info" size={16} color={theme.danger} />
                  <Text tone="muted" style={styles.bulletText}>
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>

            <Button
              title={t("onboarding.plan.premium_cta")}
              variant="secondary"
              onPress={() => {
                onPremiumInsist();
                setDonationOpen(true);
              }}
              loading={loading}
              disabled={loading}
              style={styles.innerButton}
            />
          </Card>
        </Pressable>

      </View>

      <Modal
        visible={donationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDonationOpen(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}
          onPress={() => setDonationOpen(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text variant="label" style={styles.modalTitle}>
              {t("onboarding.plan.donation_title")}
            </Text>
            <Text tone="muted" style={styles.modalBody}>
              {t("onboarding.plan.donation_body")}
            </Text>

            <View style={styles.modalButtons}>
              <Button title={t("onboarding.plan.donation_open")} onPress={openDonationLink} />
              <Button
                title={t("onboarding.plan.donation_not_now")}
                variant="secondary"
                onPress={() => setDonationOpen(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  heroVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressable: {
    width: "100%",
  },
  pressablePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  pressableDisabled: {
    opacity: 0.7,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  planTitle: {
    fontWeight: "700",
  },
  planValue: {
    marginTop: -spacing.xs,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  bullets: {
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bulletText: {
    flex: 1,
  },
  innerButton: {
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    fontWeight: "700",
  },
  modalBody: {
    lineHeight: 20,
  },
  modalButtons: {
    gap: spacing.md,
  },
});
