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
import { View, Text, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';

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
  /** Food name input (title) */
  titleInput: React.ReactNode;
  /** Quantity input for serving */
  servingQuantityInput: React.ReactNode;
  /** Unit input for serving */
  servingUnitInput: React.ReactNode;
  /** Hide the serving row (Per, Qty, Unit) */
  hideServingRow?: boolean;
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
            Food
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
            Qty{' '}
          </ThemedText>
          <View style={styles.servingQuantityContainer}>
            {props.servingQuantityInput}
          </View>
          <ThemedText
            style={styles.servingText}
            lightColor="#000000"
            darkColor="#000000"
          >
            {' '}Unit{' '}
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
          Calories
        </ThemedText>
        <View style={styles.caloriesValueContainer}>
          {props.caloriesInput}
        </View>
      </View>

      {/* Medium line around calories */}
      <NutritionLabelDivider variant="medium" />

      {/* Fat block */}
      <NutritionLabelRow
        label="Fat"
        value={props.fatInput}
        bold
      />
      <NutritionLabelRow
        label="Saturated"
        value={props.satFatInput}
        indentLevel={1}
      />
      <NutritionLabelRow
        label="+ Trans"
        value={props.transFatInput}
        indentLevel={1}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Carbohydrate block */}
      <NutritionLabelRow
        label="Carbohydrate"
        value={props.carbsInput}
        bold
      />
      <NutritionLabelRow
        label="Fibre"
        value={props.fiberInput}
        indentLevel={1}
      />
      <NutritionLabelRow
        label="Sugars"
        value={props.sugarInput}
        indentLevel={1}
      />
      <NutritionLabelDivider variant="thin" />

      {/* Protein */}
      <NutritionLabelRow
        label="Protein"
        value={props.proteinInput}
        bold
      />
      <NutritionLabelDivider variant="thin" />

      {/* Sodium */}
      <NutritionLabelRow
        label="Sodium"
        value={props.sodiumInput}
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
    fontSize: 14,
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
    fontSize: 12,
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
    marginRight:60,
  },
  caloriesLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    
  },
  caloriesValueContainer: {
    alignItems: 'flex-end',
    
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    
  },
  rowLabel: {
    fontSize: 12,
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
    marginRight: 80,
    width: 32,
    alignItems: 'flex-end',
  },
});

