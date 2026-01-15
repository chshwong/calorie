import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import * as React from "react";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { NameStep } from "@/components/onboarding/steps/NameStep";
import { PlaceholderStep } from "@/components/onboarding/steps/PlaceholderStep";
import { SexStep } from "@/components/onboarding/steps/SexStep";
import {
  completeOnboardingProfile,
  fetchOnboardingProfile,
  saveStepOneProfile,
  saveStepTwoProfile,
} from "@/services/onboarding";
import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { ThemeModeProvider } from "../contexts/ThemeModeContext";
import { validateDob } from "../lib/dates/dobRules";
import {
  filterPreferredNameInput,
  normalizePreferredName,
  validatePreferredName,
} from "../lib/validation/preferredName";
import { spacing } from "../theme/tokens";

export default function OnboardingScreen() {
  const { user, loading, onboardingComplete, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "not_telling" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightLb, setWeightLb] = useState("");

  const completeMutation = useMutation({
    mutationFn: completeOnboardingProfile,
  });
  const stepOneMutation = useMutation({
    mutationFn: saveStepOneProfile,
  });
  const stepTwoMutation = useMutation({
    mutationFn: saveStepTwoProfile,
  });
  const queryClient = useQueryClient();
  const { data: profileData } = useQuery({
    queryKey: ["onboarding-profile", user?.id],
    queryFn: () => fetchOnboardingProfile(user!.id),
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (!profileData) return;

    if (!firstName && profileData.first_name) {
      setFirstName(profileData.first_name);
    }
    if (!dateOfBirth && profileData.date_of_birth) {
      setDateOfBirth(profileData.date_of_birth);
    }
    if (!avatarUri && profileData.avatar_url) {
      setAvatarUri(profileData.avatar_url);
    }
    if (!gender && (profileData.gender === "male" || profileData.gender === "female")) {
      setGender(profileData.gender);
    }
  }, [profileData, firstName, dateOfBirth, avatarUri, gender]);

  const handleSubmit = async () => {
    if (!user) return;

    // Basic validation - check required fields are filled
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!dateOfBirth.trim()) {
      setError("Date of birth is required");
      return;
    }
    if (!gender) {
      setError("Gender is required");
      return;
    }
    if (!heightCm.trim()) {
      setError("Height is required");
      return;
    }
    if (!weightLb.trim()) {
      setError("Weight is required");
      return;
    }

    // Parse numeric values
    const heightCmNum = parseFloat(heightCm);
    const weightLbNum = parseFloat(weightLb);

    if (isNaN(heightCmNum) || heightCmNum <= 0) {
      setError("Height must be a valid number");
      return;
    }
    if (isNaN(weightLbNum) || weightLbNum <= 0) {
      setError("Weight must be a valid number");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await completeMutation.mutateAsync({
        userId: user.id,
        firstName: firstName.trim(),
        dateOfBirth: dateOfBirth.trim(),
        gender,
        heightCm: heightCmNum,
        weightLb: weightLbNum,
      });

      if (!result.ok) {
        setError(result.error || "An unexpected error occurred");
        setSaving(false);
        return;
      }

      await refreshProfile();

      setSuccess("Onboarding completed!");

      setTimeout(() => {
        router.replace("/(tabs)/today");
      }, 1000);
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred");
      setSaving(false);
    }
  };

  const handleNameStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }
    const normalizedName = normalizePreferredName(firstName);
    const nameValidation = validatePreferredName(normalizedName);
    if (!nameValidation.ok) {
      setError(nameValidation.errorKey || "onboarding.name_age.error_name_invalid");
      return;
    }
    const dobValidation = validateDob(dateOfBirth);
    if (!dobValidation.ok) {
      setError(dobValidation.errorKey || "onboarding.name_age.error_dob_format");
      return;
    }
    if (normalizedName !== firstName) {
      setFirstName(normalizedName);
    }

    setSaving(true);
    try {
      const result = await stepOneMutation.mutateAsync({
        userId: user.id,
        firstName: normalizedName,
        dateOfBirth: dateOfBirth.trim(),
        avatarUrl: avatarUri,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(2);
    } catch (e) {
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSexStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }
    if (gender !== "male" && gender !== "female") {
      setError("onboarding.sex.error_select_sex");
      return;
    }

    setSaving(true);
    try {
      const result = await stepTwoMutation.mutateAsync({
        userId: user.id,
        gender,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(3);
    } catch (e) {
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemeModeProvider>
      <Screen padding={0}>
        {loading || onboardingComplete === null ? (
          <View style={styles.centered}>
            <Text tone="muted">Loading...</Text>
          </View>
        ) : !user ? (
          <Redirect href="/login" />
        ) : onboardingComplete === true ? (
          <Redirect href="/(tabs)/today" />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {currentStep === 1 ? (
              <NameStep
                firstName={firstName}
                dateOfBirth={dateOfBirth}
                avatarUri={avatarUri}
                error={error}
                saving={saving}
                onFirstNameChange={(text) =>
                  setFirstName(filterPreferredNameInput(firstName, text))
                }
                onFirstNameBlur={() => setFirstName(normalizePreferredName(firstName))}
                onDateOfBirthChange={setDateOfBirth}
                onAvatarChange={setAvatarUri}
                onContinue={handleNameStepContinue}
              />
            ) : currentStep === 2 ? (
              <SexStep
                sex={gender === "not_telling" ? "" : gender}
                loading={saving}
                error={error}
                onSexChange={(value) => setGender(value)}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(1)}
                onContinue={handleSexStepContinue}
              />
            ) : (
              <PlaceholderStep onBack={() => setCurrentStep(1)} />
            )}
          </ScrollView>
        )}
      </Screen>
    </ThemeModeProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
});