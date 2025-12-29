import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { showAppToast } from '@/components/ui/app-toast';
import { EditSheet } from './_components/EditSheet';
import { DailyFocusTargetsStep, type DailyFocusTargets } from '@/components/onboarding/steps/DailyFocusTargetsStep';

export default function EditTargetsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: profile } = useUserConfig();
  const updateProfileMutation = useUpdateProfile();

  const [targets, setTargets] = useState<DailyFocusTargets>(() => ({
    proteinGMin: profile?.protein_g_min || 100,
    fiberGMin: profile?.fiber_g_min || 28,
    carbsGMax: profile?.carbs_g_max || 200,
    sugarGMax: profile?.sugar_g_max || 40,
    sodiumMgMax: profile?.sodium_mg_max || 2300,
  }));

  // Update state when profile changes
  useEffect(() => {
    if (profile) {
      setTargets({
        proteinGMin: profile.protein_g_min || 100,
        fiberGMin: profile.fiber_g_min || 28,
        carbsGMax: profile.carbs_g_max || 200,
        sugarGMax: profile.sugar_g_max || 40,
        sodiumMgMax: profile.sodium_mg_max || 2300,
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        protein_g_min: targets.proteinGMin,
        fiber_g_min: targets.fiberGMin,
        carbs_g_max: targets.carbsGMax,
        sugar_g_max: targets.sugarGMax,
        sodium_mg_max: targets.sodiumMgMax,
      });

      showAppToast('Focus targets updated');
      router.back();
    } catch (error) {
      console.error('Error saving targets:', error);
      showAppToast('Failed to update targets. Please try again.');
    }
  };

  return (
    <EditSheet
      title="Edit Daily Focus Targets"
      onCancel={() => router.back()}
      onSave={handleSave}
      saving={updateProfileMutation.isPending}
    >
      <View style={styles.stepContainer}>
        <DailyFocusTargetsStep
          goalType={(profile?.goal_type as any) || null}
          currentWeightLb={profile?.weight_lb || null}
          targetWeightLb={profile?.goal_weight_lb || null}
          heightCm={profile?.height_cm || null}
          sexAtBirth={(profile?.gender as any) || null}
          activityLevel={(profile?.activity_level as any) || ''}
          weightUnit={(profile?.weight_unit as 'kg' | 'lb') || 'lb'}
          calorieTarget={profile?.daily_calorie_target || null}
          onTargetChange={setTargets}
          onErrorClear={() => {}}
          loading={updateProfileMutation.isPending}
          colors={colors}
        />
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

