import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { showAppToast } from '@/components/ui/app-toast';
import EditSheet from './_components/EditSheet';
import { returnToMyGoal } from './_components/returnToMyGoal';
import { DailyCalorieTargetStep } from '@/components/onboarding/steps/DailyCalorieTargetStep';
import { mapCaloriePlanToDb } from '@/lib/onboarding/calorie-plan';
import { useTranslation } from 'react-i18next';

export default function EditCaloriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const source = params.from as string | undefined;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: profile } = useUserConfig();
  const updateProfileMutation = useUpdateProfile();

  const [calorieTarget, setCalorieTarget] = useState<number | null>(profile?.daily_calorie_target || null);
  const [maintenanceCalories, setMaintenanceCalories] = useState<number | null>(profile?.maintenance_calories || null);
  const [caloriePlan, setCaloriePlan] = useState<string | null>(profile?.calorie_plan || null);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | ''>(
    (profile?.activity_level as any) || ''
  );

  // Update state when profile changes
  useEffect(() => {
    if (profile) {
      setCalorieTarget(profile.daily_calorie_target || null);
      setMaintenanceCalories(profile.maintenance_calories || null);
      setCaloriePlan(profile.calorie_plan || null);
      setActivityLevel((profile.activity_level as any) || '');
    }
  }, [profile]);

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
      if (!calorieTarget) {
        showAppToast(t('settings.my_goal.edit_calories.toast_missing_target'));
        return;
      }

      const updatePayload: any = {
        daily_calorie_target: calorieTarget,
      };

      if (maintenanceCalories !== null) {
        updatePayload.maintenance_calories = maintenanceCalories;
      }
      if (caloriePlan) {
        updatePayload.calorie_plan = mapCaloriePlanToDb(caloriePlan);
        updatePayload.onboarding_calorie_set_at = new Date().toISOString();
      }

      await updateProfileMutation.mutateAsync(updatePayload);

      showAppToast(t('settings.my_goal.edit_calories.toast_updated'));
      returnToMyGoal(router, source);
    } catch (error) {
      console.error('Error saving calories:', error);
      showAppToast(t('settings.my_goal.edit_calories.toast_update_failed'));
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedView style={{ flex: 1 }}>
        <StandardSubheader title={t('onboarding.calorie_target.title')} />
        <EditSheet
          title={t('settings.my_goal.edit_calories.sheet_title')}
          hideHeader={true}
          onCancel={() => returnToMyGoal(router, source)}
          onSave={handleSave}
          saving={updateProfileMutation.isPending}
        >
          <View style={styles.stepContainer}>
            <DailyCalorieTargetStep
              goalType={(profile?.goal_type as any) || null}
              currentWeightLb={profile?.weight_lb || null}
              targetWeightLb={profile?.goal_weight_lb || null}
              heightCm={profile?.height_cm || null}
              sexAtBirth={(profile?.gender as any) || null}
              activityLevel={activityLevel || ''}
              dobISO={profile?.date_of_birth || null}
              bodyFatPercent={profile?.body_fat_percent || null}
              weightUnit={(profile?.weight_unit as 'kg' | 'lb') || 'lb'}
              heightUnit={(profile?.height_unit === 'ft' ? 'ft/in' : 'cm') as 'cm' | 'ft/in'}
              onCalorieTargetChange={handleCalorieTargetChange}
              onActivityLevelChange={(level) => {
                setActivityLevel(level);
                // Also update profile when activity level changes
                updateProfileMutation.mutate({ activity_level: level });
              }}
              onErrorClear={() => {}}
              loading={updateProfileMutation.isPending}
              colors={colors}
              mode="edit"
              savedCalorieTarget={profile?.daily_calorie_target || null}
            />
          </View>
        </EditSheet>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
    paddingTop: Spacing.md,
  },
});

