import React, { useState, useMemo, useEffect } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet, Platform, Modal, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ageFromDob } from '@/utils/calculations';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import {
  computeMaintenanceRange,
  getBaselineDeficitPlans,
  formatDateForDisplay,
  computePaceAndEta,
  HARD_HARD_STOP,
  HARD_FLOOR,
  roundDownTo25,
  suggestCaloriePlans,
  getWeightLossCalorieWarning,
  CALORIES_PER_LB,
  caloriesFromLbPerWeek,
  type SuggestedCaloriePlan,
} from '@/lib/onboarding/goal-calorie-nutrient-rules';
import ActivityLevelModal from './ActivityLevelModal';

interface DailyCalorieTargetStepProps {
  goalType: 'lose' | 'gain' | 'maintain' | 'recomp' | '' | null;
  currentWeightLb: number | null;
  targetWeightLb: number | null;
  heightCm: number | null;
  sexAtBirth: 'male' | 'female' | '' | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | '';
  dobISO: string | null;
  bodyFatPercent: number | null;
  weightUnit: 'kg' | 'lb';
  heightUnit: 'cm' | 'ft/in';
  firstName?: string | null;
  onCalorieTargetChange: (target: {
    calorieTarget: number;
    maintenanceCalories: number;
    caloriePlan: string;
    executionMode?: 'override';
  }) => void;
  onActivityLevelChange?: (level: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high') => void;
  onErrorClear: () => void;
  loading: boolean;
  colors: typeof Colors.light;
  mode?: 'onboarding' | 'edit';
  savedCalorieTarget?: number | null;
}

interface CalorieStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  colors: typeof Colors.light;
}

