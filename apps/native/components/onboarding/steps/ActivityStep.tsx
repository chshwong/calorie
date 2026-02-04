import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";

import ActivityRunImage from "@/assets/activity_run.png";

import { ActivityStepContent } from "@/components/onboarding/ActivityStepContent";
import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { ActivityLevel, validateActivityLevel } from "@/lib/validation/activity";
import { spacing } from "@/theme/tokens";

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
          <View style={styles.heroContainer}>
            <Image
              source={ActivityRunImage}
              resizeMode="contain"
              style={styles.heroImage}
            />
          </View>
        </HeroCard>
      }
      footer={
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
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  heroContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: 120,
    height: 120,
    opacity: 0.95,
  },
  actions: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
});
