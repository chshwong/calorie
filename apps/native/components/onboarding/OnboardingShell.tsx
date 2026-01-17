import React, { useMemo } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  footer?: React.ReactNode;
};

const FOOTER_HEIGHT = 100;

export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  hero,
  children,
  footer,
}: OnboardingShellProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const insets = useSafeAreaInsets();
  const brandName = t("auth.login.brand_name");
  const brandParts = useMemo(() => {
    const avo = brandName.slice(0, 3);
    const vibe = brandName.slice(3);
    return { avo, vibe };
  }, [brandName]);

  const footerPadBottom = Math.max(insets.bottom, spacing.md);
  const footerHeightWithPadding = FOOTER_HEIGHT + footerPadBottom + spacing.md;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flex}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              footer && { paddingBottom: footerHeightWithPadding + spacing.xl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
            <OnboardingCard>{children}</OnboardingCard>
          </ScrollView>
          {footer ? (
            <View
              style={[
                styles.footer,
                {
                  borderTopColor: theme.border,
                  backgroundColor: theme.background,
                  paddingBottom: footerPadBottom,
                },
              ]}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    backgroundColor: "transparent",
  },
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
