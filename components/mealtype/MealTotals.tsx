import { ThemedText } from '@/components/themed-text';
import type { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { View } from 'react-native';

type MealTotalsProps = {
  mealTotals: {
    kcal: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    saturated_fat_g: number | null;
    trans_fat_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
  };
  colors: typeof Colors.light | typeof Colors.dark;
  styles: any;
};

export function MealTotals({ mealTotals, colors, styles }: MealTotalsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Calculate secondary nutrients with fallback for sugar
  const satG = mealTotals.saturated_fat_g ?? 0;
  const transG = mealTotals.trans_fat_g ?? 0;
  const sugarG = (mealTotals as any).total_sugar_g ?? mealTotals.sugar_g ?? 0;
  const sodiumMg = mealTotals.sodium_mg ?? 0;

  return (
    <View style={styles.mealTotalsContainer}>
      <View style={[
        styles.totalsBand,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        }
      ]}>
        <ThemedText style={[styles.totalsLabel, { color: colors.textSecondary }]}>TOTAL</ThemedText>
        <View style={styles.mealTotalsRow}>
          <View style={styles.mealTotalsChip}>
            <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>P</ThemedText>
            <ThemedText style={[styles.mealTotalsChipValue, { color: colors.text }]}>{mealTotals.protein_g ?? 0}g</ThemedText>
          </View>
          <View style={styles.mealTotalsChip}>
            <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>C</ThemedText>
            <ThemedText style={[styles.mealTotalsChipValue, { color: colors.text }]}>{mealTotals.carbs_g ?? 0}g</ThemedText>
          </View>
          <View style={styles.mealTotalsChip}>
            <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>F</ThemedText>
            <ThemedText style={[styles.mealTotalsChipValue, { color: colors.text }]}>{mealTotals.fat_g ?? 0}g</ThemedText>
          </View>
          {(mealTotals.fiber_g ?? 0) > 0 && (
            <View style={styles.mealTotalsChip}>
              <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>Fib</ThemedText>
              <ThemedText style={[styles.mealTotalsChipValue, { color: colors.text }]}>{mealTotals.fiber_g ?? 0}g</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.mealTotalsRow}>
          <View style={styles.mealTotalsChip}>
            <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>Sat</ThemedText>
            <ThemedText style={[styles.mealTotalsChipValue, { color: colors.textSecondary }]}>{satG}g</ThemedText>
          </View>
          <View style={styles.mealTotalsChip}>
            <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>Trans</ThemedText>
            <ThemedText style={[styles.mealTotalsChipValue, { color: colors.textSecondary }]}>{transG}g</ThemedText>
          </View>
          <View style={styles.mealTotalsChip}>
            <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>Sugar</ThemedText>
            <ThemedText style={[styles.mealTotalsChipValue, { color: colors.textSecondary }]}>{sugarG}g</ThemedText>
          </View>
          <View style={styles.mealTotalsChip}>
            <ThemedText style={[styles.mealTotalsChipLabel, { color: colors.textSecondary }]}>Na</ThemedText>
            <ThemedText style={[styles.mealTotalsChipValue, { color: colors.textSecondary }]}>{sodiumMg}mg</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

