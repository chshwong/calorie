/**
 * Centralized Theme System for the Calorie Tracker App
 * 
 * This file contains all design tokens used throughout the app:
 * - Colors (light/dark mode)
 * - Spacing scale
 * - Border radii
 * - Typography (font sizes, weights, line heights)
 * - Shadows
 * - Semantic colors (success, error, warning, info)
 * 
 * IMPORTANT: Always import values from this file instead of hardcoding.
 */

import { Platform } from 'react-native';

// ============================================================================
// COLORS
// ============================================================================




//brand colors
export const salmonColorDark ='#E9876F';
export const salmonColorLight ='#B8553F';
export const brandGreenColorDark ='#DCF048';
export const brandGreencolorLight ='#526C19';


// Standardized grey color used across the entire app
// This is the primary grey for secondary text, icons, and UI elements
// Light mode: Dark grey close to primary text for high contrast (similar to Tailwind gray-700)
// Dark mode: Mid-light grey for good contrast on dark backgrounds
export const StandardGrey = {
  light: '#404040',  // Dark grey for light mode - almost as dark as body text for high contrast
  dark: '#9CA3AF',   // Mid-light grey for dark mode - maintains good contrast
} as const;

// Semantic colors (same for both themes)
export const SemanticColors = {
  success: '#10B981',
  successLight: '#10B98120',
  error: '#EF4444',
  errorLight: '#EF444420',
  warning: '#F59E0B',
  warningLight: '#F59E0B20',
  info: '#3B82F6',
  infoLight: '#3B82F620',
};

// Tab/category colors
export const CategoryColors = {
  frequent: '#3B82F6',
  recent: '#10B981',
  custom: '#8B5CF6',
  bundle: '#F59E0B',
  manual: '#6B7280',
  favorite: '#FBBF24',
};

// Dashboard accent colors (MyFitnessPal-style bright colors)
export const DashboardAccents = {
  food: salmonColorLight,      // Dark Salmon for calories
  exercise: '#F59E0B',  // Orange for exercise
  meds: '#10B981',      // Teal/green for meds
  streak: '#A855F7',    // Purple for streaks
  protein: '#F59E0B',   // Orange for protein
  carbs: '#10B981',     // Green for carbs
  fat: '#8B5CF6',       // Purple for fat
} as const;

// Module theme tokens for visual differentiation
// Used to create subtle but clear identity for each module (Exercise, Meds, etc.)
export type ModuleType = 'exercise' | 'meds' | 'food' | 'water';

export const ModuleThemes = {
  exercise: {
    accent: DashboardAccents.exercise,      // #F59E0B - Orange
    tint: DashboardAccents.exercise + '08', // ~3% opacity for subtle backgrounds
    iconColor: DashboardAccents.exercise,
  },
  meds: {
    accent: DashboardAccents.meds,          // #10B981 - Teal/green
    tint: DashboardAccents.meds + '08',     // ~3% opacity for subtle backgrounds
    iconColor: DashboardAccents.meds,
  },
  food: {
    accent: DashboardAccents.food,           // #3B82F6 - Blue
    tint: DashboardAccents.food + '08',
    iconColor: DashboardAccents.food,
  },
  water: {
    accent: '#0EA5E9',                      // Sky blue for water
    tint: '#0EA5E9' + '08',
    iconColor: '#0EA5E9',
    fill: '#0EA5E9',                        // Water fill color (can be same as accent or slightly different)
    goalLine: '#0EA5E9',                    // Goal indicator line color
    tick: '#0EA5E9',                        // Side tick marks color
  },
} as const;

