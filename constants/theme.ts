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

const tintColorLight = '#0a7ea4';
const tintColorDark = '#5BB8FF';

// Standardized grey color used across the entire app
// This is the primary grey for secondary text, icons, and UI elements
export const StandardGrey = {
  light: '#1F2937',  // Darker grey for light mode
  dark: '#4B5563',   // Darker grey for dark mode
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
  food: '#3B82F6',      // Bright blue for calories
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
    textTertiary: '#9BA1A6',
    textMuted: '#6B7280',
    textSubtle: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    // Backgrounds
    background: '#FFFFFF',
    backgroundSecondary: '#F9F9F9',
    backgroundTertiary: '#F2F2F2',
    dashboardBackground: '#F5F7FA', // Very light neutral (MyFitnessPal style)
    
    // Accent
    tint: tintColorLight,
    tintLight: tintColorLight + '20',
    
    // UI Elements
    icon: StandardGrey.light,
    tabIconDefault: StandardGrey.light,
    tabIconSelected: tintColorLight,
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
    inputPlaceholder: StandardGrey.light,
    
    // Semantic (spread from SemanticColors)
    ...SemanticColors,
  },
  dark: {
    // Text
    text: '#FFFFFF',
    textSecondary: StandardGrey.dark,
    textTertiary: '#8E8E93',
    textMuted: '#9CA3AF',
    textSubtle: '#6B7280',
    textInverse: '#11181C',
    
    // Backgrounds
    background: '#121212',
    backgroundSecondary: '#1C1C1E',
    backgroundTertiary: '#2C2C2E',
    dashboardBackground: '#0F172A', // Dark blue-grey
    
    // Accent
    tint: tintColorDark,
    tintLight: tintColorDark + '20',
    
    // UI Elements
    icon: StandardGrey.dark,
    tabIconDefault: StandardGrey.dark,
    tabIconSelected: tintColorDark,
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
    inputPlaceholder: StandardGrey.dark,
    
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
