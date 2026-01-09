import { describe, expect, it } from 'vitest';
import { getLatestWeightDisplayFromLogs } from './weight-display';

describe('getLatestWeightDisplayFromLogs', () => {
  it('returns nulls for empty logs', () => {
    expect(getLatestWeightDisplayFromLogs([])).toEqual({
      weighedAtISO: null,
      weightLb: null,
      bodyFatPercent: null,
    });
  });

  it('ties body fat strictly to the latest weigh-in (no fallback)', () => {
    const logs: any[] = [
      {
        id: 'old',
        weighed_at: '2025-01-01T10:00:00.000Z',
        weight_lb: 180,
        body_fat_percent: 22,
      },
      {
        id: 'new',
        weighed_at: '2025-01-02T10:00:00.000Z',
        weight_lb: 179,
        body_fat_percent: null,
      },
    ];

    const out = getLatestWeightDisplayFromLogs(logs as any);
    expect(out.weighedAtISO).toBe('2025-01-02T10:00:00.000Z');
    expect(out.weightLb).toBe(179);
    // Critical: do NOT fall back to older body fat.
    expect(out.bodyFatPercent).toBe(null);
  });
});

