import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, View } from "react-native";

import { DEFAULT_WEB_PATH } from "@/lib/webWrapper/webConfig";

import { ActivityStep } from "@/components/onboarding/steps/ActivityStep";
import { DailyFocusTargetsStep, type DailyFocusTargets } from "@/components/onboarding/steps/DailyFocusTargetsStep";
import { DailyTargetCaloriesStep } from "@/components/onboarding/steps/DailyTargetCaloriesStep";
import { GoalStep } from "@/components/onboarding/steps/GoalStep";
import { HeightStep } from "@/components/onboarding/steps/HeightStep";
import { LegalAgreementStep } from "@/components/onboarding/steps/LegalAgreementStep";
import { ModulePreferencesStep, type ModulePreference } from "@/components/onboarding/steps/ModulePreferencesStep";
import { NameStep } from "@/components/onboarding/steps/NameStep";
import { PlaceholderStep } from "@/components/onboarding/steps/PlaceholderStep";
import { PlanStep, type PlanSelection } from "@/components/onboarding/steps/PlanStep";
import { SexStep } from "@/components/onboarding/steps/SexStep";
import { buildWeightPayload, WeightStep } from "@/components/onboarding/steps/WeightStep";
import { uploadAvatar } from "@/services/avatar";
import { getActiveLegalDocuments } from "@/services/legal";
import {
    completeOnboardingProfile,
    fetchOnboardingProfile,
    fetchUserLegalAcceptances,
    finalizeOnboarding,
    saveAvatarProfile,
    saveModulePreferences,
    saveStepEightProfile,
    saveStepFiveProfile,
    saveStepFourProfile,
    saveStepNineProfile,
    saveStepOneProfile,
    saveStepSevenProfile,
    saveStepSixProfile,
    saveStepThreeProfile,
    saveStepTwoProfile,
    type UserLegalAcceptance,
} from "@/services/onboarding";
import { type LegalDocType, type LegalDocument } from "../../../legal/legal-documents";
import { mapCaloriePlanToDb } from "../../../lib/onboarding/calorie-plan";
import { HARD_HARD_STOP } from "../../../lib/onboarding/goal-calorie-nutrient-rules";
import { DebugErrorModal } from "../components/debug/DebugErrorModal";
import { GoalWeightStep } from "../components/onboarding/steps/GoalWeightStep";
import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { useColorScheme } from "../components/useColorScheme";
import { ThemeModeProvider } from "../contexts/ThemeModeContext";
import { validateDob } from "../lib/dates/dobRules";
import { kgToLb, lbToKg, roundTo3, roundTo1 as roundWeightTo1 } from "../lib/domain/conversions";
import { validateGoalWeight } from "../lib/onboarding/goal-weight-validation";
import { validateHeightInputs } from "../lib/onboarding/height-validation";
import { validateBodyFatPercent, validateWeightKg } from "../lib/onboarding/weight-validation";
import { ActivityLevel, validateActivityLevel } from "../lib/validation/activity";
import { GoalType, validateGoalType } from "../lib/validation/goal";
import {
    cmToFtIn,
    HeightUnit,
    roundTo1,
} from "../lib/validation/height";
import {
    filterPreferredNameInput,
    normalizePreferredName,
    validatePreferredName,
} from "../lib/validation/preferredName";
import { WeightUnit } from "../lib/validation/weight";
import { colors, spacing } from "../theme/tokens";

