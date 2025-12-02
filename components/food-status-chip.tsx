/**
 * FoodStatusChip - Reusable component for displaying Frequent/Recent status
 * 
 * Per engineering guidelines: Reusable UI component shared across screens
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';

export interface FoodStatusChipProps {
  /** Whether to show "Frequent" chip */
  isFrequent?: boolean;
  /** Whether to show "Recent" chip */
  isRecent?: boolean;
  /** Theme colors */
  colors: {
    tint: string;
    text: string;
  };
  /** Optional custom styles for the badge container */
  containerStyle?: object;
  /** Optional margin left value (default: 6) */
  marginLeft?: number;
}

/**
 * Reusable chip component for food status indicators
 * Shows "Frequent" and/or "Recent" chips
 */
export function FoodStatusChip({
  isFrequent = false,
  isRecent = false,
  colors,
  containerStyle,
  marginLeft = 6,
}: FoodStatusChipProps) {
  // Don't render if neither flag is set
  if (!isFrequent && !isRecent) {
    return null;
  }

  // If both are true, prefer "Frequent" (per spec section 7)
  // But we can show both if desired - showing just Frequent for now
  const showFrequent = isFrequent;
  const showRecent = isRecent && !isFrequent; // Only show Recent if not Frequent

  return (
    <View style={[styles.container, { marginLeft }]}>
      {showFrequent && (
        <View
          style={[
            styles.chip,
            {
              backgroundColor: '#3B82F6' + '20', // Blue with opacity
              borderColor: '#3B82F6' + '40',
            },
            containerStyle,
          ]}
        >
          <ThemedText
            style={[
              styles.chipText,
              {
                color: '#3B82F6',
              },
            ]}
          >
            Frequent
          </ThemedText>
        </View>
      )}
      {showRecent && (
        <View
          style={[
            styles.chip,
            {
              backgroundColor: '#10B981' + '20', // Green with opacity
              borderColor: '#10B981' + '40',
            },
            containerStyle,
          ]}
        >
          <ThemedText
            style={[
              styles.chipText,
              {
                color: '#10B981',
              },
            ]}
          >
            Recent
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
    minHeight: 18,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});


