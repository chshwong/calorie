import {
  Colors,
  brandBlueColorDark,
  brandBlueColorLight,
  brandVioletColorDark,
  brandVioletColorLight,
} from '@/constants/theme';

export type MacroKey = 'fat' | 'netCarb' | 'fiber' | 'protein';

type ThemeLike = typeof Colors.light | typeof Colors.dark;

function isDarkTheme(theme: ThemeLike): boolean {
  // Preferred: reference equality (call sites use `Colors[scheme]`).
  if (theme === Colors.dark) return true;
  // Fallback: structural check (in case theme is cloned).
  return theme.background === Colors.dark.background;
}

export function getMacroColors(theme: ThemeLike): Record<MacroKey, string> {
  const isDark = isDarkTheme(theme);

  return {
    // Chart slice color for "Carbs"/"Net Carb" uses salmon, which maps to the app `tint`.
    netCarb: theme.tint,
    // Chart slice color for fiber matches the theme brand green token.
    fiber: theme.brandGreen,
    // These are brand tokens defined in theme and swapped by mode.
    protein: isDark ? brandBlueColorDark : brandBlueColorLight,
    fat: isDark ? brandVioletColorDark : brandVioletColorLight,
  };
}