// Helper to convert unknown errors to readable strings (DEV only)
function formatErrorForDebug(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n\nStack:\n${error.stack || "No stack trace available"}`;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export default function OnboardingScreen() {
  // DEV-only debug error handlers
  const showDebugError = React.useCallback((error: unknown, title?: string) => {
    if (__DEV__) {
      setDebugError({
        title,
        message: formatErrorForDebug(error),
      });
    }
  }, []);

  const clearDebugError = React.useCallback(() => {
    setDebugError(null);
  }, []);
  const { t } = useTranslation();
  const { user, loading, onboardingComplete, refreshProfile } = useAuth();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<{ title?: string; message: string } | null>(null);
  const [goalWeightErrorKey, setGoalWeightErrorKey] = useState<string | null>(null);
  const [goalWeightErrorParams, setGoalWeightErrorParams] = useState<Record<string, any> | null>(
    null
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [avatarRemoteUrl, setAvatarRemoteUrl] = useState<string | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "not_telling" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">("");
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [currentWeightLb, setCurrentWeightLb] = useState("");
  const [currentWeightUnit, setCurrentWeightUnit] = useState<WeightUnit>("lb");
  const [currentBodyFatPercent, setCurrentBodyFatPercent] = useState("");
  const [goalType, setGoalType] = useState<GoalType | "">("");
  const [showAdvancedGoals, setShowAdvancedGoals] = useState(false);
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [goalWeightLb, setGoalWeightLb] = useState("");
  const [weightLb, setWeightLb] = useState("");
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [maintenanceCalories, setMaintenanceCalories] = useState<number | null>(null);
  const [caloriePlan, setCaloriePlan] = useState<string | null>(null);
  const [dailyTargets, setDailyTargets] = useState<DailyFocusTargets | null>(null);
  const [modulePreferences, setModulePreferences] = useState<ModulePreference[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanSelection>("free");
  const [premiumInsisted, setPremiumInsisted] = useState(false);
  const [legalChecked, setLegalChecked] = useState<Record<LegalDocType, boolean>>({
    terms: false,
    privacy: false,
    health_disclaimer: false,
  });
  const heightPrefilledRef = useRef(false);
  const namePrefilledRef = useRef(false);
  const weightsPrefilledRef = useRef(false);
  const goalWeightsPrefilledRef = useRef(false);
  const modulePreferencesPrefilledRef = useRef(false);
  const legalPrefilledRef = useRef(false);

  const completeMutation = useMutation({
    mutationFn: completeOnboardingProfile,
  });
  const stepOneMutation = useMutation({
    mutationFn: saveStepOneProfile,
  });
  const stepTwoMutation = useMutation({
    mutationFn: saveStepTwoProfile,
  });
  const stepThreeMutation = useMutation({
    mutationFn: saveStepThreeProfile,
  });
  const stepFourMutation = useMutation({
    mutationFn: saveStepFourProfile,
  });
  const stepFiveMutation = useMutation({
    mutationFn: saveStepFiveProfile,
  });
  const stepSixMutation = useMutation({
    mutationFn: saveStepSixProfile,
  });
  const stepSevenMutation = useMutation({
    mutationFn: saveStepSevenProfile,
  });
  const stepEightMutation = useMutation({
    mutationFn: saveStepEightProfile,
  });
  const stepNineMutation = useMutation({
    mutationFn: saveStepNineProfile,
  });
  const modulePreferencesMutation = useMutation({
    mutationFn: saveModulePreferences,
  });
  const avatarUploadMutation = useMutation({
    mutationFn: async (params: { userId: string; localUri: string }) => {
      const { cacheBustedUrl } = await uploadAvatar(params);
      const saveResult = await saveAvatarProfile({
        userId: params.userId,
        avatarUrl: cacheBustedUrl,
      });
      if (!saveResult.ok) {
        throw new Error(saveResult.error ?? "onboarding.error_save_failed");
      }
      return { avatarUrl: cacheBustedUrl };
    },
    onSuccess: ({ avatarUrl }) => {
      if (!user?.id) return;
      setAvatarRemoteUrl(avatarUrl);
      setAvatarLocalUri(null);
      queryClient.setQueryData(["onboarding-profile", user.id], (old: any) => {
        if (!old) return old;
        return { ...old, avatar_url: avatarUrl };
      });
      queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
    },
    onError: (e) => {
      if (__DEV__) {
        console.error("[avatar] upload failed", e);
      }
      setError("onboarding.photoUploadError");
    },
  });
  const avatarClearMutation = useMutation({
    mutationFn: async (params: { userId: string }) => {
      const saveResult = await saveAvatarProfile({
        userId: params.userId,
        avatarUrl: null,
      });
      if (!saveResult.ok) {
        throw new Error(saveResult.error ?? "onboarding.error_save_failed");
      }
      return { avatarUrl: null };
    },
    onSuccess: () => {
      if (!user?.id) return;
      setAvatarRemoteUrl(null);
      setAvatarLocalUri(null);
      queryClient.setQueryData(["onboarding-profile", user.id], (old: any) => {
        if (!old) return old;
        return { ...old, avatar_url: null };
      });
      queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
    },
  });
  const finalizeOnboardingMutation = useMutation({
    mutationFn: finalizeOnboarding,
  });
  const queryClient = useQueryClient();
  const { data: profileData } = useQuery({
    queryKey: ["onboarding-profile", user?.id],
    queryFn: () => fetchOnboardingProfile(user!.id),
    enabled: Boolean(user?.id),
  });
  const {
    data: legalAcceptances = [],
    isLoading: legalAcceptancesLoading,
    error: legalAcceptancesError,
    refetch: refetchLegalAcceptances,
  } = useQuery<UserLegalAcceptance[]>({
    queryKey: ["legal-acceptances", user?.id],
    queryFn: () => fetchUserLegalAcceptances(user!.id),
    enabled: Boolean(user?.id),
  });
  const {
    data: legalDocuments = [],
    isLoading: legalDocumentsLoading,
    error: legalDocumentsError,
    refetch: refetchLegalDocuments,
  } = useQuery<LegalDocument[]>({
    queryKey: ["legal-documents"],
    queryFn: getActiveLegalDocuments,
  });

  useEffect(() => {
    if (!profileData) return;

    if (!namePrefilledRef.current) {
      if (firstName !== "") {
        namePrefilledRef.current = true;
      } else if (profileData.first_name) {
        setFirstName(profileData.first_name);
        namePrefilledRef.current = true;
      } else {
        namePrefilledRef.current = true;
      }
    }
    if (!dateOfBirth && profileData.date_of_birth) {
      setDateOfBirth(profileData.date_of_birth);
    }
    if (!avatarRemoteUrl && profileData.avatar_url) {
      setAvatarRemoteUrl(profileData.avatar_url);
    }
    if (!gender && (profileData.gender === "male" || profileData.gender === "female")) {
      setGender(profileData.gender);
    }
    if (!heightPrefilledRef.current) {
      if (heightCm || heightFt || heightIn) {
        heightPrefilledRef.current = true;
      } else if (profileData.height_cm !== null && profileData.height_cm !== undefined) {
        setHeightCm(roundTo1(profileData.height_cm).toString());
        if (profileData.height_unit === "ft") {
          setHeightUnit("ft/in");
          const result = cmToFtIn(profileData.height_cm);
          if (result) {
            setHeightFt(String(result.feet));
            setHeightIn(String(result.inches));
          }
        } else {
          setHeightUnit("cm");
        }
        heightPrefilledRef.current = true;
      } else {
        heightPrefilledRef.current = true;
      }
    }
    if (
      !activityLevel &&
      profileData.activity_level &&
      validateActivityLevel(profileData.activity_level).ok
    ) {
      setActivityLevel(profileData.activity_level);
    }
    if (!goalType && profileData.goal_type && validateGoalType(profileData.goal_type).ok) {
      setGoalType(profileData.goal_type as GoalType);
      if (profileData.goal_type === "recomp") {
        setShowAdvancedGoals(true);
      }
    }
    if (!goalWeightsPrefilledRef.current) {
      if (goalWeightKg || goalWeightLb) {
        goalWeightsPrefilledRef.current = true;
        return;
      }
      if (profileData.goal_weight_lb !== null && profileData.goal_weight_lb !== undefined) {
        const displayLb = roundWeightTo1(profileData.goal_weight_lb).toString();
        const displayKg = roundWeightTo1(lbToKg(profileData.goal_weight_lb)).toString();
        setGoalWeightLb(displayLb);
        setGoalWeightKg(displayKg);
      }
      goalWeightsPrefilledRef.current = true;
    }
    if (!weightsPrefilledRef.current) {
      if (currentWeightKg || currentWeightLb || currentBodyFatPercent) {
        weightsPrefilledRef.current = true;
        return;
      }
      if (profileData.weight_lb !== null && profileData.weight_lb !== undefined) {
        const preferredUnit: WeightUnit = profileData.weight_unit === "kg" ? "kg" : "lb";
        setCurrentWeightUnit(preferredUnit);
        const displayLb = roundWeightTo1(profileData.weight_lb).toString();
        const displayKg = roundWeightTo1(lbToKg(profileData.weight_lb)).toString();
        setCurrentWeightLb(displayLb);
        setCurrentWeightKg(displayKg);
      }
      if (
        profileData.body_fat_percent !== null &&
        profileData.body_fat_percent !== undefined
      ) {
        setCurrentBodyFatPercent(roundWeightTo1(profileData.body_fat_percent).toString());
      }
      weightsPrefilledRef.current = true;
    }
    if (
      calorieTarget === null &&
      profileData.daily_calorie_target !== null &&
      profileData.daily_calorie_target !== undefined
    ) {
      setCalorieTarget(profileData.daily_calorie_target);
    }
    if (
      maintenanceCalories === null &&
      profileData.maintenance_calories !== null &&
      profileData.maintenance_calories !== undefined
    ) {
      setMaintenanceCalories(profileData.maintenance_calories);
    }
    if (!caloriePlan && profileData.calorie_plan) {
      setCaloriePlan(profileData.calorie_plan);
    }
    if (
      dailyTargets === null &&
      profileData.protein_g_min !== null &&
      profileData.fiber_g_min !== null &&
      profileData.carbs_g_max !== null &&
      profileData.sugar_g_max !== null &&
      profileData.sodium_mg_max !== null
    ) {
      setDailyTargets({
        proteinGMin: profileData.protein_g_min,
        fiberGMin: profileData.fiber_g_min,
        carbsGMax: profileData.carbs_g_max,
        sugarGMax: profileData.sugar_g_max,
        sodiumMgMax: profileData.sodium_mg_max,
      });
    }
    if (!modulePreferencesPrefilledRef.current) {
      if (modulePreferences.length > 0) {
        modulePreferencesPrefilledRef.current = true;
        return;
      }
      const picks: ModulePreference[] = [];
      const add = (value: ModulePreference | null) => {
        if (!value) return;
        if (!picks.includes(value)) {
          picks.push(value);
        }
      };
      add(profileData.focus_module_2 ?? null);
      add(profileData.focus_module_3 ?? null);
      modulePreferencesPrefilledRef.current = true;
      setModulePreferences(picks.slice(0, 2));
    }
  }, [
    profileData,
    firstName,
    dateOfBirth,
    avatarLocalUri,
    avatarRemoteUrl,
    gender,
    heightCm,
    heightFt,
    heightIn,
    heightUnit,
    activityLevel,
    currentWeightKg,
    currentWeightLb,
    currentWeightUnit,
    currentBodyFatPercent,
    goalType,
    goalWeightKg,
    goalWeightLb,
    calorieTarget,
    maintenanceCalories,
    caloriePlan,
    dailyTargets,
    modulePreferences,
  ]);

  useEffect(() => {
    if (legalPrefilledRef.current) return;
    if (!legalDocuments.length) {
      legalPrefilledRef.current = true;
      return;
    }
    if (!legalAcceptances) return;

    const latest = legalAcceptances.reduce<Record<LegalDocType, { version: string; acceptedAt: string }>>(
      (acc, curr) => {
        const existing = acc[curr.docType];
        if (!existing || new Date(curr.acceptedAt).getTime() > new Date(existing.acceptedAt).getTime()) {
          acc[curr.docType] = { version: curr.version, acceptedAt: curr.acceptedAt };
        }
        return acc;
      },
      {} as Record<LegalDocType, { version: string; acceptedAt: string }>
    );

    const nextChecked: Record<LegalDocType, boolean> = {
      terms: false,
      privacy: false,
      health_disclaimer: false,
    };

    legalDocuments.forEach((doc) => {
      if (latest[doc.docType]?.version === doc.version) {
        nextChecked[doc.docType] = true;
      }
    });

    setLegalChecked(nextChecked);
    legalPrefilledRef.current = true;
  }, [legalAcceptances, legalDocuments]);

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
        const errorMsg = result.error || "An unexpected error occurred";
        setError(typeof errorMsg === "string" ? errorMsg : String(errorMsg));
        setSaving(false);
        return;
      }

      await refreshProfile();

      setSuccess("Onboarding completed!");
      console.log("[onboarding] completed -> navigating to /web");
      router.replace({ pathname: "/web", params: { path: DEFAULT_WEB_PATH } });
      return;
    } catch (e: any) {
      const errorMessage = e?.message || "An unexpected error occurred";
      if (__DEV__) {
        showDebugError(e, "Complete Onboarding Error");
      }
      setError(typeof errorMessage === "string" ? errorMessage : String(errorMessage));
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
        avatarUrl:
          avatarRemoteUrl &&
          (avatarRemoteUrl.startsWith("http://") || avatarRemoteUrl.startsWith("https://"))
            ? avatarRemoteUrl
            : undefined,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(2);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Name Step Save Error");
      }
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
      if (__DEV__) {
        showDebugError(e, "Sex Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleHeightStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }

    const validation = validateHeightInputs(heightUnit, heightCm, heightFt, heightIn);
    if (!validation.ok) {
      setError(validation.errorKey || "onboarding.height.error_height_invalid");
      return;
    }

    setSaving(true);
    try {
      const result = await stepThreeMutation.mutateAsync({
        userId: user.id,
        heightCm: validation.cmValue!,
        heightUnit: heightUnit === "ft/in" ? "ft" : "cm",
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(4);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Height Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleActivityStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }

    const validation = validateActivityLevel(activityLevel);
    if (!validation.ok) {
      setError(validation.errorKey || "onboarding.activity.error_select_activity");
      return;
    }

    setSaving(true);
    try {
      const result = await stepFourMutation.mutateAsync({
        userId: user.id,
        activityLevel: activityLevel as ActivityLevel,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(5);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Activity Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleWeightStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }

    const raw = currentWeightUnit === "kg" ? parseFloat(currentWeightKg) : parseFloat(currentWeightLb);
    const weightKgValue =
      isNaN(raw) || raw <= 0 ? null : currentWeightUnit === "kg" ? raw : lbToKg(raw);
    const weightError = validateWeightKg(weightKgValue);
    if (weightError) {
      setError(weightError);
      return;
    }

    const bodyFatValue = currentBodyFatPercent.trim()
      ? parseFloat(currentBodyFatPercent)
      : null;
    const bodyFatError = validateBodyFatPercent(bodyFatValue);
    if (bodyFatError) {
      setError(bodyFatError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildWeightPayload(
        currentWeightUnit,
        currentWeightKg,
        currentWeightLb,
        currentBodyFatPercent
      );
      const result = await stepFiveMutation.mutateAsync({
        userId: user.id,
        weightLb: payload.weightLb,
        weightUnit: payload.weightUnit,
        bodyFatPercent: payload.bodyFatPercent,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(6);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Weight Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleGoalStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }

    const validation = validateGoalType(goalType);
    if (!validation.ok) {
      setError(validation.errorKey || "onboarding.goal.error_select_goal");
      return;
    }

    setSaving(true);
    try {
      const result = await stepSixMutation.mutateAsync({
        userId: user.id,
        goalType: goalType as GoalType,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(7);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Goal Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleGoalWeightStepContinue = async () => {
    setError(null);
    setGoalWeightErrorKey(null);
    setGoalWeightErrorParams(null);
    if (!user) {
      setGoalWeightErrorKey("onboarding.error_no_session");
      return;
    }
    if (!goalType) {
      setGoalWeightErrorKey("onboarding.goal.error_select_goal");
      return;
    }

    const currentWeightLbValue =
      currentWeightUnit === "kg"
        ? currentWeightKg.trim()
          ? kgToLb(parseFloat(currentWeightKg))
          : NaN
        : currentWeightLb.trim()
        ? parseFloat(currentWeightLb)
        : NaN;

    if (isNaN(currentWeightLbValue) || currentWeightLbValue <= 0) {
      setGoalWeightErrorKey("onboarding.current_weight.error_weight_required");
      return;
    }

    const targetInput =
      currentWeightUnit === "kg" ? goalWeightKg.trim() : goalWeightLb.trim();

    if (!targetInput) {
      setGoalWeightErrorKey("onboarding.goal_weight.error_weight_required");
      return;
    }

    const parsedTarget = parseFloat(targetInput);
    const validation = validateGoalWeight({
      currentWeightLb: currentWeightLbValue,
      goalType: goalType as GoalType,
      weightUnit: currentWeightUnit === "kg" ? "kg" : "lbs",
      targetInput: parsedTarget,
    });

    if (!validation.ok) {
      setGoalWeightErrorParams(validation.i18nParams || null);
      setGoalWeightErrorKey(validation.i18nKey);
      return;
    }

    setSaving(true);
    try {
      const result = await stepSevenMutation.mutateAsync({
        userId: user.id,
        goalWeightLb: roundTo3(validation.targetLb),
      });

      if (!result.ok) {
        setGoalWeightErrorKey("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(8);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Goal Weight Step Save Error");
      }
      setGoalWeightErrorKey("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDailyTargetStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }
    if (
      calorieTarget === null ||
      !isFinite(calorieTarget) ||
      calorieTarget < HARD_HARD_STOP ||
      maintenanceCalories === null ||
      caloriePlan === null
    ) {
      setError("onboarding.calorie_target.error_select_target");
      return;
    }

    setSaving(true);
    try {
      const mappedPlan = mapCaloriePlanToDb(caloriePlan);
      const result = await stepEightMutation.mutateAsync({
        userId: user.id,
        dailyCalorieTarget: calorieTarget,
        maintenanceCalories,
        caloriePlan: mappedPlan,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(9);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Daily Target Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDailyTargetsStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }
    if (!dailyTargets) {
      setError("onboarding.daily_targets.error_missing_data");
      return;
    }

    setSaving(true);
    try {
      const result = await stepNineMutation.mutateAsync({
        userId: user.id,
        proteinGMin: dailyTargets.proteinGMin,
        fiberGMin: dailyTargets.fiberGMin,
        carbsGMax: dailyTargets.carbsGMax,
        sugarGMax: dailyTargets.sugarGMax,
        sodiumMgMax: dailyTargets.sodiumMgMax,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      queryClient.setQueryData(["onboarding-profile", user.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          protein_g_min: dailyTargets.proteinGMin,
          fiber_g_min: dailyTargets.fiberGMin,
          carbs_g_max: dailyTargets.carbsGMax,
          sugar_g_max: dailyTargets.sugarGMax,
          sodium_mg_max: dailyTargets.sodiumMgMax,
        };
      });
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(10);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Daily Targets Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handleModulePreferencesStepContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }

    setSaving(true);
    try {
      const fallbackOrder: ModulePreference[] = ["Exercise", "Med", "Water"];
      const selected = modulePreferences.slice(0, 2).filter((item): item is ModulePreference =>
        item === "Exercise" || item === "Med" || item === "Water"
      );

      let focus2: ModulePreference;
      let focus3: ModulePreference;

      if (selected.length === 2) {
        focus2 = selected[0];
        focus3 = selected[1];
      } else if (selected.length === 1) {
        focus2 = selected[0];
        focus3 = fallbackOrder.find((item) => item !== selected[0]) ?? "Med";
      } else {
        focus2 = "Exercise";
        focus3 = "Med";
      }

      if (focus2 === focus3) {
        focus2 = "Exercise";
        focus3 = "Med";
      }

      const result = await modulePreferencesMutation.mutateAsync({
        userId: user.id,
        focusModule2: focus2,
        focusModule3: focus3,
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      queryClient.setQueryData(["onboarding-profile", user.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          focus_module_1: "Food",
          focus_module_2: focus2,
          focus_module_3: focus3,
        };
      });
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      setCurrentStep(11);
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Module Preferences Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePlanStepContinue = () => {
    if (selectedPlan !== "free") {
      if (!premiumInsisted) {
        Alert.alert(t("onboarding.plan.premium_next_nudge"));
      }
      return;
    }

    setCurrentStep(12);
  };

  const handleLegalCheckedChange = (docType: LegalDocType, value: boolean) => {
    legalPrefilledRef.current = true;
    setLegalChecked((prev) => ({ ...prev, [docType]: value }));
  };

  const handleLegalAgreementContinue = async () => {
    setError(null);
    if (!user) {
      setError("onboarding.error_no_session");
      return;
    }

    const allChecked =
      legalDocuments.length > 0 && legalDocuments.every((doc) => legalChecked[doc.docType]);

    if (!allChecked) {
      return;
    }

    setSaving(true);
    try {
      const finalCaloriePlan = mapCaloriePlanToDb(caloriePlan);
      const result = await finalizeOnboardingMutation.mutateAsync({
        userId: user.id,
        documents: legalDocuments.map((doc) => ({ docType: doc.docType, version: doc.version })),
        profileUpdate: {
          dailyCalorieTarget: calorieTarget,
          maintenanceCalories,
          caloriePlan: finalCaloriePlan,
          targets: dailyTargets,
        },
      });

      if (!result.ok) {
        setError("onboarding.error_save_failed");
        return;
      }

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["onboarding-profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["legal-acceptances", user.id] });
      console.log("[onboarding] completed -> navigating to /web");
      router.replace({ pathname: "/web", params: { path: DEFAULT_WEB_PATH } });
      return;
    } catch (e) {
      if (__DEV__) {
        showDebugError(e, "Legal Agreement Step Save Error");
      }
      setError("onboarding.error_save_failed");
    } finally {
      setSaving(false);
    }
  };

  const currentWeightLbValue =
    currentWeightUnit === "kg"
      ? currentWeightKg.trim()
        ? kgToLb(parseFloat(currentWeightKg))
        : null
      : currentWeightLb.trim()
      ? parseFloat(currentWeightLb)
      : null;

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
          <Redirect href="/post-login-gate" />
        ) : (
          <View style={styles.container}>
            {currentStep === 1 ? (
              <NameStep
                firstName={firstName}
                dateOfBirth={dateOfBirth}
                avatarUri={avatarRemoteUrl ?? avatarLocalUri}
                error={error}
                saving={saving}
                onFirstNameChange={(text) => {
                  namePrefilledRef.current = true;
                  setFirstName(filterPreferredNameInput(firstName, text));
                }}
                onFirstNameBlur={() => setFirstName(normalizePreferredName(firstName))}
                onDateOfBirthChange={setDateOfBirth}
                onAvatarChange={(nextUri) => {
                  setAvatarLocalUri(nextUri);
                  if (nextUri && user?.id) {
                    avatarUploadMutation.mutate({ userId: user.id, localUri: nextUri });
                  }
                  if (!nextUri && user?.id) {
                    avatarClearMutation.mutate({ userId: user.id });
                  }
                }}
                avatarSaving={avatarUploadMutation.isPending || avatarClearMutation.isPending}
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
            ) : currentStep === 3 ? (
              <HeightStep
                heightCm={heightCm}
                heightFt={heightFt}
                heightIn={heightIn}
                heightUnit={heightUnit}
                error={error}
                loading={saving}
                onHeightCmChange={setHeightCm}
                onHeightFtChange={setHeightFt}
                onHeightInChange={setHeightIn}
                onHeightUnitChange={setHeightUnit}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(2)}
                onContinue={handleHeightStepContinue}
              />
            ) : currentStep === 4 ? (
              <ActivityStep
                activityLevel={activityLevel}
                loading={saving}
                error={error}
                onActivityLevelChange={setActivityLevel}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(3)}
                onContinue={handleActivityStepContinue}
              />
            ) : currentStep === 5 ? (
              <WeightStep
                currentWeightKg={currentWeightKg}
                currentWeightLb={currentWeightLb}
                currentWeightUnit={currentWeightUnit}
                bodyFatPercent={currentBodyFatPercent}
                sexAtBirth={gender === "male" || gender === "female" ? gender : ""}
                dateOfBirth={dateOfBirth}
                error={error}
                loading={saving}
                onCurrentWeightKgChange={setCurrentWeightKg}
                onCurrentWeightLbChange={setCurrentWeightLb}
                onCurrentWeightUnitChange={setCurrentWeightUnit}
                onBodyFatPercentChange={setCurrentBodyFatPercent}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(4)}
                onContinue={handleWeightStepContinue}
              />
            ) : currentStep === 6 ? (
              <GoalStep
                goalType={goalType}
                showAdvancedGoals={showAdvancedGoals}
                loading={saving}
                error={error}
                onGoalChange={setGoalType}
                onShowAdvancedGoals={() => setShowAdvancedGoals(true)}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(5)}
                onContinue={handleGoalStepContinue}
              />
            ) : currentStep === 7 ? (
              <GoalWeightStep
                goalType={goalType}
                currentWeightUnit={currentWeightUnit}
                currentWeightLb={currentWeightLbValue}
                goalWeightKg={goalWeightKg}
                goalWeightLb={goalWeightLb}
                loading={saving}
                errorKey={goalWeightErrorKey}
                errorParams={goalWeightErrorParams}
                onGoalWeightKgChange={setGoalWeightKg}
                onGoalWeightLbChange={setGoalWeightLb}
                onErrorClear={() => {
                  setError(null);
                  setGoalWeightErrorKey(null);
                  setGoalWeightErrorParams(null);
                }}
                onBack={() => setCurrentStep(6)}
                onContinue={handleGoalWeightStepContinue}
              />
            ) : currentStep === 8 ? (
              <DailyTargetCaloriesStep
                profile={profileData ?? null}
                loading={saving}
                error={error}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(7)}
                onContinue={handleDailyTargetStepContinue}
                onActivityLevelSaved={setActivityLevel}
                onCalorieTargetChange={(target) => {
                  setCalorieTarget(target.calorieTarget);
                  setMaintenanceCalories(target.maintenanceCalories);
                  setCaloriePlan(target.caloriePlan);
                }}
              />
            ) : currentStep === 9 ? (
              <DailyFocusTargetsStep
                profile={profileData ?? null}
                loading={saving}
                error={error}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(8)}
                onContinue={handleDailyTargetsStepContinue}
                onTargetsChange={setDailyTargets}
              />
            ) : currentStep === 10 ? (
              <ModulePreferencesStep
                profile={profileData ?? null}
                selections={modulePreferences}
                loading={saving}
                error={error}
                onSelectionsChange={setModulePreferences}
                onErrorClear={() => setError(null)}
                onBack={() => setCurrentStep(9)}
                onContinue={handleModulePreferencesStepContinue}
              />
            ) : currentStep === 11 ? (
              <PlanStep
                selectedPlan={selectedPlan}
                onSelectedPlanChange={setSelectedPlan}
                onPremiumInsist={() => setPremiumInsisted(true)}
                loading={saving}
                onBack={() => setCurrentStep(10)}
                onContinue={handlePlanStepContinue}
              />
            ) : currentStep === 12 ? (
              <LegalAgreementStep
                documents={legalDocuments}
                checked={legalChecked}
                loading={saving}
                docsLoading={legalDocumentsLoading || legalAcceptancesLoading}
                errorKey={
                  error ??
                  (legalDocumentsError || legalAcceptancesError ? "legal.error_loading" : null)
                }
                onRetry={() => {
                  setError(null);
                  refetchLegalDocuments();
                  refetchLegalAcceptances();
                }}
                onCheckedChange={handleLegalCheckedChange}
                onBack={() => setCurrentStep(11)}
                onContinue={handleLegalAgreementContinue}
              />
            ) : (
              <PlaceholderStep onBack={() => setCurrentStep(11)} />
            )}
          </View>
        )}
      </Screen>
      {__DEV__ && (
        <DebugErrorModal
          visible={!!debugError}
          title={debugError?.title || "Debug Error"}
          message={debugError?.message || ""}
          onClose={clearDebugError}
        />
      )}
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
  container: {
    flex: 1,
  },
});