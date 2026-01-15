import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import * as React from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { NameStep } from "@/components/onboarding/steps/NameStep";
import { PlaceholderStep } from "@/components/onboarding/steps/PlaceholderStep";
import { completeOnboardingProfile } from "@/services/onboarding";
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

  // Auth and onboarding guards
  if (loading) {
    return (
      <View style={styles.centered}>
        <Text tone="muted">Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Profile is still loading
  if (onboardingComplete === null) {
    return (
      <View style={styles.centered}>
        <Text tone="muted">Loading...</Text>
      </View>
    );
  }

  // User already completed onboarding
  if (onboardingComplete === true) {
    return <Redirect href="/(tabs)/today" />;
  }

  const completeMutation = useMutation({
    mutationFn: completeOnboardingProfile,
  });

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

  // Safety check: guard should redirect, but handle brief null state
  if (!user) {
    return null;
  }

  return (
    <ThemeModeProvider>
      <Screen padding={0}>
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
              onContinue={() => {
                setError(null);
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
                setCurrentStep(2);
              }}
            />
          ) : (
            <PlaceholderStep onBack={() => setCurrentStep(1)} />
          )}
        </ScrollView>
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