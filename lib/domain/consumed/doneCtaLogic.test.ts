import { describe, expect, it } from 'vitest';
import { FOOD_LOG } from '@/constants/constraints';
import {
  getGraceWindowMinKey,
  isWithinGraceWindow,
  getUnknownLabelKind,
  getCompletionTier,
  shouldShowFastedOptionInInitialConfirm,
  shouldRequireFastedSecondaryConfirm,
} from '@/lib/domain/consumed/doneCtaLogic';

describe('doneCtaLogic', () => {
  it('computes min key for grace window (inclusive)', () => {
    expect(getGraceWindowMinKey('2026-01-07', 7)).toBe('2026-01-01');
    expect(getGraceWindowMinKey('2026-01-07', 1)).toBe('2026-01-07');
  });

  it('checks if selectedDateKey is within grace window', () => {
    const todayKey = '2026-01-07';
    expect(isWithinGraceWindow({ selectedDateKey: '2026-01-07', todayKey, graceDays: 7 })).toBe(true);
    expect(isWithinGraceWindow({ selectedDateKey: '2026-01-01', todayKey, graceDays: 7 })).toBe(true);
    expect(isWithinGraceWindow({ selectedDateKey: '2025-12-31', todayKey, graceDays: 7 })).toBe(false);
    expect(isWithinGraceWindow({ selectedDateKey: '2026-01-08', todayKey, graceDays: 7 })).toBe(false);
  });

  it('selects dynamic label kind for unknown status', () => {
    expect(
      getUnknownLabelKind({ selectedDateKey: '2026-01-07', todayKey: '2026-01-07', yesterdayKey: '2026-01-06' })
    ).toBe('today');
    expect(
      getUnknownLabelKind({ selectedDateKey: '2026-01-06', todayKey: '2026-01-07', yesterdayKey: '2026-01-06' })
    ).toBe('yesterday');
    expect(
      getUnknownLabelKind({ selectedDateKey: '2026-01-05', todayKey: '2026-01-07', yesterdayKey: '2026-01-06' })
    ).toBe('day');
  });

  it('categorizes calorie tiers', () => {
    expect(getCompletionTier(0)).toBe('zero');
    expect(getCompletionTier(1)).toBe('low');
    expect(getCompletionTier(FOOD_LOG.DONE_MODAL.LOW_CAL_MAX_INCLUSIVE)).toBe('low');
    expect(getCompletionTier(FOOD_LOG.DONE_MODAL.OK_CAL_MIN_INCLUSIVE)).toBe('ok');
  });

  it('applies fasted option visibility + secondary confirm rules', () => {
    expect(shouldShowFastedOptionInInitialConfirm(0)).toBe(true);
    expect(shouldShowFastedOptionInInitialConfirm(200)).toBe(true);
    expect(shouldShowFastedOptionInInitialConfirm(FOOD_LOG.DONE_MODAL.FASTED_PRIMARY_MAX_CAL_EXCLUSIVE - 1)).toBe(true);
    expect(shouldShowFastedOptionInInitialConfirm(FOOD_LOG.DONE_MODAL.FASTED_PRIMARY_MAX_CAL_EXCLUSIVE)).toBe(false);

    expect(shouldRequireFastedSecondaryConfirm(FOOD_LOG.DONE_MODAL.OK_CAL_MIN_INCLUSIVE - 1)).toBe(false);
    expect(shouldRequireFastedSecondaryConfirm(FOOD_LOG.DONE_MODAL.OK_CAL_MIN_INCLUSIVE)).toBe(true);
    expect(shouldRequireFastedSecondaryConfirm(FOOD_LOG.DONE_MODAL.FASTED_PRIMARY_MAX_CAL_EXCLUSIVE - 1)).toBe(true);
    expect(shouldRequireFastedSecondaryConfirm(FOOD_LOG.DONE_MODAL.FASTED_PRIMARY_MAX_CAL_EXCLUSIVE)).toBe(false);
  });
});


