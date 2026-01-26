import { describe, expect, it } from 'vitest';
import { buildWeightLogUpdatePayload } from '@/lib/services/weightLogProvenance';

describe('weightLogs provenance on edit', () => {
  it('does not clear Fitbit provenance on save-with-no-changes', () => {
    const plan = buildWeightLogUpdatePayload({
      oldRow: {
        source: 'fitbit',
        external_id: 'fitbit-log-123',
        weighed_at: '2026-01-01T10:00:00.000Z',
        weight_lb: 150.04, // rounds to 150.0 for UI compare
        body_fat_percent: 18.04, // rounds to 18.0 for UI compare
      },
      weighedAtISO: '2026-01-01T10:00:00.000Z',
      weightLb: 150.01, // still 150.0 at 1 decimal
      bodyFatPercent: 18.01, // still 18.0 at 1 decimal
      note: null,
    });

    expect(plan.shouldUpdateRow).toBe(false);
    expect(plan.userChanged.userChanged).toBe(false);
    expect(plan.payload).not.toHaveProperty('source');
    expect(plan.payload).not.toHaveProperty('external_id');
  });

  it('clears Fitbit provenance when user changes weight', () => {
    const plan = buildWeightLogUpdatePayload({
      oldRow: {
        source: 'fitbit',
        external_id: 'fitbit-log-123',
        weighed_at: '2026-01-01T10:00:00.000Z',
        weight_lb: 150.0,
        body_fat_percent: 18.0,
      },
      weighedAtISO: '2026-01-01T10:00:00.000Z',
      weightLb: 150.2,
      bodyFatPercent: 18.0,
      note: null,
    });

    expect(plan.shouldUpdateRow).toBe(true);
    expect(plan.userChanged.weightChanged).toBe(true);
    expect(plan.payload).toMatchObject({ source: 'manual', external_id: null });
  });

  it('clears Fitbit provenance when user changes body fat', () => {
    const plan = buildWeightLogUpdatePayload({
      oldRow: {
        source: 'fitbit',
        external_id: 'fitbit-log-123',
        weighed_at: '2026-01-01T10:00:00.000Z',
        weight_lb: 150.0,
        body_fat_percent: null,
      },
      weighedAtISO: '2026-01-01T10:00:00.000Z',
      weightLb: 150.0,
      bodyFatPercent: 18.2,
      note: null,
    });

    expect(plan.shouldUpdateRow).toBe(true);
    expect(plan.userChanged.bodyFatChanged).toBe(true);
    expect(plan.payload).toMatchObject({ source: 'manual', external_id: null });
  });

  it('clears Fitbit provenance when user changes time', () => {
    const plan = buildWeightLogUpdatePayload({
      oldRow: {
        source: 'fitbit',
        external_id: 'fitbit-log-123',
        weighed_at: '2026-01-01T10:00:00.000Z',
        weight_lb: 150.0,
        body_fat_percent: 18.0,
      },
      weighedAtISO: '2026-01-01T10:01:00.000Z',
      weightLb: 150.0,
      bodyFatPercent: 18.0,
      note: null,
    });

    expect(plan.shouldUpdateRow).toBe(true);
    expect(plan.userChanged.timeChanged).toBe(true);
    expect(plan.payload).toMatchObject({ source: 'manual', external_id: null });
  });

  it('does not touch provenance when source is not fitbit', () => {
    const plan = buildWeightLogUpdatePayload({
      oldRow: {
        source: 'manual',
        external_id: null,
        weighed_at: '2026-01-01T10:00:00.000Z',
        weight_lb: 150.0,
        body_fat_percent: 18.0,
      },
      weighedAtISO: '2026-01-01T10:00:00.000Z',
      weightLb: 150.2,
      bodyFatPercent: 18.0,
      note: null,
    });

    expect(plan.shouldUpdateRow).toBe(true);
    expect(plan.userChanged.weightChanged).toBe(true);
    expect(plan.payload).not.toHaveProperty('source');
    expect(plan.payload).not.toHaveProperty('external_id');
  });
});

