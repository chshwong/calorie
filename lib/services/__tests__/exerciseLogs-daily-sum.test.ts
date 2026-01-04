import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for daily_sum_exercises functionality in exerciseLogs service
 * 
 * Tests the getExerciseSummaryForRecentDays function which queries the
 * daily_sum_exercises precomputed table for efficient "Recent Days" display.
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

// Mock date-guard
const mockGetMinAllowedDateKeyFromSignupAt = vi.fn();
vi.mock('@/lib/date-guard', async () => ({
  getMinAllowedDateKeyFromSignupAt: mockGetMinAllowedDateKeyFromSignupAt,
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

describe('exerciseLogs - daily_sum_exercises', () => {
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

  describe('getExerciseSummaryForRecentDays', () => {
    it('returns empty array when userId is missing', async () => {
      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('', 7);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('fetches exercise summary data for recent days', async () => {
      // Mock today's date
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: 3,
          cardio_minutes: 45,
          cardio_count: 2,
          cardio_distance_km: '5.2500',
          strength_count: 1,
        },
        {
          date: '2025-01-14',
          activity_count: 2,
          cardio_minutes: 30,
          cardio_count: 2,
          cardio_distance_km: '3.5000',
          strength_count: 0,
        },
      ];

      // Set up the chain: from().select().eq().gte().lte().order()
      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      expect(result).toHaveLength(7); // Should fill missing days
      expect(result[0].date).toBe('2025-01-15');
      expect(result[0].total_minutes).toBe(45);
      expect(result[0].activity_count).toBe(3);
      expect(result[0].cardio_count).toBe(2);
      expect(result[0].cardio_distance_km).toBe(5.25); // Converted from string
      expect(result[0].strength_count).toBe(1);

      expect(mockFrom).toHaveBeenCalledWith('daily_sum_exercises');
      expect(mockSelect).toHaveBeenCalledWith(
        'date, activity_count, cardio_minutes, cardio_count, cardio_distance_km, strength_count'
      );
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockOrder).toHaveBeenCalledWith('date', { ascending: false });
    });

    it('converts cardio_distance_km from numeric string to number', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: 1,
          cardio_minutes: 30,
          cardio_count: 1,
          cardio_distance_km: '10.1234', // Numeric string
          strength_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      expect(result[0].cardio_distance_km).toBe(10.1234);
      expect(typeof result[0].cardio_distance_km).toBe('number');
    });

    it('handles cardio_distance_km as number type (not string)', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: 1,
          cardio_minutes: 30,
          cardio_count: 1,
          cardio_distance_km: 7.5, // Already a number
          strength_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      expect(result[0].cardio_distance_km).toBe(7.5);
      expect(typeof result[0].cardio_distance_km).toBe('number');
    });

    it('fills missing days with empty entries for consistent UI', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: 2,
          cardio_minutes: 30,
          cardio_count: 2,
          cardio_distance_km: '5.0000',
          strength_count: 0,
        },
        // Missing 2025-01-14, 2025-01-13, etc.
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      expect(result).toHaveLength(7);
      // First item should be today with data
      expect(result[0].date).toBe('2025-01-15');
      expect(result[0].activity_count).toBe(2);
      // Last item should be 7 days ago with empty data
      expect(result[6].date).toBe('2025-01-09');
      expect(result[6].activity_count).toBe(0);
      expect(result[6].total_minutes).toBe(0);
      expect(result[6].cardio_count).toBe(0);
      expect(result[6].cardio_distance_km).toBe(0);
      expect(result[6].strength_count).toBe(0);
    });

    it('returns results sorted by date descending (newest first)', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-14',
          activity_count: 1,
          cardio_minutes: 20,
          cardio_count: 1,
          cardio_distance_km: '3.0000',
          strength_count: 0,
        },
        {
          date: '2025-01-15',
          activity_count: 2,
          cardio_minutes: 30,
          cardio_count: 2,
          cardio_distance_km: '5.0000',
          strength_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      // Should be sorted newest first
      expect(result[0].date).toBe('2025-01-15');
      expect(result[1].date).toBe('2025-01-14');
    });

    it('filters out dates before user signup date', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      // User signed up on 2025-01-10
      mockGetMinAllowedDateKeyFromSignupAt.mockReturnValue('2025-01-10');

      const mockData = [
        {
          date: '2025-01-09', // Before signup - should be filtered
          activity_count: 1,
          cardio_minutes: 20,
          cardio_count: 1,
          cardio_distance_km: '3.0000',
          strength_count: 0,
        },
        {
          date: '2025-01-10', // Signup date - should be included
          activity_count: 2,
          cardio_minutes: 30,
          cardio_count: 2,
          cardio_distance_km: '5.0000',
          strength_count: 0,
        },
        {
          date: '2025-01-15',
          activity_count: 1,
          cardio_minutes: 15,
          cardio_count: 1,
          cardio_distance_km: '2.0000',
          strength_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7, '2025-01-10T00:00:00Z');

      // Should filter out 2025-01-09
      const dates = result.map((r) => r.date);
      expect(dates).not.toContain('2025-01-09');
      expect(dates).toContain('2025-01-10');
      expect(dates).toContain('2025-01-15');

      // Should not fill days before signup
      const datesBeforeSignup = dates.filter((d) => d < '2025-01-10');
      expect(datesBeforeSignup).toHaveLength(0);
    });

    it('only fills missing days that are >= signup date', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      // User signed up on 2025-01-12 (4 days ago)
      mockGetMinAllowedDateKeyFromSignupAt.mockReturnValue('2025-01-12');

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: 1,
          cardio_minutes: 15,
          cardio_count: 1,
          cardio_distance_km: '2.0000',
          strength_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7, '2025-01-12T00:00:00Z');

      // Should only have 4 days (Jan 12-15), not 7
      expect(result.length).toBeLessThanOrEqual(7);
      const dates = result.map((r) => r.date);
      expect(dates[0]).toBe('2025-01-15');
      // Should not include dates before signup
      const datesBeforeSignup = dates.filter((d) => d < '2025-01-12');
      expect(datesBeforeSignup).toHaveLength(0);
    });

    it('handles null/undefined values with defaults', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: null, // Should default to 0
          cardio_minutes: null, // Should default to 0
          cardio_count: null, // Should default to 0
          cardio_distance_km: null, // Should default to 0
          strength_count: null, // Should default to 0
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      expect(result[0].activity_count).toBe(0);
      expect(result[0].total_minutes).toBe(0);
      expect(result[0].cardio_count).toBe(0);
      expect(result[0].cardio_distance_km).toBe(0);
      expect(result[0].strength_count).toBe(0);
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

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

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

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      // Should still fill missing days even when data is null
      expect(result).toHaveLength(7);
      expect(result.every((r) => r.activity_count === 0)).toBe(true);
    });

    it('handles exception during execution', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

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

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      await getExerciseSummaryForRecentDays('user-123', 7);

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

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 14);

      expect(result).toHaveLength(14);
      expect(mockGte).toHaveBeenCalledWith('date', '2025-01-02'); // 14 days ago
    });

    it('properly handles zero values vs missing data', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: 0, // Explicit zero (has data, but no activities)
          cardio_minutes: 0,
          cardio_count: 0,
          cardio_distance_km: '0.0000',
          strength_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      // Should still include the day with zero values
      expect(result[0].date).toBe('2025-01-15');
      expect(result[0].activity_count).toBe(0);
    });

    it('correctly maps cardio_minutes to total_minutes', async () => {
      const today = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const mockData = [
        {
          date: '2025-01-15',
          activity_count: 3,
          cardio_minutes: 60, // Should map to total_minutes
          cardio_count: 3,
          cardio_distance_km: '10.0000',
          strength_count: 0,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockData, error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      const result = await getExerciseSummaryForRecentDays('user-123', 7);

      expect(result[0].total_minutes).toBe(60);
      expect(result[0].total_minutes).toBe(mockData[0].cardio_minutes);
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

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      await getExerciseSummaryForRecentDays('user-123');

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

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      await getExerciseSummaryForRecentDays('user-123', 7);

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

      const { getExerciseSummaryForRecentDays } = await import('../exerciseLogs');
      await getExerciseSummaryForRecentDays('user-123', 7);

      // Should handle year boundary (Dec 27, 2024 to Jan 2, 2025)
      expect(mockGte).toHaveBeenCalledWith('date', '2024-12-27');
      expect(mockLte).toHaveBeenCalledWith('date', '2025-01-02');
    });
  });
});

