/**
 * Calorie Zone Determination
 * 
 * Determines whether consumed calories are "In Zone", "Under", or "Over"
 * based on the user's goal type and daily calorie target.
 */

export type CalorieZone = 'in_zone' | 'under' | 'over';
export type GoalType = 'lose' | 'maintain' | 'recomp' | 'gain';

/**
 * Determines the calorie zone based on consumed calories, target, and goal type.
 * 
 * Zone rules:
 * - Weight Loss: In Zone = [Target - 300, Target], Under = < Target - 300, Over = > Target
 * - Recomp/Maintain: In Zone = [Target - 300, Target + 300], Under = < Target - 300, Over = > Target + 300
 * - Weight Gain: In Zone = [Target, Target + 300], Under = < Target, Over = > Target + 300
 * 
 * @param consumed - Calories consumed for the day
 * @param target - Daily calorie target
 * @param goalType - User's goal type (lose, maintain, recomp, or gain)
 * @returns The calorie zone: 'in_zone', 'under', or 'over'
 */
export function getCalorieZone(
  consumed: number,
  target: number,
  goalType: GoalType
): CalorieZone {
  if (target <= 0) {
    // If no target set, default to 'in_zone'
    return 'in_zone';
  }

  const ZONE_TOLERANCE = 300;

  switch (goalType) {
    case 'lose':
      // Weight Loss: In Zone = [Target - 300, Target], Under = < Target - 300, Over = > Target
      if (consumed >= target - ZONE_TOLERANCE && consumed <= target) {
        return 'in_zone';
      } else if (consumed < target - ZONE_TOLERANCE) {
        return 'under';
      } else {
        return 'over';
      }

    case 'maintain':
    case 'recomp':
      // Recomp/Maintain: In Zone = [Target - 300, Target + 300], Under = < Target - 300, Over = > Target + 300
      if (consumed >= target - ZONE_TOLERANCE && consumed <= target + ZONE_TOLERANCE) {
        return 'in_zone';
      } else if (consumed < target - ZONE_TOLERANCE) {
        return 'under';
      } else {
        return 'over';
      }

    case 'gain':
      // Weight Gain: In Zone = [Target, Target + 300], Under = < Target, Over = > Target + 300
      if (consumed >= target && consumed <= target + ZONE_TOLERANCE) {
        return 'in_zone';
      } else if (consumed < target) {
        return 'under';
      } else {
        return 'over';
      }

    default:
      // Fallback to 'in_zone' for unknown goal types
      return 'in_zone';
  }
}

