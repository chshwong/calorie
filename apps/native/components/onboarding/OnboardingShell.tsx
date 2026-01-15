import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Text } from "../ui/Text";
import { useColorScheme } from "../useColorScheme";
import { colors, fontSizes, spacing } from "../../theme/tokens";
import { OnboardingCard } from "./OnboardingCard";

type OnboardingShellProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  hero?: React.ReactNode;
  children: React.ReactNode;
};

export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  hero,
  children,
}: OnboardingShellProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const brandName = t("auth.login.brand_name");
  const brandParts = useMemo(() => {
    const avo = brandName.slice(0, 3);
    const vibe = brandName.slice(3);
    return { avo, vibe };
  }, [brandName]);

  return (
    <>
      <Text variant="title" style={styles.headerTitle}>
        <Text variant="title">{t("onboarding.header_prefix")}</Text>
        <Text variant="title" style={{ color: theme.brandAvo }}>
          {brandParts.avo}
        </Text>
        <Text variant="title" style={{ color: theme.brandVibe }}>
          {brandParts.vibe}
        </Text>
      </Text>
      <StepIndicator activeStep={step} totalSteps={totalSteps} />
      {hero ? <View style={styles.hero}>{hero}</View> : null}
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" tone="muted" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      <OnboardingCard>
        {children}
      </OnboardingCard>
    </>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    textAlign: "center",
  },
  hero: {
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    textAlign: "center",
    fontSize: fontSizes.title + 2,
    fontWeight: "700",
  },
  subtitle: {
    textAlign: "center",
  },
});