export const Colors = {
  light: {
    // Text
    text: '#11181C',
    textSecondary: StandardGrey.light,
    textSecondaryOnDark: StandardGrey.light, // Not used in light mode, but present for type consistency
    textTertiary: '#9BA1A6',
    textMuted: '#6B7280',
    textMutedOnDark: StandardGrey.light,
    textSubtle: '#9CA3AF',
    textInverse: '#FFFFFF',
    textOnSoft: '#0B0F10',
    textValueOnDark: '#11181C', // Not used in light mode, but present for type consistency
    
    // Light mode nutrition panel surfaces (not used in light mode, but present for type consistency)
    surfacePanelDark: '#FFFFFF',
    surfacePanelDividerDark: '#000000',
    
    // Light mode text inside panels (not used in light mode, but present for type consistency)
    textPanelHeaderDark: '#11181C',
    textPanelLabelDark: '#11181C',
    textPanelValueDark: '#11181C',
    
    // Light mode inputs (not used in light mode, but present for type consistency)
    inputBgDark: '#FFFFFF',
    inputBorderDark: '#000000',
    inputBorderFocusDark: '#000000',
    inputTextDark: '#000000',
    inputPlaceholderDark: '#6B7280',
    
    // Light mode Quick Log card (not used in light mode, but present for type consistency)
    quickLogCardBgDark: '#FFFFFF',
    quickLogCardBorderDark: '#E5E5E5',
    
    // Backgrounds
    background: '#FFFFFF',
    backgroundSecondary: '#F9F9F9',
    backgroundTertiary: '#F2F2F2',
    dashboardBackground: '#F5F7FA', // Very light neutral (MyFitnessPal style)
    surfaceSoft: '#EEF6F8',
    surfaceSoft2: '#F2F5F7',
    // Illustration surfaces (used for onboarding hero/illustration cards; not for inputs/toggles/buttons)
    illustrationSurface: '#EEF6F8',
    illustrationSurfaceDim: '#E4EFF3',
    // Interactive surfaces (inputs, toggles, buttons) should use this token.
    // Light mode keeps a subtle neutral to preserve hierarchy.
    surfaceInteractive: '#F9F9F9',
    strokeOnSoft: '#C8E4EC',
    strokeOnSoftStrong: '#BFDDE6',
    
    // Accent
    tint: salmonColorLight,
    tintLight: salmonColorLight + '20',
    appTeal: '#2FA4A9',
    softGlow: '#2FA4A9' + '1A',
    chartGrey: '#E6E6E6', // chartGreyLightMode
    chartGreen: '#2ECC71', // chartGreen (shared)
    chartOrange: '#FFA500', // chartOrange (shared)
    chartPink: '#FF5FA2', // chartPink (shared)
    chartRed: '#FF3B30', // chartRed (shared)
    
    // UI Elements
    icon: StandardGrey.light,
    tabIconDefault: StandardGrey.light,
    tabIconSelected: salmonColorLight,
    border: '#E5E5E5',
    borderSecondary: '#D1D1D1',
    cardBorder: 'rgba(15, 23, 42, 0.06)', // Subtle card border
    separator: '#E5E5E5',
    overlay: 'rgba(0, 0, 0, 0.5)',
    card: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.1)',
    
    // Dashboard accents
    accentFood: DashboardAccents.food,
    accentExercise: DashboardAccents.exercise,
    accentMeds: DashboardAccents.meds,
    accentStreak: DashboardAccents.streak,
    
    // Input
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E5E5',
    inputPlaceholder: StandardGrey.light, // Use textSecondary for placeholders
    
    // Semantic (spread from SemanticColors)
    ...SemanticColors,
  },
  dark: {
    // Text
    text: '#FFFFFF', // textPrimaryOnDark - title / primary labels
    textSecondary: StandardGrey.dark,
    textSecondaryOnDark: '#D1DEE2', // NEW: readable secondary copy (helper text)
    textTertiary: '#8E8E93',
    textMuted: '#9CA3AF',
    textMutedOnDark: '#A9B8BD', // subtle captions only (NOT for helper on this page)
    textSubtle: '#6B7280',
    textInverse: '#11181C',
    textOnSoft: '#0B0F10',
    textValueOnDark: '#EAF2F4', // NEW: prominent but not pure white (large numeric values)
    
    // Dark mode nutrition panel surfaces
    surfacePanelDark: '#141A1C', // darker than app background, not black
    surfacePanelDividerDark: '#2A3438', // divider lines in dark mode panels
    
    // Dark mode text inside panels
    textPanelHeaderDark: '#D6E2E6', // section headers (Calories, Fat, Carbohydrate, Protein, Sodium)
    textPanelLabelDark: '#B7C6CB', // sub-labels (Saturated, + Trans, Fibre, Sugars)
    textPanelValueDark: '#EAF2F4', // numeric values (g, mg, etc.)
    
    // Dark mode inputs (Food Entry panel)
    inputBgDark: '#11181A', // slightly distinct from panel bg (#141A1C)
    inputBorderDark: '#2E3A3F', // subtle outline for affordance
    inputBorderFocusDark: '#2FA4A9', // brand teal for focus state
    inputTextDark: '#EAF2F4', // entered text
    inputPlaceholderDark: '#AFC0C6', // readable placeholder
    
    // Dark mode Quick Log card
    quickLogCardBgDark: '#101617', // dark card surface (not pitch black)
    quickLogCardBorderDark: '#243035', // subtle outline
    
    // Backgrounds
    background: '#121212',
    backgroundSecondary: '#1C1C1E',
    backgroundTertiary: '#2C2C2E',
    dashboardBackground: '#0F172A', // Dark blue-grey
    surfaceSoft: '#EEF6F8',
    surfaceSoft2: '#F2F5F7',
    // Illustration surfaces (used for onboarding hero/illustration cards; not for inputs/toggles/buttons)
    illustrationSurface: '#EEF6F8',
    illustrationSurfaceDim: '#E4EFF3',
    // Interactive surfaces (inputs, toggles, buttons) should use this token.
    surfaceInteractive: '#0E1416',
    strokeOnSoft: '#C8E4EC',
    strokeOnSoftStrong: '#BFDDE6',
    
    // Accent
    tint: salmonColorDark,
    tintLight: salmonColorDark + '20',
    appTeal: '#5BC2C6',
    softGlow: '#5BC2C6' + '1A',
    chartGrey: '#3A3A3A', // chartGreyDarkMode
    chartGreen: '#2ECC71', // chartGreen (shared)
    chartOrange: '#FFA500', // chartOrange (shared)
    chartPink: '#FF5FA2', // chartPink (shared)
    chartRed: '#FF3B30', // chartRed (shared)
    
    // UI Elements
    icon: StandardGrey.dark,
    tabIconDefault: StandardGrey.dark,
    tabIconSelected: salmonColorDark,
    border: '#38383A',
    borderSecondary: '#48484A',
    cardBorder: 'rgba(255, 255, 255, 0.08)', // Subtle card border for dark mode
    separator: '#38383A',
    overlay: 'rgba(0, 0, 0, 0.7)',
    card: '#1C1C1E',
    shadow: 'rgba(0, 0, 0, 0.4)',
    
    // Dashboard accents
    accentFood: DashboardAccents.food,
    accentExercise: DashboardAccents.exercise,
    accentMeds: DashboardAccents.meds,
    accentStreak: DashboardAccents.streak,
    
    // Input
    inputBackground: '#1C1C1E',
    inputBorder: '#38383A',
    inputPlaceholder: StandardGrey.dark, // Use textSecondary for placeholders
    
    // Semantic (spread from SemanticColors)
    ...SemanticColors,
  },
};

