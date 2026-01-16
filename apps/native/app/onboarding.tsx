import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActivityStep } from "@/components/onboarding/steps/ActivityStep";
import { DailyFocusTargetsStep, type DailyFocusTargets } from "@/components/onboarding/steps/DailyFocusTargetsStep";
import { DailyTargetCaloriesStep } from "@/components/onboarding/steps/DailyTargetCaloriesStep";
import { GoalStep } from "@/components/onboarding/steps/GoalStep";
import { HeightStep } from "@/components/onboarding/steps/HeightStep";
import { NameStep } from "@/components/onboarding/steps/NameStep";
import { PlaceholderStep } from "@/components/onboarding/steps/PlaceholderStep";
import { SexStep } from "@/components/onboarding/steps/SexStep";
import { buildWeightPayload, WeightStep } from "@/components/onboarding/steps/WeightStep";
import {
  completeOnboardingProfile,
  fetchOnboardingProfile,
  saveStepEightProfile,
  saveStepFiveProfile,
  saveStepFourProfile,
  saveStepOneProfile,
  saveStepNineProfile,
  saveStepSevenProfile,
  saveStepSixProfile,
  saveStepThreeProfile,
  saveStepTwoProfile,
} from "@/services/onboarding";
import { mapCaloriePlanToDb } from "../../../lib/onboarding/calorie-plan";
import { HARD_HARD_STOP } from "../../../lib/onboarding/goal-calorie-nutrient-rules";
import { GoalWeightStep } from "../components/onboarding/steps/GoalWeightStep";
import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
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
import { spacing } from "../theme/tokens";

export default function OnboardingScreen() {
  const { user, loading, onboardingComplete, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [goalWeightErrorKey, setGoalWeightErrorKey] = useState<string | null>(null);
  const [goalWeightErrorParams, setGoalWeightErrorParams] = useState<Record<string, any> | null>(
    null
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

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
  const heightPrefilledRef = useRef(false);
  const weightsPrefilledRef = useRef(false);
  const goalWeightsPrefilledRef = useRef(false);

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
  }, [
    profileData,
    firstName,
    dateOfBirth,
    avatarUri,
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
  ]);

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
          <Redirect href="/(tabs)/today" />
        ) : (
          <View style={styles.container}>
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
            ) : (
              <PlaceholderStep onBack={() => setCurrentStep(9)} />
            )}
          </View>
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
  container: {
    flex: 1,
  },
});