const CalorieStepper: React.FC<CalorieStepperProps> = ({
  value,
  min,
  max,
  step,
  onValueChange,
  disabled = false,
  colors,
}) => {
  const handleIncrement = () => {
    const clamped = Math.max(min, Math.min(max, value + step));
    const next = Math.max(min, roundDownTo25(clamped));
    onValueChange(next);
  };

  const handleDecrement = () => {
    const clamped = Math.max(min, Math.min(max, value - step));
    const next = Math.max(min, roundDownTo25(clamped));
    onValueChange(next);
  };

  return (
    <View style={styles.stepperContainer}>
      <TouchableOpacity
        style={[
          styles.stepperButton,
          { borderColor: colors.border, backgroundColor: colors.background },
          disabled && styles.stepperButtonDisabled,
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        onPress={handleDecrement}
        disabled={disabled || value <= min}
        {...getButtonAccessibilityProps(
          'Decrease calories',
          `Double tap to decrease by ${step} cal`,
          disabled || value <= min
        )}
      >
        <IconSymbol name="chevron.down" size={20} color={value <= min ? colors.textSecondary : colors.text} />
      </TouchableOpacity>
      <View style={[styles.valueContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text variant="h4" style={[styles.valueText, { color: colors.text }]}>
          {value}
        </Text>
        <Text variant="caption" style={[styles.unitText, { color: colors.textSecondary }]}>
          cal/day
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.stepperButton,
          { borderColor: colors.border, backgroundColor: colors.background },
          disabled && styles.stepperButtonDisabled,
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        onPress={handleIncrement}
        disabled={disabled || value >= max}
        {...getButtonAccessibilityProps(
          'Increase calories',
          `Double tap to increase by ${step} cal`,
          disabled || value >= max
        )}
      >
        <IconSymbol name="chevron.up" size={20} color={value >= max ? colors.textSecondary : colors.text} />
      </TouchableOpacity>
    </View>
  );
};

export const DailyCalorieTargetStep: React.FC<DailyCalorieTargetStepProps> = ({
  goalType,
  currentWeightLb,
  targetWeightLb,
  heightCm,
  sexAtBirth,
  activityLevel,
  dobISO,
  bodyFatPercent,
  weightUnit,
  onCalorieTargetChange,
  onActivityLevelChange,
  onErrorClear,
  loading,
  colors,
  mode = 'onboarding',
  savedCalorieTarget = null,
}) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const [showActivityModal, setShowActivityModal] = useState(false);

  type CaloriePlanKey =
    | 'moreSustainable'
    | 'standard'
    | 'aggressive'
    | 'cautiousMinimum'
    | 'sustainable_floor_1200'
    | 'maintain_leaner'
    | 'maintain_standard'
    | 'maintain_flexible'
    | 'recomp_leaner'
    | 'recomp_standard'
    | 'recomp_muscle'
    | 'gain_lean'
    | 'gain_standard'
    | 'gain_aggressive'
    | 'custom';

  const [selectedPlan, setSelectedPlan] = useState<CaloriePlanKey | null>(null);
  const [customCalories, setCustomCalories] = useState<number | null>(null);
  const [showCustomWarningModal, setShowCustomWarningModal] = useState(false);
  const [executionMode, setExecutionMode] = useState<'override' | undefined>(undefined);

  const isWeightLossPresetKey = (
    key: CaloriePlanKey
  ): key is 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'sustainable_floor_1200' =>
    key === 'moreSustainable' || key === 'standard' || key === 'aggressive' || key === 'cautiousMinimum' || key === 'sustainable_floor_1200';

  // Compute calculations if weight loss goal
  const isWeightLoss = goalType === 'lose';
  const isMaintain = goalType === 'maintain';
  const isRecomp = goalType === 'recomp';
  const isGain = goalType === 'gain';
  const isNonLoss = isMaintain || isRecomp || isGain;

  // Gain preset pace definitions (pace-first approach)
  const GAIN_PRESET_PACES: Record<string, number> = {
    gain_lean: 0.4,
    gain_standard: 0.6,
    gain_aggressive: 1.3,
  };

  // Compute maintenance range for all goals (needed for BMR and activity display)
  const maintenanceRange = useMemo(() => {
    if (!currentWeightLb || !heightCm || !sexAtBirth || !activityLevel || !dobISO) {
      return null;
    }

    const ageYears = ageFromDob(dobISO);
    const weightKg = lbToKg(currentWeightLb);

    return computeMaintenanceRange({
      sexAtBirth: sexAtBirth as 'male' | 'female' | 'unknown',
      ageYears,
      heightCm,
      weightKg,
      bodyFatPct: bodyFatPercent,
      activityLevel,
    });
  }, [currentWeightLb, heightCm, sexAtBirth, activityLevel, dobISO, bodyFatPercent]);

  const calculations = useMemo(() => {
    if (!isWeightLoss || !maintenanceRange) {
      return null;
    }

    // Get baseline deficit plans (new implementation)
    const plans = getBaselineDeficitPlans({
      currentWeightLb,
      targetWeightLb,
      maintenanceLow: maintenanceRange.lowerMaintenance,
      maintenanceHigh: maintenanceRange.upperMaintenance,
      sexAtBirth: sexAtBirth as 'male' | 'female' | 'unknown',
    });

      return {
        plans,
      };
  }, [isWeightLoss, maintenanceRange, currentWeightLb, targetWeightLb, sexAtBirth]);

  const nonLossSuggestions = useMemo(() => {
    if (!isNonLoss || !currentWeightLb || !heightCm || !sexAtBirth || !activityLevel || !dobISO) {
      return null;
    }

    const ageYears = ageFromDob(dobISO);
    const weightKg = lbToKg(currentWeightLb);

    return suggestCaloriePlans({
      goalType: goalType as 'maintain' | 'recomp' | 'gain',
      sexAtBirth: sexAtBirth as 'male' | 'female' | 'unknown',
      ageYears,
      heightCm,
      weightKg,
      bodyFatPct: bodyFatPercent,
      activityLevel,
      currentWeightLb,
      targetWeightLb,
    });
  }, [isNonLoss, goalType, currentWeightLb, targetWeightLb, heightCm, sexAtBirth, activityLevel, dobISO, bodyFatPercent]);

  // Get current calorie target
  const currentCalorieTarget = useMemo(() => {
    if (!selectedPlan) return null;

    if (selectedPlan === 'custom' && customCalories !== null) {
      return customCalories;
    }

    if (isWeightLoss && calculations && selectedPlan !== 'custom' && isWeightLossPresetKey(selectedPlan)) {
      const plan = calculations.plans.plans[selectedPlan];
      // Type guard: check if it's a BaselinePlan (has isVisible property)
      if (plan && 'isVisible' in plan && plan.isVisible && plan.isSelectable && plan.caloriesPerDay !== null) {
        return plan.caloriesPerDay;
      }
    }

    if (isNonLoss && nonLossSuggestions && selectedPlan !== 'custom') {
      const plan = nonLossSuggestions.plans.find((p) => p.key === selectedPlan);
      if (plan && plan.isSelectable && isFinite(plan.caloriesPerDay) && plan.caloriesPerDay >= HARD_HARD_STOP) {
        return plan.caloriesPerDay;
      }
    }

    // Fallback to custom if selected plan is not available
    if (selectedPlan !== 'custom' && customCalories !== null) {
      return customCalories;
    }

    return null;
  }, [calculations, nonLossSuggestions, isWeightLoss, isNonLoss, selectedPlan, customCalories]);

  // Initialize default selection and custom calories
  useEffect(() => {
    if (calculations && selectedPlan === null) {
      // Set default plan from rules
      if (calculations.plans.defaultPlan) {
        setSelectedPlan(calculations.plans.defaultPlan as CaloriePlanKey);
        // The onCalorieTargetChange will be called by the other useEffect when currentCalorieTarget is computed
      }
    }
    if (nonLossSuggestions && selectedPlan === null) {
      setSelectedPlan(nonLossSuggestions.defaultPlanKey as CaloriePlanKey);
    }
    // Initialize customCalories always (not just when custom is selected) so expanded UI can render
    if (customCalories === null && calculations) {
      // Default to standard plan calories if available, else more sustainable, else aggressive, else maintenance
      let defaultCalories: number;
      if (calculations.plans.plans.standard.isVisible && calculations.plans.plans.standard.caloriesPerDay !== null) {
        defaultCalories = calculations.plans.plans.standard.caloriesPerDay;
      } else if (calculations.plans.plans.moreSustainable.isVisible && calculations.plans.plans.moreSustainable.caloriesPerDay !== null) {
        defaultCalories = calculations.plans.plans.moreSustainable.caloriesPerDay;
      } else if (calculations.plans.plans.aggressive.isVisible && calculations.plans.plans.aggressive.caloriesPerDay !== null) {
        defaultCalories = calculations.plans.plans.aggressive.caloriesPerDay;
      } else {
        // Fallback to maintenance calories
        defaultCalories = maintenanceRange?.lowerMaintenance ?? HARD_HARD_STOP;
      }
      // Never allow below 700, even for pre-fill
      const clampedCalories = Math.max(HARD_HARD_STOP, roundDownTo25(defaultCalories));
      setCustomCalories(clampedCalories);
    }
    if (customCalories === null && nonLossSuggestions) {
      const defaultPlan = nonLossSuggestions.plans.find((p) => p.key === nonLossSuggestions.defaultPlanKey);
      const defaultCalories = defaultPlan?.caloriesPerDay ?? nonLossSuggestions.maintenance.mid;
      // Never allow below 700, even for pre-fill
      const clampedCalories = Math.max(HARD_HARD_STOP, roundDownTo25(defaultCalories));
      setCustomCalories(clampedCalories);
    }
  }, [selectedPlan, customCalories, calculations, nonLossSuggestions]);

  // Clear selected plan if it becomes unselectable
  useEffect(() => {
    if (isWeightLoss && calculations && selectedPlan && selectedPlan !== 'custom' && isWeightLossPresetKey(selectedPlan)) {
      const plan = calculations.plans.plans[selectedPlan];
      // Type guard: check if it's a BaselinePlan (has isSelectable property)
      if (plan && 'isSelectable' in plan && !plan.isSelectable) {
        // Fallback to default plan or custom
        if (calculations.plans.defaultPlan) {
          setSelectedPlan(calculations.plans.defaultPlan as CaloriePlanKey);
        } else {
          setSelectedPlan('custom');
        }
      }
    }
    if (nonLossSuggestions && selectedPlan && selectedPlan !== 'custom') {
      const plan = nonLossSuggestions.plans.find((p) => p.key === selectedPlan);
      if (plan && !plan.isSelectable) {
        setSelectedPlan(nonLossSuggestions.defaultPlanKey as CaloriePlanKey);
      }
    }
  }, [calculations, nonLossSuggestions, selectedPlan]);

  // Compute canProceed validation
  const canProceed = useMemo(() => {
    if (!selectedPlan) return false;

    if (selectedPlan === 'custom') {
      // Custom: must have valid calories >= HARD_HARD_STOP
      return customCalories !== null && 
             isFinite(customCalories) && 
             customCalories >= HARD_HARD_STOP;
    }

    if (isWeightLoss && calculations && isWeightLossPresetKey(selectedPlan)) {
      // Preset plan: must have valid calories from plan
      const plan = calculations.plans.plans[selectedPlan];
      if (!plan || !('isVisible' in plan) || !plan.isVisible || !plan.isSelectable) {
        return false;
      }
      const planCalories = plan.caloriesPerDay;
      return planCalories !== null && 
             isFinite(planCalories) && 
             planCalories >= HARD_HARD_STOP;
    }

    if (isNonLoss && nonLossSuggestions) {
      const plan = nonLossSuggestions.plans.find((p) => p.key === selectedPlan);
      return Boolean(
        plan &&
          plan.isSelectable &&
          isFinite(plan.caloriesPerDay) &&
          plan.caloriesPerDay >= HARD_HARD_STOP
      );
    }

    return false;
  }, [calculations, nonLossSuggestions, isWeightLoss, isNonLoss, selectedPlan, customCalories]);

  // Notify parent of changes
  useEffect(() => {
    if (currentCalorieTarget !== null && calculations && selectedPlan !== null) {
      // Map new plan keys to legacy keys for backward compatibility
      let legacyPlanKey: string;
      if (selectedPlan === 'custom') {
        legacyPlanKey = 'custom';
      } else if (selectedPlan === 'moreSustainable') {
        legacyPlanKey = 'sustainable';
      } else if (selectedPlan === 'standard') {
        legacyPlanKey = 'sustainable'; // Standard maps to sustainable for now
      } else if (selectedPlan === 'aggressive') {
        legacyPlanKey = 'accelerated';
      } else if (selectedPlan === 'cautiousMinimum') {
        legacyPlanKey = 'sustainable'; // Cautious minimum maps to sustainable
      } else {
        legacyPlanKey = 'custom';
      }

      onCalorieTargetChange({
        calorieTarget: currentCalorieTarget,
        maintenanceCalories: maintenanceRange?.lowerMaintenance ?? 0,
        caloriePlan: legacyPlanKey,
        executionMode,
      });
    }
  }, [currentCalorieTarget, calculations, selectedPlan, executionMode, onCalorieTargetChange]);

  useEffect(() => {
    if (currentCalorieTarget !== null && nonLossSuggestions && selectedPlan !== null) {
      onCalorieTargetChange({
        calorieTarget: currentCalorieTarget,
        maintenanceCalories: nonLossSuggestions.maintenance.mid,
        caloriePlan: selectedPlan,
        executionMode: undefined,
      });
    }
  }, [currentCalorieTarget, nonLossSuggestions, selectedPlan, onCalorieTargetChange]);

  // Check if custom calories exceed lowerMaintenance and show warning
  const handleCustomCaloriesChange = (newValue: number) => {
    const minBound = Math.max(
      HARD_HARD_STOP,
      isWeightLoss
        ? calculations?.plans.plans.custom.min ?? HARD_HARD_STOP
        : nonLossSuggestions?.custom.min ?? HARD_HARD_STOP
    );
    const maxBound = isWeightLoss
      ? calculations?.plans.plans.custom.max ?? HARD_HARD_STOP
      : nonLossSuggestions?.custom.max ?? HARD_HARD_STOP;

    const clamped = Math.max(minBound, Math.min(maxBound, newValue));
    const next = Math.max(minBound, roundDownTo25(clamped));

    // Select custom plan when stepper buttons are clicked
    setSelectedPlan('custom');
    setCustomCalories(next);
    if (isWeightLoss && maintenanceRange && next > maintenanceRange.lowerMaintenance && !executionMode) {
      setShowCustomWarningModal(true);
    }
  };

  // Get warning text for custom calories
  const getCustomWarningText = (): { text: string; color: string } | null => {
    if (customCalories === null) return null;

    if (isWeightLoss) {
      if (!calculations) return null;
      const { warningLevel, warningText } = getWeightLossCalorieWarning(customCalories);
      if (warningText === null) return null;
      
      // Determine color: yellow if selected, otherwise based on warning level
      const isCustomSelected = selectedPlan === 'custom';
      let color: string;
      if (isCustomSelected) {
        color = getWarningColor(true); // Selected cards: always yellow
      } else if (warningLevel === 'red') {
        color = getWarningColor(false);
      } else if (warningLevel === 'neutral') {
        color = colors.textSecondary; // Neutral gray
      } else {
        color = getWarningColor(false); // fallback
      }
      
      return {
        text: warningLevel === 'red' ? `⚠️ ${warningText}` : warningText,
        color,
      };
    }

    if (isNonLoss && nonLossSuggestions) {
      const upper = nonLossSuggestions.maintenance.upper;
      const lower = nonLossSuggestions.maintenance.lower;
      const isCustomSelected = selectedPlan === 'custom';

      // For maintenance/recomp, use unified low-calorie warnings (same as weight loss)
      if (isMaintain || isRecomp) {
        const { warningLevel, warningText } = getWeightLossCalorieWarning(customCalories);
        if (warningText !== null) {
          let color: string;
          if (isCustomSelected) {
            color = getWarningColor(true); // Selected cards: always yellow
          } else if (warningLevel === 'red') {
            color = getWarningColor(false);
          } else if (warningLevel === 'neutral') {
            color = colors.textSecondary; // Neutral gray
          } else {
            color = getWarningColor(false); // fallback
          }
          
          return {
            text: warningLevel === 'red' ? `⚠️ ${warningText}` : warningText,
            color,
          };
        }
        // No warning for >= 1200
        return null;
      }

      // Gain goals keep existing warning logic
      if (isGain && customCalories < lower) {
        return { text: t('onboarding.calorie_target.gain_warning_below_maintenance'), color: getWarningColor(isCustomSelected) };
      }
      if (isGain && customCalories > upper + 700) {
        return { text: t('onboarding.calorie_target.gain_warning_high'), color: getWarningColor(isCustomSelected) };
      }
    }

    return null;
  };

  // Compute pace and ETA for any goal type (loss, gain, etc.)
  const computePaceAndEtaForGoal = (
    maintenanceCals: number,
    selectedTargetCals: number,
    goalType: 'lose' | 'gain' | 'maintain' | 'recomp',
    nowDate: Date = new Date()
  ): {
    paceLbsPerWeek: number | null;
    etaWeeks: number | null;
    etaDate: Date | null;
    paceLine: string | null;
    etaLine: string | null;
  } => {
    if (!currentWeightLb || !targetWeightLb) {
      return {
        paceLbsPerWeek: null,
        etaWeeks: null,
        etaDate: null,
        paceLine: null,
        etaLine: null,
      };
    }

    // Calculate daily delta (positive for gain, negative for loss)
    const dailyDelta = selectedTargetCals - maintenanceCals;

    // Calculate pace in lbs/week
    const lbPerWeek = (dailyDelta * 7) / CALORIES_PER_LB;

    // Calculate weight delta
    const weightDeltaLb = targetWeightLb - currentWeightLb;

    // Edge handling: if pace is <= 0 or weight delta doesn't match goal direction
    if (lbPerWeek <= 0 || (goalType === 'gain' && weightDeltaLb <= 0) || (goalType === 'lose' && weightDeltaLb >= 0)) {
      return {
        paceLbsPerWeek: null,
        etaWeeks: null,
        etaDate: null,
        paceLine: null,
        etaLine: null,
      };
    }

    // Calculate weeks needed (round up to nearest week)
    const weeksRaw = Math.abs(weightDeltaLb) / Math.abs(lbPerWeek);
    const weeks = Math.ceil(weeksRaw);

    // Calculate target date
    const etaDate = new Date(nowDate);
    etaDate.setDate(etaDate.getDate() + weeks * 7);

    // Format pace line (weight loss format for all goals)
    const paceLine = `~${roundTo1(Math.abs(lbPerWeek))} lb/week`;

    // Format ETA line (weight loss format: ~X weeks (by DATE))
    const etaLine = `~${weeks} week${weeks === 1 ? '' : 's'} (by ${formatDateForDisplay(etaDate.toISOString().split('T')[0])})`;

    return {
      paceLbsPerWeek: Math.round(Math.abs(lbPerWeek) * 10) / 10,
      etaWeeks: weeks,
      etaDate,
      paceLine,
      etaLine,
    };
  };

  // Compute pace and ETA for custom calories (live updates)
  const customMeta = useMemo(() => {
    if (!isWeightLoss || !maintenanceRange || customCalories === null || !currentWeightLb) {
      return {
        paceLbsPerWeek: null,
        etaWeeks: null,
        etaDate: null,
      };
    }

    return computePaceAndEta({
      maintenanceLow: maintenanceRange?.lowerMaintenance ?? 0,
      maintenanceHigh: maintenanceRange?.upperMaintenance ?? 0,
      customCalories,
      currentWeightLb,
      targetWeightLb,
    });
  }, [
    isWeightLoss,
    maintenanceRange,
    customCalories,
    currentWeightLb,
    targetWeightLb,
  ]);

  // Compute pace and ETA for gain custom calories (live updates)
  const customGainMeta = useMemo(() => {
    if (!isGain || !maintenanceRange || customCalories === null || !currentWeightLb || !targetWeightLb) {
      return {
        paceLbsPerWeek: null,
        etaWeeks: null,
        etaDate: null,
        paceLine: null,
        etaLine: null,
      };
    }

    const maintenanceMid = (maintenanceRange.lowerMaintenance + maintenanceRange.upperMaintenance) / 2;
    return computePaceAndEtaForGoal(
      maintenanceMid,
      customCalories,
      'gain'
    );
  }, [
    isGain,
    maintenanceRange,
    customCalories,
    currentWeightLb,
    targetWeightLb,
  ]);

  const handleCustomWarningProceed = () => {
    setExecutionMode('override');
    setShowCustomWarningModal(false);
  };

  const handleCustomWarningAdjust = () => {
    // Clamp to lowerMaintenance, but never below 700
    if (maintenanceRange && customCalories !== null) {
      const adjustedCalories = Math.max(HARD_HARD_STOP, roundDownTo25(maintenanceRange.lowerMaintenance));
      setCustomCalories(adjustedCalories);
    }
    setShowCustomWarningModal(false);
  };

  // Format weight for display
  const formatWeight = (weightLb: number): string => {
    if (weightUnit === 'kg') {
      return `${roundTo1(lbToKg(weightLb))} kg`;
    }
    return `${roundTo1(weightLb)} lb`;
  };

  // Get activity label
  const getActivityLabel = (): string => {
    const key = `onboarding.activity.${activityLevel}.label`;
    return t(key);
  };

  // Get goal-specific subtitle text
  const getSubtitleText = (): string => {
    if (!targetWeightLb) {
      return 'Choose a daily calorie target: ';
    }

    const formattedWeight = formatWeight(targetWeightLb);

    if (isWeightLoss) {
      return `To reach ${formattedWeight}, choose a calorie target below maintenance: `;
    } else if (isMaintain) {
      return `To maintain at ${formattedWeight}, choose a calorie target near maintenance: `;
    } else if (isRecomp) {
      return `To recomposition at ${formattedWeight}, choose a calorie target near maintenance: `;
    } else if (isGain) {
      return `To gain toward ${formattedWeight}, choose a daily calorie target above maintenance: `;
    }

    // Fallback
    return 'Choose a daily calorie target: ';
  };


  // For non-weight-loss goals, show placeholder
  if (!isWeightLoss && !isNonLoss) {
    return (
      <View style={styles.stepContentAnimated}>
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
              <MaterialCommunityIcons name="food" size={100} color={onboardingColors.primary} />
            </View>
          </View>
        </View>
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.calorie_target.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.calorie_target.coming_soon')}
        </ThemedText>
      </View>
    );
  }

  // Weight loss goal - show full UI
  // Only show "missing data" if truly missing required inputs
  if (isWeightLoss && !calculations) {
    return (
      <View style={styles.stepContentAnimated}>
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.calorie_target.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.calorie_target.error_missing_data')}
        </ThemedText>
      </View>
    );
  }

  if (isNonLoss && !nonLossSuggestions) {
    return (
      <View style={styles.stepContentAnimated}>
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.calorie_target.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.calorie_target.error_missing_data')}
        </ThemedText>
      </View>
    );
  }

  const plans = isWeightLoss ? calculations?.plans ?? null : null;

  const getNonLossContextLineKey = (): string => {
    if (isMaintain) return 'onboarding.calorie_target.maintain_context_line';
    if (isRecomp) return 'onboarding.calorie_target.recomp_context_line';
    return 'onboarding.calorie_target.gain_context_line';
  };

  // Shared activity summary block (BMR + activity link + activity sentence)
  const ActivitySummaryBlock = () => {
    if (!maintenanceRange) return null;

    return (
      <>
        {/* Line 1: BMR range */}
        <ThemedText style={[styles.breakdownLine, { color: colors.text }]}>
          {t('onboarding.calorie_target.bmr_range_line', {
            lowerBmr: maintenanceRange.lowerBmr,
            upperBmr: maintenanceRange.upperBmr,
          })}
        </ThemedText>

        {/* Line 2: Adjust activity level link */}
        {onActivityLevelChange && (
          <TouchableOpacity 
            onPress={() => setShowActivityModal(true)}
            style={styles.adjustActivityLinkContainer}
            {...getButtonAccessibilityProps(
              'Adjust activity level',
              'Double tap to adjust your activity level'
            )}
          >
            <Text style={[styles.adjustActivityLink, { color: onboardingColors.primary }]}>
              Adjust activity level
            </Text>
          </TouchableOpacity>
        )}

        {/* Line 3: Activity calories range */}
        <ThemedText style={[styles.breakdownLine, { color: colors.text }]}>
          {t('onboarding.calorie_target.activity_range_line', {
            lowerActivity: maintenanceRange.lowerActivityCalories,
            upperActivity: maintenanceRange.upperActivityCalories,
            activityLabel: getActivityLabel(),
          })}
        </ThemedText>
      </>
    );
  };

  // Helper to get warning color based on selection state
  const getWarningColor = (isSelected: boolean): string => {
    return isSelected ? Colors.light.warning : Colors.light.error;
  };

  // Helper function to render a baseline deficit chip
  const renderBaselineChip = (planKey: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'sustainable_floor_1200') => {
    if (!calculations) return null;
    const plan = calculations.plans.plans[planKey];
    if (!plan || !plan.isVisible) return null;
    
    // For aggressive plan: hide if disabled due to being below 700 kcal/day (unsupported)
    if (planKey === 'aggressive' && !plan.isSelectable && plan.caloriesPerDay !== null && plan.caloriesPerDay < HARD_HARD_STOP) {
      return null;
    }

    const isSelected = selectedPlan === planKey;
    const isSelectable = plan.isSelectable;
    const textColor = isSelected && isSelectable ? Colors.light.textInverse : colors.text;
    const secondaryTextColor = isSelected && isSelectable ? Colors.light.textInverse : colors.textSecondary;

    // Format pace display
    const paceText = plan.paceLbsPerWeek !== null && plan.paceLbsPerWeek > 0
      ? `~${roundTo1(plan.paceLbsPerWeek)} lb/week`
      : null;

    // Format date display
    const dateText = plan.etaDateISO && plan.etaWeeks !== null && plan.etaWeeks > 0
      ? `~${plan.etaWeeks} week${plan.etaWeeks === 1 ? '' : 's'} (by ${formatDateForDisplay(plan.etaDateISO)})`
      : null;

    // Get warning text from plan (computed by rules module)
    const warningText = plan.warningText;
    // Determine warning color based on level and selection state
    let warningColor: string;
    if (isSelected && isSelectable) {
      // Selected cards: always use warning yellow for visibility
      warningColor = getWarningColor(true);
    } else if (plan.warningLevel === 'red') {
      warningColor = getWarningColor(false);
    } else if (plan.warningLevel === 'neutral') {
      // Neutral gray for tier 2 (1000-1199) - only when not selected
      warningColor = colors.textSecondary;
    } else {
      warningColor = getWarningColor(false); // fallback
    }

    // Get title with recommended badge
    const titleText = plan.isRecommended
      ? `${plan.title} (Recommended)`
      : plan.title;

    return (
      <TouchableOpacity
        key={planKey}
        style={[
          styles.presetCard,
          {
            borderColor: isSelected && isSelectable ? onboardingColors.primary : colors.border,
            backgroundColor: isSelected && isSelectable ? undefined : colors.background,
            borderWidth: isSelected && isSelectable ? 0 : 1,
            opacity: isSelectable ? 1 : 0.6,
          },
          isSelected && isSelectable && (Platform.OS === 'web'
            ? {
                background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              } as any
            : { backgroundColor: onboardingColors.primary }),
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        onPress={() => {
          if (isSelectable) {
            setSelectedPlan(planKey);
            setCustomCalories(null);
            setExecutionMode(undefined);
          }
        }}
        disabled={loading || !isSelectable}
        {...getButtonAccessibilityProps(
          `${titleText}${isSelected ? ' selected' : ''}${!isSelectable ? ' (disabled)' : ''}`,
          !isSelectable
            ? 'This plan is below the safe minimum intake'
            : `Double tap to select ${plan.title}`,
          loading || !isSelectable
        )}
      >
        <View style={styles.presetContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Text variant="h4" style={[styles.presetLabel, { color: textColor }]}>
              {plan.title}
            </Text>
            {plan.isRecommended && (
              <View style={{
                backgroundColor: isSelected ? Colors.light.textInverse : onboardingColors.primary,
                paddingHorizontal: Spacing.xs,
                paddingVertical: 2,
                borderRadius: BorderRadius.sm,
              }}>
                <Text style={{
                  fontSize: FontSize.xs,
                  fontWeight: FontWeight.semibold,
                  color: isSelected ? onboardingColors.primary : Colors.light.textInverse,
                }}>
                  {t('onboarding.calorie_target.recommended_badge')}
                </Text>
              </View>
            )}
          </View>
          <Text variant="body" style={[styles.presetCalories, { color: textColor }]}>
            {plan.caloriesPerDay !== null && isSelectable
              ? `${plan.caloriesPerDay} cal/day`
              : plan.caloriesPerDay !== null && !isSelectable
              ? plan.caloriesPerDay < HARD_HARD_STOP
                ? planKey === 'standard'
                  ? 'Try using Set Custom Pace instead'
                  : 'Below 700 kcal/day is not supported. Choose another target date or weight.'
                : 'Below safe minimum'
              : ''}
          </Text>
          {paceText && (
            <Text variant="caption" style={[styles.presetMetaText, { color: secondaryTextColor }]}>
              {paceText}
            </Text>
          )}
          {dateText && (
            <Text variant="caption" style={[styles.presetMetaText, { color: secondaryTextColor }]}>
              {dateText}
            </Text>
          )}
          {plan.key === 'cautiousMinimum' && plan.isVisible && (
            <Text variant="caption" style={[styles.presetDescription, { color: secondaryTextColor }]}>
              At the lower safety boundary.
            </Text>
          )}
          {plan.subtitle && (
            <Text variant="caption" style={[styles.presetDescription, { color: secondaryTextColor }]}>
              {plan.subtitle}
            </Text>
          )}
          {warningText && (
            <ThemedText
              style={[
                styles.warningText,
                { color: warningColor },
              ]}
            >
              {plan.warningLevel === 'red' ? '⚠️ ' : ''}{warningText}
            </ThemedText>
          )}
        </View>
        {isSelected && isSelectable && (
          <View style={styles.presetCheckmark}>
            <IconSymbol name="checkmark.circle.fill" size={Spacing['2xl']} color={Colors.light.textInverse} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderNonLossChip = (plan: SuggestedCaloriePlan) => {
    const isSelected = selectedPlan === plan.key;
    const isSelectable = plan.isSelectable;
    const textColor = isSelected && isSelectable ? Colors.light.textInverse : colors.text;
    const secondaryTextColor = isSelected && isSelectable ? Colors.light.textInverse : colors.textSecondary;

    // Compute pace and ETA for gain goals (use preset pace values)
    let paceLine: string | null = null;
    let etaLine: string | null = null;
    if (isGain && maintenanceRange && currentWeightLb && targetWeightLb) {
      const presetPace = GAIN_PRESET_PACES[plan.key];
      if (presetPace !== undefined) {
        // Use preset pace value directly (pace-first approach)
        const lbPerWeek = presetPace;
        const weightDeltaLb = targetWeightLb - currentWeightLb;
        
        if (weightDeltaLb > 0 && lbPerWeek > 0) {
          // Calculate weeks needed (round up to nearest week)
          const weeksRaw = Math.abs(weightDeltaLb) / Math.abs(lbPerWeek);
          const weeks = Math.ceil(weeksRaw);
          
          // Calculate target date
          const etaDate = new Date();
          etaDate.setDate(etaDate.getDate() + weeks * 7);
          
          // Format pace line (weight loss format: ~X lb/week)
          paceLine = `~${roundTo1(lbPerWeek)} lb/week`;
          
          // Format ETA line (weight loss format: ~X weeks (by DATE))
          etaLine = `~${weeks} week${weeks === 1 ? '' : 's'} (by ${formatDateForDisplay(etaDate.toISOString().split('T')[0])})`;
        } else {
          paceLine = null;
          etaLine = null;
        }
      } else {
        // Fallback: calculate from calories (for custom or unknown plans)
        const maintenanceMid = (maintenanceRange.lowerMaintenance + maintenanceRange.upperMaintenance) / 2;
        const paceEta = computePaceAndEtaForGoal(
          maintenanceMid,
          plan.caloriesPerDay,
          'gain'
        );
        paceLine = paceEta.paceLine;
        etaLine = paceEta.etaLine;
      }
    }

    // For maintenance/recomp, use unified low-calorie warnings (same as weight loss)
    let warningText: string | null = null;
    let warningLevel: 'none' | 'neutral' | 'red' | 'unsafe' = 'none';
    if ((isMaintain || isRecomp) && plan.caloriesPerDay < HARD_FLOOR) {
      const warning = getWeightLossCalorieWarning(plan.caloriesPerDay);
      warningText = warning.warningText;
      warningLevel = warning.warningLevel;
    } else if (plan.warning) {
      // For gain goals, use existing warning structure
      warningText = t(plan.warning.textKey);
      warningLevel = plan.warning.level === 'red' ? 'red' : plan.warning.level === 'orange' ? 'neutral' : 'none';
    }

    // Determine warning color based on level and selection state
    let warningColor: string;
    if (isSelected && isSelectable) {
      // Selected cards: always use warning yellow for visibility
      warningColor = getWarningColor(true);
    } else if (warningLevel === 'red') {
      warningColor = getWarningColor(false);
    } else if (warningLevel === 'neutral') {
      // Neutral gray for tier 2 (1000-1199) - only when not selected
      warningColor = colors.textSecondary;
    } else {
      warningColor = getWarningColor(isSelected && isSelectable);
    }

    return (
      <TouchableOpacity
        key={plan.key}
        style={[
          styles.presetCard,
          {
            borderColor: isSelected && isSelectable ? onboardingColors.primary : colors.border,
            backgroundColor: isSelected && isSelectable ? undefined : colors.background,
            borderWidth: isSelected && isSelectable ? 0 : 1,
            opacity: isSelectable ? 1 : 0.6,
          },
          isSelected && isSelectable && (Platform.OS === 'web'
            ? {
                background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              } as any
            : { backgroundColor: onboardingColors.primary }),
          Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
        ]}
        onPress={() => {
          if (isSelectable) {
            setSelectedPlan(plan.key as any);
            setCustomCalories(null);
            setExecutionMode(undefined);
          }
        }}
        disabled={loading || !isSelectable}
        {...getButtonAccessibilityProps(
          `${t(plan.titleKey)}${isSelected ? ' selected' : ''}${!isSelectable ? ' (disabled)' : ''}`,
          !isSelectable
            ? t('onboarding.calorie_target.a11y_plan_below_safe_minimum')
            : t('onboarding.calorie_target.a11y_select_plan', { planTitle: t(plan.titleKey) }),
          loading || !isSelectable
        )}
      >
        <View style={styles.presetContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Text variant="h4" style={[styles.presetLabel, { color: textColor }]}>
              {t(plan.titleKey)}
            </Text>
            {plan.isRecommended && (
              <View style={{
                backgroundColor: isSelected ? Colors.light.textInverse : onboardingColors.primary,
                paddingHorizontal: Spacing.xs,
                paddingVertical: 2,
                borderRadius: BorderRadius.sm,
              }}>
                <Text style={{
                  fontSize: FontSize.xs,
                  fontWeight: FontWeight.semibold,
                  color: isSelected ? onboardingColors.primary : Colors.light.textInverse,
                }}>
                  {t('onboarding.calorie_target.recommended_badge')}
                </Text>
              </View>
            )}
          </View>
          <Text variant="body" style={[styles.presetCalories, { color: textColor }]}>
            {isSelectable ? `${plan.caloriesPerDay} cal/day` : t('onboarding.calorie_target.below_safe_minimum')}
          </Text>
          <Text variant="caption" style={[styles.presetDescription, { color: secondaryTextColor }]}>
            {t(plan.subtitleKey)}
          </Text>
          {paceLine && (
            <Text variant="caption" style={[styles.presetMetaText, { color: secondaryTextColor }]}>
              {paceLine}
            </Text>
          )}
          {etaLine && (
            <Text variant="caption" style={[styles.presetMetaText, { color: secondaryTextColor }]}>
              {etaLine}
            </Text>
          )}
          {warningText && (
            <ThemedText style={[styles.warningText, { color: warningColor }]}>
              {warningLevel === 'red' ? '⚠️ ' : ''}{warningText}
            </ThemedText>
          )}
          {!isSelectable && (
            <ThemedText style={[styles.warningText, { color: getWarningColor(false), fontSize: FontSize.sm + 2 }]}>
              {t('onboarding.calorie_target.unsafe_cannot_select')}
            </ThemedText>
          )}
        </View>
        {isSelected && isSelectable && (
          <View style={styles.presetCheckmark}>
            <IconSymbol name="checkmark.circle.fill" size={Spacing['2xl']} color={Colors.light.textInverse} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
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
            <MaterialCommunityIcons name="fire" size={100} color={onboardingColors.primary} />
          </View>
        </View>
      </View>

      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.calorie_target.title')}
      </ThemedText>

      {/* Context Display */}
      <View style={styles.breakdownSection}>
        {/* Shared activity summary block (shown for all goals) */}
        <ActivitySummaryBlock />

        {/* Goal-specific content */}
        {isWeightLoss && maintenanceRange && (
          <>
            {/* Maintenance range */}
            {(() => {
              const maintenanceText = t('onboarding.calorie_target.maintenance_range_line', {
                lowerMaintenance: maintenanceRange.lowerMaintenance,
                upperMaintenance: maintenanceRange.upperMaintenance,
              });
              const [label, range] = maintenanceText.split('\n');

              // If the translation doesn't include a newline, fall back to single-line render.
              if (!range) {
                return (
                  <ThemedText style={[styles.breakdownLine, styles.breakdownLineBold, { color: colors.text }]}>
                    {maintenanceText}
                  </ThemedText>
                );
              }

              return (
                <>
                  <ThemedText style={[styles.breakdownLine, styles.breakdownLineBold, { color: colors.text }]}>
                    {label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.breakdownLine,
                      styles.breakdownLineBold,
                      styles.breakdownLineMaintenanceRange,
                      { color: colors.text },
                    ]}
                  >
                    {range}
                  </ThemedText>
                </>
              );
            })()}
          </>
        )}

        {isNonLoss && nonLossSuggestions && (
          <>
            {/* Estimated maintenance range - split into 2 lines like weight loss */}
            {(() => {
              const maintenanceText = t('onboarding.calorie_target.estimated_maintenance_range_line', {
                lower: nonLossSuggestions.maintenance.lower,
                upper: nonLossSuggestions.maintenance.upper,
              });
              
              // Try splitting by newline first (if translation has it)
              let [label, range] = maintenanceText.split('\n');
              
              // If no newline, manually split at colon
              if (!range) {
                const colonIndex = maintenanceText.indexOf(':');
                if (colonIndex !== -1) {
                  label = maintenanceText.substring(0, colonIndex + 1).trim();
                  range = maintenanceText.substring(colonIndex + 1).trim();
                } else {
                  // Fallback: split at "cal/day" if no colon
                  const calDayIndex = maintenanceText.indexOf('cal/day');
                  if (calDayIndex !== -1) {
                    label = maintenanceText.substring(0, calDayIndex).trim();
                    range = maintenanceText.substring(calDayIndex).trim();
                  } else {
                    // Last resort: single line
                    return (
                      <ThemedText style={[styles.breakdownLine, styles.breakdownLineBold, { color: colors.text }]}>
                        {maintenanceText}
                      </ThemedText>
                    );
                  }
                }
              }

              return (
                <>
                  <ThemedText style={[styles.breakdownLine, styles.breakdownLineBold, { color: colors.text }]}>
                    {label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.breakdownLine,
                      styles.breakdownLineBold,
                      styles.breakdownLineMaintenanceRange,
                      { color: colors.text },
                    ]}
                  >
                    {range}
                  </ThemedText>
                </>
              );
            })()}
          </>
        )}
      </View>

      {/* Subtitle */}
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.text }]}>
        {getSubtitleText()}
        {mode === 'edit' && savedCalorieTarget !== null && savedCalorieTarget !== undefined && (
          <>
            {'\n'}
            <ThemedText
              style={[
                styles.previouslySetLine,
                { color: colors.tint, fontWeight: FontWeight.bold },
              ]}
            >
              {t('onboarding.calorie_target.previously_set_target', { calories: savedCalorieTarget })}
            </ThemedText>
          </>
        )}
      </ThemedText>

      {/* Warning Banner for EXTREME_EDGE_CASE (Weight Loss) */}
      {isWeightLoss && calculations && calculations.plans.status === 'EXTREME_EDGE_CASE' && (
        <View style={[styles.warningBanner, { backgroundColor: `${Colors.light.warning}20`, borderColor: Colors.light.warning }]}>
          <ThemedText style={[styles.warningBannerText, { color: '#8A4A00' }]}>
            ⚠️ {calculations.plans.message}
          </ThemedText>
          <ThemedText style={[styles.warningBannerText, { color: Colors.light.textSecondary, marginTop: Spacing.xs }]}>
            Based on your current data, standard weight-loss targets would fall below safe limits.
            Everyone differs (genetics, body composition, activity). Increasing activity and building consistent habits may still help over time.
            You can set a custom target if you know what you're doing, or go back and adjust your goal.
          </ThemedText>
        </View>
      )}

      {/* Warning Banner for Maintenance/Recomp when maintenanceLow < 1100 */}
      {(() => {
        const shouldShowGoalLimitWarning = 
          maintenanceRange && 
          maintenanceRange.lowerMaintenance < 1100 && 
          (isMaintain || isRecomp);
        
        if (!shouldShowGoalLimitWarning) return null;

        const warningMessage = 'This goal is beyond what the app can guide reliably.';
        
        const warningDetails = isMaintain
          ? 'Based on your current data, maintenance targets at this range are hard to estimate accurately and small fluctuations can shift outcomes. Everyone differs (genetics, body composition, activity). Increasing activity and building consistent habits may still help over time. You can set a custom target if you know what you\'re doing, or go back and adjust your goal.'
          : 'Based on your current data, recomposition targets at this range are hard to set because progress depends heavily on training quality, protein, and recovery. Everyone differs (genetics, body composition, activity). Increasing activity and building consistent habits may still help over time. You can set a custom target if you know what you\'re doing, or go back and adjust your goal.';

        return (
          <View style={[styles.warningBanner, { backgroundColor: `${Colors.light.warning}20`, borderColor: Colors.light.warning }]}>
            <ThemedText style={[styles.warningBannerText, { color: '#8A4A00' }]}>
              ⚠️ {warningMessage}
            </ThemedText>
            <ThemedText style={[styles.warningBannerText, { color: Colors.light.textSecondary, marginTop: Spacing.xs }]}>
              {warningDetails}
            </ThemedText>
          </View>
        );
      })()}


      {/* Plan Options */}
      <View style={styles.presetsContainer}>
        {/* Baseline Deficit Chips */}
        {isWeightLoss && calculations && calculations.plans.status !== 'EXTREME_EDGE_CASE' && (
          <>
            {calculations?.plans.plans.sustainable_floor_1200 && renderBaselineChip('sustainable_floor_1200')}
            {renderBaselineChip('moreSustainable')}
            {renderBaselineChip('standard')}
            {renderBaselineChip('aggressive')}
            {renderBaselineChip('cautiousMinimum')}
          </>
        )}

        {isNonLoss && nonLossSuggestions && (() => {
          // Hide presets for maintain/recomp when maintenanceLow < 1100 (same behavior as weight loss)
          const shouldHidePresets = 
            maintenanceRange && 
            maintenanceRange.lowerMaintenance < 1100 && 
            (isMaintain || isRecomp);
          
          if (shouldHidePresets) {
            return null;
          }
          
          return (
            <>
              {nonLossSuggestions.plans.map((p) => renderNonLossChip(p))}
            </>
          );
        })()}

        {/* Custom Option */}
        {selectedPlan === 'custom' ? (
          <View
            style={[
              styles.presetCard,
              Platform.OS === 'web'
                ? {
                    background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  } as any
                : { backgroundColor: onboardingColors.primary },
            ]}
          >
            <View style={styles.presetContent}>
              <Text variant="h4" style={[styles.presetLabel, { color: Colors.light.textInverse }]}>
                {t('onboarding.calorie_target.plan_custom')}
              </Text>
              {customCalories !== null && (
                <>
                  <CalorieStepper
                    value={customCalories}
                    min={Math.max(
                      HARD_HARD_STOP,
                      isWeightLoss
                        ? calculations?.plans.plans.custom.min ?? HARD_HARD_STOP
                        : nonLossSuggestions?.custom.min ?? HARD_HARD_STOP
                    )}
                    max={
                      isWeightLoss
                        ? calculations?.plans.plans.custom.max ?? HARD_HARD_STOP
                        : nonLossSuggestions?.custom.max ?? HARD_HARD_STOP
                    }
                    step={25}
                    onValueChange={handleCustomCaloriesChange}
                    disabled={loading}
                    colors={colors}
                  />
                  {isWeightLoss && customMeta.paceLbsPerWeek !== null && customMeta.paceLbsPerWeek > 0 && (
                    <Text variant="caption" style={[styles.presetMetaText, { color: Colors.light.textInverse }]}>
                      ~{roundTo1(customMeta.paceLbsPerWeek)} lb/week
                    </Text>
                  )}
                  {isWeightLoss && customMeta.etaWeeks !== null && customMeta.etaWeeks > 0 && customMeta.etaDate && (
                    <Text variant="caption" style={[styles.presetMetaText, { color: Colors.light.textInverse }]}>
                      ~{customMeta.etaWeeks} week{customMeta.etaWeeks === 1 ? '' : 's'} (by {formatDateForDisplay(customMeta.etaDate.toISOString().split('T')[0])})
                    </Text>
                  )}
                  {isGain && customGainMeta.paceLbsPerWeek !== null && customGainMeta.paceLbsPerWeek > 0 && (
                    <Text variant="caption" style={[styles.presetMetaText, { color: Colors.light.textInverse }]}>
                      ~{roundTo1(customGainMeta.paceLbsPerWeek)} lb/week
                    </Text>
                  )}
                  {isGain && customGainMeta.etaWeeks !== null && customGainMeta.etaWeeks > 0 && customGainMeta.etaDate && (
                    <Text variant="caption" style={[styles.presetMetaText, { color: Colors.light.textInverse }]}>
                      ~{customGainMeta.etaWeeks} week{customGainMeta.etaWeeks === 1 ? '' : 's'} (by {formatDateForDisplay(customGainMeta.etaDate.toISOString().split('T')[0])})
                    </Text>
                  )}
                  {getCustomWarningText() && (
                    <ThemedText
                      style={[
                        styles.warningText,
                        { color: getCustomWarningText()!.color },
                      ]}
                    >
                      {getCustomWarningText()!.text}
                    </ThemedText>
                  )}
                </>
              )}
            </View>
            <View style={styles.presetCheckmark}>
              <IconSymbol name="checkmark.circle.fill" size={Spacing['2xl']} color={Colors.light.textInverse} />
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.presetCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderWidth: 1,
              },
              Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
            ]}
            onPress={() => {
              setSelectedPlan('custom');
              setCustomCalories((prev) => {
                if (prev === null) return null;
                // Never allow below 700, even for pre-fill
                return Math.max(HARD_HARD_STOP, roundDownTo25(prev));
              });
            }}
            disabled={loading}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              t('onboarding.calorie_target.plan_custom'),
              'Double tap to select custom calorie target',
              loading
            )}
          >
            <View style={styles.presetContent}>
              <Text variant="h4" style={[styles.presetLabel, { color: colors.text }]}>
                {t('onboarding.calorie_target.plan_custom')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Warning Modal */}
      {isWeightLoss && (
        <Modal
          visible={showCustomWarningModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCustomWarningAdjust}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <ThemedText type="title" style={[styles.modalTitle, { color: colors.text }]}>
                {t('onboarding.calorie_target.custom_warning_title')}
              </ThemedText>
              <ThemedText style={[styles.modalMessage, { color: colors.textSecondary }]}>
                {t('onboarding.calorie_target.custom_warning_message')}
              </ThemedText>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: colors.border }]}
                  onPress={handleCustomWarningAdjust}
                  {...getButtonAccessibilityProps(
                    t('onboarding.calorie_target.custom_warning_adjust'),
                    'Double tap to adjust calories'
                  )}
                >
                  <Text variant="body" style={[styles.modalButtonText, { color: colors.text }]}>
                    {t('onboarding.calorie_target.custom_warning_adjust')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: onboardingColors.primary }]}
                  onPress={handleCustomWarningProceed}
                  {...getButtonAccessibilityProps(
                    t('onboarding.calorie_target.custom_warning_proceed'),
                    'Double tap to proceed anyway'
                  )}
                >
                  <Text variant="body" style={[styles.modalButtonText, { color: Colors.light.textInverse }]}>
                    {t('onboarding.calorie_target.custom_warning_proceed')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Activity Level Modal */}
      {onActivityLevelChange && showActivityModal && (
        <ActivityLevelModal
          initialActivityLevel={activityLevel || 'sedentary'}
          onCancel={() => setShowActivityModal(false)}
          onSave={(newActivityLevel) => {
            onActivityLevelChange(newActivityLevel);
            setShowActivityModal(false);
          }}
          colors={colors}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stepContentAnimated: {
    gap: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
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
    fontSize: FontSize.md + 2,
    marginBottom: Spacing['2xl'],
    textAlign: 'center',
    lineHeight: (FontSize.md + 2) * LineHeight.normal,
  },
  breakdownSection: {
    alignSelf: 'stretch',
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginLeft: -Spacing.xl,
    marginRight: -Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
    web: {
    width: 'calc(100% + 2 * var(--spacing-xl))',
    },
    default: {},
    }),
    },
  
  
  breakdownLine: {
    fontSize: FontSize.base + 2,
    lineHeight: (FontSize.base + 2) * LineHeight.normal,
    textAlign: 'center',
  },
  breakdownLineMaintenanceRange: {
    fontSize: FontSize.base + 4, // +2 points vs breakdownLine
    lineHeight: (FontSize.base + 4) * LineHeight.normal,
  },
  breakdownLineBold: {
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xs,
  },
  presetsContainer: {
    gap: Spacing.md,
  },
  presetCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    position: 'relative',
    minHeight: 100,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  presetContent: {
    flex: 1,
  },
  presetLabel: {
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  presetCalories: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  presetDescription: {
    fontSize: FontSize.sm + 2,
  },
  presetMetaText: {
    fontSize: FontSize.sm+2, // +2 vs presetDescription for "~x/week" and ETA lines
  },
  presetCheckmark: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
  warningText: {
    fontSize: FontSize.sm + 3,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    justifyContent: 'center',
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  stepperButtonDisabled: {
    opacity: 0.5,
  },
  valueContainer: {
    minWidth: 120,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  unitText: {
    fontSize: FontSize.xs + 2,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: Shadows.lg,
    }),
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: FontSize.base + 2,
    lineHeight: (FontSize.base + 2) * LineHeight.normal,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  modalButtonSecondary: {
    borderWidth: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  modalButtonText: {
    fontSize: FontSize.base + 2,
    fontWeight: FontWeight.semibold,
  },
  warningBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  warningBannerText: {
    fontSize: FontSize.sm + 4,
    lineHeight: (FontSize.sm + 4) * LineHeight.normal,
    textAlign: 'center',
  },
  helperTextContainer: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  helperText: {
    fontSize: FontSize.sm + 2,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  adjustActivityLinkContainer: {
    marginBottom: 6,
    alignItems: 'center',
  },
  adjustActivityLink: {
    fontSize: FontSize.sm + 2,
    fontWeight: FontWeight.semibold,
    textDecorationLine: 'underline',
  },
  previouslySetLine: {
    fontSize: FontSize.sm + 4,
    fontWeight: FontWeight.regular,
  },
});
