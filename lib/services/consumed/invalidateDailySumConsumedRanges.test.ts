import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invalidateDailySumConsumedRangesForDate,
  invalidateDailySumConsumedMealRangesForDate,
} from '@/lib/services/consumed/invalidateDailySumConsumedRanges';

describe('invalidateDailySumConsumedRangesForDate', () => {
  it('invalidates only ranges for the given user that contain the date', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    // Seed queries in cache (so findAll can discover them)
    qc.setQueryData(['dailySumConsumedRange', 'u1', '2026-01-01', '2026-01-07'], []);
    qc.setQueryData(['dailySumConsumedRange', 'u1', '2026-01-10', '2026-01-17'], []);
    qc.setQueryData(['dailySumConsumedRange', 'u2', '2026-01-01', '2026-01-07'], []);

    invalidateDailySumConsumedRangesForDate(qc, 'u1', '2026-01-03');

    // Only the first range for u1 contains 2026-01-03
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['dailySumConsumedRange', 'u1', '2026-01-01', '2026-01-07'],
    });
  });

  it('is a no-op when userId or dateKey is missing', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    invalidateDailySumConsumedRangesForDate(qc, undefined, '2026-01-03');
    invalidateDailySumConsumedRangesForDate(qc, 'u1', '');

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('invalidateDailySumConsumedMealRangesForDate', () => {
  it('invalidates only ranges for the given user that contain the date', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    // Seed queries in cache (so findAll can discover them)
    qc.setQueryData(['dailySumConsumedMealRange', 'u1', '2026-01-01', '2026-01-07'], []);
    qc.setQueryData(['dailySumConsumedMealRange', 'u1', '2026-01-10', '2026-01-17'], []);
    qc.setQueryData(['dailySumConsumedMealRange', 'u2', '2026-01-01', '2026-01-07'], []);

    invalidateDailySumConsumedMealRangesForDate(qc, 'u1', '2026-01-03');

    // Only the first range for u1 contains 2026-01-03
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['dailySumConsumedMealRange', 'u1', '2026-01-01', '2026-01-07'],
    });
  });

  it('is a no-op when userId or dateKey is missing', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    invalidateDailySumConsumedMealRangesForDate(qc, undefined, '2026-01-03');
    invalidateDailySumConsumedMealRangesForDate(qc, 'u1', '');

    expect(spy).not.toHaveBeenCalled();
  });
});


