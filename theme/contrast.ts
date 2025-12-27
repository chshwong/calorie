// theme/contrast.ts
// Utilities to ensure WCAG contrast for theme-derived colors (no dependencies).

type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const to2 = (x: number) => x.toString(16).padStart(2, '0');
  return `#${to2(clamp255(r))}${to2(clamp255(g))}${to2(clamp255(b))}`;
}

function clamp255(x: number) {
  return Math.max(0, Math.min(255, Math.round(x)));
}

function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const L1 = relativeLuminance(fgHex);
  const L2 = relativeLuminance(bgHex);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function blend(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

/**
 * Ensures fg meets min contrast vs bg.
 * In light mode, we darken fg (blend toward black).
 * In dark mode, we lighten fg (blend toward white).
 */
export function ensureContrast(
  fgHex: string,
  bgHex: string,
  mode: 'light' | 'dark',
  minRatio = 4.5
): string {
  if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;

  const target = mode === 'light' ? '#000000' : '#FFFFFF';
  // binary search blend amount
  let lo = 0;
  let hi = 1;
  let best = fgHex;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const cand = blend(fgHex, target, mid);
    const cr = contrastRatio(cand, bgHex);
    if (cr >= minRatio) {
      best = cand;
      hi = mid; // minimal adjustment
    } else {
      lo = mid;
    }
  }
  return best;
}


