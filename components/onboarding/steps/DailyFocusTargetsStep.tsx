import React, { useState, useMemo, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, TextInput, Modal, Dimensions, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle, getInputAccessibilityProps } from '@/utils/accessibility';
import { 
  suggestWeightLossNutrients,
  computeSuggestedTargets,
  computeSliderRange,
  type SuggestedTargets,
} from '@/lib/onboarding/goal-calorie-nutrient-rules';
import { NUTRIENT_TARGETS } from '@/constants/constraints';
import { TargetSlider } from '@/components/inputs/TargetSlider';
import { OnboardingScrollScreen } from '@/components/onboarding/OnboardingScrollScreen';
import { NutrientReferenceModal, type NutrientType } from '@/components/onboarding/nutrient-reference-modal';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface DailyFocusTargetsStepProps {
  goalType: 'lose' | 'gain' | 'maintain' | 'recomp' | '' | null;
  currentWeightLb: number | null;
  targetWeightLb: number | null;
  heightCm: number | null;
  sexAtBirth: 'male' | 'female' | '' | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | '';
  weightUnit: 'kg' | 'lb';
  calorieTarget?: number | null;
  onTargetChange: (targets: DailyFocusTargets) => void;
  onErrorClear: () => void;
  loading: boolean;
  colors: typeof Colors.light;
  stepKey?: string | number; // Used to trigger scroll to top on step change
}

export interface DailyFocusTargets {
  proteinGMin: number;
  fiberGMin: number;
  carbsGMax: number;
  sugarGMax: number;
  sodiumMgMax: number;
}

type ConstraintType = 'min' | 'max' | 'target';

// Breakpoint constants for responsive layout
// Per engineering guidelines: design-specific constants are acceptable with comments
const WIDE_SCREEN_BREAKPOINT = 480; // Breakpoint for 2-column layout
const DESKTOP_BREAKPOINT = 768; // Breakpoint for desktop layout
const CONTENT_MAX_WIDTH = 520; // must match styles.content.maxWidth
const CARD_MIN_WIDTH_WIDE = 280; // must match styles.nutrientCardWide.minWidth

interface TargetStepperProps {
  label: string;
  unit: string;
  suggestedValue: number;
  currentValue: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  colors: typeof Colors.light;
  defaultConstraint?: ConstraintType;
}