// Type for theme colors
export type ThemeColors = typeof Colors.light;

// ============================================================================
// SPACING
// ============================================================================

/**
 * Spacing scale based on 4px base unit
 * Use these values instead of arbitrary numbers
 */
export const Spacing = {
  none: 0,
  xxs:2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
  // Dashboard-specific
  card: 18,           // Standard card radius
  cardBottomExtra: 24, // Asymmetric bottom rounding
  chip: 9999,          // Full pill shape
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

/**
 * Font sizes following a type scale
 */
export const FontSize = {
  xs: 10,
  sm: 12,
  gaugeLabelMd: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

/**
 * Font weights
 */
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Font families used in react-native-svg text. Keep in sync with app font loading.
export const FontFamilies = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
} as const;

// Shared gauge typography (kept in theme to avoid hardcoded font sizes in components)
export const GaugeText = {
  macroGauge: {
    label: {
      md: { fontSize: FontSize.gaugeLabelMd, fontWeight: FontWeight.semibold },
      sm: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    },
    value: {
      md: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
      sm: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
    },
  },
} as const;

/**
 * Line heights
 */
export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

/**
 * Typography presets for consistent text styling
 * Use these with the ThemedText component
 */
export const Typography = {
  // Headings
  h1: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['3xl'] * LineHeight.tight,
  },
  h2: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['2xl'] * LineHeight.tight,
  },
  h3: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.xl * LineHeight.tight,
  },
  h4: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.lg * LineHeight.normal,
  },
  
  // Body text
  body: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  bodyLarge: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.normal,
  },
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  
  // Labels
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  labelLarge: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  
  // Caption/Helper text
  caption: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.xs * LineHeight.normal,
  },
  
  // Button text
  button: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  buttonSmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
    web: {
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 3,
    },
    web: {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 5,
    },
    web: {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    default: {},
  }),
  // Premium card shadow for dashboard
  card: Platform.select({
    ios: {
      shadowColor: 'rgba(15, 23, 42, 0.06)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    web: {
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
      // Remove deprecated shadow props for web
    },
    default: {},
  }),
};

// ============================================================================
// LAYOUT
// ============================================================================

