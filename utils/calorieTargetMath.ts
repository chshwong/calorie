/**
 * Calorie Target Math Utilities
 * 
 * Pure functions for calculating weight loss estimates based on calorie targets.
 */

const KCAL_PER_LB = 3500;

type WeightLossEstimateParams = {
  startWeightLbs: number;
  targetWeightLbs: number;
  maintenanceKcalPerDay: number;
  targetKcalPerDay: number;
};

export function estimateWeeksToReachTarget({
  startWeightLbs,
  targetWeightLbs,
  maintenanceKcalPerDay,
  targetKcalPerDay,
}: WeightLossEstimateParams): number | null {
  const lbsToLose = startWeightLbs - targetWeightLbs;
  if (lbsToLose <= 0) return 0;

  const dailyDeficit = maintenanceKcalPerDay - targetKcalPerDay;
  if (dailyDeficit <= 0) return null;

  const weeklyLossLbs = (dailyDeficit * 7) / KCAL_PER_LB;
  if (weeklyLossLbs <= 0) return null;

  return lbsToLose / weeklyLossLbs; // weeks
}

