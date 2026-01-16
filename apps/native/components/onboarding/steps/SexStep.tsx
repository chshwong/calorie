import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { colors, fontSizes, fontWeights, spacing } from "../../../theme/tokens";
import { Button } from "../../ui/Button";
import { ChoiceTile } from "../../ui/ChoiceTile";
import { Text } from "../../ui/Text";
import { useColorScheme } from "../../useColorScheme";

type SexOption = "male" | "female";

type SexStepProps = {
  sex: SexOption | "";
  onSexChange: (sex: SexOption) => void;
  onErrorClear: () => void;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
  error?: string | null;
};

export function SexStep({
  sex,
  onSexChange,
  onErrorClear,
  loading,
  onBack,
  onContinue,
  error,
}: SexStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const options: Array<{ value: SexOption; labelKey: string }> = [
    { value: "male", labelKey: "onboarding.sex.male" },
    { value: "female", labelKey: "onboarding.sex.female" },
  ];

  return (
    <OnboardingShell
      step={2}
      totalSteps={12}
      title={t("onboarding.sex.title")}
      subtitle={t("onboarding.sex.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroRow}>
            <Text style={[styles.illustrationSymbol, { color: theme.primary }]}>♀</Text>
            <Text style={[styles.illustrationSymbol, { color: theme.primary }]}>♂</Text>
          </View>
        </HeroCard>
      }
    >
      <View style={styles.section}>
          <View style={styles.options}>
            {options.map((option) => {
              const selected = sex === option.value;
              return (
                <ChoiceTile
                  key={option.value}
                  title={t(option.labelKey)}
                  selected={selected}
                  disabled={loading}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSexChange(option.value);
                    onErrorClear();
                  }}
                />
              );
            })}
          </View>

          {error ? (
            <Text variant="caption" tone="danger" style={styles.centerText}>
              {t(error)}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              title={t("common.back")}
              variant="secondary"
              onPress={onBack}
              disabled={loading}
            />
            <Button
              title={t("common.next")}
              onPress={onContinue}
              disabled={loading || !sex}
              loading={loading}
            />
          </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  illustrationSymbol: {
    fontSize: fontSizes.illustration,
    fontWeight: fontWeights.bold,
  },
  options: {
    gap: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
});
