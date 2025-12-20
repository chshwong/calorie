import React, { useState, useMemo, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { lbToKg } from '@/lib/domain/weight-constants';
import { suggestWeightLossNutrients } from '@/lib/onboarding/goal-calorie-nutrient-rules';

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
}

export interface DailyFocusTargets {
  proteinGMin: number;
  fiberGMin: number;
  carbsGMax: number;
  sugarGMax: number;
  sodiumMgMax: number;
  waterMlTarget: number;
}

interface SuggestedTargets {
  proteinGMin: { value: number; min: number; max: number; step: number };
  fiberGMin: { value: number; min: number; max: number; step: number };
  carbsGMax: { value: number; min: number; max: number; step: number; isPrimary: boolean };
  sugarGMax: { value: number; min: number; max: number; step: number };
  sodiumMgMax: { value: number; min: number; max: number; step: number };
  waterMlTarget: { value: number; min: number; max: number; step: number };
}

/**
 * Compute suggested daily focus targets based on user inputs
 */
function computeSuggestedTargets(
  goalType: 'lose' | 'gain' | 'maintain' | 'recomp' | '' | null,
  currentWeightLb: number | null,
  targetWeightLb: number | null,
  heightCm: number | null,
  sexAtBirth: 'male' | 'female' | '' | null,
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | ''
): SuggestedTargets | null {
  if (!goalType || currentWeightLb === null) {
    return null;
  }

  const weightLb = targetWeightLb !== null ? targetWeightLb : currentWeightLb;
  const isWeightLoss = goalType === 'lose';

  // For weight loss, use the rules module
  if (isWeightLoss && sexAtBirth && activityLevel) {
    const suggestions = suggestWeightLossNutrients({
      goalWeightLb: weightLb,
      currentWeightLb,
      sexAtBirth: sexAtBirth as 'male' | 'female' | 'unknown',
      activityLevel,
    });

    return {
      proteinGMin: {
        value: suggestions.proteinMinG,
        min: suggestions.clamps.protein.min,
        max: suggestions.clamps.protein.max,
        step: suggestions.clamps.protein.step,
      },
      fiberGMin: {
        value: suggestions.fiberMinG,
        min: suggestions.clamps.fiber.min,
        max: suggestions.clamps.fiber.max,
        step: suggestions.clamps.fiber.step,
      },
      carbsGMax: {
        value: suggestions.carbsMaxG,
        min: suggestions.clamps.carbs.min,
        max: suggestions.clamps.carbs.max,
        step: suggestions.clamps.carbs.step,
        isPrimary: true,
      },
      sugarGMax: {
        value: suggestions.sugarMaxG,
        min: suggestions.clamps.sugar.min,
        max: suggestions.clamps.sugar.max,
        step: suggestions.clamps.sugar.step,
      },
      sodiumMgMax: {
        value: suggestions.sodiumMaxMg,
        min: suggestions.clamps.sodium.min,
        max: suggestions.clamps.sodium.max,
        step: suggestions.clamps.sodium.step,
      },
      waterMlTarget: {
        value: suggestions.waterTargetMl,
        min: suggestions.clamps.water.min,
        max: suggestions.clamps.water.max,
        step: suggestions.clamps.water.step,
      },
    };
  }

  // For non-weight-loss, use simplified logic (can be enhanced later)
  // Protein (always primary)
  let proteinMultiplier = 0.6; // sedentary default
  if (activityLevel === 'light' || activityLevel === 'moderate') {
    proteinMultiplier = 0.75;
  } else if (activityLevel === 'high' || activityLevel === 'very_high') {
    proteinMultiplier = 0.85;
  }
  proteinMultiplier = Math.max(0.5, Math.min(1.0, proteinMultiplier));
  let proteinG = Math.round(weightLb * proteinMultiplier);
  proteinG = Math.max(80, Math.min(250, proteinG));
  proteinG = Math.round(proteinG / 5) * 5;

  // Fiber (always primary)
  let fiberG = 28; // unknown default
  if (sexAtBirth === 'female') {
    fiberG = 25;
  } else if (sexAtBirth === 'male') {
    fiberG = 30;
  }
  if (weightLb > 190) {
    fiberG += 5;
  }
  if (activityLevel === 'high' || activityLevel === 'very_high') {
    fiberG += 3;
  }
  fiberG = Math.max(22, Math.min(45, Math.round(fiberG)));

  // Carbs (secondary for non-weight-loss)
  let carbsG: number;
  if (activityLevel === 'sedentary') {
    carbsG = 220;
  } else if (activityLevel === 'light' || activityLevel === 'moderate') {
    carbsG = 260;
  } else {
    carbsG = 320;
  }
  carbsG = Math.max(120, Math.min(400, carbsG));
  carbsG = Math.round(carbsG / 10) * 10;

  // Sugar (secondary)
  const sugarG = 40;
  const sugarGClamped = Math.max(25, Math.min(70, sugarG));
  const sugarGFinal = Math.round(sugarGClamped / 5) * 5;

  // Sodium (secondary)
  let sodiumMg = 2300;
  if (activityLevel === 'high' || activityLevel === 'very_high') {
    sodiumMg = 2600;
  }
  sodiumMg = Math.max(1500, Math.min(3500, sodiumMg));
  sodiumMg = Math.round(sodiumMg / 100) * 100;

  // Water (secondary)
  const weightKg = lbToKg(weightLb);
  let waterMl = Math.round(weightKg * 30);
  if (activityLevel === 'light' || activityLevel === 'moderate') {
    waterMl += 300;
  } else if (activityLevel === 'high' || activityLevel === 'very_high') {
    waterMl += 700;
  }
  waterMl = Math.max(1800, Math.min(4500, waterMl));
  waterMl = Math.round(waterMl / 100) * 100;

  return {
    proteinGMin: { value: proteinG, min: 80, max: 250, step: 5 },
    fiberGMin: { value: fiberG, min: 22, max: 45, step: 1 },
    carbsGMax: { value: carbsG, min: 120, max: 400, step: 10, isPrimary: false },
    sugarGMax: { value: sugarGFinal, min: 25, max: 70, step: 5 },
    sodiumMgMax: { value: sodiumMg, min: 1500, max: 3500, step: 100 },
    waterMlTarget: { value: waterMl, min: 1800, max: 4500, step: 100 },
  };
}

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
}) => {
  const handleIncrement = () => {
    const newValue = Math.min(max, currentValue + step);
    onValueChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, currentValue - step);
    onValueChange(newValue);
  };

  return (
    <View style={styles.targetRow}>
      <View style={styles.targetLabelContainer}>
        <Text variant="body" style={[styles.targetLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text variant="caption" style={[styles.targetSuggestion, { color: colors.textSecondary }]}>
          Suggested: {suggestedValue} {unit}
        </Text>
      </View>
      <View style={styles.stepperContainer}>
        <TouchableOpacity
          style={[
            styles.stepperButton,
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
          <IconSymbol name="chevron.down" size={20} color={currentValue <= min ? colors.textSecondary : colors.text} />
        </TouchableOpacity>
        <View style={[styles.valueContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text variant="h4" style={[styles.valueText, { color: colors.text }]}>
            {currentValue}
          </Text>
          <Text variant="caption" style={[styles.unitText, { color: colors.textSecondary }]}>
            {unit}
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
          disabled={disabled || currentValue >= max}
          {...getButtonAccessibilityProps(
            `Increase ${label}`,
            `Double tap to increase ${label} by ${step} ${unit}`,
            disabled || currentValue >= max
          )}
        >
          <IconSymbol name="chevron.up" size={20} color={currentValue >= max ? colors.textSecondary : colors.text} />
        </TouchableOpacity>
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
}) => {
  const { t } = useTranslation();
  const [expandedSecondary, setExpandedSecondary] = useState(false);

  // Compute suggested targets
  const suggested = useMemo(
    () => computeSuggestedTargets(goalType, currentWeightLb, targetWeightLb, heightCm, sexAtBirth, activityLevel),
    [goalType, currentWeightLb, targetWeightLb, heightCm, sexAtBirth, activityLevel]
  );

  // Initialize current values from suggestions
  const [targets, setTargets] = useState<DailyFocusTargets>(() => {
    if (!suggested) {
      return {
        proteinGMin: 100,
        fiberGMin: 28,
        carbsGMax: 200,
        sugarGMax: 40,
        sodiumMgMax: 2300,
        waterMlTarget: 2500,
      };
    }
    return {
      proteinGMin: suggested.proteinGMin.value,
      fiberGMin: suggested.fiberGMin.value,
      carbsGMax: suggested.carbsGMax.value,
      sugarGMax: suggested.sugarGMax.value,
      sodiumMgMax: suggested.sodiumMgMax.value,
      waterMlTarget: suggested.waterMlTarget.value,
    };
  });

  // Update targets when suggestions change
  useEffect(() => {
    if (suggested) {
      setTargets({
        proteinGMin: suggested.proteinGMin.value,
        fiberGMin: suggested.fiberGMin.value,
        carbsGMax: suggested.carbsGMax.value,
        sugarGMax: suggested.sugarGMax.value,
        sodiumMgMax: suggested.sodiumMgMax.value,
        waterMlTarget: suggested.waterMlTarget.value,
      });
    }
  }, [suggested]);

  // Notify parent of changes (onTargetChange is stable setState from parent)
  useEffect(() => {
    onTargetChange(targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets]);

  // Convert water ml to oz for display if using imperial
  const displayWaterValue = weightUnit === 'lb' ? Math.round(targets.waterMlTarget / 29.5735) : targets.waterMlTarget;
  const displayWaterUnit = weightUnit === 'lb' ? 'oz' : 'ml';

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
            <MaterialCommunityIcons name="target" size={100} color={onboardingColors.primary} />
          </View>
        </View>
      </View>

      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.daily_targets.title')}
      </ThemedText>
      {calorieTarget !== null && calorieTarget !== undefined && (
        <ThemedText style={[styles.calorieInfo, { color: colors.textSecondary }]}>
          {t('onboarding.daily_targets.based_on_calories', { calories: calorieTarget })}
        </ThemedText>
      )}
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.daily_targets.subtitle')}
      </ThemedText>

      {/* Primary Focus */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={[styles.sectionHeader, { color: colors.text }]}>
          {t('onboarding.daily_targets.primary_focus')}
        </ThemedText>
        <View style={styles.targetsList}>
          <TargetStepper
            label={t('onboarding.daily_targets.protein')}
            unit="g"
            suggestedValue={suggested.proteinGMin.value}
            currentValue={targets.proteinGMin}
            min={suggested.proteinGMin.min}
            max={suggested.proteinGMin.max}
            step={suggested.proteinGMin.step}
            onValueChange={(value) => setTargets({ ...targets, proteinGMin: value })}
            disabled={loading}
            colors={colors}
          />
          <TargetStepper
            label={t('onboarding.daily_targets.fiber')}
            unit="g"
            suggestedValue={suggested.fiberGMin.value}
            currentValue={targets.fiberGMin}
            min={suggested.fiberGMin.min}
            max={suggested.fiberGMin.max}
            step={suggested.fiberGMin.step}
            onValueChange={(value) => setTargets({ ...targets, fiberGMin: value })}
            disabled={loading}
            colors={colors}
          />
          {isWeightLoss && (
            <TargetStepper
              label={t('onboarding.daily_targets.carbs')}
              unit="g"
              suggestedValue={suggested.carbsGMax.value}
              currentValue={targets.carbsGMax}
              min={suggested.carbsGMax.min}
              max={suggested.carbsGMax.max}
              step={suggested.carbsGMax.step}
              onValueChange={(value) => setTargets({ ...targets, carbsGMax: value })}
              disabled={loading}
              colors={colors}
            />
          )}
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
          <View style={styles.targetsList}>
            {!isWeightLoss && (
              <TargetStepper
                label={t('onboarding.daily_targets.carbs')}
                unit="g"
                suggestedValue={suggested.carbsGMax.value}
                currentValue={targets.carbsGMax}
                min={suggested.carbsGMax.min}
                max={suggested.carbsGMax.max}
                step={suggested.carbsGMax.step}
                onValueChange={(value) => setTargets({ ...targets, carbsGMax: value })}
                disabled={loading}
                colors={colors}
              />
            )}
            <TargetStepper
              label={t('onboarding.daily_targets.sugar')}
              unit="g"
              suggestedValue={suggested.sugarGMax.value}
              currentValue={targets.sugarGMax}
              min={suggested.sugarGMax.min}
              max={suggested.sugarGMax.max}
              step={suggested.sugarGMax.step}
              onValueChange={(value) => setTargets({ ...targets, sugarGMax: value })}
              disabled={loading}
              colors={colors}
            />
            <TargetStepper
              label={t('onboarding.daily_targets.sodium')}
              unit="mg"
              suggestedValue={suggested.sodiumMgMax.value}
              currentValue={targets.sodiumMgMax}
              min={suggested.sodiumMgMax.min}
              max={suggested.sodiumMgMax.max}
              step={suggested.sodiumMgMax.step}
              onValueChange={(value) => setTargets({ ...targets, sodiumMgMax: value })}
              disabled={loading}
              colors={colors}
            />
            <TargetStepper
              label={t('onboarding.daily_targets.water')}
              unit={displayWaterUnit}
              suggestedValue={weightUnit === 'lb' ? Math.round(suggested.waterMlTarget / 29.5735) : suggested.waterMlTarget}
              currentValue={displayWaterValue}
              min={weightUnit === 'lb' ? Math.round(suggested.waterMlTarget.min / 29.5735) : suggested.waterMlTarget.min}
              max={weightUnit === 'lb' ? Math.round(suggested.waterMlTarget.max / 29.5735) : suggested.waterMlTarget.max}
              step={weightUnit === 'lb' ? Math.max(1, Math.round(suggested.waterMlTarget.step / 29.5735)) : suggested.waterMlTarget.step}
              onValueChange={(displayValue) => {
                // Convert display value back to ml, then round to nearest 100ml step
                const mlValue = weightUnit === 'lb' 
                  ? Math.round((displayValue * 29.5735) / 100) * 100
                  : Math.round(displayValue / 100) * 100;
                setTargets({ ...targets, waterMlTarget: mlValue });
              }}
              disabled={loading}
              colors={colors}
            />
          </View>
        )}
      </View>
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
    fontSize: FontSize.md,
    marginBottom: Spacing['2xl'],
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
    marginTop: Spacing.lg,
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
    gap: Spacing.lg,
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  targetLabelContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  targetLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  targetSuggestion: {
    fontSize: FontSize.sm,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
    minWidth: 80,
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
    fontSize: FontSize.xs,
    marginTop: 2,
  },
});

