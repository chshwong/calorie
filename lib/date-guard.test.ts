import { describe, expect, it } from 'vitest';
import { clampDateKey, compareDateKeys, dateKeyToLocalStartOfDay, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { toDateKey } from '@/utils/dateKey';

describe('date-guard', () => {
  it('getMinAllowedDateKeyFromSignupAt returns a canonical dateKey based on local timezone', () => {
    const iso = '2024-01-02T03:04:05.678Z';
    const key = getMinAllowedDateKeyFromSignupAt(iso);

    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Implementation is intentionally local-date based.
    expect(key).toBe(toDateKey(iso));
  });

  it('compareDateKeys orders canonical date keys correctly', () => {
    expect(compareDateKeys('2025-01-01', '2025-01-01')).toBe(0);
    expect(compareDateKeys('2025-01-01', '2025-01-02')).toBe(-1);
    expect(compareDateKeys('2025-01-10', '2025-01-02')).toBe(1);
  });

  it('clampDateKey clamps below min and above max', () => {
    const min = '2025-01-10';
    const max = '2025-01-20';

    expect(clampDateKey('2025-01-01', min, max)).toBe(min);
    expect(clampDateKey('2025-01-15', min, max)).toBe('2025-01-15');
    expect(clampDateKey('2025-02-01', min, max)).toBe(max);
  });

  it('dateKeyToLocalStartOfDay returns a local midnight Date for that key', () => {
    const key = '2025-07-04';
    const d = dateKeyToLocalStartOfDay(key);

    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
    expect(toDateKey(d)).toBe(key);
  });
});


