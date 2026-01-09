import { lbToKg } from '@/lib/domain/weight-constants';

/**
 * Formats weekly weight loss projection based on daily calorie deficit
 * 
 * @param deficitCalories - Daily calorie deficit (positive number)
 * @param unit - Weight unit preference ('lb' or 'kg')
 * @param t - Translation function for internationalization
 * @returns Formatted string with weekly projection
 */
export function formatWeeklyLossProjection(
  deficitCalories: number,
  unit: 'lb' | 'kg',
  t: (key: string, options?: { [key: string]: string | number }) => string
): string {
  // 3600 calories ≈ 1 lb (standard conversion)
  const lbPerWeek = (deficitCalories * 7) / 3600;
  const perWeek = unit === 'kg' ? lbToKg(lbPerWeek) : lbPerWeek;
  // round to 1 decimal, minimum 0.1
  const rounded = Math.max(0.1, Math.round(perWeek * 10) / 10);
  const unitStr = unit === 'kg' ? 'kg' : 'lb';
  const projection = `${rounded.toFixed(1)} ${unitStr} per week`;
  return t('home.done_for_today.weekly_loss_projection', {
    projection,
    defaultValue: `Days like today ≈ ${projection}.`,
  });
}

