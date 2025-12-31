export function canComputeNetCalories(hasFoodEntries: boolean): boolean {
  return hasFoodEntries;
}

export function calculateNetCalories(params: { burnedTdeeCal: number; eatenCalories: number }): number {
  return params.burnedTdeeCal - params.eatenCalories;
}


