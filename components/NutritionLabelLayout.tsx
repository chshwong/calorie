/**
 * NutritionLabelLayout - Reusable component for rendering a Canadian Nutrition Facts label layout
 * 
 * This is a pure presentational component that accepts ReactNode props for all input values,
 * making it reusable across Manual entry, Custom food, Quick Log, and other forms.
 * 
 * Visual spec:
 * - White background, black text only
 * - Solid black border (1-1.5px), no rounding, no shadows
 * - Top thick line; medium lines around Calories; thin lines between nutrient blocks
 * - Nutrient labels left-aligned; numeric values right-aligned
 * - Section headers (Fat, Carbohydrate, Protein, Sodium) bold; sub-rows indented
 * - No % Daily Value column
 * 
 * Usage:
 * Pass your existing input components (TextInput, FormTextInput, etc.) as props.
 * This component only handles layout and styling, not state or validation.
 */

import React from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, FontWeight, Nudge, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMacroColors } from '@/utils/macroColors';

type NutrientValueProps = {
  value: React.ReactNode;
  unit?: 'g' | 'mg';
  color?: string;
};

function NutrientValue({ value, unit, color }: NutrientValueProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={styles.valueWithUnit}>
      <View style={styles.valueInner}>{value}</View>
      {unit ? (
        <ThemedText
          style={[styles.unitText, { color: color ?? colors.textPanelValueDark }]}
        >
          {` ${unit}`}
        </ThemedText>
      ) : null}
    </View>
  );
}

type NutritionLabelDividerProps = {
  variant: 'thick' | 'medium' | 'thin';
};

function NutritionLabelDivider({ variant }: NutritionLabelDividerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const borderWidth =
    variant === 'thick'
      ? Nudge.px2 + Nudge.px1
      : variant === 'medium'
        ? Nudge.px2
        : Nudge.px1;

  return (
    <View
      style={[
        styles.divider,
        { 
          borderTopWidth: borderWidth, 
          borderTopColor: colors.surfacePanelDividerDark,
        },
      ]}
    />
  );
}

type NutritionLabelRowProps = {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  indentLevel?: 0 | 1;
  labelColorOverride?: string;
};

function NutritionLabelRow({
  label,
  value,
  bold = false,
  indentLevel = 0,
  labelColorOverride,
}: NutritionLabelRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Section headers (bold) use textPanelHeaderDark, sub-labels use textPanelLabelDark
  const labelColor = labelColorOverride ?? (bold ? colors.textPanelHeaderDark : colors.textPanelLabelDark);
  
  return (
    <View style={styles.row}>
      <ThemedText
        style={[
          styles.rowLabel,
          bold && styles.rowLabelBold,
          indentLevel === 1 && styles.rowLabelIndented,
          { color: labelColor }, // Explicit inline color override
        ]}
      >
        {label}
      </ThemedText>
      {/* Fixed width numeric column, right-aligned, closer to center */}
      <View style={styles.rowValueContainer}>{value}</View>
    </View>
  );
}

export type NutritionLabelLayoutProps = {
  /** Optional label for the food title row (defaults to "Food *") */
  titleLabel?: string;
  /** Food name input (title) */
  titleInput: React.ReactNode;
  /** Quantity input for serving */
  servingQuantityInput: React.ReactNode;
  /** Unit input for serving */
  servingUnitInput: React.ReactNode;
  /** Hide the serving row (Per, Qty, Unit) */
  hideServingRow?: boolean;
  /** Optional label for the calories row (defaults to "Calories") */
  caloriesLabel?: string;
  /** Calories input */
  caloriesInput: React.ReactNode;
  /** Fat input (g) */
  fatInput: React.ReactNode;
  /** Saturated fat input (g) */
  satFatInput: React.ReactNode;
  /** Trans fat input (g) */
  transFatInput: React.ReactNode;
  /** Carbohydrate input (g) */
  carbsInput: React.ReactNode;
  /** Fiber input (g) */
  fiberInput: React.ReactNode;
  /** Sugar input (g) */
  sugarInput: React.ReactNode;
  /** Protein input (g) */
  proteinInput: React.ReactNode;
  /** Sodium input (mg) */
  sodiumInput: React.ReactNode;
};

/**
 * NutritionLabelLayout - Renders a Canadian Nutrition Facts label layout
 * 
 * All value props should be your existing input components. This component
 * only handles the visual layout and styling to match a nutrition label.
 */
