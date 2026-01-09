import { describe, expect, it } from 'vitest';
import { buildWeightSeriesForDayKeys } from './weight-chart-series';

describe('buildWeightSeriesForDayKeys', () => {
  it('returns NaN for missing days (no carry-forward)', () => {
    const dayKeys = ['2025-01-01', '2025-01-02', '2025-01-03'];
    const dailyMap = new Map<any, any>([
      ['2025-01-01', { date_key: '2025-01-01', weight_lb: 180 }],
      // 2025-01-02 missing
      ['2025-01-03', { date_key: '2025-01-03', weight_lb: 178 }],
    ]);

    const values = buildWeightSeriesForDayKeys({ dayKeys, dailyMap: dailyMap as any, unit: 'lbs' });
    expect(values[0]).toBe(180);
    expect(Number.isNaN(values[1])).toBe(true);
    expect(values[2]).toBe(178);
  });
});