const TargetStepper: React.FC<TargetStepperProps> = ({
  label,
  unit,
  suggestedValue,
  currentValue,
  min,
  max,
  step,
  onValueChange,
  disabled = false,
  colors,
  defaultConstraint = 'target',
}) => {
  const [inputValue, setInputValue] = useState(currentValue.toString());
  const [showConstraintModal, setShowConstraintModal] = useState(false);
  const [constraint, setConstraint] = useState<ConstraintType>(defaultConstraint);

  // Update input value when currentValue changes externally
  useEffect(() => {
    setInputValue(currentValue.toString());
  }, [currentValue]);

  const handleIncrement = () => {
    const newValue = Math.min(max, currentValue + step);
    onValueChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, currentValue - step);
    onValueChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleInputChange = (text: string) => {
    // Allow empty string for editing
    if (text === '') {
      setInputValue('');
      return;
    }

    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue === '') {
      setInputValue('');
      return;
    }

    setInputValue(numericValue);
    const numValue = parseInt(numericValue, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      // Round to nearest step
      const steppedValue = Math.round(clampedValue / step) * step;
      onValueChange(steppedValue);
      setInputValue(steppedValue.toString());
    }
  };

  const handleInputBlur = () => {
    // Ensure value is valid on blur
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue) || numValue < min) {
      onValueChange(min);
      setInputValue(min.toString());
    } else if (numValue > max) {
      onValueChange(max);
      setInputValue(max.toString());
    } else {
      const steppedValue = Math.round(numValue / step) * step;
      onValueChange(steppedValue);
      setInputValue(steppedValue.toString());
    }
  };

  const getConstraintBadgeLabel = (): string | null => {
    if (constraint === 'min') return 'Daily Min';
    if (constraint === 'max') return 'Daily Max';
    return null;
  };

  const constraintBadgeLabel = getConstraintBadgeLabel();

  const screenWidth = Dimensions.get('window').width;

  // content is clamped to CONTENT_MAX_WIDTH and also has horizontal padding
  const effectiveContentWidth = Math.min(
    CONTENT_MAX_WIDTH,
    screenWidth - (Spacing.sm * 2) // scrollContent paddingHorizontal
  );

  // only enable 2-column layout when 2 cards can actually fit
  const canFitTwoColumns =
    effectiveContentWidth >= (CARD_MIN_WIDTH_WIDE * 2 + Spacing.md);

  const isWideScreen = screenWidth > WIDE_SCREEN_BREAKPOINT && canFitTwoColumns;

  return (
    <>
      <View style={[
        styles.nutrientCard,
        isWideScreen && styles.nutrientCardWide,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }
      ]}>
        {/* Header Row: Title + Min/Max chip */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text variant="h4" style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {label}
            </Text>
          </View>
          {constraintBadgeLabel && (
            <View style={styles.headerRight}>
              <View style={styles.chipRow}>
                <View style={[styles.constraintBadge, { backgroundColor: colors.border }]}>
                  <Text style={[styles.constraintBadgeText, { color: colors.textSecondary }]}>
                    {constraintBadgeLabel}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Suggested value */}
        <View style={styles.suggestedRow}>
          <Text variant="caption" style={[styles.suggestedText, { color: colors.textSecondary }]}>
            Suggested: {suggestedValue} {unit}
          </Text>
        </View>

        {/* Row B: Input */}
        <View style={styles.cardRowB}>
          <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.numericInput, { color: colors.text }]}
              value={inputValue}
              onChangeText={handleInputChange}
              onBlur={handleInputBlur}
              keyboardType="number-pad"
              editable={!disabled}
              {...getInputAccessibilityProps(
                `${label} input`,
                `Enter ${label} value in ${unit}`,
                undefined,
                true
              )}
            />
            <Text style={[styles.inputUnitSuffix, { color: colors.textSecondary }]}>
              {unit}
            </Text>
          </View>
          <View style={styles.verticalStepper}>
            <TouchableOpacity
              style={[
                styles.stepperButtonCompact,
                { borderColor: colors.border, backgroundColor: colors.background },
                disabled && styles.stepperButtonDisabled,
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={handleIncrement}
              disabled={disabled || currentValue >= max}
              {...getButtonAccessibilityProps(
                `Increase ${label}`,
                `Double tap to increase ${label} by ${step} ${unit}`,
                disabled || currentValue >= max
              )}
            >
              <IconSymbol name="chevron.up" size={16} color={currentValue >= max ? colors.textSecondary : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepperButtonCompact,
                { borderColor: colors.border, backgroundColor: colors.background },
                disabled && styles.stepperButtonDisabled,
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={handleDecrement}
              disabled={disabled || currentValue <= min}
              {...getButtonAccessibilityProps(
                `Decrease ${label}`,
                `Double tap to decrease ${label} by ${step} ${unit}`,
                disabled || currentValue <= min
              )}
            >
              <IconSymbol name="chevron.down" size={16} color={currentValue <= min ? colors.textSecondary : colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row C: Advanced (Constraint button) */}
        <TouchableOpacity
          style={styles.constraintButton}
          onPress={() => setShowConstraintModal(true)}
          disabled={disabled}
          {...getButtonAccessibilityProps(
            'Constraint settings',
            'Double tap to change constraint type',
            disabled
          )}
        >
          <Text style={[styles.constraintButtonText, { color: colors.textSecondary }]}>
            Constraint
          </Text>
          <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Constraint Modal */}
      <Modal
        visible={showConstraintModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowConstraintModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <ThemedText type="title" style={[styles.modalTitle, { color: colors.text }]}>
              {label} Constraint
            </ThemedText>
            <ThemedText style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Choose how this target should be enforced
            </ThemedText>
            
            <View style={styles.constraintOptions}>
              <TouchableOpacity
                style={[
                  styles.constraintOption,
                  { borderColor: constraint === 'min' ? onboardingColors.primary : colors.border, backgroundColor: colors.backgroundSecondary },
                  constraint === 'min' && { borderWidth: 2 },
                ]}
                onPress={() => {
                  setConstraint('min');
                  setShowConstraintModal(false);
                }}
              >
                <Text style={[styles.constraintOptionLabel, { color: colors.text }]}>Minimum</Text>
                <Text style={[styles.constraintOptionDesc, { color: colors.textSecondary }]}>
                  Ensure at least this amount
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.constraintOption,
                  { borderColor: constraint === 'max' ? onboardingColors.primary : colors.border, backgroundColor: colors.backgroundSecondary },
                  constraint === 'max' && { borderWidth: 2 },
                ]}
                onPress={() => {
                  setConstraint('max');
                  setShowConstraintModal(false);
                }}
              >
                <Text style={[styles.constraintOptionLabel, { color: colors.text }]}>Maximum</Text>
                <Text style={[styles.constraintOptionDesc, { color: colors.textSecondary }]}>
                  Stay below this amount
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.constraintOption,
                  { borderColor: constraint === 'target' ? onboardingColors.primary : colors.border, backgroundColor: colors.backgroundSecondary },
                  constraint === 'target' && { borderWidth: 2 },
                ]}
                onPress={() => {
                  setConstraint('target');
                  setShowConstraintModal(false);
                }}
              >
                <Text style={[styles.constraintOptionLabel, { color: colors.text }]}>Target</Text>
                <Text style={[styles.constraintOptionDesc, { color: colors.textSecondary }]}>
                  Aim for this amount
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: onboardingColors.primary }]}
              onPress={() => setShowConstraintModal(false)}
              {...getButtonAccessibilityProps('Close', 'Double tap to close', false)}
            >
              <Text style={[styles.modalCloseButtonText, { color: Colors.light.textInverse }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

interface NutrientTargetSliderCardProps {
  label: string;
  unit: string;
  constraintType: 'min' | 'max' | 'target';
  suggestedValue: number;
  currentValue: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  onResetToRecommended: () => void;
  disabled?: boolean;
  colors: typeof Colors.light;
  formatValue?: (val: number) => string;
  helperText?: string;
  nutrientType: NutrientType;
  onReferencePress: () => void;
}

const NutrientTargetSliderCard: React.FC<NutrientTargetSliderCardProps> = ({
  label,
  unit,
  suggestedValue,
  currentValue,
  min,
  max,
  step,
  onValueChange,
  onResetToRecommended,
  disabled = false,
  colors,
  constraintType = 'target',
  formatValue,
  helperText,
  nutrientType,
  onReferencePress,
}) => {
  const getConstraintBadgeLabel = (): string | null => {
    if (constraintType === 'min') return 'Daily Min';
    if (constraintType === 'max') return 'Daily Max';
    return null;
  };

  const constraintBadgeLabel = getConstraintBadgeLabel();

  const screenWidth = Dimensions.get('window').width;

  // content is clamped to CONTENT_MAX_WIDTH and also has horizontal padding
  const effectiveContentWidth = Math.min(
    CONTENT_MAX_WIDTH,
    screenWidth - (Spacing.sm * 2) // scrollContent paddingHorizontal
  );

  // only enable 2-column layout when 2 cards can actually fit
  const canFitTwoColumns =
    effectiveContentWidth >= (CARD_MIN_WIDTH_WIDE * 2 + Spacing.md);

  const isWideScreen = screenWidth > WIDE_SCREEN_BREAKPOINT && canFitTwoColumns;

  return (
    <View style={[
      styles.nutrientCard,
      isWideScreen && styles.nutrientCardWide,
      { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }
    ]}>
      {/* Header Row: Title + Min/Max chip */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text variant="h4" style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
        {constraintBadgeLabel && (
          <View style={styles.headerRight}>
            <View style={styles.chipRow}>
              <View style={[styles.constraintBadge, { backgroundColor: colors.border }]}>
                <Text style={[styles.constraintBadgeText, { color: colors.textSecondary }]}>
                  {constraintBadgeLabel}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Suggested value with inline Reference */}
      <View style={styles.suggestedRow}>
        <Text variant="caption" style={[styles.suggestedText, { color: colors.textSecondary }]}>
          Suggested: {formatValue ? formatValue(suggestedValue) : suggestedValue.toString()} {unit}
        </Text>
        <TouchableOpacity
          onPress={onReferencePress}
          disabled={disabled}
          style={Platform.OS === 'web' && getFocusStyle(colors.tint)}
          hitSlop={Spacing.sm}
          {...getButtonAccessibilityProps(
            `${label} reference`,
            `Double tap to view ${label} reference information`,
            disabled
          )}
        >
          <Text style={[styles.refText, { color: colors.tint }]}>
            ℹ️ Reference
          </Text>
        </TouchableOpacity>
      </View>

      {/* Slider */}
      <View style={styles.sliderWrapper}>
        <TargetSlider
          value={currentValue}
          min={min}
          max={max}
          step={step}
          unit={unit}
          onChange={onValueChange}
          onResetToRecommended={onResetToRecommended}
          recommendedValue={suggestedValue}
          formatValue={formatValue}
          disabled={disabled}
          colors={colors}
        />
      </View>
    </View>
  );
};

export const DailyFocusTargetsStep: React.FC<DailyFocusTargetsStepProps> = ({
  goalType,
  currentWeightLb,
  targetWeightLb,
  heightCm,
  sexAtBirth,
  activityLevel,
  weightUnit,
  calorieTarget,
  onTargetChange,
  onErrorClear,
  loading,
  colors,
  stepKey,
}) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const [expandedSecondary, setExpandedSecondary] = useState(false);
  const [referenceModal, setReferenceModal] = useState<{ visible: boolean; nutrientType: NutrientType | null }>({
    visible: false,
    nutrientType: null,
  });

  // Breakpoint only used to force a clean relayout when toggling device mode in web devtools
  const layoutKey = useMemo(() => (width < DESKTOP_BREAKPOINT ? 'narrow' : 'wide'), [width]);
  
  const screenWidth = width;
  const effectiveContentWidth = Math.min(
    CONTENT_MAX_WIDTH,
    screenWidth - (Spacing.sm * 2)
  );
  const canFitTwoColumns =
    effectiveContentWidth >= (CARD_MIN_WIDTH_WIDE * 2 + Spacing.md);
  const isWideScreen = screenWidth > WIDE_SCREEN_BREAKPOINT && canFitTwoColumns;

  // Compute suggested targets
  const suggested = useMemo(
    () => computeSuggestedTargets(goalType, currentWeightLb, targetWeightLb, heightCm, sexAtBirth, activityLevel),
    [goalType, currentWeightLb, targetWeightLb, heightCm, sexAtBirth, activityLevel]
  );

  // Track previous goalType to detect goal changes
  const prevGoalTypeRef = React.useRef<typeof goalType>(goalType);
  const hasInitializedRef = React.useRef<boolean>(false);

  // Initialize current values from suggestions - only once or when goal changes
  const [targets, setTargets] = useState<DailyFocusTargets>(() => {
    if (!suggested) {
      return {
        proteinGMin: 100,
        fiberGMin: 28,
        carbsGMax: 200,
        sugarGMax: 40,
        sodiumMgMax: 2300,
      };
    }
    hasInitializedRef.current = true;
    return {
      proteinGMin: suggested.proteinGMin.value,
      fiberGMin: suggested.fiberGMin.value,
      carbsGMax: suggested.carbsGMax.value,
      sugarGMax: suggested.sugarGMax.value,
      sodiumMgMax: suggested.sodiumMgMax.value,
    };
  });

  // Only update targets when goalType changes (not on every suggested change)
  useEffect(() => {
    // Check if goalType actually changed
    if (prevGoalTypeRef.current !== goalType) {
      prevGoalTypeRef.current = goalType;
      // Reset to suggested values when goal changes
      if (suggested) {
        setTargets({
          proteinGMin: suggested.proteinGMin.value,
          fiberGMin: suggested.fiberGMin.value,
          carbsGMax: suggested.carbsGMax.value,
          sugarGMax: suggested.sugarGMax.value,
          sodiumMgMax: suggested.sodiumMgMax.value,
        });
        hasInitializedRef.current = true;
      }
    } else if (!hasInitializedRef.current && suggested) {
      // Initialize once if not already initialized
      setTargets({
        proteinGMin: suggested.proteinGMin.value,
        fiberGMin: suggested.fiberGMin.value,
        carbsGMax: suggested.carbsGMax.value,
        sugarGMax: suggested.sugarGMax.value,
        sodiumMgMax: suggested.sodiumMgMax.value,
      });
      hasInitializedRef.current = true;
    }
  }, [goalType, suggested]);

  // Notify parent of changes (onTargetChange is stable setState from parent)
  useEffect(() => {
    onTargetChange(targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets]);

  if (!suggested) {
    return (
      <View style={styles.stepContentAnimated}>
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.daily_targets.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.daily_targets.error_missing_data')}
        </ThemedText>
      </View>
    );
  }

  const isWeightLoss = goalType === 'lose';
  const isMaintenanceOrRecomp = goalType === 'maintain' || goalType === 'recomp';

  // Helper function to compute slider ranges for each nutrient type
  // For weight loss/gain, uses suggested min/max/step directly (clamped to slider bounds)
  // For maintenance/recomp, computes dynamic ranges
  const getSliderRange = (
    nutrientType: 'protein' | 'fiber' | 'carbs' | 'sugar' | 'sodium',
    recommended: number,
    suggestedRange?: { min: number; max: number; step: number }
  ) => {
    // If we have a suggested range (weight loss/gain), use full slider bounds for protein, fiber, carbs, and sodium
    if (suggestedRange) {
      if (nutrientType === 'protein') {
        // Use full slider bounds, keep step from suggested range
        return {
          min: NUTRIENT_TARGETS.PROTEIN_SLIDER.MIN,
          max: NUTRIENT_TARGETS.PROTEIN_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === 'fiber') {
        // Use full slider bounds, keep step from suggested range
        return {
          min: NUTRIENT_TARGETS.FIBER_SLIDER.MIN,
          max: NUTRIENT_TARGETS.FIBER_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === 'carbs') {
        // Use full slider bounds, keep step from suggested range
        return {
          min: NUTRIENT_TARGETS.CARBS_SLIDER.MIN,
          max: NUTRIENT_TARGETS.CARBS_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === 'sodium') {
        // Use full slider bounds, keep step from suggested range
        return {
          min: NUTRIENT_TARGETS.SODIUM_SLIDER.MIN,
          max: NUTRIENT_TARGETS.SODIUM_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      if (nutrientType === 'sugar') {
        // Use full slider bounds, keep step from suggested range
        return {
          min: NUTRIENT_TARGETS.SUGAR_SLIDER.MIN,
          max: NUTRIENT_TARGETS.SUGAR_SLIDER.MAX,
          step: suggestedRange.step,
        };
      }
      return suggestedRange;
    }

    // Otherwise compute dynamic ranges (maintenance/recomp)
    switch (nutrientType) {
      case 'protein':
        // Protein: use full slider bounds from constraints, step 5
        return { 
          min: NUTRIENT_TARGETS.PROTEIN_SLIDER.MIN, 
          max: NUTRIENT_TARGETS.PROTEIN_SLIDER.MAX, 
          step: 5 
        };
      case 'fiber':
        // Fiber: use full slider bounds from constraints, step 1
        return { 
          min: NUTRIENT_TARGETS.FIBER_SLIDER.MIN, 
          max: NUTRIENT_TARGETS.FIBER_SLIDER.MAX, 
          step: 1 
        };
      case 'carbs':
        // Carbs: use full slider bounds from constraints, step 5
        return { 
          min: NUTRIENT_TARGETS.CARBS_SLIDER.MIN, 
          max: NUTRIENT_TARGETS.CARBS_SLIDER.MAX, 
          step: 5 
        };
      case 'sugar':
        // Sugar: use full slider bounds from constraints, step 5
        return { 
          min: NUTRIENT_TARGETS.SUGAR_SLIDER.MIN, 
          max: NUTRIENT_TARGETS.SUGAR_SLIDER.MAX, 
          step: 5 
        };
      case 'sodium':
        // Sodium: use full slider bounds from constraints, step 50
        return { 
          min: NUTRIENT_TARGETS.SODIUM_SLIDER.MIN, 
          max: NUTRIENT_TARGETS.SODIUM_SLIDER.MAX, 
          step: 50 
        };
      default:
        return { min: Math.max(0, recommended - 50), max: recommended + 50, step: 5 };
    }
  };

  // Nutrient configuration for primary and secondary targets
  type NutrientKey = 'protein' | 'fiber' | 'carbs' | 'sugar' | 'sodium';
  
  interface NutrientConfig {
    key: NutrientKey;
    targetKey: keyof DailyFocusTargets;
    labelKey: string;
    unit: string;
    constraintType: 'min' | 'max' | 'target';
    isPrimary: boolean;
    showCondition?: (isWeightLoss: boolean) => boolean;
  }

  const primaryNutrients: NutrientConfig[] = [
    {
      key: 'protein',
      targetKey: 'proteinGMin',
      labelKey: 'onboarding.daily_targets.protein',
      unit: 'g',
      constraintType: 'min',
      isPrimary: true,
    },
    {
      key: 'fiber',
      targetKey: 'fiberGMin',
      labelKey: 'onboarding.daily_targets.fiber',
      unit: 'g',
      constraintType: 'min',
      isPrimary: true,
    },
    {
      key: 'carbs',
      targetKey: 'carbsGMax',
      labelKey: 'onboarding.daily_targets.carbs',
      unit: 'g',
      constraintType: 'max',
      isPrimary: true,
      showCondition: (isWeightLoss) => isWeightLoss, // Only show in primary for weight loss
    },
  ];

  const secondaryNutrients: NutrientConfig[] = [
    {
      key: 'carbs',
      targetKey: 'carbsGMax',
      labelKey: 'onboarding.daily_targets.carbs',
      unit: 'g',
      constraintType: 'max',
      isPrimary: false,
      showCondition: (isWeightLoss) => !isWeightLoss, // Only show in secondary for non-weight-loss
    },
    {
      key: 'sugar',
      targetKey: 'sugarGMax',
      labelKey: 'onboarding.daily_targets.sugar',
      unit: 'g',
      constraintType: 'max',
      isPrimary: false,
    },
    {
      key: 'sodium',
      targetKey: 'sodiumMgMax',
      labelKey: 'onboarding.daily_targets.sodium',
      unit: 'mg',
      constraintType: 'max',
      isPrimary: false,
    },
  ];

  return (
    <View style={styles.screen}>
      <OnboardingScrollScreen
        key={layoutKey}
        stepKey={stepKey}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.stepContentAnimated}>
            {/* Illustration */}
            <View style={styles.stepIllustration}>
              <View
                style={{
                  width: 172,
                  height: 172,
                  borderRadius: BorderRadius['3xl'],
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${onboardingColors.primary}0F`,
                  ...Shadows.md,
                }}
              >
                <View
                  style={{
                    width: 148,
                    height: 148,
                    borderRadius: BorderRadius['3xl'],
                    // Decorative hero surface: reduce glare in dark mode (do NOT use for inputs/toggles/buttons)
                    backgroundColor: isDark ? colors.illustrationSurfaceDim : colors.background,
                    borderWidth: Spacing.xs,
                    borderColor: isDark ? colors.strokeOnSoftStrong : `${onboardingColors.primary}50`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="target" size={100} color={onboardingColors.primary} />
                </View>
              </View>
            </View>

            {/* Title */}
            <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
              {t('onboarding.daily_targets.title')}
            </ThemedText>
            <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
              {t('onboarding.daily_targets.subtitle')}
            </ThemedText>

            {/* Primary Focus */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={[styles.sectionHeader, { color: colors.text }]}>
                {t('onboarding.daily_targets.primary_focus')}
              </ThemedText>
              <View style={[styles.targetsList, isWideScreen && styles.targetsListWide]}>
                {primaryNutrients
                  .filter((nutrient) => !nutrient.showCondition || nutrient.showCondition(isWeightLoss))
                  .map((nutrient) => {
                    const suggestedData = suggested[nutrient.targetKey as keyof SuggestedTargets] as {
                      value: number;
                      min: number;
                      max: number;
                      step: number;
                    };
                    const currentValue = targets[nutrient.targetKey];
                    const range = getSliderRange(
                      nutrient.key,
                      suggestedData.value,
                      isMaintenanceOrRecomp
                        ? undefined
                        : { min: suggestedData.min, max: suggestedData.max, step: suggestedData.step }
                    );
                    
                    return (
                      <NutrientTargetSliderCard
                        key={nutrient.key}
                        label={t(nutrient.labelKey)}
                        unit={nutrient.unit}
                        constraintType={nutrient.constraintType}
                        suggestedValue={suggestedData.value}
                        currentValue={currentValue}
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        onValueChange={(value) =>
                          setTargets((prev) => ({ ...prev, [nutrient.targetKey]: value } as DailyFocusTargets))
                        }
                        onResetToRecommended={() =>
                          setTargets((prev) => ({ ...prev, [nutrient.targetKey]: suggestedData.value } as DailyFocusTargets))
                        }
                        disabled={loading}
                        colors={colors}
                        nutrientType={nutrient.key}
                        onReferencePress={() => setReferenceModal({ visible: true, nutrientType: nutrient.key })}
                      />
                    );
                  })}
              </View>
            </View>

            {/* Secondary Targets (Collapsible) */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setExpandedSecondary(!expandedSecondary)}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  expandedSecondary ? 'Collapse secondary targets' : 'Expand secondary targets',
                  'Double tap to expand or collapse secondary targets',
                  loading
                )}
              >
                <ThemedText type="subtitle" style={[styles.sectionHeader, { color: colors.text }]}>
                  {t('onboarding.daily_targets.secondary_targets')}
                </ThemedText>
                <IconSymbol
                  name={expandedSecondary ? 'chevron.up' : 'chevron.down'}
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              {expandedSecondary && (
                <View style={[styles.targetsList, isWideScreen && styles.targetsListWide]}>
                  {secondaryNutrients
                    .filter((nutrient) => !nutrient.showCondition || nutrient.showCondition(isWeightLoss))
                    .map((nutrient) => {
                      const suggestedData = suggested[nutrient.targetKey as keyof SuggestedTargets] as {
                        value: number;
                        min: number;
                        max: number;
                        step: number;
                      };
                      const currentValue = targets[nutrient.targetKey];
                      const range = getSliderRange(
                        nutrient.key,
                        suggestedData.value,
                        isMaintenanceOrRecomp
                          ? undefined
                          : { min: suggestedData.min, max: suggestedData.max, step: suggestedData.step }
                      );
                      
                      return (
                        <NutrientTargetSliderCard
                          key={nutrient.key}
                          label={t(nutrient.labelKey)}
                          unit={nutrient.unit}
                          constraintType={nutrient.constraintType}
                          suggestedValue={suggestedData.value}
                          currentValue={currentValue}
                          min={range.min}
                          max={range.max}
                          step={range.step}
                          onValueChange={(value) =>
                            setTargets((prev) => ({ ...prev, [nutrient.targetKey]: value } as DailyFocusTargets))
                          }
                          onResetToRecommended={() =>
                            setTargets((prev) => ({ ...prev, [nutrient.targetKey]: suggestedData.value } as DailyFocusTargets))
                          }
                          disabled={loading}
                          colors={colors}
                          nutrientType={nutrient.key}
                          onReferencePress={() => setReferenceModal({ visible: true, nutrientType: nutrient.key })}
                        />
                      );
                    })}
                </View>
              )}
            </View>
          </View>
        </View>
      </OnboardingScrollScreen>

      {/* Nutrient Reference Modal */}
      {referenceModal.nutrientType && (
        <NutrientReferenceModal
          visible={referenceModal.visible}
          onClose={() => setReferenceModal({ visible: false, nutrientType: null })}
          nutrientType={referenceModal.nutrientType}
          sexAtBirth={sexAtBirth}
          colors={colors}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Critical on web: flexGrow + alignItems centers the column reliably
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.sm,
    paddingBottom: 24,
    alignItems: 'center',
  },
  // Clamp + fill column
  content: {
    width: '100%',
    maxWidth: 520,
  },
  stepContentAnimated: {
    gap: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.sm,
    ...Platform.select({
      web: {
        animationKeyframes: {
          from: { opacity: 0, transform: `translateY(${Spacing.md}px)` },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animationDuration: '0.3s',
        animationTimingFunction: 'ease',
        animationFillMode: 'both',
      },
      default: {
        opacity: 1,
      },
    }),
  },
  stepIllustration: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  stepTitleModern: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitleModern: {
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
    lineHeight: FontSize.md * LineHeight.normal,
  },
  calorieInfo: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * LineHeight.normal,
    fontStyle: 'italic',
  },
  section: {
    marginTop: Spacing.xs,
    gap: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  targetsList: {
    gap: Spacing.md,
  },
  targetsListWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nutrientCardWide: {
    width: '48%',
    // Minimum width for wide cards to maintain readability
    // This is a design-specific constant, not a theme value
    minWidth: 280,
  },
  nutrientCard: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0, // CRITICAL on web: allows text to shrink instead of pushing layout
  },
  title: {
    fontSize: FontSize.base + 2,
    fontWeight: FontWeight.semibold,
    flexShrink: 1, // allow wrapping only if truly necessary
  },
  headerRight: {
    alignItems: 'flex-end', // pin chip to the far right
    flexShrink: 0,
  },
  chipRow: {
    alignSelf: 'flex-end',
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 0,
  },
  suggestedText: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  refText: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  constraintBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  constraintBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  cardRowB: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  // Constrain the slider to the padded area with overflow clipping
  sliderWrapper: {
    width: '100%',
    paddingHorizontal: 4, // small inset so the thumb never touches the edge
    overflow: 'hidden', // CRITICAL: prevents track poking through rounded corners
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  numericInput: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    padding: 0, // Remove default padding
    textAlign: 'left',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
      default: {},
    }),
  },
  inputUnitSuffix: {
    fontSize: FontSize.base,
    marginLeft: Spacing.xs,
    fontWeight: FontWeight.regular,
  },
  verticalStepper: {
    flexDirection: 'column',
    gap: Spacing.xs,
  },
  stepperButtonCompact: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any,
      default: {},
    }),
  },
  stepperButtonDisabled: {
    opacity: 0.5,
  },
  cardRowC: {
    marginTop: Spacing.xs,
  },
  constraintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  constraintButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    ...Platform.select({
      web: {
        justifyContent: 'center',
        alignItems: 'center',
      },
      default: {},
    }),
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing['2xl'],
    maxHeight: '80%',
    ...Shadows.lg,
    ...Platform.select({
      web: {
        borderRadius: BorderRadius.xl,
        // Modal max width: design-specific constant for optimal readability
        maxWidth: 400,
        maxHeight: '90%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      } as any,
      default: {},
    }),
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  constraintOptions: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  constraintOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  constraintOptionLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  constraintOptionDesc: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  modalCloseButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  modalCloseButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});

