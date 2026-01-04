import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatWeeklyLossProjection } from './weeklyLossProjection';

describe('formatWeeklyLossProjection', () => {
  const mockT = vi.fn((key: string, options?: { [key: string]: string | number }) => {
    if (key === 'home.done_for_today.weekly_loss_projection' && options) {
      return options.defaultValue as string;
    }
    return '';
  });

  beforeEach(() => {
    mockT.mockClear();
  });

  describe('lb unit calculations', () => {
    it('should calculate 2.0 lb per week for 1021 calorie deficit', () => {
      const result = formatWeeklyLossProjection(1021, 'lb', mockT);
      // 1021 * 7 / 3600 = 7147 / 3600 = 1.985... → 2.0
      expect(result).toContain('2.0');
      expect(result).toContain('lb');
      expect(mockT).toHaveBeenCalledWith('home.done_for_today.weekly_loss_projection', {
        amount: '2.0',
        unit: 'lb',
        defaultValue: expect.stringContaining('2.0 lb'),
      });
    });

    it('should calculate 1.0 lb per week for 514 calorie deficit', () => {
      const result = formatWeeklyLossProjection(514, 'lb', mockT);
      // 514 * 7 / 3600 = 3598 / 3600 = 0.999... → 1.0
      expect(result).toContain('1.0');
      expect(result).toContain('lb');
    });

    it('should calculate 0.5 lb per week for 257 calorie deficit', () => {
      const result = formatWeeklyLossProjection(257, 'lb', mockT);
      // 257 * 7 / 3600 = 1799 / 3600 = 0.499... → 0.5
      expect(result).toContain('0.5');
      expect(result).toContain('lb');
    });

    it('should enforce minimum of 0.1 lb per week', () => {
      const result = formatWeeklyLossProjection(50, 'lb', mockT);
      // 50 * 7 / 3600 = 350 / 3600 = 0.097... → 0.1 (minimum)
      expect(result).toContain('0.1');
      expect(result).toContain('lb');
    });

    it('should round to 1 decimal place', () => {
      const result = formatWeeklyLossProjection(450, 'lb', mockT);
      // 450 * 7 / 3600 = 3150 / 3600 = 0.875 → 0.9
      expect(result).toContain('0.9');
      expect(result).toContain('lb');
    });
  });

  describe('kg unit calculations', () => {
    it('should convert 2.0 lb to approximately 0.9 kg per week for 1021 calorie deficit', () => {
      const result = formatWeeklyLossProjection(1021, 'kg', mockT);
      // 1021 * 7 / 3600 = 1.985 lb → 1.985 / 2.2046226218 = 0.900... → 0.9 kg
      expect(result).toContain('0.9');
      expect(result).toContain('kg');
      expect(mockT).toHaveBeenCalledWith('home.done_for_today.weekly_loss_projection', {
        amount: '0.9',
        unit: 'kg',
        defaultValue: expect.stringContaining('0.9 kg'),
      });
    });

    it('should convert 1.0 lb to approximately 0.5 kg per week', () => {
      const result = formatWeeklyLossProjection(514, 'kg', mockT);
      // 514 * 7 / 3600 = 0.999 lb → 0.999 / 2.2046226218 = 0.453... → 0.5 kg
      expect(result).toContain('0.5');
      expect(result).toContain('kg');
    });

    it('should enforce minimum of 0.1 kg per week', () => {
      const result = formatWeeklyLossProjection(50, 'kg', mockT);
      // 50 * 7 / 3600 = 0.097 lb → 0.097 / 2.2046226218 = 0.044... → 0.1 (minimum)
      expect(result).toContain('0.1');
      expect(result).toContain('kg');
    });
  });

  describe('translation function integration', () => {
    it('should call translation function with correct parameters', () => {
      formatWeeklyLossProjection(1000, 'lb', mockT);
      
      expect(mockT).toHaveBeenCalledTimes(1);
      expect(mockT).toHaveBeenCalledWith(
        'home.done_for_today.weekly_loss_projection',
        expect.objectContaining({
          amount: expect.any(String),
          unit: 'lb',
          defaultValue: expect.stringContaining('lb per week'),
        })
      );
    });

    it('should use translation function for kg unit', () => {
      formatWeeklyLossProjection(1000, 'kg', mockT);
      
      expect(mockT).toHaveBeenCalledWith(
        'home.done_for_today.weekly_loss_projection',
        expect.objectContaining({
          unit: 'kg',
          defaultValue: expect.stringContaining('kg per week'),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very large deficits', () => {
      const result = formatWeeklyLossProjection(5000, 'lb', mockT);
      // 5000 * 7 / 3600 = 35000 / 3600 = 9.722... → 9.7
      expect(result).toContain('9.7');
      expect(result).toContain('lb');
    });

    it('should handle very small deficits (minimum threshold)', () => {
      const result = formatWeeklyLossProjection(51, 'lb', mockT);
      // Should round up to 0.1 minimum
      expect(result).toContain('0.1');
    });
  });
});

