/**
 * UI helper functions for meal type tabs
 * 
 * Provides color utilities for tab styling based on tab type and selection state.
 */

import type { ColorScheme } from '@/hooks/use-color-scheme';

/**
 * Get the color for a tab based on its type and selection state
 * 
 * @param tab - The tab identifier (frequent, recent, custom, bundle, manual)
 * @param isSelected - Whether the tab is currently selected
 * @param fallbackColor - Fallback color if tab type is not recognized
 * @returns Hex color string with opacity for unselected tabs
 */
export function getTabColor(
  tab: string,
  isSelected: boolean,
  fallbackColor: string
): string {
  const shades: Record<string, string> = {
    frequent: '#3B82F6', // Blue
    recent: '#10B981', // Green
    custom: '#8B5CF6', // Purple
    bundle: '#F59E0B', // Orange
    manual: '#6B7280', // Dark Grey
  };
  
  const baseColor = shades[tab as keyof typeof shades] || fallbackColor;
  
  if (isSelected) {
    // Return the full vibrant color for selected tab
    return baseColor;
  } else {
    // Return a lighter/muted version for unselected tabs (70% opacity for better visibility)
    return baseColor + 'B3'; // ~70% opacity
  }
}

/**
 * Get the background color for a tab list based on tab type and color scheme
 * 
 * @param tab - The tab identifier (frequent, recent, custom, bundle, manual)
 * @param colorScheme - The current color scheme ('light' or 'dark')
 * @param fallbackColor - Fallback color if tab type is not recognized
 * @returns Hex color string with opacity for background
 */
export function getTabListBackgroundColor(
  tab: string,
  colorScheme: ColorScheme | null,
  fallbackColor: string
): string {
  // Special handling for Bundle - use a warmer, more sophisticated color that works better in dark mode
  if (tab === 'bundle') {
    // Use a muted warm amber/terracotta tone instead of bright orange
    // Creates a sophisticated, elegant look that complements the orange label
    if (colorScheme === 'dark') {
      // In dark mode, use a warm muted amber with subtle opacity
      return '#E87E5A20'; // Warm terracotta/amber at 12.5% opacity
    } else {
      // In light mode, use a softer peach tone
      return '#FFB88520'; // Soft peach at 12.5% opacity
    }
  }
  
  const shades: Record<string, string> = {
    frequent: '#3B82F6', // Blue
    recent: '#10B981', // Green
    custom: '#8B5CF6', // Purple
    bundle: '#F59E0B', // Orange (fallback)
    manual: '#6B7280', // Dark Grey
  };
  
  const baseColor = shades[tab as keyof typeof shades] || fallbackColor;
  // Return light background color - use higher opacity in dark mode for better visibility
  // Light mode: 15% opacity, Dark mode: 30% opacity
  const opacity = colorScheme === 'dark' ? '4D' : '26'; // '4D' = ~30% opacity, '26' = ~15% opacity
  return baseColor + opacity;
}

