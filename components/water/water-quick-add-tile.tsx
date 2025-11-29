/**
 * Water Quick Add Tile Component
 * 
 * Displays a single quick-add preset tile with icon, amount, label, and plus button
 * Follows engineering guidelines: reusable, themed, i18n, accessible
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WaterUnit, formatWaterValue } from '@/utils/waterUnits';
import { getButtonAccessibilityProps, getMinTouchTargetStyle } from '@/utils/accessibility';
import { getPresetIconName, type QuickAddPreset } from '@/utils/waterQuickAddPresets';

type WaterQuickAddTileProps = {
  preset: QuickAddPreset;
  onPress: (amount: number, unit: WaterUnit) => void;
  isAddingWater?: boolean;
  isCustom?: boolean; // If true, this is the "Custom amount" tile
};

export function WaterQuickAddTile({
  preset,
  onPress,
  isAddingWater = false,
  isCustom = false,
}: WaterQuickAddTileProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const iconName = getPresetIconName(preset.iconType);
  const displayAmount = formatWaterValue(preset.amount, preset.unit);
  const label = isCustom ? t('water.quick_presets.custom_amount') : t(preset.labelKey);

  return (
    <View style={styles.tileContainer}>
      <TouchableOpacity
        style={[styles.tile, { backgroundColor: colors.card, ...Shadows.sm }]}
        onPress={() => onPress(preset.amount, preset.unit)}
        disabled={isAddingWater}
        activeOpacity={0.7}
        {...getButtonAccessibilityProps(
          isCustom 
            ? t('water.quick_presets.custom_amount')
            : t('water.quick_presets.add', { amount: displayAmount, label })
        )}
      >
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <IconSymbol
            name={iconName}
            size={isCustom ? 28 : 32}
            color={isCustom ? colors.textSecondary : colors.tint}
          />
        </View>

        {/* Amount */}
        <ThemedText
          style={[styles.amount, { color: colors.text }]}
          numberOfLines={1}
        >
          {isCustom ? t('water.quick_presets.custom') : displayAmount}
        </ThemedText>

        {/* Label */}
        <ThemedText
          style={[styles.label, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {label}
        </ThemedText>
      </TouchableOpacity>

      {/* Plus Button */}
      <TouchableOpacity
        style={[
          styles.plusButton,
          {
            backgroundColor: colors.tint,
            borderColor: colors.tint,
          },
        ]}
        onPress={() => onPress(preset.amount, preset.unit)}
        disabled={isAddingWater}
        activeOpacity={0.7}
        {...getButtonAccessibilityProps(
          isCustom 
            ? t('water.quick_presets.custom_amount')
            : t('water.quick_presets.add', { amount: displayAmount, label })
        )}
        {...getMinTouchTargetStyle()}
      >
        <IconSymbol name="plus" size={20} color={colors.textInverse} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tileContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    minWidth: 70,
    maxWidth: 90,
  },
  tile: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs / 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs / 2,
  },
  amount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