export const Layout = {
  /** Minimum touch target size for accessibility (44x44) */
  minTouchTarget: 44,
  
  /** Maximum content width for centered layouts */
  maxContentWidth: 600,
  
  /** Desktop page container max width (canonical desktop width) */
  desktopMaxWidth: 900,
  
  /** Standard screen padding */
  screenPadding: Spacing.lg,
  
  /** Standard card padding */
  cardPadding: Spacing.md,
  
  /** Standard gap between list items */
  listGap: Spacing.sm,
  
  /** Dashboard-specific spacing */
  sectionGap: Spacing.lg,      // Gap between sections
  cardInnerPadding: Spacing.lg, // Inner padding for cards
  
  /** Dashboard compact spacing (reduced by 30-50%) */
  sectionGapCompact: 10,        // Reduced from 16 (~40% reduction)
  cardInnerPaddingCompact: 10,   // Reduced from 16 (~40%)
  cardInnerPaddingY: 8,         // Top/bottom padding only (~50% reduction)
  chartGapCompact: 6,             // Gaps in charts (~50% reduction)
  rowGapCompact: 6,               // Gaps between rows (~50% reduction)
  titleGapCompact: 6,             // Gap after titles (~50% reduction)
};

// ============================================================================
// COMPONENT TOKENS
// ============================================================================

/**
 * More bottom sheet (tab menu) tokens.
 *
 * Engineering guideline #11: components should not hardcode colors/sizes.
 * Design spec requires several non-scale values (e.g. 15px label text, 5px handle height),
 * so those live here as explicit tokens.
 */
export const MoreSheetTokens = {
  backdrop: {
    color: {
      // Matches prior overlay appearance in tabs layout (now animated via opacity).
      light: 'rgba(0,0,0,0.35)',
      dark: 'rgba(0,0,0,0.35)',
    },
  },
  container: {
    paddingHorizontal: Spacing.lg, // 16
    paddingTop: Layout.cardInnerPaddingCompact, // 10 (spec-driven)
    paddingBottomBase: Layout.cardInnerPaddingCompact, // 10 (spec-driven; safe-area added at runtime)
    borderTopRadius: BorderRadius['3xl'], // 24
  },
  handle: {
    width: Layout.minTouchTarget, // 44
    height: 5, // spec-driven
    borderRadius: 3, // spec-driven
    marginBottom: Layout.cardInnerPaddingCompact, // 10
    paddingTop: Layout.cardInnerPaddingCompact, // 10 (spec-driven)
    paddingBottom: Layout.cardInnerPaddingY, // 8 (spec-driven)
    color: {
      light: 'rgba(0,0,0,0.18)',
      dark: 'rgba(255,255,255,0.18)',
    },
  },
  header: {
    logoWidth: 104, // spec: ~10–20% of original mascot asset
    title: {
      fontSize: FontSize.lg, // 18
      fontWeight: FontWeight.bold,
      color: {
        light: '#0B0C0E',
        dark: '#F2F4F7',
      },
    },
    marginBottom: Spacing.md, // 12
  },
  row: {
    height: Spacing['5xl'] + Spacing.sm, // 56
    paddingHorizontal: Spacing.md + Spacing.xxs, // 14
    borderRadius: BorderRadius.xl, // 16
    borderWidth: 1,
    gap: Layout.cardInnerPaddingCompact, // 10
    backgroundColor: {
      light: 'rgba(0,0,0,0.02)',
      dark: 'rgba(255,255,255,0.04)',
    },
    borderColor: {
      light: 'rgba(0,0,0,0.06)',
      dark: 'rgba(255,255,255,0.08)',
    },
    label: {
      fontSize: 15, // spec-driven
      fontWeight: FontWeight.semibold,
      color: {
        light: '#0B0C0E',
        dark: '#F2F4F7',
      },
    },
    chevron: {
      size: FontSize.lg, // 18
      color: {
        light: 'rgba(0,0,0,0.38)',
        dark: 'rgba(255,255,255,0.45)',
      },
    },
  },
  iconChip: {
    size: 34, // spec-driven
    borderRadius: BorderRadius.lg, // 12
    backgroundColor: {
      light: 'rgba(0,0,0,0.06)',
      dark: 'rgba(255,255,255,0.08)',
    },
    iconSize: FontSize.lg, // 18
    iconColor: {
      light: '#0B0C0E',
      dark: '#F2F4F7',
    },
    marginRight: Spacing.md, // 12
  },
  sheet: {
    backgroundColor: {
      light: '#FFFFFF',
      dark: '#14161A',
    },
  },
} as const;

/**
 * Big Circle Menu (Quick Add) bottom sheet tokens.
 *
 * Engineering guideline #11: components should not hardcode colors/sizes.
 * Light mode keeps the current look; dark mode matches the AvoVibe premium spec.
 */
