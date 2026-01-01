import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/burned/dailySumBurned', () => ({
  getDailySumBurnedByDate: vi.fn(),
  insertDailySumBurned: vi.fn(),
}));

vi.mock('@/lib/services/userConfig', () => ({
  getUserConfig: vi.fn(),
}));

vi.mock('@/lib/services/weightLogs', () => ({
  fetchLatestWeighInAtOrBefore: vi.fn(),
}));

vi.mock('@/lib/domain/burned/systemBurnedDefaults', () => ({
  computeSystemBurnedDefaults: vi.fn(),
}));

vi.mock('@/utils/dateKey', async () => {
  const actual = await vi.importActual<typeof import('@/utils/dateKey')>('@/utils/dateKey');
  return {
    ...actual,
    getTodayKey: () => '2026-01-01',
  };
});

describe('getOrCreateDailySumBurned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses weight_log history at local end-of-day when creating a row', async () => {
    const { getOrCreateDailySumBurned } = await import('@/lib/services/burned/getOrCreateDailySumBurned');
    const burned = await import('@/lib/services/burned/dailySumBurned');
    const userConfigSvc = await import('@/lib/services/userConfig');
    const weightLogs = await import('@/lib/services/weightLogs');
    const burnedDefaults = await import('@/lib/domain/burned/systemBurnedDefaults');

    vi.mocked(burned.getDailySumBurnedByDate).mockResolvedValue(null);
    vi.mocked(userConfigSvc.getUserConfig).mockResolvedValue({
      user_id: 'u1',
      gender: 'male',
      date_of_birth: '1990-01-01',
      height_cm: 180,
      weight_lb: 210,
      activity_level: 'moderate',
    } as any);

    vi.mocked(weightLogs.fetchLatestWeighInAtOrBefore).mockResolvedValue({
      weighed_at: '2025-12-15T10:00:00.000Z',
      weight_lb: 180,
    });

    vi.mocked(burnedDefaults.computeSystemBurnedDefaults).mockReturnValue({
      system_bmr_cal: 1000,
      system_active_cal: 500,
      system_tdee_cal: 1500,
    });

    vi.mocked(burned.insertDailySumBurned).mockImplementation(async (row: any) => ({
      id: 'b1',
      updated_at: new Date().toISOString(),
      ...row,
    }));

    const res = await getOrCreateDailySumBurned('u1', '2025-12-15');

    expect(res?.entry_date).toBe('2025-12-15');

    // Ensure we used local end-of-day ISO for the lookup.
    const expectedEndOfDayISO = new Date(2025, 11, 15, 23, 59, 59, 999).toISOString();
    expect(weightLogs.fetchLatestWeighInAtOrBefore).toHaveBeenCalledWith('u1', expectedEndOfDayISO);

    // Ensure compute used the weight_log weight, not profile weight.
    expect(burnedDefaults.computeSystemBurnedDefaults).toHaveBeenCalledWith(
      expect.objectContaining({ weight_lb: 180 })
    );

    // Insert payload should mirror system_* into authoritative values on creation.
    expect(burned.insertDailySumBurned).toHaveBeenCalledWith(
      expect.objectContaining({
        entry_date: '2025-12-15',
        bmr_cal: 1000,
        active_cal: 500,
        tdee_cal: 1500,
        system_bmr_cal: 1000,
        system_active_cal: 500,
        system_tdee_cal: 1500,
      })
    );
  });
});


