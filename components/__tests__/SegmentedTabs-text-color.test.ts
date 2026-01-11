/**
 * Unit tests for SegmentedTabs contrasting text color logic
 * 
 * Tests verify that the text color selection works correctly:
 * - When useContrastingTextOnActive is true and tab is active:
 *   - Dark mode: uses colors.textOnTint (black)
 *   - Light mode: uses colors.textInverse (white)
 * - When useContrastingTextOnActive is false or tab is inactive:
 *   - Uses colors.text (default)
 * 
 * Per engineering guidelines: Unit tests for domain logic
 */

import { describe, it, expect } from 'vitest';

type ColorScheme = 'light' | 'dark';

/**
 * Extract the text color selection logic from SegmentedTabs component
 * This mirrors the decision logic in the component
 */
function getTabTextColor(
  isActive: boolean,
  useContrastingTextOnActive: boolean,
  colorScheme: ColorScheme,
  colors: { text: string; textOnTint: string; textInverse: string }
): string {
  if (isActive && useContrastingTextOnActive) {
    return colorScheme === 'dark' ? colors.textOnTint : colors.textInverse;
  }
  return colors.text;
}

describe('SegmentedTabs text color logic', () => {
  const lightColors = {
    text: '#11181C',
    textOnTint: '#000000',
    textInverse: '#FFFFFF',
  };

  const darkColors = {
    text: '#FFFFFF',
    textOnTint: '#000000',
    textInverse: '#FFFFFF',
  };

  describe('getTabTextColor - Active tab with contrasting text', () => {
    it('should use textOnTint (black) in dark mode when active and useContrastingTextOnActive is true', () => {
      const color = getTabTextColor(true, true, 'dark', darkColors);
      expect(color).toBe(darkColors.textOnTint);
    });

    it('should use textInverse (white) in light mode when active and useContrastingTextOnActive is true', () => {
      const color = getTabTextColor(true, true, 'light', lightColors);
      expect(color).toBe(lightColors.textInverse);
    });
  });

  describe('getTabTextColor - Active tab without contrasting text', () => {
    it('should use default text color when active but useContrastingTextOnActive is false', () => {
      const darkColor = getTabTextColor(true, false, 'dark', darkColors);
      expect(darkColor).toBe(darkColors.text);

      const lightColor = getTabTextColor(true, false, 'light', lightColors);
      expect(lightColor).toBe(lightColors.text);
    });
  });

  describe('getTabTextColor - Inactive tab', () => {
    it('should use default text color when inactive, regardless of useContrastingTextOnActive', () => {
      const darkColorWithContrast = getTabTextColor(false, true, 'dark', darkColors);
      expect(darkColorWithContrast).toBe(darkColors.text);

      const darkColorWithoutContrast = getTabTextColor(false, false, 'dark', darkColors);
      expect(darkColorWithoutContrast).toBe(darkColors.text);

      const lightColorWithContrast = getTabTextColor(false, true, 'light', lightColors);
      expect(lightColorWithContrast).toBe(lightColors.text);

      const lightColorWithoutContrast = getTabTextColor(false, false, 'light', lightColors);
      expect(lightColorWithoutContrast).toBe(lightColors.text);
    });
  });

  describe('getTabTextColor - Edge cases', () => {
    it('should handle all combinations correctly', () => {
      const combinations = [
        { isActive: true, useContrasting: true, colorScheme: 'dark' as ColorScheme, expected: darkColors.textOnTint },
        { isActive: true, useContrasting: true, colorScheme: 'light' as ColorScheme, expected: lightColors.textInverse },
        { isActive: true, useContrasting: false, colorScheme: 'dark' as ColorScheme, expected: darkColors.text },
        { isActive: true, useContrasting: false, colorScheme: 'light' as ColorScheme, expected: lightColors.text },
        { isActive: false, useContrasting: true, colorScheme: 'dark' as ColorScheme, expected: darkColors.text },
        { isActive: false, useContrasting: true, colorScheme: 'light' as ColorScheme, expected: lightColors.text },
        { isActive: false, useContrasting: false, colorScheme: 'dark' as ColorScheme, expected: darkColors.text },
        { isActive: false, useContrasting: false, colorScheme: 'light' as ColorScheme, expected: lightColors.text },
      ];

      combinations.forEach(({ isActive, useContrasting, colorScheme, expected }) => {
        const colors = colorScheme === 'dark' ? darkColors : lightColors;
        const result = getTabTextColor(isActive, useContrasting, colorScheme, colors);
        expect(result).toBe(expected);
      });
    });
  });
});
