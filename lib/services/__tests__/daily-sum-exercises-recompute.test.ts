import { describe, expect, it } from 'vitest';

/**
 * Tests for daily_sum_exercises recompute logic
 * 
 * These tests verify the conceptual logic of the recompute_daily_sum_exercises
 * SQL function, ensuring correct aggregation and calculation of daily exercise summaries.
 * 
 * Note: These are unit tests for the logic, not integration tests with the database.
 * The actual SQL function is tested via integration tests or manual verification.
 */

describe('daily_sum_exercises - Recompute Logic', () => {
  /**
   * Helper function that mirrors the recompute logic from the SQL function
   * This simulates what recompute_daily_sum_exercises does conceptually
   */
  const recomputeDailySummary = (exerciseLogs: Array<{
    category: 'cardio_mind_body' | 'strength';
    minutes: number | null;
    distance_km: number | null;
  }>) => {
    const activity_count = exerciseLogs.length;

    if (activity_count === 0) {
      return null; // Delete the summary row
    }

    let cardio_count = 0;
    let cardio_minutes = 0;
    let cardio_distance_km = 0;
    let strength_count = 0;

    exerciseLogs.forEach((log) => {
      if (log.category === 'cardio_mind_body') {
        cardio_count += 1;
        cardio_minutes += log.minutes ?? 0;
        cardio_distance_km += log.distance_km ?? 0;
      } else if (log.category === 'strength') {
        strength_count += 1;
      }
    });

    // Round distance to 4 decimal places (matching SQL function)
    cardio_distance_km = Math.round(cardio_distance_km * 10000) / 10000;

    return {
      activity_count,
      cardio_count,
      cardio_minutes,
      cardio_distance_km,
      strength_count,
    };
  };

  describe('recomputeDailySummary - Activity Counts', () => {
    it('returns null when there are no exercise logs', () => {
      const result = recomputeDailySummary([]);
      expect(result).toBeNull();
    });

    it('counts total activities correctly', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.activity_count).toBe(3);
    });

    it('counts cardio activities correctly', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
        { category: 'strength' as const, minutes: null, distance_km: null },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_count).toBe(2);
    });

    it('counts strength activities correctly', () => {
      const logs = [
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.strength_count).toBe(2);
    });

    it('handles mixed categories correctly', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'strength' as const, minutes: null, distance_km: null },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.activity_count).toBe(5);
      expect(result?.cardio_count).toBe(2);
      expect(result?.strength_count).toBe(3);
    });
  });

  describe('recomputeDailySummary - Cardio Minutes', () => {
    it('sums cardio minutes correctly', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
        { category: 'cardio_mind_body' as const, minutes: 15, distance_km: 2 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_minutes).toBe(65);
    });

    it('treats null minutes as 0 for cardio', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: null, distance_km: 3 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 2 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_minutes).toBe(50); // 30 + 0 + 20
    });

    it('ignores strength minutes (should not affect cardio_minutes)', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'strength' as const, minutes: 45, distance_km: null }, // Should be ignored
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_minutes).toBe(30);
    });
  });

  describe('recomputeDailySummary - Cardio Distance', () => {
    it('sums cardio distance correctly', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5.25 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3.75 },
        { category: 'cardio_mind_body' as const, minutes: 15, distance_km: 2.5 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_distance_km).toBe(11.5);
    });

    it('treats null distance as 0 for cardio', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5.25 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: null },
        { category: 'cardio_mind_body' as const, minutes: 15, distance_km: 2.5 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_distance_km).toBe(7.75); // 5.25 + 0 + 2.5
    });

    it('rounds distance to 4 decimal places', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5.123456 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3.789012 },
      ];
      const result = recomputeDailySummary(logs);
      // 5.123456 + 3.789012 = 8.912468, rounded to 4 decimals = 8.9125
      expect(result?.cardio_distance_km).toBe(8.9125);
    });

    it('handles precise rounding correctly', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 1.1111 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 2.2222 },
        { category: 'cardio_mind_body' as const, minutes: 15, distance_km: 3.3333 },
      ];
      const result = recomputeDailySummary(logs);
      // 1.1111 + 2.2222 + 3.3333 = 6.6666, should remain 6.6666
      expect(result?.cardio_distance_km).toBe(6.6666);
    });

    it('ignores strength distance (should not affect cardio_distance_km)', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5.25 },
        { category: 'strength' as const, minutes: null, distance_km: 10.5 }, // Should be ignored
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_distance_km).toBe(5.25);
    });
  });

  describe('recomputeDailySummary - Edge Cases', () => {
    it('handles all cardio activities with no strength', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.activity_count).toBe(2);
      expect(result?.cardio_count).toBe(2);
      expect(result?.strength_count).toBe(0);
    });

    it('handles all strength activities with no cardio', () => {
      const logs = [
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'strength' as const, minutes: null, distance_km: null },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.activity_count).toBe(3);
      expect(result?.cardio_count).toBe(0);
      expect(result?.cardio_minutes).toBe(0);
      expect(result?.cardio_distance_km).toBe(0);
      expect(result?.strength_count).toBe(3);
    });

    it('handles cardio activities with no minutes or distance', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: null, distance_km: null },
        { category: 'cardio_mind_body' as const, minutes: null, distance_km: null },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_count).toBe(2);
      expect(result?.cardio_minutes).toBe(0);
      expect(result?.cardio_distance_km).toBe(0);
    });

    it('handles very large numbers correctly', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 999, distance_km: 999.9999 },
        { category: 'cardio_mind_body' as const, minutes: 888, distance_km: 888.8888 },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_minutes).toBe(1887);
      // 999.9999 + 888.8888 = 1888.8887, rounded to 4 decimals = 1888.8887
      expect(result?.cardio_distance_km).toBe(1888.8887);
    });

    it('handles fractional minutes (though they should be integers)', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30.5, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20.7, distance_km: 3 },
      ];
      const result = recomputeDailySummary(logs);
      // Should still sum them (SQL doesn't enforce integer-only for minutes in this logic)
      expect(result?.cardio_minutes).toBe(51.2);
    });
  });

  describe('recomputeDailySummary - Data Integrity', () => {
    it('maintains consistency: activity_count = cardio_count + strength_count', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
        { category: 'strength' as const, minutes: null, distance_km: null },
        { category: 'strength' as const, minutes: null, distance_km: null },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.activity_count).toBe(
        (result?.cardio_count ?? 0) + (result?.strength_count ?? 0)
      );
    });

    it('ensures cardio_minutes only includes cardio activities', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'strength' as const, minutes: 60, distance_km: null }, // Should not count
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_minutes).toBe(30);
      expect(result?.strength_count).toBe(1);
    });

    it('ensures cardio_distance_km only includes cardio activities', () => {
      const logs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 10.5 },
        { category: 'strength' as const, minutes: null, distance_km: 5.25 }, // Should not count
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.cardio_distance_km).toBe(10.5);
      expect(result?.strength_count).toBe(1);
    });
  });

  describe('Trigger Behavior Simulation', () => {
    it('simulates INSERT trigger: new cardio entry increases counts', () => {
      // Initial state
      const initialLogs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
      ];
      const initial = recomputeDailySummary(initialLogs);

      // After INSERT
      const afterInsert = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
      ];
      const updated = recomputeDailySummary(afterInsert);

      expect(updated?.cardio_count).toBe((initial?.cardio_count ?? 0) + 1);
      expect(updated?.cardio_minutes).toBe((initial?.cardio_minutes ?? 0) + 20);
      expect(updated?.cardio_distance_km).toBe((initial?.cardio_distance_km ?? 0) + 3);
    });

    it('simulates UPDATE trigger: changing date recomputes both old and new dates', () => {
      // Old date logs
      const oldDateLogs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
      ];
      const oldDateSummary = recomputeDailySummary(oldDateLogs);

      // After moving one entry to new date
      const newDateLogs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
      ];
      const newDateSummary = recomputeDailySummary(newDateLogs);

      // Old date should have one less entry
      expect(oldDateSummary?.cardio_count).toBe(2);
      expect(newDateSummary?.cardio_count).toBe(1);

      // Distance should be split
      expect(oldDateSummary?.cardio_distance_km).toBe(8);
      expect(newDateSummary?.cardio_distance_km).toBe(5);
    });

    it('simulates DELETE trigger: removing entry decreases counts', () => {
      // Initial state
      const initialLogs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'cardio_mind_body' as const, minutes: 20, distance_km: 3 },
        { category: 'strength' as const, minutes: null, distance_km: null },
      ];
      const initial = recomputeDailySummary(initialLogs);

      // After DELETE (remove one cardio entry)
      const afterDelete = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
        { category: 'strength' as const, minutes: null, distance_km: null },
      ];
      const updated = recomputeDailySummary(afterDelete);

      expect(updated?.cardio_count).toBe((initial?.cardio_count ?? 0) - 1);
      expect(updated?.cardio_minutes).toBe((initial?.cardio_minutes ?? 0) - 20);
      expect(updated?.cardio_distance_km).toBe((initial?.cardio_distance_km ?? 0) - 3);
    });

    it('simulates DELETE trigger: deleting last entry should return null', () => {
      // Initial state
      const initialLogs = [
        { category: 'cardio_mind_body' as const, minutes: 30, distance_km: 5 },
      ];
      const initial = recomputeDailySummary(initialLogs);
      expect(initial).not.toBeNull();

      // After DELETE (remove last entry)
      const afterDelete: typeof initialLogs = [];
      const updated = recomputeDailySummary(afterDelete);

      expect(updated).toBeNull(); // Should delete the summary row
    });
  });
});

