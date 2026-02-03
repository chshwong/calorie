import { describe, expect, it } from 'vitest';

import { deriveWearableSplit } from '@/lib/services/burned/deriveWearableSplit';
import { toDateKey } from '@/utils/dateKey';

describe('deriveWearableSplit', () => {
  it('clamps when wearable total < derived BMR so far (today)', () => {
    const now = new Date(2026, 0, 1, 18, 0, 0, 0); // 18:00 local => 75% of day
    const entryDateKey = toDateKey(now);

    const res = deriveWearableSplit({
      entryDateKey,
      now,
      systemBmrFullDay: 1800,
      wearableTdeeTotal: 900,
    });

    expect(res.progress).toBeCloseTo(0.75, 6);
    expect(res.bmr).toBe(900);
    expect(res.active).toBe(0);
    expect(res.tdee).toBe(900);
  });

  it('clamps when wearable total < full-day system BMR (past day)', () => {
    const now = new Date(2026, 0, 2, 12, 0, 0, 0); // not entry day
    const entryDateKey = '2026-01-01';

    const res = deriveWearableSplit({
      entryDateKey,
      now,
      systemBmrFullDay: 1600,
      wearableTdeeTotal: 1200,
    });

    expect(res.progress).toBe(1);
    expect(res.bmr).toBe(1200);
    expect(res.active).toBe(0);
    expect(res.tdee).toBe(1200);
  });
});

