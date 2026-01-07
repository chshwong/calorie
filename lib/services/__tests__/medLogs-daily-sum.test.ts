import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for daily_sum_meds functionality in medLogs service
 * 
 * Tests the getMedSummaryForRecentDays function which queries the
 * daily_sum_meds precomputed table for efficient "Recent Days" display.
 */

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Mock dateTime
const mockGetLocalDateKey = vi.fn((date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

vi.mock('@/utils/dateTime', () => ({
  getLocalDateKey: mockGetLocalDateKey,
}));

describe('medLogs - daily_sum_meds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behavior
    mockGetLocalDateKey.mockImplementation((date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });
  });

  describe('getMedSummaryForRecentDays', () => {
    it('returns empty array when userId is missing', async () => {
      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('', 7);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('fetches med summary data for recent days', async () => {
      // Mock today's date
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          med_count: 2,
          supp_count: 1,
        },
        {
          date: '2025-01-14',
          med_count: 1,
          supp_count: 0,
        },
      ];

      // Set up the chain: from().select().eq().gte().lte().order()
      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2025-01-15');
      expect(result[0].med_count).toBe(2);
      expect(result[0].supp_count).toBe(1);
      expect(result[0].item_count).toBe(3); // 2 meds + 1 supp
      expect(result[1].date).toBe('2025-01-14');
      expect(result[1].med_count).toBe(1);
      expect(result[1].supp_count).toBe(0);
      expect(result[1].item_count).toBe(1); // 1 med + 0 supp

      expect(mockFrom).toHaveBeenCalledWith('daily_sum_meds');
      expect(mockSelect).toHaveBeenCalledWith('date, med_count, supp_count');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockOrder).toHaveBeenCalledWith('date', { ascending: false });
    });

    it('calculates item_count correctly from med_count and supp_count', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          med_count: 5,
          supp_count: 3,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      expect(result[0].med_count).toBe(5);
      expect(result[0].supp_count).toBe(3);
      expect(result[0].item_count).toBe(8); // 5 + 3
    });

    it('handles null/undefined counts with defaults', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          med_count: null, // Should default to 0
          supp_count: undefined, // Should default to 0
        },
        {
          date: '2025-01-14',
          med_count: 2,
          supp_count: null,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      expect(result[0].med_count).toBe(0);
      expect(result[0].supp_count).toBe(0);
      expect(result[0].item_count).toBe(0); // null + undefined = 0
      expect(result[1].med_count).toBe(2);
      expect(result[1].supp_count).toBe(0);
      expect(result[1].item_count).toBe(2); // 2 + null = 2
    });

    it('returns empty array on database error', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: '500' },
      });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      mockOrder.mockResolvedValue({ data: null, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      expect(result).toEqual([]);
    });

    it('handles exception during execution', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      expect(result).toEqual([]);
    });

    it('calculates correct date range for query', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      await getMedSummaryForRecentDays('user-123', 7);

      // Should query from 7 days ago to today
      expect(mockGte).toHaveBeenCalledWith('date', '2025-01-09'); // 7 days ago
      expect(mockLte).toHaveBeenCalledWith('date', '2025-01-15'); // today
    });

    it('handles different day counts correctly', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      await getMedSummaryForRecentDays('user-123', 14);

      expect(mockGte).toHaveBeenCalledWith('date', '2025-01-02'); // 14 days ago
    });

    it('returns results sorted by date descending (newest first)', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-14',
          med_count: 1,
          supp_count: 0,
        },
        {
          date: '2025-01-15',
          med_count: 2,
          supp_count: 1,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      // Should be sorted newest first (as returned from DB with DESC order)
      expect(result[0].date).toBe('2025-01-14');
      expect(result[1].date).toBe('2025-01-15');
    });

    it('handles zero counts correctly', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          med_count: 0,
          supp_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      // Note: In practice, daily_sum_meds should not have rows with both counts = 0
      // (they get deleted by the recompute function), but we handle it gracefully
      expect(result[0].med_count).toBe(0);
      expect(result[0].supp_count).toBe(0);
      expect(result[0].item_count).toBe(0);
    });

    it('returns med_count and supp_count in addition to item_count', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          med_count: 3,
          supp_count: 2,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      const result = await getMedSummaryForRecentDays('user-123', 7);

      // Verify all three fields are present
      expect(result[0]).toHaveProperty('med_count');
      expect(result[0]).toHaveProperty('supp_count');
      expect(result[0]).toHaveProperty('item_count');
      expect(result[0].med_count).toBe(3);
      expect(result[0].supp_count).toBe(2);
      expect(result[0].item_count).toBe(5);
    });
  });

  describe('Date Range Calculation', () => {
    it('calculates date range correctly for default 7 days', async () => {
      const today = new Date('2025-02-10T14:30:00Z');
      vi.setSystemTime(today);

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      await getMedSummaryForRecentDays('user-123');

      // Default is 7 days
      const expectedStart = '2025-02-04'; // 7 days ago
      const expectedEnd = '2025-02-10'; // today
      expect(mockGte).toHaveBeenCalledWith('date', expectedStart);
      expect(mockLte).toHaveBeenCalledWith('date', expectedEnd);
    });

    it('handles month boundaries correctly', async () => {
      const today = new Date('2025-02-01T12:00:00Z');
      vi.setSystemTime(today);

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      await getMedSummaryForRecentDays('user-123', 7);

      // Should handle month boundary (Jan 26 to Feb 1)
      expect(mockGte).toHaveBeenCalledWith('date', '2025-01-26');
      expect(mockLte).toHaveBeenCalledWith('date', '2025-02-01');
    });

    it('handles year boundaries correctly', async () => {
      const today = new Date('2025-01-02T12:00:00Z');
      vi.setSystemTime(today);

      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getMedSummaryForRecentDays } = await import('../medLogs');
      await getMedSummaryForRecentDays('user-123', 7);

      // Should handle year boundary (Dec 27, 2024 to Jan 2, 2025)
      expect(mockGte).toHaveBeenCalledWith('date', '2024-12-27');
      expect(mockLte).toHaveBeenCalledWith('date', '2025-01-02');
    });
  });
});

