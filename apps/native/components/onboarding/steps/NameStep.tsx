import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { DEFAULT_DOB_DATE } from "@/lib/validation/date";
import Feather from "@expo/vector-icons/Feather";
import { useThemeMode } from "../../../contexts/ThemeModeContext";
import {
  formatDob,
  getAgeFromDob,
  getDobMaxDate,
  getDobMinDate,
  parseDob,
} from "../../../lib/dates/dobRules";
import { colors, radius, spacing } from "../../../theme/tokens";
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
  const initials = firstName.trim().length > 0 ? firstName.trim()[0]?.toUpperCase() : "";
  const dobMinDate = getDobMinDate();
  const dobMaxDate = getDobMaxDate();
  const dobPickerDate = useMemo(() => {
    if (dobDate) {
      return dobDate;
    }
    return clampDate(DEFAULT_DOB_DATE, dobMinDate, dobMaxDate);
  }, [dobDate, dobMinDate, dobMaxDate]);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const nextUri = result.assets?.[0]?.uri ?? null;
    onAvatarChange(nextUri);
  };

  return (
    <OnboardingShell
      step={1}
      totalSteps={12}
      title={t("onboarding.name_age.title")}
    >
      <View style={styles.section}>
          <View style={styles.avatarWrap}>
            <View
              style={[
                styles.avatarOuter,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: theme.text,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarRing,
                  { borderColor: theme.brandAvo, backgroundColor: theme.card },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { borderColor: theme.brandVibe, backgroundColor: theme.surface },
                  ]}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <Text tone="muted" style={styles.avatarPlaceholder}>
                      {initials}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.name_age.photo_change_label")}
              hitSlop={styles.iconHitSlop}
              onPress={pickAvatar}
              disabled={saving}
              style={[
                styles.avatarButton,
                styles.avatarButtonBottom,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: theme.text,
                },
              ]}
            >
              <Feather name="camera" size={14} color={theme.text} />
            </Pressable>
          </View>

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
              labelStyle={styles.inputLabel}
              style={[styles.inputControl, { borderColor: theme.border }]}
            />
            <Text
              variant="caption"
              tone="muted"
              style={[styles.helperText, { color: theme.textMuted }]}
            >
              {t("onboarding.name_age.preferred_name_helper")}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text variant="label" tone="muted" style={styles.inputLabel}>
              {t("onboarding.name_age.dob_label")} *
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setShowDobPicker((prev) => (Platform.OS === "ios" ? !prev : true))
              }
              disabled={saving}
              style={[
                styles.dobField,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: dobError ? theme.danger : theme.inputBorder,
                },
              ]}
            >
              <Text tone={dobTone} style={styles.dobText}>
                {dobDisplay}
              </Text>
              <View pointerEvents="none" style={styles.dobIcon}>
                <Feather name="calendar" size={18} color={theme.textMuted} />
              </View>
            </Pressable>
            <Text variant="caption" tone="muted" style={styles.dobHelper}>
              {t("onboarding.name_age.subtitle")}
            </Text>
            {age !== null ? (
              <Text variant="caption" tone="muted" style={styles.ageText}>
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
              value={dobPickerDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              textColor={Platform.OS === "ios" ? theme.text : undefined}
              minimumDate={dobMinDate}
              maximumDate={dobMaxDate}
              onChange={(event, selected) => {
                const eventType = (event as any)?.type;
                if (eventType === "dismissed") {
                  setShowDobPicker(false);
                  return;
                }
                if (selected) {
                  onDateOfBirthChange(formatDob(selected));
                }
                if (Platform.OS !== "ios") {
                  setShowDobPicker(false);
                }
              }}
            />
          ) : null}

          <ThemeModeToggle />

          {error && !nameError && !dobError ? (
            <Text tone="danger" style={styles.centerText}>
              {t(error)}
            </Text>
          ) : null}

          <Button
            title={t("common.next")}
            onPress={onContinue}
            disabled={saving}
            loading={saving}
            style={[styles.nextButton, { shadowColor: theme.text }]}
          />
      </View>
    </OnboardingShell>
  );
}

function ThemeModeToggle() {
  const { mode, setMode } = useThemeMode();
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const modeLabel =
    mode === "light"
      ? t("onboarding.name_age.appearance_value_light")
      : mode === "dark"
        ? t("onboarding.name_age.appearance_value_dark")
        : t("onboarding.name_age.appearance_value_system");
  const modeIcon =
    mode === "light" ? "sun" : mode === "dark" ? "moon" : "monitor";

  const cycleMode = () => {
    if (mode === "system") {
      setMode("light");
      return;
    }
    if (mode === "light") {
      setMode("dark");
      return;
    }
    setMode("system");
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t("onboarding.name_age.appearance_title")}, ${modeLabel}`}
      onPress={cycleMode}
      style={({ pressed }) => [styles.themePressable, pressed && styles.themePressed]}
    >
      <Card
        style={[
          styles.themeCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.text,
          },
        ]}
      >
        <View style={styles.themeRow}>
          <View style={styles.themeIcon}>
            <Feather name={modeIcon} size={18} color={theme.textMuted} />
          </View>
          <View style={styles.themeText}>
            <Text style={styles.sectionTitle}>{t("onboarding.name_age.appearance_title")}</Text>
            <Text tone="muted" style={styles.themeSubtitle}>
              {t("onboarding.name_age.appearance_subtitle")}
            </Text>
          </View>
          <View style={[styles.themeValue, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.primary }}>{modeLabel}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function clampDate(value: Date, min: Date, max: Date) {
  const time = value.getTime();
  if (time < min.getTime()) {
    return min;
  }
  if (time > max.getTime()) {
    return max;
  }
  return value;
}

function isNameError(error: string) {
  return error.startsWith("onboarding.name_age.error_name");
}

function isDobError(error: string) {
  return error.startsWith("onboarding.name_age.error_dob") || error.startsWith("onboarding.name_age.error_age");
}

const styles = StyleSheet.create({
  dobHelper: {
    textAlign: "left",
  },
  section: {
    gap: spacing.sm,
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: 132,
    height: 132,
    alignSelf: "center",
  },
  avatarOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: "cover",
  },
  avatarPlaceholder: {
    fontSize: 28,
    fontWeight: "600",
  },
  avatarButton: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarButtonTop: {
    top: 6,
    right: 6,
  },
  avatarButtonBottom: {
    bottom: 6,
    right: 6,
  },
  iconHitSlop: {
    top: 12,
    right: 12,
    bottom: 12,
    left: 12,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs / 2,
  },
  inputControl: {
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  helperText: {
    opacity: 0.9,
    marginTop: spacing.xs / 2,
  },
  dobField: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dobText: {
    flex: 1,
  },
  dobIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  ageText: {},
  sectionTitle: {
    fontWeight: "600",
    textAlign: "center",
  },
  themeSubtitle: {
    textAlign: "center",
  },
  themePressable: {
    width: "100%",
  },
  themePressed: {
    opacity: 0.9,
  },
  themeCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  themeIcon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  themeText: {
    flex: 1,
    gap: spacing.xs,
  },
  themeValue: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  nextButton: {
    minHeight: 56,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  centerText: {
    textAlign: "center",
  },
});
