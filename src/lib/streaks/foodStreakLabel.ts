// Domain helper only: do not hardcode user-facing copy here.
// UI must format copy via i18n/en.json + t() (see docs/engineering-guidelines.md).
type FoodStreakLabel = { emoji: string; days: number } | null;

export function getFoodLoggingStreakLabel(days: number | null | undefined): FoodStreakLabel {
  if (days == null || days < 2) return null;

  let emoji: string;
  if (days <= 5) emoji = '📅';
  else if (days <= 14) emoji = '👏';
  else if (days <= 25) emoji = '💪';
  else if (days <= 49) emoji = '🔥';
  else if (days <= 99) emoji = '🏆';
  else emoji = '👑';

  return { emoji, days };
}

