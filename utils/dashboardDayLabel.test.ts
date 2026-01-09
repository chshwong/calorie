import { describe, expect, it } from 'vitest';
import { getDashboardDayLabel } from './dashboardDayLabel';

describe('getDashboardDayLabel', () => {
  it('returns Today for todayKey', () => {
    const out = getDashboardDayLabel({
      dateKey: '2026-01-09',
      todayKey: '2026-01-09',
      yesterdayKey: '2026-01-08',
      t: (k: string) => (k === 'common.today' ? 'Today' : k),
      getWeekdayLabel: () => 'Fri',
    });
    expect(out).toBe('Today');
  });

  it('returns Yday i18n key for yesterdayKey', () => {
    const out = getDashboardDayLabel({
      dateKey: '2026-01-08',
      todayKey: '2026-01-09',
      yesterdayKey: '2026-01-08',
      t: (k: string) => (k === 'date.yday' ? 'Yday' : k),
      getWeekdayLabel: () => 'Thu',
    });
    expect(out).toBe('Yday');
  });

  it('delegates weekday formatting for other days', () => {
    const out = getDashboardDayLabel({
      dateKey: '2026-01-07',
      todayKey: '2026-01-09',
      yesterdayKey: '2026-01-08',
      t: (k: string) => k,
      getWeekdayLabel: (k: string) => (k === '2026-01-07' ? 'Wed' : 'X'),
    });
    expect(out).toBe('Wed');
  });
});

