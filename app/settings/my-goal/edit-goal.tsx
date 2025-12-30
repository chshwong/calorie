import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { showAppToast } from '@/components/ui/app-toast';
import EditSheet from './_components/EditSheet';
import { returnToMyGoal } from './_components/returnToMyGoal';
import { GoalStep } from '@/components/onboarding/steps/GoalStep';
import { GoalWeightStep } from '@/components/onboarding/steps/GoalWeightStep';
import { ActivityStep } from '@/components/onboarding/steps/ActivityStep';
import { DailyCalorieTargetStep } from '@/components/onboarding/steps/DailyCalorieTargetStep';
import { getSuggestedTargetWeightLb } from '@/lib/onboarding/goal-weight-rules';
import { mapCaloriePlanToDb } from '@/lib/onboarding/calorie-plan';
import { lbToKg, kgToLb, roundTo1 } from '@/utils/bodyMetrics';

type GoalType = 'lose' | 'maintain' | 'gain' | 'recomp';

export default function EditGoalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ start?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'] as typeof Colors.light;
  const { data: profile } = useUserConfig();
  const updateProfileMutation = useUpdateProfile();

  // Step index: 0 = Goal, 1 = GoalWeight, 2 = Activity, 3 = DailyCalorieTarget
  const [subStepIndex, setSubStepIndex] = useState(0);
  const didInitFromParams = useRef(false);

  // Optional deep-link start (used by Settings "Adjust Activity Level" row)
  useEffect(() => {
    if (didInitFromParams.current) return;
    didInitFromParams.current = true;

    if (params?.start === 'activity') {
      setSubStepIndex(2);
    }
  }, [params?.start]);

  // Initialize state from profile
  const [goal, setGoal] = useState<GoalType | ''>((profile?.goal_type as GoalType) || '');
  const [showAdvancedGoals, setShowAdvancedGoals] = useState(goal === 'recomp');
  
  // Goal weight state
  const weightUnit = (profile?.weight_unit || 'lb') as 'kg' | 'lb';
  const [goalWeightKg, setGoalWeightKg] = useState(() => {
    if (profile?.goal_weight_kg) {
      return roundTo1(profile.goal_weight_kg).toString();
    }
    if (profile?.goal_weight_lb) {
      return roundTo1(lbToKg(profile.goal_weight_lb)).toString();
    }
    return '';
  });
  const [goalWeightLb, setGoalWeightLb] = useState(() => {
    if (profile?.goal_weight_lb) {
      return roundTo1(profile.goal_weight_lb).toString();
    }
    if (profile?.goal_weight_kg) {
      return roundTo1(profile.goal_weight_kg * 2.20462).toString();
    }
    return '';
  });

  // Activity level state
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | ''>(
    (profile?.activity_level as any) || ''
  );

  // Daily calorie target state (for step 4)
  const [calorieTarget, setCalorieTarget] = useState<number | null>(profile?.daily_calorie_target || null);
  const [maintenanceCalories, setMaintenanceCalories] = useState<number | null>(profile?.maintenance_calories || null);
  const [caloriePlan, setCaloriePlan] = useState<string | null>(profile?.calorie_plan || null);

  // Update calorie state when profile changes
  useEffect(() => {
    if (profile) {
      setCalorieTarget(profile.daily_calorie_target || null);
      setMaintenanceCalories(profile.maintenance_calories || null);
      setCaloriePlan(profile.calorie_plan || null);
    }
  }, [profile]);

  // Compute goal weight suggestion
  const goalWeightSuggestion = useMemo(() => {
    if (!goal || !profile?.weight_lb) return null;
    return getSuggestedTargetWeightLb({
      goalType: goal as GoalType,
      currentWeightLb: profile.weight_lb,
      heightCm: profile.height_cm || null,
      sexAtBirth: profile.gender || null,
      dobISO: profile.date_of_birth || null,
    });
  }, [goal, profile?.weight_lb, profile?.height_cm, profile?.gender, profile?.date_of_birth]);

  const handleCalorieTargetChange = (target: {
    calorieTarget: number;
    maintenanceCalories: number;
    caloriePlan: string;
    executionMode?: 'override';
  }) => {
    setCalorieTarget(target.calorieTarget);
    setMaintenanceCalories(target.maintenanceCalories);
    setCaloriePlan(target.caloriePlan);
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!goal) {
        showAppToast('Please select a goal type');
        setSubStepIndex(0);
        return;
      }

      if (!goalWeightLb && !goalWeightKg) {
        showAppToast('Please enter a goal weight');
        setSubStepIndex(1);
        return;
      }

      if (!activityLevel) {
        showAppToast('Please select an activity level');
        setSubStepIndex(2);
        return;
      }

      if (!calorieTarget) {
        showAppToast('Please set a calorie target');
        setSubStepIndex(3);
        return;
      }

      // Convert goal weight to lb (canonical)
      let goalWeightLbValue: number | null = null;
      if (goalWeightLb) {
        goalWeightLbValue = parseFloat(goalWeightLb);
      } else if (goalWeightKg) {
        goalWeightLbValue = kgToLb(parseFloat(goalWeightKg));
      }

      // Build update payload with all fields
      const updatePayload: any = {
        goal_type: goal,
        goal_weight_lb: goalWeightLbValue,
        goal_weight_kg: goalWeightLbValue ? lbToKg(goalWeightLbValue) : null,
        activity_level: activityLevel,
        daily_calorie_target: calorieTarget,
      };

      // Add optional fields if they exist
      if (maintenanceCalories !== null) {
        updatePayload.maintenance_calories = maintenanceCalories;
      }
      if (caloriePlan) {
        updatePayload.calorie_plan = mapCaloriePlanToDb(caloriePlan);
        // Also set onboarding_calorie_set_at if calorie_plan is set (matching onboarding behavior)
        updatePayload.onboarding_calorie_set_at = new Date().toISOString();
      }

      // Update profile
      await updateProfileMutation.mutateAsync(updatePayload);

      showAppToast('Goal updated');
      returnToMyGoal(router);
    } catch (error) {
      console.error('Error saving goal:', error);
      showAppToast('Failed to update goal. Please try again.');
    }
  };

  const handleBack = () => {
    if (subStepIndex > 0) {
      setSubStepIndex(subStepIndex - 1);
    } else {
      router.back();
    }
  };

  const handleNext = () => {
    if (subStepIndex === 0) {
      // Validate goal
      if (!goal) {
        showAppToast('Please select a goal type');
        return;
      }
      setSubStepIndex(1);
    } else if (subStepIndex === 1) {
      // Validate goal weight
      if (!goalWeightLb && !goalWeightKg) {
        showAppToast('Please enter a goal weight');
        return;
      }
      setSubStepIndex(2);
    } else if (subStepIndex === 2) {
      // Validate activity level
      if (!activityLevel) {
        showAppToast('Please select an activity level');
        return;
      }
      setSubStepIndex(3);
    }
  };

  const canGoNext = () => {
    if (subStepIndex === 0) return !!goal;
    if (subStepIndex === 1) return !!(goalWeightLb || goalWeightKg);
    if (subStepIndex === 2) return !!activityLevel;
    // Step 3 (calorie target) - allow save if calorieTarget is set (from profile or step selection)
    if (subStepIndex === 3) return !!calorieTarget;
    return true;
  };

  const renderStep = () => {
    if (subStepIndex === 0) {
      return (
        <GoalStep
          goal={goal}
          showAdvancedGoals={showAdvancedGoals}
          onGoalChange={(g) => {
            setGoal(g);
            if (g === 'recomp') {
              setShowAdvancedGoals(true);
            }
          }}
          onShowAdvancedGoals={() => setShowAdvancedGoals(true)}
          onErrorClear={() => {}}
          loading={updateProfileMutation.isPending}
          colors={colors}
        />
      );
    }

    if (subStepIndex === 1) {
      return (
        <GoalWeightStep
          goalWeightKg={goalWeightKg}
          goalWeightLb={goalWeightLb}
          currentWeightUnit={weightUnit}
          goalType={goal ? goal : null}
          currentWeightLb={profile?.weight_lb || null}
          heightCm={profile?.height_cm || null}
          sexAtBirth={profile?.gender || null}
          dobISO={profile?.date_of_birth || null}
          goalWeightSuggestion={goalWeightSuggestion}
          onGoalWeightKgChange={setGoalWeightKg}
          onGoalWeightLbChange={setGoalWeightLb}
          onErrorClear={() => {}}
          error={null}
          errorKey={null}
          loading={updateProfileMutation.isPending}
          colors={colors}
        />
      );
    }

    if (subStepIndex === 2) {
      return (
        <ActivityStep
          mode="wizard"
          activityLevel={activityLevel}
          onActivityLevelChange={(level) => setActivityLevel(level)}
          onErrorClear={() => {}}
          loading={updateProfileMutation.isPending}
          colors={colors}
        />
      );
    }

    if (subStepIndex === 3) {
      return (
        <DailyCalorieTargetStep
          goalType={goal ? goal : null}
          currentWeightLb={profile?.weight_lb || null}
          targetWeightLb={goalWeightLb ? parseFloat(goalWeightLb) : (goalWeightKg ? kgToLb(parseFloat(goalWeightKg)) : null)}
          heightCm={profile?.height_cm || null}
          sexAtBirth={(profile?.gender as any) || null}
          activityLevel={activityLevel || ''}
          dobISO={profile?.date_of_birth || null}
          bodyFatPercent={profile?.body_fat_percent || null}
          weightUnit={weightUnit}
          heightUnit={(profile?.height_unit === 'ft' ? 'ft/in' : 'cm') as 'cm' | 'ft/in'}
          onCalorieTargetChange={handleCalorieTargetChange}
          onActivityLevelChange={(level) => setActivityLevel(level)}
          onErrorClear={() => {}}
          loading={updateProfileMutation.isPending}
          colors={colors}
          mode="edit"
          savedCalorieTarget={profile?.daily_calorie_target || null}
        />
      );
    }

    return null;
  };

  const getStepTitle = () => {
    if (subStepIndex === 0) return 'Edit Goal';
    if (subStepIndex === 1) return 'Edit Goal Weight';
    if (subStepIndex === 2) return 'Edit Activity Level';
    if (subStepIndex === 3) return 'Edit Daily Calorie Target';
    return 'Edit Goal';
  };

  const isSettingsAdjustActivityEntry = params?.start === 'activity';
  const isActivityLevelScreen = isSettingsAdjustActivityEntry && subStepIndex === 2;
  const shouldShowBackButton = subStepIndex > 0 && !isActivityLevelScreen;

  const handleClose = () => {
    if (router.canGoBack?.()) return router.back();
    // @ts-ignore - navigation types can vary
    if ((navigation as any)?.canGoBack?.()) return router.back();
    router.replace('/settings/my-goal');
  };

  return (
    <EditSheet
      title={getStepTitle()}
      onCancel={isSettingsAdjustActivityEntry ? handleClose : () => returnToMyGoal(router)}
      onSave={handleSave}
      saving={updateProfileMutation.isPending}
      headerVariant={isActivityLevelScreen ? 'standardSubheaderCloseRight' : 'default'}
      scrollToTopKey={subStepIndex}
      showBack={shouldShowBackButton}
      onBack={handleBack}
      showNext={subStepIndex < 3}
      onNext={handleNext}
      canSave={canGoNext()}
    >
      <View style={styles.stepContainer}>
        {renderStep()}
      </View>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
    paddingTop: Spacing.md,
  },
});