export function NutritionLabelLayout(props: NutritionLabelLayoutProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const macroColors = getMacroColors(colors);
  
  // Format numeric-like nodes without mutating inputs (TextInput is left intact)
  const formatNode = (node: React.ReactNode, decimals: 0 | 1): React.ReactNode => {
    const formatNumber = (value: any) => {
      const num = typeof value === 'string' ? Number(value) : Number(value);
      if (!isFinite(num)) return value;
      return decimals === 0 ? Math.round(num).toString() : num.toFixed(decimals);
    };

    if (typeof node === 'string' || typeof node === 'number') {
      return formatNumber(node);
    }

    if (!React.isValidElement(node)) return node;

    // Do not alter TextInput to preserve user editing behavior
    if (node.type === TextInput) {
      return node;
    }

    const propsAny: any = node.props || {};
    const normalizedChildren = propsAny.children !== undefined
      ? React.Children.map(propsAny.children, (child) => formatNode(child, decimals))
      : propsAny.children;

    return React.cloneElement(node as any, {
      ...propsAny,
      children: normalizedChildren,
    });
  };

  // Apply value color for dark mode (for nutrition values below Calories),
  // optionally overriding with a specific color (used for macro rows).
  const applyValueColor = (node: React.ReactNode, overrideColor?: string): React.ReactNode => {
    if (!React.isValidElement(node)) return node;

    const normalizeStyle = (styleProp: any) => {
      if (Array.isArray(styleProp)) return styleProp.filter(Boolean);
      return styleProp ? [styleProp] : [];
    };

    const propsAny: any = node.props || {};

    const mergedStyle = [
      ...normalizeStyle((node.props as any)?.style),
      // Default to panel value color unless explicitly overridden.
      ...(overrideColor ? [{ color: overrideColor }] : [{ color: colors.textPanelValueDark }]),
    ];

    const clonedProps: any = {
      ...propsAny,
      style: mergedStyle,
    };

    if (propsAny && propsAny.children !== undefined) {
      clonedProps.children = React.Children.map(propsAny.children, (child) => applyValueColor(child, overrideColor));
    }

    return React.cloneElement(node as any, clonedProps);
  };

  // Calories value should match the label color (white in dark mode, black in light mode).
  const caloriesValueNode = applyValueColor(
    formatNode(props.caloriesInput, 0),
    colors.textPanelHeaderDark
  );
  const fatValueNode = applyValueColor(formatNode(props.fatInput, 1), macroColors.fat);
  const satFatValueNode = applyValueColor(formatNode(props.satFatInput, 1));
  const transFatValueNode = applyValueColor(formatNode(props.transFatInput, 1));
  const carbsValueNode = applyValueColor(formatNode(props.carbsInput, 0), macroColors.netCarb);
  const fiberValueNode = applyValueColor(formatNode(props.fiberInput, 1), macroColors.fiber);
  const sugarValueNode = applyValueColor(formatNode(props.sugarInput, 1));
  const proteinValueNode = applyValueColor(formatNode(props.proteinInput, 0), macroColors.protein);
  const sodiumValueNode = applyValueColor(formatNode(props.sodiumInput, 0));

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.surfacePanelDark,
        borderColor: colors.surfacePanelDividerDark,
      }
    ]}>
      {/* Top thick bar */}
      <NutritionLabelDivider variant="thick" />

      {/* Title: "Food" label + input */}
      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <ThemedText
            style={[
              styles.foodLabel,
              { color: colors.textPanelHeaderDark }, // Explicit inline color
            ]}
          >
            {props.titleLabel ?? t('nutrition_label.food_required')}
          </ThemedText>
          <View style={styles.titleInputContainer}>
            {props.titleInput}
          </View>
        </View>
      </View>

      {/* Serving line: "Per Qty [qty] Unit [unit]" */}
      {!props.hideServingRow && (
        <View style={styles.servingRow}>
          <ThemedText
            style={[
              styles.servingText,
              { color: colors.textPanelLabelDark }, // Explicit inline color
            ]}
          >
            {t('nutrition_label.per')}{' '}
          </ThemedText>
          <ThemedText
            style={[
              styles.servingText,
              { color: colors.textPanelLabelDark }, // Explicit inline color
            ]}
          >
            {t('nutrition_label.qty_required')}{' '}
          </ThemedText>
          <View style={styles.servingQuantityContainer}>
            {props.servingQuantityInput}
          </View>
          <ThemedText
            style={[
              styles.servingText,
              { color: colors.textPanelLabelDark }, // Explicit inline color
            ]}
          >
            {' '}{t('nutrition_label.unit_required')}{' '}
          </ThemedText>
          <View style={styles.servingUnitContainer}>
            {props.servingUnitInput}
          </View>
        </View>
      )}

      {/* Medium line under title + serving */}
      <NutritionLabelDivider variant="medium" />

      {/* Calories row */}
      <View style={styles.caloriesRow}>
        <ThemedText
          style={[
            styles.caloriesLabel,
            { color: colors.textPanelHeaderDark }, // Explicit inline color
          ]}
        >
        {props.caloriesLabel ?? t('nutrition_label.calories')}
        </ThemedText>
        <View style={styles.caloriesValueContainer}>
          {caloriesValueNode}
        </View>
      </View>

      {/* Medium line around calories */}
      <NutritionLabelDivider variant="medium" />

      {/* Fat block */}
      <NutritionLabelRow
        label={t('nutrition_label.fat')}
        value={<NutrientValue value={fatValueNode} unit="g" color={macroColors.fat} />}
        bold
        labelColorOverride={macroColors.fat}
      />
      <NutritionLabelRow
        label={t('nutrition_label.saturated')}
        value={<NutrientValue value={satFatValueNode} unit="g" />}
        indentLevel={1}
      />
      <NutritionLabelRow
        label={t('nutrition_label.trans_plus')}
        value={<NutrientValue value={transFatValueNode} unit="g" />}
        indentLevel={1}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Carbohydrate block */}
      <NutritionLabelRow
        label={t('nutrition_label.carbohydrate')}
        value={<NutrientValue value={carbsValueNode} unit="g" color={macroColors.netCarb} />}
        bold
        labelColorOverride={macroColors.netCarb}
      />
      <NutritionLabelRow
        label={t('nutrition_label.fibre')}
        value={<NutrientValue value={fiberValueNode} unit="g" color={macroColors.fiber} />}
        indentLevel={1}
        labelColorOverride={macroColors.fiber}
      />
      <NutritionLabelRow
        label={t('nutrition_label.sugars')}
        value={<NutrientValue value={sugarValueNode} unit="g" />}
        indentLevel={1}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Protein */}
      <NutritionLabelRow
        label={t('nutrition_label.protein')}
        value={<NutrientValue value={proteinValueNode} unit="g" color={macroColors.protein} />}
        bold
        labelColorOverride={macroColors.protein}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Sodium */}
      <NutritionLabelRow
        label={t('nutrition_label.sodium')}
        value={<NutrientValue value={sodiumValueNode} unit="mg" />}
        bold
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // backgroundColor and borderColor set dynamically via inline styles
    borderWidth: Nudge.px1,
    borderRadius: BorderRadius.none,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  divider: {
    marginTop: Nudge.px1,
    width: '100%',
  },
  titleContainer: {
    marginTop: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  foodLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    // color set via inline style
    marginRight: Spacing.sm,
  },
  titleInputContainer: {
    flex: 1,
  },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  servingText: {
    fontSize: FontSize.base,
    // color set via inline style
  },
  servingQuantityContainer: {
    width: Spacing['4xl'],
  },
  servingUnitContainer: {
    flex: 1,
    minWidth: Spacing['6xl'], // 64
    marginLeft: Spacing.sm,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  caloriesLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    // color set via inline style
  },
  caloriesValueContainer: {
    marginLeft: 'auto',
    paddingRight: Spacing.md,
    minWidth: Spacing.lg * 5, // 80
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xxs,
  },
  rowLabel: {
    fontSize: FontSize.base,
    // color set via inline style
    fontWeight: FontWeight.regular,
  },
  rowLabelBold: {
    fontWeight: FontWeight.bold,
  },
  rowLabelIndented: {
    paddingLeft: Spacing.lg,
  },
  rowValueContainer: {
    marginLeft: 'auto',
    paddingRight: Spacing.md,
    minWidth: Spacing.lg * 5, // 80
    alignItems: 'flex-end',
  },
  valueWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  valueInner: {
    minWidth: Spacing['5xl'],
    alignItems: 'flex-end',
  },
  unitText: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm + Nudge.px2,
    marginLeft: Nudge.px2,
  },
});

