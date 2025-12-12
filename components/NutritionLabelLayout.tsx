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
import { DashboardAccents } from '@/constants/theme';

type NutrientValueProps = {
  value: React.ReactNode;
  unit?: 'g' | 'mg';
};

function NutrientValue({ value, unit }: NutrientValueProps) {
  return (
    <View style={styles.valueWithUnit}>
      <View style={styles.valueInner}>{value}</View>
      {unit ? (
        <ThemedText
          style={styles.unitText}
          lightColor="#000000"
          darkColor="#000000"
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
  const borderWidth =
    variant === 'thick' ? 3 : variant === 'medium' ? 2 : 1;

  return (
    <View
      style={[
        styles.divider,
        { borderTopWidth: borderWidth, borderTopColor: '#000000' },
      ]}
    />
  );
}

type NutritionLabelRowProps = {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  indentLevel?: 0 | 1;
};

function NutritionLabelRow({
  label,
  value,
  bold = false,
  indentLevel = 0,
}: NutritionLabelRowProps) {
  return (
    <View style={styles.row}>
      <ThemedText
        style={[
          styles.rowLabel,
          bold && styles.rowLabelBold,
          indentLevel === 1 && styles.rowLabelIndented,
        ]}
        lightColor="#000000"
        darkColor="#000000"
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

  // Apply the calories accent color recursively to any element tree
  const applyCaloriesColor = (node: React.ReactNode): React.ReactNode => {
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
  const fatValueNode = formatNode(props.fatInput, 1);
  const satFatValueNode = formatNode(props.satFatInput, 1);
  const transFatValueNode = formatNode(props.transFatInput, 1);
  const carbsValueNode = formatNode(props.carbsInput, 0);
  const fiberValueNode = formatNode(props.fiberInput, 1);
  const sugarValueNode = formatNode(props.sugarInput, 1);
  const proteinValueNode = formatNode(props.proteinInput, 0);
  const sodiumValueNode = formatNode(props.sodiumInput, 0);

  return (
    <View style={styles.container}>
      {/* Top thick bar */}
      <NutritionLabelDivider variant="thick" />

      {/* Title: "Food" label + input */}
      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <ThemedText
            style={styles.foodLabel}
            lightColor="#000000"
            darkColor="#000000"
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
            style={styles.servingText}
            lightColor="#000000"
            darkColor="#000000"
          >
            Per{' '}
          </ThemedText>
          <ThemedText
            style={styles.servingText}
            lightColor="#000000"
            darkColor="#000000"
          >
            Qty *{' '}
          </ThemedText>
          <View style={styles.servingQuantityContainer}>
            {props.servingQuantityInput}
          </View>
          <ThemedText
            style={styles.servingText}
            lightColor="#000000"
            darkColor="#000000"
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
          style={styles.caloriesLabel}
          lightColor="#000000"
          darkColor="#000000"
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
        value={<NutrientValue value={fatValueNode} unit="g" />}
        bold
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
        value={<NutrientValue value={carbsValueNode} unit="g" />}
        bold
      />
      <NutritionLabelRow
        label="Fibre"
        value={<NutrientValue value={fiberValueNode} unit="g" />}
        indentLevel={1}
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
        value={<NutrientValue value={proteinValueNode} unit="g" />}
        bold
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
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
    color: '#000000',
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
    color: '#000000',
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
    color: '#000000',
    
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
    
  },
  rowLabel: {
    fontSize: 14,
    color: '#000000',
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

