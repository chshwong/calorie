import { describe, expect, it } from 'vitest';
import type { WeightLogRow } from '@/lib/services/weightLogs';

// Copy the helper functions here for testing, or import from a utils file
// Since these are simple pure functions, we'll test the logic directly
function getLatestWeightEntry(entries: WeightLogRow[]): WeightLogRow | null {
  if (!entries || entries.length === 0) return null;
  return entries.reduce((latest, current) => {
    if (!latest) return current;
    return new Date(current.weighed_at).getTime() > new Date(latest.weighed_at).getTime()
      ? current
      : latest;
  }, null as WeightLogRow | null);
}

function getLatestBodyFatEntry(entries: WeightLogRow[]): WeightLogRow | null {
  const withBodyFat = entries.filter((e) => e.body_fat_percent !== null && e.body_fat_percent !== undefined);
  if (withBodyFat.length === 0) return null;
  return withBodyFat.reduce((latest, current) => {
    if (!latest) return current;
    return new Date(current.weighed_at).getTime() > new Date(latest.weighed_at).getTime()
      ? current
      : latest;
  }, null as WeightLogRow | null);
}

describe('getLatestWeightEntry', () => {
  it('returns null for empty array', () => {
    const result = getLatestWeightEntry([]);
    expect(result).toBeNull();
  });

  it('returns single entry', () => {
    const entries: WeightLogRow[] = [
      {
        id: '1',
        user_id: 'user1',
        weighed_at: '2026-01-15T10:00:00Z',
        weight_lb: 150,
        body_fat_percent: 20,
        note: null,
      },
    ];

    const result = getLatestWeightEntry(entries);
    expect(result).toEqual(entries[0]);
  });

  it('returns entry with latest weighed_at timestamp', () => {
    const entries: WeightLogRow[] = [
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
        weighed_at: '2026-01-15T18:00:00Z', // Latest
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-15T12:00:00Z',
        weight_lb: 150.5,
        body_fat_percent: 20.5,
        note: null,
      },
    ];

    const result = getLatestWeightEntry(entries);
    expect(result?.id).toBe('2');
    expect(result?.weight_lb).toBe(151);
  });

  it('handles entries across multiple days', () => {
    const entries: WeightLogRow[] = [
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
        weighed_at: '2026-01-17T10:00:00Z', // Latest
        weight_lb: 152,
        body_fat_percent: 22,
        note: null,
      },
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-16T10:00:00Z',
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
    ];

    const result = getLatestWeightEntry(entries);
    expect(result?.id).toBe('2');
    expect(result?.weighed_at).toBe('2026-01-17T10:00:00Z');
  });
});

describe('getLatestBodyFatEntry', () => {
  it('returns null for empty array', () => {
    const result = getLatestBodyFatEntry([]);
    expect(result).toBeNull();
  });

  it('returns null when no entries have body_fat_percent', () => {
    const entries: WeightLogRow[] = [
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

    const result = getLatestBodyFatEntry(entries);
    expect(result).toBeNull();
  });

  it('returns entry with latest body_fat_percent', () => {
    const entries: WeightLogRow[] = [
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
        weighed_at: '2026-01-15T18:00:00Z', // Latest with body fat
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-16T10:00:00Z', // Latest but no body fat
        weight_lb: 152,
        body_fat_percent: null,
        note: null,
      },
    ];

    const result = getLatestBodyFatEntry(entries);
    expect(result?.id).toBe('2'); // Latest entry WITH body_fat_percent
    expect(result?.body_fat_percent).toBe(21);
  });

  it('ignores entries without body_fat_percent and finds latest with body fat', () => {
    const entries: WeightLogRow[] = [
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
        body_fat_percent: null, // No body fat
        note: null,
      },
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-17T10:00:00Z', // Latest but no body fat
        weight_lb: 152,
        body_fat_percent: null,
        note: null,
      },
    ];

    const result = getLatestBodyFatEntry(entries);
    expect(result?.id).toBe('1'); // Only entry with body fat
    expect(result?.body_fat_percent).toBe(20);
  });

  it('handles mixed entries correctly', () => {
    const entries: WeightLogRow[] = [
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
        weighed_at: '2026-01-15T12:00:00Z',
        weight_lb: 150.5,
        body_fat_percent: null, // No body fat
        note: null,
      },
      {
        id: '3',
        user_id: 'user1',
        weighed_at: '2026-01-15T18:00:00Z', // Latest with body fat
        weight_lb: 151,
        body_fat_percent: 21,
        note: null,
      },
      {
        id: '4',
        user_id: 'user1',
        weighed_at: '2026-01-16T10:00:00Z',
        weight_lb: 152,
        body_fat_percent: null, // No body fat
        note: null,
      },
    ];

    const result = getLatestBodyFatEntry(entries);
    expect(result?.id).toBe('3'); // Latest entry WITH body fat
    expect(result?.body_fat_percent).toBe(21);
  });
});

