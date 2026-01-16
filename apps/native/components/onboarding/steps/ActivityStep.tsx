import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Feather from "@expo/vector-icons/Feather";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ActivityStepContent } from "@/components/onboarding/ActivityStepContent";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { ActivityLevel, validateActivityLevel } from "@/lib/validation/activity";
import { colors, spacing } from "@/theme/tokens";

type ActivityStepProps = {
  activityLevel: ActivityLevel | "";
  loading: boolean;
  error: string | null;
  onActivityLevelChange: (level: ActivityLevel) => void;
  onErrorClear: () => void;
  onBack: () => void;
  onContinue: () => void;
};


export function ActivityStep({
  activityLevel,
  loading,
  error,
  onActivityLevelChange,
  onErrorClear,
  onBack,
  onContinue,
}: ActivityStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const validation = useMemo(
    () => validateActivityLevel(activityLevel),
    [activityLevel]
  );

  return (
    <OnboardingShell
      step={4}
      totalSteps={12}
      title={t("onboarding.activity.title")}
      subtitle={t("onboarding.activity.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <Feather name="activity" size={56} color={theme.primary} />
          </View>
        </HeroCard>
      }
    >
      <View style={styles.section}>
        <ActivityStepContent
          value={activityLevel}
          onChange={(level) => {
            onActivityLevelChange(level);
            onErrorClear();
          }}
          disabled={loading}
        />

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
            disabled={loading || !validation.ok}
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
  heroVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
});
