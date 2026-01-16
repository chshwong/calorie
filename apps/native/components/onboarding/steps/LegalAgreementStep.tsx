import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Feather from "@expo/vector-icons/Feather";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReferenceModal } from "@/components/ui/ReferenceModal";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";
import { type LegalDocument, type LegalDocType } from "../../../../legal/legal-documents";

type CheckboxState = Record<LegalDocType, boolean>;

type LegalAgreementStepProps = {
  documents: LegalDocument[];
  checked: CheckboxState;
  loading: boolean;
  docsLoading: boolean;
  errorKey: string | null;
  onRetry: () => void;
  onCheckedChange: (docType: LegalDocType, value: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function LegalAgreementStep({
  documents,
  checked,
  loading,
  docsLoading,
  errorKey,
  onRetry,
  onCheckedChange,
  onBack,
  onContinue,
}: LegalAgreementStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);

  const allChecked = useMemo(
    () => documents.length > 0 && documents.every((doc) => checked[doc.docType]),
    [documents, checked]
  );

  const checkboxLabelFor = (docType: LegalDocType) => {
    switch (docType) {
      case "terms":
        return t("onboarding.legal.agree_terms");
      case "privacy":
        return t("onboarding.legal.agree_privacy");
      case "health_disclaimer":
        return t("onboarding.legal.acknowledge_risk");
      default:
        return "";
    }
  };

  return (
    <OnboardingShell
      step={12}
      totalSteps={12}
      title={t("onboarding.legal.title")}
      subtitle={t("onboarding.legal.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <Feather name="file-text" size={56} color={theme.primary} />
          </View>
        </HeroCard>
      }
    >
      <View style={styles.section}>
        {errorKey ? (
          <View style={styles.errorBlock}>
            <Text tone="danger" style={styles.centerText}>
              {t("onboarding.legal.error_prefix")} {t(errorKey)}
            </Text>
            <Button
              title={t("onboarding.legal.retry")}
              variant="secondary"
              onPress={onRetry}
              disabled={loading || docsLoading}
            />
          </View>
        ) : null}

        {docsLoading ? (
          <Text tone="muted" style={styles.centerText}>
            {t("onboarding.legal.loading")}
          </Text>
        ) : documents.length === 0 ? (
          <OnboardingErrorBox message={t("onboarding.legal.error_no_docs")} />
        ) : (
          <View style={styles.cardList}>
            {documents.map((doc) => {
              const isChecked = checked[doc.docType];
              const checkboxLabel = checkboxLabelFor(doc.docType);

              return (
                <Card
                  key={`${doc.docType}:${doc.version}`}
                  style={[
                    styles.card,
                    { borderColor: theme.border, backgroundColor: theme.card },
                  ]}
                >
                  <View style={styles.cardRow}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked, disabled: loading }}
                      accessibilityLabel={checkboxLabel}
                      accessibilityHint={t("onboarding.legal.double_tap_check", {
                        action: isChecked
                          ? t("onboarding.legal.action_uncheck")
                          : t("onboarding.legal.action_check"),
                        label: checkboxLabel,
                      })}
                      onPress={() => onCheckedChange(doc.docType, !isChecked)}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.checkboxPressable,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: isChecked ? theme.primary : theme.border,
                            backgroundColor: isChecked ? theme.primary : "transparent",
                          },
                        ]}
                      >
                        {isChecked ? (
                          <Feather name="check" size={14} color={theme.primaryText} />
                        ) : null}
                      </View>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.docContent,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => setOpenDoc(doc)}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel={t("onboarding.legal.open_label", { title: doc.title })}
                      accessibilityHint={t("onboarding.legal.double_tap_open", { title: doc.title })}
                    >
                      <View style={styles.docText}>
                        <Text variant="label">{doc.title}</Text>
                        <Text tone="muted" variant="caption">
                          {t("onboarding.legal.version")}: {doc.version}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={theme.text} />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View style={styles.actions}>
          <Button title={t("common.back")} variant="secondary" onPress={onBack} disabled={loading} />
          <Button
            title={t("common.next")}
            onPress={onContinue}
            disabled={loading || !allChecked}
            loading={loading}
          />
        </View>
      </View>

      <ReferenceModal
        visible={Boolean(openDoc)}
        title={openDoc?.title ?? ""}
        subtitle={
          openDoc ? `${t("onboarding.legal.version")}: ${openDoc.version}` : undefined
        }
        onClose={() => setOpenDoc(null)}
        closeLabel={t("onboarding.legal.close")}
      >
        <Text style={styles.modalBody}>{openDoc?.contentMd ?? ""}</Text>
      </ReferenceModal>
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
  cardList: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  checkboxPressable: {
    padding: spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  docContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  docText: {
    flex: 1,
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.md,
  },
  errorBlock: {
    gap: spacing.sm,
    alignItems: "center",
  },
  centerText: {
    textAlign: "center",
  },
  pressed: {
    opacity: 0.9,
  },
  modalBody: {
    lineHeight: 20,
  },
});
