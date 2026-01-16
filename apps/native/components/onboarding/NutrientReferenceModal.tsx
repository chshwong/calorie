import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ReferenceModal } from "@/components/ui/ReferenceModal";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, spacing } from "@/theme/tokens";

export type NutrientType = "protein" | "fiber" | "carbs" | "sugar" | "sodium";

type NutrientReferenceModalProps = {
  visible: boolean;
  nutrientType: NutrientType;
  sexAtBirth: "male" | "female" | "" | null;
  onClose: () => void;
};

type NutrientReferenceContent = {
  titleKey: string;
  whyTrackKey: string;
  whatToAimForKey: string;
  typicalRanges?: {
    maleKey?: string;
    femaleKey?: string;
    combinedKey?: string;
  };
  realisticStartKey?: string;
  whenNotApplyKey?: string;
  disclaimerKey: string;
};

const CONTENT_KEYS: Record<NutrientType, NutrientReferenceContent> = {
  protein: {
    titleKey: "onboarding.daily_targets.reference.protein.title",
    whyTrackKey: "onboarding.daily_targets.reference.protein.why_track",
    whatToAimForKey: "onboarding.daily_targets.reference.protein.what_to_aim_for",
    typicalRanges: {
      femaleKey: "onboarding.daily_targets.reference.protein.typical_ranges.female",
      combinedKey: "onboarding.daily_targets.reference.protein.typical_ranges.combined",
    },
    disclaimerKey: "onboarding.daily_targets.reference.protein.disclaimer",
  },
  fiber: {
    titleKey: "onboarding.daily_targets.reference.fiber.title",
    whyTrackKey: "onboarding.daily_targets.reference.fiber.why_track",
    whatToAimForKey: "onboarding.daily_targets.reference.fiber.what_to_aim_for",
    typicalRanges: {
      maleKey: "onboarding.daily_targets.reference.fiber.typical_ranges.male",
      femaleKey: "onboarding.daily_targets.reference.fiber.typical_ranges.female",
      combinedKey: "onboarding.daily_targets.reference.fiber.typical_ranges.combined",
    },
    realisticStartKey: "onboarding.daily_targets.reference.fiber.realistic_start",
    disclaimerKey: "onboarding.daily_targets.reference.fiber.disclaimer",
  },
  carbs: {
    titleKey: "onboarding.daily_targets.reference.carbs.title",
    whyTrackKey: "onboarding.daily_targets.reference.carbs.why_track",
    whatToAimForKey: "onboarding.daily_targets.reference.carbs.what_to_aim_for",
    typicalRanges: {
      combinedKey: "onboarding.daily_targets.reference.carbs.typical_ranges.combined",
    },
    disclaimerKey: "onboarding.daily_targets.reference.carbs.disclaimer",
  },
  sugar: {
    titleKey: "onboarding.daily_targets.reference.sugar.title",
    whyTrackKey: "onboarding.daily_targets.reference.sugar.why_track",
    whatToAimForKey: "onboarding.daily_targets.reference.sugar.what_to_aim_for",
    disclaimerKey: "onboarding.daily_targets.reference.sugar.disclaimer",
  },
  sodium: {
    titleKey: "onboarding.daily_targets.reference.sodium.title",
    whyTrackKey: "onboarding.daily_targets.reference.sodium.why_track",
    whatToAimForKey: "onboarding.daily_targets.reference.sodium.what_to_aim_for",
    whenNotApplyKey: "onboarding.daily_targets.reference.sodium.when_not_apply",
    disclaimerKey: "onboarding.daily_targets.reference.sodium.disclaimer",
  },
};

export function NutrientReferenceModal({
  visible,
  nutrientType,
  sexAtBirth,
  onClose,
}: NutrientReferenceModalProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const content = CONTENT_KEYS[nutrientType];
  const normalizedSex = sexAtBirth === "male" || sexAtBirth === "female" ? sexAtBirth : null;

  return (
    <ReferenceModal
      visible={visible}
      title={t(content.titleKey)}
      onClose={onClose}
      closeLabel={t("common.close")}
    >
      <View style={styles.section}>
        <Text variant="label">{t("onboarding.daily_targets.reference.sections.why_track")}</Text>
        <Text variant="caption" tone="muted">
          {t(content.whyTrackKey)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label">{t("onboarding.daily_targets.reference.sections.what_to_aim_for")}</Text>
        <Text variant="caption" tone="muted">
          {t(content.whatToAimForKey)}
        </Text>
        {content.typicalRanges ? (
          <View style={styles.subsection}>
            <Text variant="label">{t("onboarding.daily_targets.reference.sections.typical_ranges")}</Text>
            {normalizedSex === "male" && content.typicalRanges.maleKey ? (
              <Text variant="caption" tone="muted">
                {t(content.typicalRanges.maleKey)}
              </Text>
            ) : null}
            {normalizedSex === "female" && content.typicalRanges.femaleKey ? (
              <Text variant="caption" tone="muted">
                {t(content.typicalRanges.femaleKey)}
              </Text>
            ) : null}
            {content.typicalRanges.combinedKey ? (
              <Text variant="caption" tone="muted">
                {t(content.typicalRanges.combinedKey)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {content.realisticStartKey ? (
          <View style={styles.subsection}>
            <Text variant="label">{t("onboarding.daily_targets.reference.sections.realistic_start")}</Text>
            <Text variant="caption" tone="muted">
              {t(content.realisticStartKey)}
            </Text>
          </View>
        ) : null}
      </View>

      {content.whenNotApplyKey ? (
        <View style={styles.section}>
          <Text variant="label">{t("onboarding.daily_targets.reference.sections.when_not_apply")}</Text>
          <Text variant="caption" tone="muted">
            {t(content.whenNotApplyKey)}
          </Text>
        </View>
      ) : null}

      <View style={[styles.section, styles.disclaimer, { borderTopColor: theme.border }]}>
        <Text variant="caption" tone="muted">
          {t(content.disclaimerKey)}
        </Text>
      </View>
    </ReferenceModal>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  subsection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  disclaimer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
});
