type TFn = (key: string, options?: any) => string;

/**
 * Dashboard-only day label helper.
 * Keeps weekday formatting delegated to the caller to avoid changing existing visuals,
 * but forces a shared i18n label for Yesterday ("Yday").
 */
export function getDashboardDayLabel(args: {
  dateKey: string;
  todayKey: string;
  yesterdayKey: string;
  t: TFn;
  getWeekdayLabel: (dateKey: string) => string;
}): string {
  const { dateKey, todayKey, yesterdayKey, t, getWeekdayLabel } = args;
  if (dateKey === todayKey) return t('common.today');
  if (dateKey === yesterdayKey) return t('date.yday');
  return getWeekdayLabel(dateKey);
}

