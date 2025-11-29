/**
 * React Query hook for body metrics (age, height, weight, BMI)
 * 
 * Reuses cached profile data from useUserProfile hook.
 * Does not trigger additional Supabase calls.
 * 
 * Query key: ['bodyMetrics', userId]
 */

import { useMemo } from 'react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { ageFromDob } from '@/utils/calculations';
import { calculateBmi, getBmiClassification, getBmiClassificationKey, lbsToKg } from '@/utils/bodyMetrics';

export type BodyMetrics = {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  weightLbs: number | null;
  bmi: number | null;
  bmiLabel: string | null;
  bmiClassification: 'underweight' | 'normal' | 'overweight' | 'obese' | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook to get body metrics from cached profile data
 * 
 * @returns BodyMetrics object with age, height, weight, BMI, and loading/error states
 */
export function useBodyMetrics(): BodyMetrics {
  const { data: profile, isLoading, error } = useUserProfile();

  const metrics = useMemo(() => {
    if (!profile) {
      return {
        age: null,
        heightCm: null,
        weightKg: null,
        weightLbs: null,
        bmi: null,
        bmiLabel: null,
        bmiClassification: null,
      };
    }

    // Calculate age from date of birth
    const age = profile.date_of_birth
      ? ageFromDob(profile.date_of_birth)
      : null;

    // Get height in cm
    const heightCm = profile.height_cm ?? null;

    // Get weight - profile stores weight_lb, convert to kg
    const weightLbs = profile.weight_lb ?? null;
    const weightKg = weightLbs !== null ? lbsToKg(weightLbs) : null;

    // Calculate BMI
    const bmi = calculateBmi(weightKg, heightCm);
    const bmiClassification = getBmiClassification(bmi);
    const bmiLabel = bmiClassification ? getBmiClassificationKey(bmiClassification) : null;

    return {
      age,
      heightCm,
      weightKg,
      weightLbs,
      bmi,
      bmiLabel,
      bmiClassification,
    };
  }, [profile]);

  return {
    ...metrics,
    isLoading,
    error: error as Error | null,
  };
}