export const BigCircleMenuTokens = {
  backdrop: {
    color: {
      // Matches existing light overlay appearance in tabs layout.
      light: 'rgba(0,0,0,0.4)',
      // Spec: slightly stronger in dark mode.
      dark: 'rgba(0,0,0,0.55)',
    },
  },
  container: {
    paddingHorizontal: {
      light: Spacing.xl, // 20 (keep existing light mode)
      dark: Spacing.lg, // 16 (spec)
    },
    paddingTop: {
      light: Spacing.md, // 12 (keep existing light mode)
      dark: Layout.cardInnerPaddingCompact, // 10 (spec)
    },
    paddingBottomBase: {
      light: Spacing.xl, // 20 (keep existing light mode)
      dark: Layout.cardInnerPaddingCompact, // 10 (spec; safe-area added at runtime)
    },
    borderTopRadius: {
      light: 22, // keep existing light mode
      dark: BorderRadius['3xl'], // 24 (spec)
    },
    maxWidth: 1200, // keep existing sheet max-width
  },
  handle: {
    width: {
      light: 40, // keep existing light mode
      dark: Layout.minTouchTarget, // 44 (spec)
    },
    height: {
      light: 4, // keep existing light mode
      dark: 5, // spec
    },
    borderRadius: {
      light: 2, // keep existing light mode
      dark: 3, // spec
    },
    marginBottom: Spacing.md, // 12
    color: {
      light: '#ccc', // keep existing light mode
      dark: 'rgba(255,255,255,0.18)', // spec
    },
  },
  grid: {
    gap: {
      // Existing: row gap 16, column gap 12
      light: { row: Spacing.lg, column: Spacing.md },
      // Spec: 12 in both directions
      dark: { row: Spacing.md, column: Spacing.md },
    },
  },
  tile: {
    borderRadius: BorderRadius.card, // 18
    paddingVertical: Spacing.lg + Spacing.xxs, // 18
    paddingHorizontal: Spacing.md + Spacing.xxs, // 14
    backgroundColor: {
      light: 'rgba(255,255,255,0.85)', // keep existing light mode
      dark: '#1B1F24', // spec
    },
    borderWidth: {
      light: 0,
      dark: 1,
    },
    borderColor: {
      light: 'transparent',
      dark: 'rgba(255,255,255,0.08)', // spec
    },
    rippleColor: {
      light: 'rgba(0,0,0,0.08)', // not used by default (kept for completeness)
      dark: 'rgba(255,255,255,0.10)', // spec
    },
    iosShadow: {
      light: { color: '#000', opacity: 0.08, radius: 12, offsetY: 4 },
      // Spec: subtle shadow only
      dark: { color: '#000', opacity: 0.25, radius: 10, offsetY: 4 },
    },
    androidElevation: {
      light: 4,
      dark: 3, // spec max 2–3
    },
    iconChip: {
      size: {
        light: null,
        dark: 44, // spec
      },
      borderRadius: {
        light: null,
        dark: 14, // spec
      },
      backgroundColor: {
        light: 'transparent',
        // Slightly softer than spec so the chip blends more like light mode.
        dark: 'rgba(255,255,255,0.06)',
      },
      emojiSize: {
        light: 32, // keep existing light mode
        // No chip in dark mode (matches light mode layout), so keep emoji larger like light mode.
        dark: 32,
      },
      iconBoxHeightMultiplier: {
        // Vector icons have less inherent line-height than emojis; multiplier keeps label baselines aligned.
        light: 1.4,
        dark: 1.4,
      },
      marginBottom: {
        light: Spacing.md, // 12 (existing is 10, but this is not applied directly; component controls exact)
        dark: 0,
      },
    },
    label: {
      fontSize: {
        light: 15, // keep existing light mode
        dark: FontSize.base, // 14 (spec)
      },
      fontWeight: {
        light: FontWeight.medium, // 500
        dark: FontWeight.semibold, // 600
      },
      color: {
        light: '#1a1a1a', // keep existing light mode
        dark: '#F2F4F7', // spec
      },
      marginTop: {
        light: Spacing.xs, // 4
        dark: Spacing.md - Spacing.xxs, // 10
      },
    },
  },
  sheet: {
    backgroundColor: {
      light: 'rgba(255,255,255,0.9)', // keep existing light mode
      dark: '#14161A', // spec
    },
  },
} as const;

// ============================================================================
// FONTS (Legacy - kept for backwards compatibility)
// ============================================================================

/**
 * @deprecated Use Inter font from useFonts hook instead
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'Inter',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    sans: 'Inter',
    serif: 'serif',
    rounded: 'Inter',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "Inter, system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  default: {
    sans: 'Inter',
    serif: 'serif',
    rounded: 'Inter',
    mono: 'monospace',
  },
});
