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
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { DashboardAccents, Colors } from '@/constants/theme';
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
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={styles.valueWithUnit}>
      <View style={styles.valueInner}>{value}</View>
      {unit ? (
        <ThemedText
          style={styles.unitText}
          lightColor={color ?? '#000000'}
          darkColor={color ?? colors.textPanelValueDark}
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
  const isDark = colorScheme === 'dark';
  const borderWidth =
    variant === 'thick' ? 3 : variant === 'medium' ? 2 : 1;

  return (
    <View
      style={[
        styles.divider,
        { 
          borderTopWidth: borderWidth, 
          borderTopColor: isDark ? colors.surfacePanelDividerDark : '#000000' 
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
  const isDark = colorScheme === 'dark';
  
  // Section headers (bold) use textPanelHeaderDark, sub-labels use textPanelLabelDark
  const labelColor = labelColorOverride ?? (isDark 
    ? (bold ? colors.textPanelHeaderDark : colors.textPanelLabelDark)
    : '#000000');
  
  return (
    <View style={[styles.row, isDark && { opacity: 1 }]}>
      <ThemedText
        style={[
          styles.rowLabel,
          bold && styles.rowLabelBold,
          indentLevel === 1 && styles.rowLabelIndented,
          { color: labelColor }, // Explicit inline color override
        ]}
        lightColor="#000000"
        darkColor={labelColor}
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
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
      // In light mode, leave values as-is unless explicitly overridden.
      // In dark mode, default to panel value color unless explicitly overridden.
      ...(overrideColor ? [{ color: overrideColor }] : isDark ? [{ color: colors.textPanelValueDark }] : []),
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

  // Apply the calories accent color recursively to any element tree
  const applyCaloriesColor = (node: React.ReactNode): React.ReactNode => {
    // Calories can remain with accent color even in dark mode
    if (!React.isValidElement(node)) return node;

    const normalizeStyle = (styleProp: any) => {
      if (Array.isArray(styleProp)) return styleProp.filter(Boolean);
      return styleProp ? [styleProp] : [];
    };

    const propsAny: any = node.props || {};

    const mergedStyle = [
      ...normalizeStyle((node.props as any)?.style),
      styles.caloriesValueText,
    ];

    const clonedProps: any = {
      ...propsAny,
      style: mergedStyle,
    };

    if (propsAny && propsAny.children !== undefined) {
      clonedProps.children = React.Children.map(propsAny.children, (child) =>
        applyCaloriesColor(child)
      );
    }

    return React.cloneElement(node as any, clonedProps);
  };

  const caloriesValueNode = applyCaloriesColor(formatNode(props.caloriesInput, 0));
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
        backgroundColor: isDark ? colors.surfacePanelDark : '#FFFFFF',
        borderColor: isDark ? colors.surfacePanelDividerDark : '#000000',
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
              { color: isDark ? colors.textPanelHeaderDark : '#000000' }, // Explicit inline color
            ]}
            lightColor="#000000"
            darkColor={colors.textPanelHeaderDark}
          >
            {props.titleLabel ?? 'Food *'}
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
              { color: isDark ? colors.textPanelLabelDark : '#000000' }, // Explicit inline color
            ]}
            lightColor="#000000"
            darkColor={colors.textPanelLabelDark}
          >
            Per{' '}
          </ThemedText>
          <ThemedText
            style={[
              styles.servingText,
              { color: isDark ? colors.textPanelLabelDark : '#000000' }, // Explicit inline color
            ]}
            lightColor="#000000"
            darkColor={colors.textPanelLabelDark}
          >
            Qty *{' '}
          </ThemedText>
          <View style={styles.servingQuantityContainer}>
            {props.servingQuantityInput}
          </View>
          <ThemedText
            style={[
              styles.servingText,
              { color: isDark ? colors.textPanelLabelDark : '#000000' }, // Explicit inline color
            ]}
            lightColor="#000000"
            darkColor={colors.textPanelLabelDark}
          >
            {' '}Unit *{' '}
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
            { color: isDark ? colors.textPanelHeaderDark : '#000000' }, // Explicit inline color
          ]}
          lightColor="#000000"
          darkColor={colors.textPanelHeaderDark}
        >
        {props.caloriesLabel ?? 'Calories'}
        </ThemedText>
        <View style={styles.caloriesValueContainer}>
          {caloriesValueNode}
        </View>
      </View>

      {/* Medium line around calories */}
      <NutritionLabelDivider variant="medium" />

      {/* Fat block */}
      <NutritionLabelRow
        label="Fat"
        value={<NutrientValue value={fatValueNode} unit="g" color={macroColors.fat} />}
        bold
        labelColorOverride={macroColors.fat}
      />
      <NutritionLabelRow
        label="Saturated"
        value={<NutrientValue value={satFatValueNode} unit="g" />}
        indentLevel={1}
      />
      <NutritionLabelRow
        label="+ Trans"
        value={<NutrientValue value={transFatValueNode} unit="g" />}
        indentLevel={1}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Carbohydrate block */}
      <NutritionLabelRow
        label="Carbohydrate"
        value={<NutrientValue value={carbsValueNode} unit="g" color={macroColors.netCarb} />}
        bold
        labelColorOverride={macroColors.netCarb}
      />
      <NutritionLabelRow
        label="Fibre"
        value={<NutrientValue value={fiberValueNode} unit="g" color={macroColors.fiber} />}
        indentLevel={1}
        labelColorOverride={macroColors.fiber}
      />
      <NutritionLabelRow
        label="Sugars"
        value={<NutrientValue value={sugarValueNode} unit="g" />}
        indentLevel={1}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Protein */}
      <NutritionLabelRow
        label="Protein"
        value={<NutrientValue value={proteinValueNode} unit="g" color={macroColors.protein} />}
        bold
        labelColorOverride={macroColors.protein}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Sodium */}
      <NutritionLabelRow
        label="Sodium"
        value={<NutrientValue value={sodiumValueNode} unit="mg" />}
        bold
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // backgroundColor and borderColor set dynamically via inline styles
    borderWidth: 1.5,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  divider: {
    marginTop: 1,
    width: '100%',
  },
  titleContainer: {
    marginTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  foodLabel: {
    fontSize: 16,
    fontWeight: '700',
    // color set via inline style
    marginRight: 8,
  },
  titleInputContainer: {
    flex: 1,
  },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  servingText: {
    fontSize: 14,
    // color set via inline style
  },
  servingQuantityContainer: {
    width: 40,
  },
  servingUnitContainer: {
    flex: 1,
    minWidth: 60,
    marginLeft: 8,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  caloriesLabel: {
    fontSize: 16,
    fontWeight: '700',
    // color set via inline style
  },
  caloriesValueContainer: {
    marginLeft: 'auto',
    paddingRight: 12,
    minWidth: 80,
    alignItems: 'flex-end',
    color: DashboardAccents.food,
  },
  caloriesValueText: {
    color: DashboardAccents.food,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    // opacity set via inline style in dark mode to ensure no dimming
  },
  rowLabel: {
    fontSize: 14,
    // color set via inline style
    fontWeight: '400',
  },
  rowLabelBold: {
    fontWeight: '700',
  },
  rowLabelIndented: {
    paddingLeft: 16,
  },
  rowValueContainer: {
    marginLeft: 'auto',
    paddingRight: 12,
    minWidth: 80,
    alignItems: 'flex-end',
  },
  valueWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  valueInner: {
    minWidth: 48,
    alignItems: 'flex-end',
  },
  unitText: {
    fontSize: 12,
    lineHeight: 14,
    marginLeft: 2,
  },
});

