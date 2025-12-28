import React from 'react';
import { Text } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  brandGreenColorDark,
  brandGreencolorLight,
  salmonColorDark,
  salmonColorLight,
} from '@/constants/theme';

type ColoredBrandNameProps = {
  withSpaceBefore?: boolean;
  withSpaceAfter?: boolean;
};

/**
 * Inline brand wordmark: "Avo" (brand green) + "Vibe" (salmon).
 * - Theme-aware (light/dark resolved via app's `useColorScheme()`).
 * - Inherits typography from parent <Text> (no font styles set here).
 * - Brand name is intentionally not localized.
 */
export function ColoredBrandName({
  withSpaceBefore = false,
  withSpaceAfter = false,
}: ColoredBrandNameProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const avoColor = isDark ? brandGreenColorDark : brandGreencolorLight;
  const vibeColor = isDark ? salmonColorDark : salmonColorLight;

  return (
    <Text>
      {withSpaceBefore ? ' ' : ''}
      <Text style={{ color: avoColor }}>Avo</Text>
      <Text style={{ color: vibeColor }}>Vibe</Text>
      {withSpaceAfter ? ' ' : ''}
    </Text>
  );
}


