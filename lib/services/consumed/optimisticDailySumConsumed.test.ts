import { describe, expect, it } from 'vitest';
import { buildOptimisticDailySumConsumedRow } from '@/lib/services/consumed/optimisticDailySumConsumed';

describe('buildOptimisticDailySumConsumedRow', () => {
  it('fills missing previous with zeros and timestamps', () => {
    const row = buildOptimisticDailySumConsumedRow({
      userId: 'u1',
      entryDate: '2026-01-02',
      status: 'unknown',
      nowIso: '2026-01-02T12:00:00.000Z',
      previous: null,
    });

    expect(row.user_id).toBe('u1');
    expect(row.entry_date).toBe('2026-01-02');
    expect(row.calories).toBe(0);
    expect(row.log_status).toBe('unknown');
    expect(row.created_at).toBe('2026-01-02T12:00:00.000Z');
    expect(row.completed_at).toBeNull();
  });

  it('preserves totals and created_at from previous row', () => {
    const row = buildOptimisticDailySumConsumedRow({
      userId: 'u1',
      entryDate: '2026-01-02',
      status: 'completed',
      nowIso: '2026-01-02T12:00:00.000Z',
      previous: {
        user_id: 'u1',
        entry_date: '2026-01-02',
        calories: 123,
        protein_g: 1,
        carbs_g: 2,
        fat_g: 3,
        fibre_g: 4,
        sugar_g: 5,
        saturated_fat_g: 6,
        trans_fat_g: 7,
        sodium_mg: 8,
        log_status: 'unknown',
        created_at: '2026-01-01T00:00:00.000Z',
        touched_at: 'x',
        status_updated_at: null,
        completed_at: null,
        last_recomputed_at: null,
        updated_at: 'x',
      },
    });

    expect(row.calories).toBe(123);
    expect(row.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(row.log_status).toBe('completed');
    expect(row.completed_at).toBe('2026-01-02T12:00:00.000Z');
  });
});


