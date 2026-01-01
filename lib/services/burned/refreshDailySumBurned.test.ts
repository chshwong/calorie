import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/dateKey', async () => {
  const actual = await vi.importActual<typeof import('@/utils/dateKey')>('@/utils/dateKey');
  return {
    ...actual,
    getTodayKey: () => '2026-01-01',
  };
});

vi.mock('@/constants/constraints', async () => {
  const actual = await vi.importActual<typeof import('@/constants/constraints')>('@/constants/constraints');
  return {
    ...actual,
    BURNED: {
      ...actual.BURNED,
      REFRESH_LOOKBACK_DAYS: 21,
    },
  };
});

vi.mock('@/lib/services/userConfig', () => ({
  getUserConfig: vi.fn(),
}));

vi.mock('@/lib/services/weightLogs', () => ({
  fetchLatestWeighInAtOrBefore: vi.fn(),
  fetchNextWeighInAfter: vi.fn(),
  fetchWeightLogsRange: vi.fn(),
}));

vi.mock('@/lib/domain/burned/systemBurnedDefaults', () => ({
  computeSystemBurnedDefaults: vi.fn(),
}));

vi.mock('@/lib/services/burned/dailySumBurned', () => ({
  getDailySumBurnedForRange: vi.fn(),
  getDailySumBurnedByDate: vi.fn(),
  updateDailySumBurnedById: vi.fn(),
}));

describe('refreshDailySumBurned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates system_* for affected existing rows, and only updates authoritative fields when not overridden', async () => {
    const svc = await import('@/lib/services/burned/refreshDailySumBurned');
    const userConfigSvc = await import('@/lib/services/userConfig');
    const weightLogs = await import('@/lib/services/weightLogs');
    const burned = await import('@/lib/services/burned/dailySumBurned');
    const defaults = await import('@/lib/domain/burned/systemBurnedDefaults');

    vi.mocked(userConfigSvc.getUserConfig).mockResolvedValue({
      user_id: 'u1',
      gender: 'male',
      date_of_birth: '1990-01-01',
      height_cm: 180,
      weight_lb: 210,
      activity_level: 'moderate',
    } as any);

    // Bound the affected window by the next weigh-in after the changed timestamp.
    vi.mocked(weightLogs.fetchNextWeighInAfter).mockResolvedValue('2025-12-14T10:00:00.000Z');

    // Window seed: latest before start-of-window.
    vi.mocked(weightLogs.fetchLatestWeighInAtOrBefore).mockResolvedValue({
      weighed_at: '2025-12-10T10:00:00.000Z',
      weight_lb: 200,
    } as any);

    // Weight logs inside window: change weight on 12-12, carries forward to 12-13.
    vi.mocked(weightLogs.fetchWeightLogsRange).mockResolvedValue([
      {
        id: 'w1',
        user_id: 'u1',
        weighed_at: '2025-12-12T10:00:00.000Z',
        weight_lb: 180,
        body_fat_percent: null,
        note: null,
      },
    ] as any);

    // Provide two existing burned rows in the affected range 2025-12-12..2025-12-13
    vi.mocked(burned.getDailySumBurnedForRange).mockResolvedValue([
      {
        id: 'b1',
        user_id: 'u1',
        entry_date: '2025-12-12',
        updated_at: 'x',
        bmr_cal: 1000,
        active_cal: 500,
        tdee_cal: 1500,
        system_bmr_cal: 900,
        system_active_cal: 450,
        system_tdee_cal: 1350,
        bmr_overridden: false,
        active_overridden: false,
        tdee_overridden: false,
        is_overridden: false,
        source: 'system',
        vendor_external_id: null,
        vendor_payload_hash: null,
        synced_at: null,
      },
      {
        id: 'b2',
        user_id: 'u1',
        entry_date: '2025-12-13',
        updated_at: 'x',
        bmr_cal: 1200,
        active_cal: 800,
        tdee_cal: 2000,
        system_bmr_cal: 1100,
        system_active_cal: 700,
        system_tdee_cal: 1800,
        bmr_overridden: true,
        active_overridden: true,
        tdee_overridden: true,
        is_overridden: true,
        source: 'watch',
        vendor_external_id: null,
        vendor_payload_hash: null,
        synced_at: null,
      },
    ] as any);

    // Deterministic defaults based on weight_lb so assertions are simple.
    vi.mocked(defaults.computeSystemBurnedDefaults).mockImplementation((input: any) => {
      const w = Number(input.weight_lb ?? 0);
      const bmr = w; // 180
      const active = 10;
      return { system_bmr_cal: bmr, system_active_cal: active, system_tdee_cal: bmr + active };
    });

    vi.mocked(burned.updateDailySumBurnedById).mockResolvedValue({} as any);

    const res = await svc.refreshBurnedFromWeightChange({
      userId: 'u1',
      changedAtISO: '2025-12-11T12:00:00.000Z',
    });

    expect(res).toEqual({ updated: 2, startDate: '2025-12-12', endDate: '2025-12-13' });

    // b1 (non-overridden): should update system_* and authoritative fields + flags.
    expect(burned.updateDailySumBurnedById).toHaveBeenCalledWith({
      userId: 'u1',
      id: 'b1',
      updates: expect.objectContaining({
        system_bmr_cal: 180,
        system_active_cal: 10,
        system_tdee_cal: 190,
        bmr_cal: 180,
        active_cal: 10,
        tdee_cal: 190,
        is_overridden: false,
      }),
    });

    // b2 (overridden): should update only system_* (no bmr_cal/active_cal/tdee_cal changes).
    const calls = vi.mocked(burned.updateDailySumBurnedById).mock.calls;
    const b2Call = calls.find((c) => c[0]?.id === 'b2');
    expect(b2Call).toBeTruthy();
    const b2Updates = (b2Call as any)[0].updates as Record<string, unknown>;
    expect(b2Updates.system_bmr_cal).toBe(180);
    expect(b2Updates.system_active_cal).toBe(10);
    expect(b2Updates.system_tdee_cal).toBe(190);
    expect('bmr_cal' in b2Updates).toBe(false);
    expect('active_cal' in b2Updates).toBe(false);
    expect('tdee_cal' in b2Updates).toBe(false);
  });

  it('refreshBurnedTodayFromProfileChange is a no-op if no today row exists', async () => {
    const svc = await import('@/lib/services/burned/refreshDailySumBurned');
    const burned = await import('@/lib/services/burned/dailySumBurned');

    vi.mocked(burned.getDailySumBurnedByDate).mockResolvedValue(null);

    const res = await svc.refreshBurnedTodayFromProfileChange('u1');
    expect(res).toBeNull();
  });
});


