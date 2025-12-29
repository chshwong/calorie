/**
 * Calorie plan mapping utilities
 *
 * The database constraint `check_valid_calorie_plan` expects one of:
 *   - 'easy' | 'recommended' | 'aggressive' | 'custom' | 'calculated'
 *
 * Some parts of the UI historically emit legacy keys like:
 *   - 'onTime' | 'sustainable' | 'accelerated' | 'custom'
 *
 * This helper normalizes any incoming value to a valid DB value.
 */

export type CaloriePlanDbValue = 'easy' | 'recommended' | 'aggressive' | 'custom' | 'calculated';

const DB_VALUES: ReadonlySet<string> = new Set(['easy', 'recommended', 'aggressive', 'custom', 'calculated']);

export function mapCaloriePlanToDb(plan: string | null | undefined): CaloriePlanDbValue {
  if (!plan || typeof plan !== 'string') return 'calculated';

  // Pass-through if already valid.
  if (DB_VALUES.has(plan)) return plan as CaloriePlanDbValue;

  // Legacy UI keys.
  switch (plan) {
    case 'onTime':
      return 'calculated';
    case 'sustainable':
      return 'recommended';
    case 'accelerated':
      return 'aggressive';
    case 'custom':
      return 'custom';
    // Newer internal keys (defensive; ensures DB-safe values even if we change UI keys).
    case 'standard':
      return 'recommended';
    case 'moreSustainable':
      return 'easy';
    case 'cautiousMinimum':
    case 'sustainable_floor_1200':
      return 'easy';
    default:
      return 'calculated';
  }
}


