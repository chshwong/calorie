import { describe, it, expect } from 'vitest';

import { getFoodLoggingStreakLabel } from './foodStreakLabel';

describe('getFoodLoggingStreakLabel', () => {
  it('returns null for null/undefined', () => {
    expect(getFoodLoggingStreakLabel(null)).toBeNull();
    expect(getFoodLoggingStreakLabel(undefined)).toBeNull();
  });

  it('returns null for days < 2', () => {
    expect(getFoodLoggingStreakLabel(0)).toBeNull();
    expect(getFoodLoggingStreakLabel(1)).toBeNull();
  });

  const cases: Array<{ days: number; emoji: string }> = [
    { days: 2, emoji: '📅' },
    { days: 5, emoji: '📅' },
    { days: 6, emoji: '👏' },
    { days: 14, emoji: '👏' },
    { days: 15, emoji: '💪' },
    { days: 25, emoji: '💪' },
    { days: 26, emoji: '🔥' },
    { days: 49, emoji: '🔥' },
    { days: 50, emoji: '🏆' },
    { days: 99, emoji: '🏆' },
    { days: 100, emoji: '👑' },
  ];

  it.each(cases)('returns correct label for $days days', ({ days, emoji }) => {
    const res = getFoodLoggingStreakLabel(days);
    expect(res).toEqual({ days, emoji });
  });
});

