/**
 * FoodSourceBadge - Reusable component for displaying food source indicator
 * 
 * Shows "C" chip only for custom foods.
 * Database foods show no badge (default state).
 * 
 * Per engineering guidelines: Reusable UI component shared across screens
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';

export interface FoodSourceBadgeProps {
  /** Whether the food is custom (true) or from database (false) */
  isCustom: boolean;
  /** Theme colors */
  colors: {
    tint: string;
  };
  /** Optional custom styles for the badge container */
  containerStyle?: object;
  /** Optional margin left value (default: 6) */
  marginLeft?: number;
}

/**
 * Reusable badge component for food source indicator
 * Shows "C" chip only for custom foods. Database foods have no badge.
 */
export function FoodSourceBadge({
  isCustom,
  colors,
  containerStyle,
  marginLeft = 6,
}: FoodSourceBadgeProps) {
  // Only show badge for custom foods
  if (!isCustom) {
    return null;
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.tint + '20',
          borderColor: colors.tint + '40',
          marginLeft,
        },
        containerStyle,
      ]}
    >
      <ThemedText
        style={[
          styles.badgeText,
          {
            color: colors.tint,
          },
        ]}
      >
        C
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
    minHeight: 18,
    minWidth: 0,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

