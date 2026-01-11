import { HighlightableRow } from '@/components/common/highlightable-row';
import { FoodSourceBadge } from '@/components/food-source-badge';
import { MultiSelectItem } from '@/components/multi-select-item';
import { ThemedText } from '@/components/themed-text';
import type { Colors } from '@/constants/theme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';
import type { CalorieEntry } from '@/utils/types';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

type EntryCardProps = {
  entry: CalorieEntry;
  foodSourceMap: { [foodId: string]: boolean };
  showEntryDetails: boolean;
  onEdit: (entry: CalorieEntry) => void;
  onDelete: (entryId: string, entryName: string) => void;
  isSelected: boolean;
  onToggleSelection: () => void;
  isNewlyAdded: boolean;
  hasAnySelection: boolean;
  entriesEditMode: boolean;
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string) => string;
  styles: any;
};

export function EntryCard({
  entry,
  foodSourceMap,
  showEntryDetails,
  onEdit,
  onDelete,
  isSelected,
  onToggleSelection,
  isNewlyAdded,
  hasAnySelection,
  entriesEditMode,
  colors,
  t,
  styles,
}: EntryCardProps) {
  // Calculate secondary nutrients for details mode
  const satG = entry.saturated_fat_g ?? 0;
  const transG = entry.trans_fat_g ?? 0;
  const sugarG = (entry as any).total_sugar_g ?? entry.sugar_g ?? 0;
  const sodiumMg = entry.sodium_mg ?? 0;
  const hasSecondaryNutrients = satG > 0 || transG > 0 || sugarG > 0 || sodiumMg > 0;

  const entryContent = (
    <HighlightableRow
      isNew={isNewlyAdded}
      style={[
        styles.entryCard, 
        { 
          backgroundColor: 'transparent',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator + '40',
        }
      ]}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryHeaderLeft}>
          <View style={styles.entryNameRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
              <TouchableOpacity
                onPress={() => onEdit(entry)}
                activeOpacity={0.7}
                style={[
                  styles.entryItemNameButton,
                  { flexShrink: 1, minWidth: 0 },
                  getMinTouchTargetStyle(),
                ]}
                {...getButtonAccessibilityProps(
                  `Edit ${entry.item_name}`,
                  'Double tap to edit this food entry'
                )}
                {...(Platform.OS === 'web' ? getWebAccessibilityProps(
                  'button',
                  `Edit ${entry.item_name}`,
                  `edit-entry-${entry.id}`
                ) : {})}
              >
                <ThemedText 
                  style={[styles.entryItemName, { color: colors.text, flexShrink: 1 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {entry.item_name}
                </ThemedText>
              </TouchableOpacity>
              {/* Source indicator badge - moved to left side */}
              {entry.food_id && (
                <FoodSourceBadge
                  isCustom={foodSourceMap[entry.food_id] === true}
                  colors={colors}
                  marginLeft={6}
                  containerStyle={{ marginRight: 0 }}
                />
              )}
              {!entry.food_id && (
                <View style={[
                  styles.sourceBadge,
                  {
                    backgroundColor: 'transparent',
                    marginLeft: 6,
                    marginRight: 0,
                  }
                ]}>
                  <ThemedText style={[
                    styles.sourceBadgeText,
                    { color: colors.textSecondary }
                  ]}>
                    {entry.source === 'ai' ? 'AI' : '⚡'}
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
              {/* Only show quantity x unit for non-manual entries */}
              {entry.food_id && (
                <ThemedText style={[styles.entrySummary, { color: colors.textSecondary, fontSize: 11 }]}>
                  {entry.quantity} x {entry.unit}
                </ThemedText>
              )}
            </View>
          </View>
          {showEntryDetails && (
            <TouchableOpacity
              onPress={() => onEdit(entry)}
              activeOpacity={0.7}
              style={styles.entryMacrosContainer}
            >
                <View style={styles.entryMacrosRow}>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>P</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.text }]}>{entry.protein_g ?? 0}g</ThemedText>
                  </View>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>C</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.text }]}>{entry.carbs_g ?? 0}g</ThemedText>
                  </View>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>F</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.text }]}>{entry.fat_g ?? 0}g</ThemedText>
                  </View>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>Fib</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.text }]}>{entry.fiber_g ?? 0}g</ThemedText>
                  </View>
                </View>
              {hasSecondaryNutrients && (
                <View style={styles.entryMacrosRowSecondary}>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>Sat</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.textSecondary }]}>{satG}g</ThemedText>
                  </View>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>Trans</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.textSecondary }]}>{transG}g</ThemedText>
                  </View>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>Sugar</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.textSecondary }]}>{sugarG}g</ThemedText>
                  </View>
                  <View style={styles.entryMacroChip}>
                    <ThemedText style={[styles.entryMacroChipLabel, { color: colors.textSecondary }]}>Na</ThemedText>
                    <ThemedText style={[styles.entryMacroChipValue, { color: colors.textSecondary }]}>{sodiumMg}mg</ThemedText>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.entryHeaderRight}>
          {/* Kcal value */}
          <ThemedText style={[styles.entryCaloriesValue, { color: colors.tint, fontSize: 11 }]}>
            {entry.calories_kcal} cal
          </ThemedText>
        </View>
      </View>
    </HighlightableRow>
  );

  // Wrap with MultiSelectItem if in edit mode
  if (entriesEditMode) {
    return (
      <MultiSelectItem
        key={entry.id}
        isSelected={isSelected}
        onToggle={onToggleSelection}
      >
        {entryContent}
      </MultiSelectItem>
    );
  }

  return <React.Fragment key={entry.id}>{entryContent}</React.Fragment>;
}

