import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { useThemeMode } from "../../../contexts/ThemeModeContext";
import {
  formatDob,
  getAgeFromDob,
  getDobMaxDate,
  getDobMinDate,
  parseDob,
} from "../../../lib/dates/dobRules";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AvatarPicker } from "../../ui/AvatarPicker";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { Text } from "../../ui/Text";
import { useColorScheme } from "../../useColorScheme";

type NameStepProps = {
  firstName: string;
  dateOfBirth: string;
  avatarUri: string | null;
  error: string | null;
  saving: boolean;
  onFirstNameChange: (value: string) => void;
  onFirstNameBlur: () => void;
  onDateOfBirthChange: (value: string) => void;
  onAvatarChange: (value: string | null) => void;
  onContinue: () => void;
};

export function NameStep({
  firstName,
  dateOfBirth,
  avatarUri,
  error,
  saving,
  onFirstNameChange,
  onFirstNameBlur,
  onDateOfBirthChange,
  onAvatarChange,
  onContinue,
}: NameStepProps) {
  const { t } = useTranslation();
  const [showDobPicker, setShowDobPicker] = useState(false);
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const dobDate = parseDob(dateOfBirth);
  const dobDisplay = dateOfBirth || t("onboarding.name_age.dob_placeholder");
  const dobTone = dateOfBirth ? "default" : "muted";
  const age = dateOfBirth ? getAgeFromDob(dateOfBirth) : null;
  const nameError = error && isNameError(error) ? error : undefined;
  const dobError = error && isDobError(error) ? error : undefined;
  const brandName = t("auth.login.brand_name");
  const brandParts = useMemo(() => {
    const avo = brandName.slice(0, 3);
    const vibe = brandName.slice(3);
    return { avo, vibe };
  }, [brandName]);

  return (
    <>
      <StepIndicator activeStep={1} totalSteps={12} />
      <Text variant="caption" tone="muted" style={styles.stepCaption}>
        {t("onboarding.step1_title")}
      </Text>
      <YourAvoVibeHeader brandAvo={brandParts.avo} brandVibe={brandParts.vibe} />
      <Text variant="title" style={styles.title}>
        {t("onboarding.name_age.title")}
      </Text>
      <Text tone="muted" style={styles.subtitle}>
        {t("onboarding.name_age.subtitle")}
      </Text>

      <Card>
        <View style={styles.section}>
          <AvatarPicker uri={avatarUri} onChange={onAvatarChange} />

          <View style={styles.fieldGroup}>
            <Input
              label={`${t("onboarding.name_age.preferred_name_label")} *`}
              value={firstName}
              onChangeText={onFirstNameChange}
              onBlur={onFirstNameBlur}
              placeholder={t("onboarding.name_age.preferred_name_placeholder")}
              autoCapitalize="words"
              editable={!saving}
              error={nameError ? t(nameError) : undefined}
            />
            <Text variant="caption" tone="muted">
              {t("onboarding.name_age.preferred_name_helper")}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text variant="caption" tone="muted" style={styles.inputLabel}>
              {t("onboarding.name_age.dob_label")} *
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDobPicker(true)}
              disabled={saving}
              style={[
                styles.dobField,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: dobError ? theme.danger : theme.inputBorder,
                },
              ]}
            >
              <Text tone={dobTone}>{dobDisplay}</Text>
            </Pressable>
            {age !== null ? (
              <Text variant="caption" tone="muted">
                {t("onboarding.name_age.age_display", { age })}
              </Text>
            ) : null}
            {dobError ? (
              <Text variant="caption" tone="danger">
                {t(dobError)}
              </Text>
            ) : null}
          </View>
          {showDobPicker ? (
            <DateTimePicker
              value={dobDate ?? getDobMaxDate()}
              mode="date"
              display="default"
              minimumDate={getDobMinDate()}
              maximumDate={getDobMaxDate()}
              onChange={(event, selected) => {
                const eventType = (event as any)?.type;
                if (eventType === "dismissed") {
                  setShowDobPicker(false);
                  return;
                }
                if (selected) {
                  onDateOfBirthChange(formatDob(selected));
                }
                setShowDobPicker(false);
              }}
            />
          ) : null}

          <ThemeModeToggle />

          {error && !nameError && !dobError ? (
            <Text tone="danger" style={styles.centerText}>
              {t(error)}
            </Text>
          ) : null}

          <Button title={t("common.next")} onPress={onContinue} disabled={saving} />
        </View>
      </Card>
    </>
  );
}

function ThemeModeToggle() {
  const { mode, setMode } = useThemeMode();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();

  return (
    <View style={styles.themeSection}>
      <Text style={styles.sectionTitle}>{t("onboarding.name_age.appearance_title")}</Text>
      <Text tone="muted" style={styles.themeSubtitle}>
        {t("onboarding.name_age.appearance_subtitle")}
      </Text>
      <View style={styles.themeButtons}>
        <Button
          title={t("onboarding.name_age.appearance_value_system")}
          variant={mode === "system" ? "primary" : "ghost"}
          onPress={() => setMode("system")}
          style={styles.themeButton}
          titleProps={{ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85 }}
        />
        <Button
          title={t("onboarding.name_age.appearance_value_light")}
          variant={mode === "light" ? "primary" : "ghost"}
          onPress={() => setMode("light")}
          style={styles.themeButton}
          titleProps={{ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85 }}
        />
        <Button
          title={t("onboarding.name_age.appearance_value_dark")}
          variant={mode === "dark" ? "primary" : "ghost"}
          onPress={() => setMode("dark")}
          style={styles.themeButton}
          titleProps={{ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85 }}
        />
      </View>
    </View>
  );
}

function YourAvoVibeHeader({ brandAvo, brandVibe }: { brandAvo: string; brandVibe: string }) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const { t } = useTranslation();

  return (
    <Text variant="title" style={styles.headerTitle}>
      <Text variant="title">{t("onboarding.header_prefix")}</Text>
      <Text variant="title" style={{ color: theme.brandAvo }}>
        {brandAvo}
      </Text>
      <Text variant="title" style={{ color: theme.brandVibe }}>
        {brandVibe}
      </Text>
    </Text>
  );
}

function isNameError(error: string) {
  return error.startsWith("onboarding.name_age.error_name");
}

function isDobError(error: string) {
  return error.startsWith("onboarding.name_age.error_dob") || error.startsWith("onboarding.name_age.error_age");
}

const styles = StyleSheet.create({
  stepCaption: {
    textAlign: "center",
  },
  headerTitle: {
    textAlign: "center",
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  section: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  dobField: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  themeSection: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontWeight: "600",
    textAlign: "center",
  },
  themeSubtitle: {
    textAlign: "center",
  },
  themeButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  themeButton: {
    flex: 1,
  },
  centerText: {
    textAlign: "center",
  },
});
