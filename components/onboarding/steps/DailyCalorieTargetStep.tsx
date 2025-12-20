import React, { useState, useMemo, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Modal, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { ageFromDob } from '@/utils/calculations';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import {
  computeMaintenanceRange,
  getBaselineDeficitPlans,
  formatDateForDisplay,
  computePaceAndEta,
  HARD_HARD_STOP,
  HARD_FLOOR,
} from '@/lib/onboarding/goal-calorie-nutrient-rules';

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
  onErrorClear: () => void;
  loading: boolean;
  colors: typeof Colors.light;
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
    const newValue = Math.min(max, value + step);
    onValueChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onValueChange(newValue);
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
  onErrorClear,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState<'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum' | 'custom' | null>(null);
  const [customCalories, setCustomCalories] = useState<number | null>(null);
  const [showCustomWarningModal, setShowCustomWarningModal] = useState(false);
  const [executionMode, setExecutionMode] = useState<'override' | undefined>(undefined);

  // Compute calculations if weight loss goal
  const isWeightLoss = goalType === 'lose';

  const calculations = useMemo(() => {
    if (!isWeightLoss || !currentWeightLb || !heightCm || !sexAtBirth || !activityLevel || !dobISO) {
      return null;
    }

    const ageYears = ageFromDob(dobISO);
    const weightKg = lbToKg(currentWeightLb);

    // Compute maintenance range
    const maintenanceRange = computeMaintenanceRange({
      sexAtBirth: sexAtBirth as 'male' | 'female' | 'unknown',
      ageYears,
      heightCm,
      weightKg,
      bodyFatPct: bodyFatPercent,
      activityLevel,
    });

    // Get baseline deficit plans (new implementation)
    const plans = getBaselineDeficitPlans({
      currentWeightLb,
      targetWeightLb,
      maintenanceLow: maintenanceRange.lowerMaintenance,
      maintenanceHigh: maintenanceRange.upperMaintenance,
      sexAtBirth: sexAtBirth as 'male' | 'female' | 'unknown',
    });

    return {
      maintenanceRange,
      plans,
    };
  }, [isWeightLoss, currentWeightLb, targetWeightLb, heightCm, sexAtBirth, activityLevel, dobISO, bodyFatPercent]);

  // Get current calorie target
  const currentCalorieTarget = useMemo(() => {
    if (!calculations || !selectedPlan) return null;

    if (selectedPlan === 'custom' && customCalories !== null) {
      return customCalories;
    }

    if (selectedPlan !== 'custom') {
      const plan = calculations.plans.plans[selectedPlan];
      // Type guard: check if it's a BaselinePlan (has isVisible property)
      if (plan && 'isVisible' in plan && plan.isVisible && plan.isSelectable && plan.caloriesPerDay !== null) {
        return plan.caloriesPerDay;
      }
    }

    // Fallback to custom if selected plan is not available
    if (selectedPlan !== 'custom' && customCalories !== null) {
      return customCalories;
    }

    return null;
  }, [calculations, selectedPlan, customCalories]);

  // Initialize default selection and custom calories
  useEffect(() => {
    if (calculations && selectedPlan === null) {
      // Set default plan from rules
      if (calculations.plans.defaultPlan) {
        setSelectedPlan(calculations.plans.defaultPlan);
        // The onCalorieTargetChange will be called by the other useEffect when currentCalorieTarget is computed
      }
    }
    if (selectedPlan === 'custom' && customCalories === null && calculations) {
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
        defaultCalories = calculations.maintenanceRange.lowerMaintenance;
      }
      setCustomCalories(defaultCalories);
    }
  }, [selectedPlan, customCalories, calculations]);

  // Clear selected plan if it becomes unselectable
  useEffect(() => {
    if (calculations && selectedPlan && selectedPlan !== 'custom') {
      const plan = calculations.plans.plans[selectedPlan];
      // Type guard: check if it's a BaselinePlan (has isSelectable property)
      if (plan && 'isSelectable' in plan && !plan.isSelectable) {
        // Fallback to default plan or custom
        if (calculations.plans.defaultPlan) {
          setSelectedPlan(calculations.plans.defaultPlan);
        } else {
          setSelectedPlan('custom');
        }
      }
    }
  }, [calculations, selectedPlan]);

  // Compute canProceed validation
  const canProceed = useMemo(() => {
    if (!calculations || !selectedPlan) return false;

    if (selectedPlan === 'custom') {
      // Custom: must have valid calories >= HARD_HARD_STOP
      return customCalories !== null && 
             isFinite(customCalories) && 
             customCalories >= HARD_HARD_STOP;
    } else {
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
  }, [calculations, selectedPlan, customCalories]);

  // Debug log (temporary)
  useEffect(() => {
    if (calculations) {
      console.log('DailyCalorieTarget selection', { 
        selectedPlan, 
        customCalories, 
        currentCalorieTarget,
        canProceed 
      });
    }
  }, [selectedPlan, customCalories, currentCalorieTarget, canProceed, calculations]);

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
        maintenanceCalories: calculations.maintenanceRange.lowerMaintenance,
        caloriePlan: legacyPlanKey,
        executionMode,
      });
    }
  }, [currentCalorieTarget, calculations, selectedPlan, executionMode, onCalorieTargetChange]);

  // Check if custom calories exceed lowerMaintenance and show warning
  const handleCustomCaloriesChange = (newValue: number) => {
    setCustomCalories(newValue);
    if (calculations && newValue > calculations.maintenanceRange.lowerMaintenance && !executionMode) {
      setShowCustomWarningModal(true);
    }
  };

  // Get warning text for custom calories
  const getCustomWarningText = (): { text: string; color: string } | null => {
    if (!calculations || customCalories === null) return null;
    const softFloor = sexAtBirth === 'male' ? 1400 : sexAtBirth === 'female' ? 1300 : 1400;
    if (customCalories >= HARD_HARD_STOP && customCalories < HARD_FLOOR) {
      // Calories are >= 700 but < 1200
      return { text: '⚠️ Could be unsafe, consider changing your target date or weight', color: Colors.light.warning };
    } else if (customCalories < HARD_FLOOR) {
      return { text: t('onboarding.calorie_target.warning_unsafe'), color: Colors.light.warning };
    } else if (customCalories < softFloor) {
      return { text: 'Below our recommended minimum, proceed with caution', color: Colors.light.warning };
    }
    return null;
  };

  // Compute pace and ETA for custom calories (live updates)
  const customMeta = useMemo(() => {
    if (!calculations || customCalories === null || !currentWeightLb) {
      return {
        paceLbsPerWeek: null,
        etaWeeks: null,
        etaDate: null,
      };
    }

    return computePaceAndEta({
      maintenanceLow: calculations.maintenanceRange.lowerMaintenance,
      maintenanceHigh: calculations.maintenanceRange.upperMaintenance,
      customCalories,
      currentWeightLb,
      targetWeightLb,
    });
  }, [
    calculations,
    customCalories,
    currentWeightLb,
    targetWeightLb,
  ]);

  const handleCustomWarningProceed = () => {
    setExecutionMode('override');
    setShowCustomWarningModal(false);
  };

  const handleCustomWarningAdjust = () => {
    // Clamp to lowerMaintenance
    if (calculations && customCalories !== null) {
      setCustomCalories(calculations.maintenanceRange.lowerMaintenance);
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


  // For non-weight-loss goals, show placeholder
  if (!isWeightLoss) {
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
                backgroundColor: Colors.light.background,
                borderWidth: Spacing.xs,
                borderColor: `${onboardingColors.primary}50`,
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
  if (!calculations) {
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

  const { maintenanceRange, plans } = calculations;

  // Helper function to render a baseline deficit chip
  const renderBaselineChip = (planKey: 'moreSustainable' | 'standard' | 'aggressive' | 'cautiousMinimum') => {
    const plan = calculations.plans.plans[planKey];
    if (!plan.isVisible) return null;

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
      ? `Est. reach in ~${plan.etaWeeks} week${plan.etaWeeks === 1 ? '' : 's'} (by ${formatDateForDisplay(plan.etaDateISO)})`
      : null;

    // Get warning text
    const getWarningText = (): string | null => {
      if (!isSelectable && plan.caloriesPerDay !== null && plan.caloriesPerDay < HARD_HARD_STOP) {
        return 'Below safe minimum';
      }
      if (plan.warningLevel === 'hard') {
        // Calories are >= 700 but < 1200
        return '⚠️ Could be unsafe, consider changing your target date or weight';
      }
      if (plan.warningLevel === 'soft') {
        return 'Below our recommended minimum, proceed with caution';
      }
      return null;
    };

    const warningText = getWarningText();

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
                  Recommended
                </Text>
              </View>
            )}
          </View>
          <Text variant="body" style={[styles.presetCalories, { color: textColor }]}>
            {plan.caloriesPerDay !== null && isSelectable
              ? `${plan.caloriesPerDay} cal/day`
              : plan.caloriesPerDay !== null && !isSelectable
              ? 'Below safe minimum'
              : ''}
          </Text>
          {paceText && (
            <Text variant="caption" style={[styles.presetDescription, { color: secondaryTextColor }]}>
              {paceText}
            </Text>
          )}
          {dateText && (
            <Text variant="caption" style={[styles.presetDescription, { color: secondaryTextColor }]}>
              {dateText}
            </Text>
          )}
          {plan.key === 'cautiousMinimum' && plan.isVisible && (
            <Text variant="caption" style={[styles.presetDescription, { color: secondaryTextColor }]}>
              At the lower safety boundary.
            </Text>
          )}
          {warningText && (
            <ThemedText
              style={[
                styles.warningText,
                {
                  color: isSelected && isSelectable ? Colors.light.warning : Colors.light.error,
                },
              ]}
            >
              {warningText}
            </ThemedText>
          )}
          {!isSelectable && plan.caloriesPerDay !== null && plan.caloriesPerDay < HARD_HARD_STOP && (
            <ThemedText style={[styles.warningText, { color: Colors.light.error, fontSize: FontSize.sm + 2 }]}>
              This plan is unsafe and cannot be selected.
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
              backgroundColor: Colors.light.background,
              borderWidth: Spacing.xs,
              borderColor: `${onboardingColors.primary}50`,
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
        {/* Line 2: BMR range */}
        <ThemedText style={[styles.breakdownLine, { color: colors.text }]}>
          {t('onboarding.calorie_target.bmr_range_line', {
            lowerBmr: maintenanceRange.lowerBmr,
            upperBmr: maintenanceRange.upperBmr,
          })}
        </ThemedText>

        {/* Line 3: Activity calories range */}
        <ThemedText style={[styles.breakdownLine, { color: colors.text }]}>
          {t('onboarding.calorie_target.activity_range_line', {
            lowerActivity: maintenanceRange.lowerActivityCalories,
            upperActivity: maintenanceRange.upperActivityCalories,
            activityLabel: getActivityLabel(),
          })}
        </ThemedText>

        {/* Line 4: Maintenance range */}
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
      </View>

      {/* Subtitle */}
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.text }]}>
        {targetWeightLb
          ? `To reach ${formatWeight(targetWeightLb)}, choose a daily calorie target: `
          : 'Choose a daily calorie target: '}
      </ThemedText>

      {/* Warning Banner for EXTREME_EDGE_CASE */}
      {calculations.plans.status === 'EXTREME_EDGE_CASE' && (
        <View style={[styles.warningBanner, { backgroundColor: `${Colors.light.warning}20`, borderColor: Colors.light.warning }]}>
          <ThemedText style={[styles.warningBannerText, { color: Colors.light.warning }]}>
            ⚠️ {calculations.plans.message}
          </ThemedText>
          <ThemedText style={[styles.warningBannerText, { color: Colors.light.textSecondary, marginTop: Spacing.xs }]}>
            Based on your current data, standard weight-loss targets would fall below safe limits.
            Everyone differs (genetics, body composition, activity). Increasing activity and building consistent habits may still help over time.
            You can set a custom target if you know what you're doing, or go back and adjust your goal.
          </ThemedText>
        </View>
      )}


      {/* Plan Options */}
      <View style={styles.presetsContainer}>
        {/* Baseline Deficit Chips */}
        {calculations.plans.status !== 'EXTREME_EDGE_CASE' && (
          <>
            {renderBaselineChip('moreSustainable')}
            {renderBaselineChip('standard')}
            {renderBaselineChip('aggressive')}
            {renderBaselineChip('cautiousMinimum')}
          </>
        )}

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
                    min={calculations.plans.plans.custom.min}
                    max={calculations.plans.plans.custom.max}
                    step={50}
                    onValueChange={handleCustomCaloriesChange}
                    disabled={loading}
                    colors={colors}
                  />
                  {customMeta.paceLbsPerWeek !== null && customMeta.paceLbsPerWeek > 0 && (
                    <Text variant="caption" style={[styles.presetDescription, { color: Colors.light.textInverse }]}>
                      ~{roundTo1(customMeta.paceLbsPerWeek)} lb/week
                    </Text>
                  )}
                  {customMeta.etaWeeks !== null && customMeta.etaWeeks > 0 && customMeta.etaDate && (
                    <Text variant="caption" style={[styles.presetDescription, { color: Colors.light.textInverse }]}>
                      Est. reach in ~{customMeta.etaWeeks} week{customMeta.etaWeeks === 1 ? '' : 's'} (by {formatDateForDisplay(customMeta.etaDate.toISOString().split('T')[0])})
                    </Text>
                  )}
                  {getCustomWarningText() && (
                    <ThemedText style={[styles.warningText, { color: getCustomWarningText()!.color }]}>
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
            onPress={(e) => {
              if (Platform.OS === 'web' && e) {
                (e as any).preventDefault?.();
              }
              setSelectedPlan('custom');
            }}
            disabled={loading}
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
              <Text variant="body" style={[styles.presetCalories, { color: colors.text }]}>
                {t('onboarding.calorie_target.plan_custom_desc')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Warning Modal */}
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
  presetCheckmark: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
  warningText: {
    fontSize: FontSize.sm + 6,
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
});
