import { describe, expect, it } from 'vitest';

/**
 * Tests for daily_sum_meds recompute logic
 * 
 * These tests verify the conceptual logic of the recompute_daily_sum_meds
 * SQL function, ensuring correct aggregation and calculation of daily med/supp summaries.
 * 
 * Note: These are unit tests for the logic, not integration tests with the database.
 * The actual SQL function is tested via integration tests or manual verification.
 */

describe('daily_sum_meds - Recompute Logic', () => {
  /**
   * Helper function that mirrors the recompute logic from the SQL function
   * This simulates what recompute_daily_sum_meds does conceptually
   */
  const recomputeDailySummary = (medLogs: Array<{
    type: 'med' | 'supp' | 'other';
  }>) => {
    const med_count = medLogs.filter(log => log.type === 'med' || log.type === 'other').length;
    const supp_count = medLogs.filter(log => log.type === 'supp').length;

    if (med_count === 0 && supp_count === 0) {
      return null; // Delete the summary row
    }

    return {
      med_count,
      supp_count,
    };
  };

  describe('recomputeDailySummary - Counts', () => {
    it('returns null when there are no med logs', () => {
      const result = recomputeDailySummary([]);
      expect(result).toBeNull();
    });

    it('counts meds correctly', () => {
      const logs = [
        { type: 'med' as const },
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(2);
      expect(result?.supp_count).toBe(1);
    });

    it('counts supplements correctly', () => {
      const logs = [
        { type: 'supp' as const },
        { type: 'supp' as const },
        { type: 'supp' as const },
        { type: 'med' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(1);
      expect(result?.supp_count).toBe(3);
    });

    it('treats legacy "other" type as med', () => {
      const logs = [
        { type: 'med' as const },
        { type: 'other' as const },
        { type: 'other' as const },
        { type: 'supp' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(3); // 1 med + 2 other
      expect(result?.supp_count).toBe(1);
    });

    it('handles mixed types correctly', () => {
      const logs = [
        { type: 'med' as const },
        { type: 'med' as const },
        { type: 'other' as const },
        { type: 'supp' as const },
        { type: 'supp' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(3); // 2 med + 1 other
      expect(result?.supp_count).toBe(2);
    });
  });

  describe('recomputeDailySummary - Edge Cases', () => {
    it('handles all meds with no supplements', () => {
      const logs = [
        { type: 'med' as const },
        { type: 'med' as const },
        { type: 'other' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(3);
      expect(result?.supp_count).toBe(0);
    });

    it('handles all supplements with no meds', () => {
      const logs = [
        { type: 'supp' as const },
        { type: 'supp' as const },
        { type: 'supp' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(0);
      expect(result?.supp_count).toBe(3);
    });

    it('returns null when both counts are zero', () => {
      const logs: Array<{ type: 'med' | 'supp' | 'other' }> = [];
      const result = recomputeDailySummary(logs);
      expect(result).toBeNull();
    });

    it('does not return null when only med_count is zero but supp_count > 0', () => {
      const logs = [
        { type: 'supp' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result).not.toBeNull();
      expect(result?.med_count).toBe(0);
      expect(result?.supp_count).toBe(1);
    });

    it('does not return null when only supp_count is zero but med_count > 0', () => {
      const logs = [
        { type: 'med' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result).not.toBeNull();
      expect(result?.med_count).toBe(1);
      expect(result?.supp_count).toBe(0);
    });
  });

  describe('recomputeDailySummary - Data Integrity', () => {
    it('maintains consistency: total items = med_count + supp_count', () => {
      const logs = [
        { type: 'med' as const },
        { type: 'med' as const },
        { type: 'other' as const },
        { type: 'supp' as const },
        { type: 'supp' as const },
      ];
      const result = recomputeDailySummary(logs);
      const totalItems = (result?.med_count ?? 0) + (result?.supp_count ?? 0);
      expect(totalItems).toBe(5);
    });

    it('ensures med_count only includes med and other types', () => {
      const logs = [
        { type: 'med' as const },
        { type: 'other' as const },
        { type: 'supp' as const }, // Should not count
        { type: 'supp' as const }, // Should not count
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(2);
      expect(result?.supp_count).toBe(2);
    });

    it('ensures supp_count only includes supp type', () => {
      const logs = [
        { type: 'supp' as const },
        { type: 'med' as const }, // Should not count
        { type: 'other' as const }, // Should not count
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(2);
      expect(result?.supp_count).toBe(1);
    });
  });

  describe('Trigger Behavior Simulation', () => {
    it('simulates INSERT trigger: new med entry increases med_count', () => {
      // Initial state
      const initialLogs = [
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const initial = recomputeDailySummary(initialLogs);

      // After INSERT
      const afterInsert = [
        { type: 'med' as const },
        { type: 'med' as const }, // New entry
        { type: 'supp' as const },
      ];
      const updated = recomputeDailySummary(afterInsert);

      expect(updated?.med_count).toBe((initial?.med_count ?? 0) + 1);
      expect(updated?.supp_count).toBe(initial?.supp_count);
    });

    it('simulates INSERT trigger: new supp entry increases supp_count', () => {
      // Initial state
      const initialLogs = [
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const initial = recomputeDailySummary(initialLogs);

      // After INSERT
      const afterInsert = [
        { type: 'med' as const },
        { type: 'supp' as const },
        { type: 'supp' as const }, // New entry
      ];
      const updated = recomputeDailySummary(afterInsert);

      expect(updated?.med_count).toBe(initial?.med_count);
      expect(updated?.supp_count).toBe((initial?.supp_count ?? 0) + 1);
    });

    it('simulates UPDATE trigger: changing type from med to supp updates both counts', () => {
      // Old state (before update)
      const oldLogs = [
        { type: 'med' as const },
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const oldSummary = recomputeDailySummary(oldLogs);

      // New state (after changing one med to supp)
      const newLogs = [
        { type: 'med' as const },
        { type: 'supp' as const }, // Changed from med
        { type: 'supp' as const },
      ];
      const newSummary = recomputeDailySummary(newLogs);

      expect(oldSummary?.med_count).toBe(2);
      expect(oldSummary?.supp_count).toBe(1);
      expect(newSummary?.med_count).toBe(1);
      expect(newSummary?.supp_count).toBe(2);
    });

    it('simulates UPDATE trigger: changing date recomputes both old and new dates', () => {
      // Old date logs
      const oldDateLogs = [
        { type: 'med' as const },
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const oldDateSummary = recomputeDailySummary(oldDateLogs);

      // After moving one entry to new date
      const newDateLogs = [
        { type: 'med' as const },
      ];
      const newDateSummary = recomputeDailySummary(newDateLogs);

      // Old date should have one less med
      expect(oldDateSummary?.med_count).toBe(2);
      expect(newDateSummary?.med_count).toBe(1);
    });

    it('simulates DELETE trigger: removing med entry decreases med_count', () => {
      // Initial state
      const initialLogs = [
        { type: 'med' as const },
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const initial = recomputeDailySummary(initialLogs);

      // After DELETE (remove one med)
      const afterDelete = [
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const updated = recomputeDailySummary(afterDelete);

      expect(updated?.med_count).toBe((initial?.med_count ?? 0) - 1);
      expect(updated?.supp_count).toBe(initial?.supp_count);
    });

    it('simulates DELETE trigger: removing supp entry decreases supp_count', () => {
      // Initial state
      const initialLogs = [
        { type: 'med' as const },
        { type: 'supp' as const },
        { type: 'supp' as const },
      ];
      const initial = recomputeDailySummary(initialLogs);

      // After DELETE (remove one supp)
      const afterDelete = [
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const updated = recomputeDailySummary(afterDelete);

      expect(updated?.med_count).toBe(initial?.med_count);
      expect(updated?.supp_count).toBe((initial?.supp_count ?? 0) - 1);
    });

    it('simulates DELETE trigger: deleting last entry should return null', () => {
      // Initial state
      const initialLogs = [
        { type: 'med' as const },
      ];
      const initial = recomputeDailySummary(initialLogs);
      expect(initial).not.toBeNull();

      // After DELETE (remove last entry)
      const afterDelete: typeof initialLogs = [];
      const updated = recomputeDailySummary(afterDelete);

      expect(updated).toBeNull(); // Should delete the summary row
    });

    it('simulates DELETE trigger: deleting all meds but keeping supps should not return null', () => {
      // Initial state
      const initialLogs = [
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const initial = recomputeDailySummary(initialLogs);
      expect(initial).not.toBeNull();

      // After DELETE (remove med, keep supp)
      const afterDelete = [
        { type: 'supp' as const },
      ];
      const updated = recomputeDailySummary(afterDelete);

      expect(updated).not.toBeNull(); // Should keep row since supp_count > 0
      expect(updated?.med_count).toBe(0);
      expect(updated?.supp_count).toBe(1);
    });

    it('simulates DELETE trigger: deleting all supps but keeping meds should not return null', () => {
      // Initial state
      const initialLogs = [
        { type: 'med' as const },
        { type: 'supp' as const },
      ];
      const initial = recomputeDailySummary(initialLogs);
      expect(initial).not.toBeNull();

      // After DELETE (remove supp, keep med)
      const afterDelete = [
        { type: 'med' as const },
      ];
      const updated = recomputeDailySummary(afterDelete);

      expect(updated).not.toBeNull(); // Should keep row since med_count > 0
      expect(updated?.med_count).toBe(1);
      expect(updated?.supp_count).toBe(0);
    });
  });

  describe('Legacy Type Handling', () => {
    it('correctly handles all legacy "other" types as meds', () => {
      const logs = [
        { type: 'other' as const },
        { type: 'other' as const },
        { type: 'other' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(3);
      expect(result?.supp_count).toBe(0);
    });

    it('correctly handles mix of med, other, and supp types', () => {
      const logs = [
        { type: 'med' as const },
        { type: 'other' as const },
        { type: 'other' as const },
        { type: 'supp' as const },
        { type: 'supp' as const },
      ];
      const result = recomputeDailySummary(logs);
      expect(result?.med_count).toBe(3); // 1 med + 2 other
      expect(result?.supp_count).toBe(2);
    });
  });
});

