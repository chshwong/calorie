import { BigCircleMenuTokens } from '@/constants/theme';

export type BigCircleMenuThemeKey = 'light' | 'dark';

/**
 * Centralized Big Circle Menu (Quick Add) color access.
 *
 * Implementation note (spec): components should rely on existing theme selection
 * and avoid mixing light-mode colors when theme is dark.
 */
export function getBigCircleMenuColors(theme: BigCircleMenuThemeKey) {
  return {
    sheetBg: BigCircleMenuTokens.sheet.backgroundColor[theme],
    backdrop: BigCircleMenuTokens.backdrop.color[theme],
    handle: BigCircleMenuTokens.handle.color[theme],
    tileBg: BigCircleMenuTokens.tile.backgroundColor[theme],
    tileBorder: BigCircleMenuTokens.tile.borderColor[theme],
    label: BigCircleMenuTokens.tile.label.color[theme],
    chipBg: BigCircleMenuTokens.tile.iconChip.backgroundColor[theme],
    ripple: BigCircleMenuTokens.tile.rippleColor[theme],
  } as const;
}


