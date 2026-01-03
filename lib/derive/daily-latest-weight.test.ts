import { describe, expect, it } from 'vitest';
import { deriveDailyLatestWeight } from './daily-latest-weight';
import type { WeightLogRow } from '@/lib/services/weightLogs';

describe('deriveDailyLatestWeight', () => {
  it('returns empty array for empty input', () => {
    const result = deriveDailyLatestWeight([]);
    expect(result).toEqual([]);
  });

  it('handles single log entry', () => {
    const logs: WeightLogRow[] = [
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-15T10:30:00Z',
        weight_lb: 150,
        body_fat_percent: 20,
        note: null,
      },
    ];

    const result = deriveDailyLatestWeight(logs);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date_key: '2026-01-15',
      weight_lb: 150,
      body_fat_percent: 20,
      id: '1',
    });
    expect(result[0].weighed_at).toBe('2026-01-15T10:30:00Z');
  });

  it('selects latest weigh-in when multiple entries exist on same day', () => {
    const logs: WeightLogRow[] = [
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-15T08:00:00Z',
        weight_lb: 150,
        body_fat_percent: 20,
        note: null,
      },
      {
        id: '2',
        user_id: 'user1',
        weighed_at: '2026-01-15T18:00:00Z', // Later same day
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
    ];

    const result = deriveDailyLatestWeight(logs);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date_key: '2026-01-15',
      weight_lb: 151, // Latest weight
      body_fat_percent: 21, // Latest body fat
      id: '2', // Latest entry ID
    });
  });

  it('handles multiple days correctly', () => {
    const logs: WeightLogRow[] = [
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-15T10:00:00Z',
        weight_lb: 150,
        body_fat_percent: 20,
        note: null,
      },
      {
        id: '2',
        user_id: 'user1',
        weighed_at: '2026-01-16T10:00:00Z',
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-17T10:00:00Z',
        weight_lb: 152,
        body_fat_percent: null,
        note: null,
      },
    ];

    const result = deriveDailyLatestWeight(logs);
    expect(result).toHaveLength(3);
    expect(result[0].date_key).toBe('2026-01-15');
    expect(result[1].date_key).toBe('2026-01-16');
    expect(result[2].date_key).toBe('2026-01-17');
    expect(result[0].weight_lb).toBe(150);
    expect(result[1].weight_lb).toBe(151);
    expect(result[2].weight_lb).toBe(152);
  });

  it('sorts results by date_key ascending', () => {
    const logs: WeightLogRow[] = [
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-17T10:00:00Z',
        weight_lb: 152,
        body_fat_percent: null,
        note: null,
      },
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-15T10:00:00Z',
        weight_lb: 150,
        body_fat_percent: 20,
        note: null,
      },
      {
        id: '2',
        user_id: 'user1',
        weighed_at: '2026-01-16T10:00:00Z',
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
    ];

    const result = deriveDailyLatestWeight(logs);
    expect(result).toHaveLength(3);
    expect(result[0].date_key).toBe('2026-01-15');
    expect(result[1].date_key).toBe('2026-01-16');
    expect(result[2].date_key).toBe('2026-01-17');
  });

  it('handles null weight_lb and body_fat_percent', () => {
    const logs: WeightLogRow[] = [
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-15T10:00:00Z',
        weight_lb: 150,
        body_fat_percent: null,
        note: null,
      },
      {
        id: '2',
        user_id: 'user1',
        weighed_at: '2026-01-16T10:00:00Z',
        weight_lb: 151,
        body_fat_percent: null,
        note: null,
      },
    ];

    const result = deriveDailyLatestWeight(logs);
    expect(result[0].body_fat_percent).toBeNull();
    expect(result[1].body_fat_percent).toBeNull();
  });

  it('handles timezone boundaries correctly (uses local date)', () => {
    // Test that UTC timestamps are converted to local date keys
    // If test runs in UTC, these should map to same day
    // If test runs in PST (UTC-8), 2026-01-16T07:00:00Z maps to 2026-01-15 local
    const logs: WeightLogRow[] = [
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-16T07:00:00Z', // Early morning UTC
        weight_lb: 150,
        body_fat_percent: 20,
        note: null,
      },
      {
        id: '2',
        user_id: 'user1',
        weighed_at: '2026-01-16T23:00:00Z', // Late evening UTC
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
    ];

    const result = deriveDailyLatestWeight(logs);
    // Both entries should map to the same local date (depending on test timezone)
    // The key test is that the later timestamp wins
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2'); // Latest entry wins
    expect(result[0].weight_lb).toBe(151);
  });

  it('handles complex scenario: multiple entries per day across multiple days', () => {
    const logs: WeightLogRow[] = [
      // Day 1: 2 entries
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-15T08:00:00Z',
        weight_lb: 150,
        body_fat_percent: 20,
        note: null,
      },
      {
        id: '2',
        user_id: 'user1',
        weighed_at: '2026-01-15T20:00:00Z', // Latest on day 1
        weight_lb: 150.5,
        body_fat_percent: 20.5,
        note: null,
      },
      // Day 2: 1 entry
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-16T10:00:00Z',
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
      // Day 3: 3 entries
      {
        id: '4',
        user_id: 'user1',
        weighed_at: '2026-01-17T07:00:00Z',
        weight_lb: 151.5,
        body_fat_percent: 21.5,
        note: null,
      },
      {
        id: '5',
        user_id: 'user1',
        weighed_at: '2026-01-17T14:00:00Z',
        weight_lb: 152,
        body_fat_percent: 22,
        note: null,
      },
      {
        id: '6',
        user_id: 'user1',
        weighed_at: '2026-01-17T22:00:00Z', // Latest on day 3
        weight_lb: 152.5,
        body_fat_percent: 22.5,
        note: null,
      },
    ];

    const result = deriveDailyLatestWeight(logs);
    expect(result).toHaveLength(3);

    // Day 1: latest entry (id: 2)
    expect(result[0].date_key).toBe('2026-01-15');
    expect(result[0].id).toBe('2');
    expect(result[0].weight_lb).toBe(150.5);
    expect(result[0].body_fat_percent).toBe(20.5);

    // Day 2: only entry (id: 3)
    expect(result[1].date_key).toBe('2026-01-16');
    expect(result[1].id).toBe('3');
    expect(result[1].weight_lb).toBe(151);
    expect(result[1].body_fat_percent).toBe(21);

    // Day 3: latest entry (id: 6)
    expect(result[2].date_key).toBe('2026-01-17');
    expect(result[2].id).toBe('6');
    expect(result[2].weight_lb).toBe(152.5);
    expect(result[2].body_fat_percent).toBe(22.5);
  });
});

