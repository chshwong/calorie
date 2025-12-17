import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { Colors } from '@/constants/theme';

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
  return (
    <View style={[styles.mealTotalsContainer, { backgroundColor: colors.tintLight }]}>
      <ThemedText style={[styles.mealTotalsLine, { color: colors.text }]}>
        {`Total · Pro `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.protein_g ?? 0}g</ThemedText>
        {`  Carb `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.carbs_g ?? 0}g</ThemedText>
        {`  Fat `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.fat_g ?? 0}g</ThemedText>
        {`  Fib `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.fiber_g ?? 0}g</ThemedText>
      </ThemedText>
      <ThemedText style={[styles.mealTotalsLine, { color: colors.text }]}>
        {`Sat Fat `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.saturated_fat_g ?? 0}g</ThemedText>
        {`  Trans Fat `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.trans_fat_g ?? 0}g</ThemedText>
        {`  Sugar `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.sugar_g ?? 0}g</ThemedText>
        {`  Sodium `}
        <ThemedText style={[styles.mealTotalsLine, { color: colors.tint, fontWeight: '400' }]}>{mealTotals.sodium_mg ?? 0}mg</ThemedText>
      </ThemedText>
    </View>
  );
}

