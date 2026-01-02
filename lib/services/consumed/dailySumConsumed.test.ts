import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyLogStatus, DailySumConsumed } from '@/utils/types';

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

describe('dailySumConsumed service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDailySumConsumedForRange', () => {
    it('returns empty array when userId is missing', async () => {
      const { getDailySumConsumedForRange } = await import('./dailySumConsumed');
      const result = await getDailySumConsumedForRange('', '2026-01-01', '2026-01-07');
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns empty array when startDate is missing', async () => {
      const { getDailySumConsumedForRange } = await import('./dailySumConsumed');
      const result = await getDailySumConsumedForRange('u1', '', '2026-01-07');
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns empty array when endDate is missing', async () => {
      const { getDailySumConsumedForRange } = await import('./dailySumConsumed');
      const result = await getDailySumConsumedForRange('u1', '2026-01-01', '');
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('fetches daily sum consumed data for a date range', async () => {
      const mockData: DailySumConsumed[] = [
        {
          user_id: 'u1',
          entry_date: '2026-01-01',
          calories: 1500,
          protein_g: 100,
          carbs_g: 150,
          fat_g: 50,
          fibre_g: 25,
          sugar_g: 75,
          saturated_fat_g: 20,
          trans_fat_g: 0,
          sodium_mg: 2000,
          log_status: 'unknown',
          created_at: '2026-01-01T00:00:00.000Z',
          touched_at: '2026-01-01T12:00:00.000Z',
          status_updated_at: null,
          completed_at: null,
          last_recomputed_at: '2026-01-01T12:00:00.000Z',
          updated_at: '2026-01-01T12:00:00.000Z',
        },
        {
          user_id: 'u1',
          entry_date: '2026-01-02',
          calories: 1800,
          protein_g: 120,
          carbs_g: 180,
          fat_g: 60,
          fibre_g: 30,
          sugar_g: 90,
          saturated_fat_g: 25,
          trans_fat_g: 0,
          sodium_mg: 2500,
          log_status: 'completed',
          created_at: '2026-01-02T00:00:00.000Z',
          touched_at: '2026-01-02T12:00:00.000Z',
          status_updated_at: '2026-01-02T18:00:00.000Z',
          completed_at: '2026-01-02T18:00:00.000Z',
          last_recomputed_at: '2026-01-02T12:00:00.000Z',
          updated_at: '2026-01-02T18:00:00.000Z',
        },
      ];

      // Set up the chain: from().select().eq().gte().lte().order()
      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getDailySumConsumedForRange } = await import('./dailySumConsumed');
      const result = await getDailySumConsumedForRange('u1', '2026-01-01', '2026-01-07');

      expect(result).toEqual(mockData);
      expect(mockFrom).toHaveBeenCalledWith('daily_sum_consumed');
      expect(mockSelect).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('user_id', 'u1');
      expect(mockGte).toHaveBeenCalledWith('entry_date', '2026-01-01');
      expect(mockLte).toHaveBeenCalledWith('entry_date', '2026-01-07');
      expect(mockOrder).toHaveBeenCalledWith('entry_date', { ascending: true });
    });

    it('returns empty array on error', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: '500' },
      });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getDailySumConsumedForRange } = await import('./dailySumConsumed');
      const result = await getDailySumConsumedForRange('u1', '2026-01-01', '2026-01-07');

      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getDailySumConsumedForRange } = await import('./dailySumConsumed');
      const result = await getDailySumConsumedForRange('u1', '2026-01-01', '2026-01-07');

      expect(result).toEqual([]);
    });
  });

  describe('setDailyConsumedStatus', () => {
    it('returns false when entryDate is missing', async () => {
      const { setDailyConsumedStatus } = await import('./dailySumConsumed');
      const result = await setDailyConsumedStatus({ entryDate: '', status: 'completed' });
      expect(result).toBe(false);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('calls RPC with correct parameters for completed status', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const { setDailyConsumedStatus } = await import('./dailySumConsumed');
      const result = await setDailyConsumedStatus({ entryDate: '2026-01-01', status: 'completed' });

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('set_daily_consumed_status', {
        p_entry_date: '2026-01-01',
        p_status: 'completed',
      });
    });

    it('calls RPC with correct parameters for fasted status', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const { setDailyConsumedStatus } = await import('./dailySumConsumed');
      const result = await setDailyConsumedStatus({ entryDate: '2026-01-01', status: 'fasted' });

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('set_daily_consumed_status', {
        p_entry_date: '2026-01-01',
        p_status: 'fasted',
      });
    });

    it('calls RPC with correct parameters for unknown status', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const { setDailyConsumedStatus } = await import('./dailySumConsumed');
      const result = await setDailyConsumedStatus({ entryDate: '2026-01-01', status: 'unknown' });

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('set_daily_consumed_status', {
        p_entry_date: '2026-01-01',
        p_status: 'unknown',
      });
    });

    it('returns false on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error', code: '500' },
      });

      const { setDailyConsumedStatus } = await import('./dailySumConsumed');
      const result = await setDailyConsumedStatus({ entryDate: '2026-01-01', status: 'completed' });

      expect(result).toBe(false);
    });
  });

  describe('recomputeDailySumConsumed', () => {
    it('returns false when entryDate is missing', async () => {
      const { recomputeDailySumConsumed } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumed('');
      expect(result).toBe(false);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('calls RPC with correct parameters', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const { recomputeDailySumConsumed } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumed('2026-01-01');

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('recompute_daily_sum_consumed', {
        p_entry_date: '2026-01-01',
      });
    });

    it('returns false on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error', code: '500' },
      });

      const { recomputeDailySumConsumed } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumed('2026-01-01');

      expect(result).toBe(false);
    });
  });

  describe('recomputeDailySumConsumedRange', () => {
    it('returns null when startDate is missing', async () => {
      const { recomputeDailySumConsumedRange } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumedRange({ startDate: '', endDate: '2026-01-07' });
      expect(result).toBeNull();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('returns null when endDate is missing', async () => {
      const { recomputeDailySumConsumedRange } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumedRange({ startDate: '2026-01-01', endDate: '' });
      expect(result).toBeNull();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('calls RPC with correct parameters and returns number of upserted rows', async () => {
      mockRpc.mockResolvedValue({ data: 5, error: null });

      const { recomputeDailySumConsumedRange } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumedRange({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      expect(result).toBe(5);
      expect(mockRpc).toHaveBeenCalledWith('recompute_daily_sum_consumed_range', {
        p_start: '2026-01-01',
        p_end: '2026-01-07',
      });
    });

    it('returns null when data is not a number', async () => {
      mockRpc.mockResolvedValue({ data: 'invalid', error: null });

      const { recomputeDailySumConsumedRange } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumedRange({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      expect(result).toBeNull();
    });

    it('returns null on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error', code: '500' },
      });

      const { recomputeDailySumConsumedRange } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumedRange({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      expect(result).toBeNull();
    });

    it('returns null when data is null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const { recomputeDailySumConsumedRange } = await import('./dailySumConsumed');
      const result = await recomputeDailySumConsumedRange({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      expect(result).toBeNull();
    });
  });
});

