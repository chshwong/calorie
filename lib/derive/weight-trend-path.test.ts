import { describe, expect, it } from 'vitest';
import { buildFitbitPathD } from './weight-trend-path';

describe('buildFitbitPathD', () => {
  it('connects between measurement points even across missing days', () => {
    const points = [
      { x: 10, y: 10 },
      null,
      null,
      { x: 40, y: 5 },
    ];
    const d = buildFitbitPathD(points);
    expect(d).toBe('M 10 10 L 40 5');
  });

  it('returns empty string when no points', () => {
    expect(buildFitbitPathD([null, null])).toBe('');
  });
});

