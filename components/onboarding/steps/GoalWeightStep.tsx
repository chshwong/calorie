import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, SemanticColors, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { filterNumericInput } from '@/utils/inputFilters';
import { NumericUnitInput } from '@/components/forms/NumericUnitInput';
import { type GoalType, type SuggestionResult } from '@/lib/onboarding/goal-weight-rules';
import { lbToKg, kgToLb, MAINTAIN_RECOMP_PCT, MAINTAIN_RECOMP_ABS_CAP_LB } from '@/lib/domain/weight-constants';
import { roundTo1, roundTo3 } from '@/utils/bodyMetrics';
import { WeightNudgePicker } from '@/components/onboarding/WeightNudgePicker';
import { PROFILES } from '@/constants/constraints';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface GoalWeightStepProps {
  goalWeightKg: string;
  goalWeightLb: string;
  currentWeightUnit: 'kg' | 'lb';
  goalType: GoalType | null;
  currentWeightLb: number | null;
  heightCm: number | null;
  sexAtBirth: string | null;
  dobISO: string | null;
  goalWeightSuggestion: SuggestionResult | null;
  onGoalWeightKgChange: (text: string) => void;
  onGoalWeightLbChange: (text: string) => void;
  onErrorClear: () => void;
  error: string | null;
  errorKey: string | null;
  loading: boolean;
  colors: typeof Colors.light;
}

// Helper function for input limiting
const limitToOneDecimal = (text: string): string => {
  const filtered = filterNumericInput(text);
  const parts = filtered.split('.');
  if (parts.length <= 1) return filtered;
  return `${parts[0]}.${parts[1].slice(0, 1)}`;
};

const limitWeightInput = (text: string): string => {
  const oneDecimal = limitToOneDecimal(text);
  const [intPart, decPart] = oneDecimal.split('.');
  const limitedInt = intPart.slice(0, 3); // max 3 digits before decimal
  return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
};

const roundToNearestHalf = (n: number): number => Math.round(n * 2) / 2;

export const GoalWeightStep: React.FC<GoalWeightStepProps> = ({
  goalWeightKg,
  goalWeightLb,
  currentWeightUnit,
  goalType,
  currentWeightLb,
  heightCm,
  sexAtBirth,
  dobISO,
  goalWeightSuggestion,
  onGoalWeightKgChange,
  onGoalWeightLbChange,
  onErrorClear,
  error,
  errorKey,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  // Compute suggestion text and placeholder from suggestion result (derived, not state)
  const { suggestionText, placeholder, suggestedWeightLb } = useMemo(() => {
    // If goalType is maintain or recomp, use current weight
    if (goalType === 'maintain' || goalType === 'recomp') {
      if (currentWeightLb === null) {
        // Fallback if current weight not available
        const fallbackPlaceholder = currentWeightUnit === 'kg' 
          ? t('onboarding.goal_weight.placeholder_fallback_kg')
          : t('onboarding.goal_weight.placeholder_fallback_lb');
        return { suggestionText: null, placeholder: fallbackPlaceholder, suggestedWeightLb: null };
      }
      
      const currentWeight = currentWeightUnit === 'kg' 
        ? roundTo1(lbToKg(currentWeightLb))
        : roundTo1(currentWeightLb);
      
      const unit = currentWeightUnit === 'kg' ? 'kg' : 'lb';
      const suggestionTextValue = t('onboarding.goal_weight.suggested_placeholder', {
        weight: currentWeight.toString(),
        unit,
      });
      const placeholderValue = currentWeightUnit === 'kg'
        ? t('onboarding.goal_weight.placeholder_example_kg', { weight: currentWeight.toString() })
        : t('onboarding.goal_weight.placeholder_example_lb', { weight: currentWeight.toString() });
      
      return {
        suggestionText: typeof suggestionTextValue === 'string' ? suggestionTextValue : String(suggestionTextValue),
        placeholder: typeof placeholderValue === 'string' ? placeholderValue : String(placeholderValue),
        suggestedWeightLb: currentWeightLb,
      };
    }
    
    // For lose/gain, use suggestion result from hook
    if (!goalWeightSuggestion) {
      // Fallback if suggestion not available
      const fallbackPlaceholder = currentWeightUnit === 'kg' 
        ? t('onboarding.goal_weight.placeholder_fallback_kg')
        : t('onboarding.goal_weight.placeholder_fallback_lb');
      return { suggestionText: null, placeholder: fallbackPlaceholder, suggestedWeightLb: null };
    }
    
    if (goalWeightSuggestion.ok) {
      // Format suggested weight in user's selected unit
      const suggestedWeight = currentWeightUnit === 'kg'
        ? roundToNearestHalf(lbToKg(goalWeightSuggestion.suggestedLb))
        : roundToNearestHalf(goalWeightSuggestion.suggestedLb);
      
      const unit = currentWeightUnit === 'kg' ? 'kg' : 'lb';
      
      // Use i18n for suggestion text - ensure it's a string
      const suggestionTextValue = t('onboarding.goal_weight.suggested_placeholder', {
        weight: suggestedWeight.toString(),
        unit,
      });
      const placeholderValue = currentWeightUnit === 'kg'
        ? t('onboarding.goal_weight.placeholder_example_kg', { weight: suggestedWeight.toString() })
        : t('onboarding.goal_weight.placeholder_example_lb', { weight: suggestedWeight.toString() });
      
      return {
        suggestionText: typeof suggestionTextValue === 'string' ? suggestionTextValue : String(suggestionTextValue),
        placeholder: typeof placeholderValue === 'string' ? placeholderValue : String(placeholderValue),
        suggestedWeightLb: goalWeightSuggestion.suggestedLb,
      };
    } else {
      // If suggestion unavailable, use i18n message (no number shown)
      const suggestionTextValue = t(goalWeightSuggestion.messageKey, goalWeightSuggestion.messageParams || {});
      const fallbackPlaceholder = currentWeightUnit === 'kg' 
        ? t('onboarding.goal_weight.placeholder_fallback_kg')
        : t('onboarding.goal_weight.placeholder_fallback_lb');
      return {
        suggestionText: typeof suggestionTextValue === 'string' ? suggestionTextValue : String(suggestionTextValue),
        placeholder: fallbackPlaceholder,
        suggestedWeightLb: null,
      };
    }
  }, [goalType, currentWeightLb, currentWeightUnit, goalWeightSuggestion, t]);

  // Track if we've already prefilled for the current goalType
  // This prevents refilling if user manually clears the field
  const hasPrefilledForCurrentGoalRef = useRef(false);
  const previousGoalTypeRef = useRef<GoalType | ''>(goalType || '');
  const hasManuallyAdjustedRef = useRef(false);
  const previousCurrentWeightLbRef = useRef<number | null>(currentWeightLb);

  // Reset prefill flag when goalType changes (user navigated from GoalStep)
  useEffect(() => {
    if (goalType && goalType !== previousGoalTypeRef.current) {
      previousGoalTypeRef.current = goalType;
      hasPrefilledForCurrentGoalRef.current = false;
      hasManuallyAdjustedRef.current = false;
    }
  }, [goalType]);

  // Track if current weight changes (user went back and edited)
  useEffect(() => {
    if (currentWeightLb !== previousCurrentWeightLbRef.current) {
      previousCurrentWeightLbRef.current = currentWeightLb;
      // If current weight changed and we're in maintain/recomp, re-center target
      if ((goalType === 'maintain' || goalType === 'recomp') && currentWeightLb !== null) {
        hasManuallyAdjustedRef.current = false;
        // Will be handled by the initialization effect below
      }
    }
  }, [currentWeightLb, goalType]);

  // Calculate nudge range for maintain/recomp (in lb, canonical)
  const nudgeRange = useMemo(() => {
    if ((goalType !== 'maintain' && goalType !== 'recomp') || currentWeightLb === null) {
      return null;
    }
    
    const globalMinLb = PROFILES.WEIGHT_LB.MIN;
    const globalMaxLb = PROFILES.WEIGHT_LB.MAX;
    
    // Compute deviation using centralized constants
    // deviationLb = min(currentWeightLb * MAINTAIN_RECOMP_PCT, MAINTAIN_RECOMP_ABS_CAP_LB)
    const deviationLb = Math.min(
      currentWeightLb * MAINTAIN_RECOMP_PCT,
      MAINTAIN_RECOMP_ABS_CAP_LB
    );
    
    // Compute allowed bounds (intersection of all rules)
    const allowedMinLb = Math.max(
      globalMinLb,
      currentWeightLb - deviationLb
    );
    const allowedMaxLb = Math.min(
      globalMaxLb,
      currentWeightLb + deviationLb
    );
    
    // Guard: if min > max, clamp both to currentWeightLb and disable
    if (allowedMinLb > allowedMaxLb) {
      return {
        minLb: Math.max(globalMinLb, Math.min(globalMaxLb, currentWeightLb)),
        maxLb: Math.max(globalMinLb, Math.min(globalMaxLb, currentWeightLb)),
        currentLb: currentWeightLb,
        deviationLb: 0,
        disabled: true,
      };
    }
    
    return {
      minLb: allowedMinLb,
      maxLb: allowedMaxLb,
      currentLb: currentWeightLb,
      deviationLb,
      disabled: false,
    };
  }, [goalType, currentWeightLb]);

  // Initialize target weight to current weight for maintain/recomp
  useEffect(() => {
    if ((goalType === 'maintain' || goalType === 'recomp') && currentWeightLb !== null && nudgeRange) {
      // If current weight changed, re-center target (unless user manually adjusted after the change)
      const currentWeightChanged = previousCurrentWeightLbRef.current !== null && 
                                   previousCurrentWeightLbRef.current !== currentWeightLb;
      
      if (currentWeightChanged && !hasManuallyAdjustedRef.current) {
        // Re-center to new current weight and clamp to new range
        const targetLb = Math.max(nudgeRange.minLb, Math.min(nudgeRange.maxLb, nudgeRange.currentLb));
        if (currentWeightUnit === 'kg') {
          const targetKg = roundTo1(lbToKg(targetLb));
          onGoalWeightKgChange(targetKg.toString());
          onGoalWeightLbChange(roundTo3(targetLb).toString());
        } else {
          const targetLbRounded = roundTo1(targetLb);
          onGoalWeightLbChange(targetLbRounded.toString());
          onGoalWeightKgChange(roundTo1(lbToKg(targetLb)).toString());
        }
        return;
      }
      
      // Only initialize if user hasn't manually adjusted and fields are empty
      if (!hasManuallyAdjustedRef.current && goalWeightKg.trim() === '' && goalWeightLb.trim() === '') {
        const targetLb = nudgeRange.currentLb;
        if (currentWeightUnit === 'kg') {
          const targetKg = roundTo1(lbToKg(targetLb));
          onGoalWeightKgChange(targetKg.toString());
          onGoalWeightLbChange(roundTo3(targetLb).toString());
        } else {
          const targetLbRounded = roundTo1(targetLb);
          onGoalWeightLbChange(targetLbRounded.toString());
          onGoalWeightKgChange(roundTo1(lbToKg(targetLb)).toString());
        }
        hasPrefilledForCurrentGoalRef.current = true;
      }
    }
  }, [goalType, currentWeightLb, nudgeRange, currentWeightUnit, goalWeightKg, goalWeightLb, onGoalWeightKgChange, onGoalWeightLbChange]);

  // Clamp picker value when unit changes for maintain/recomp
  useEffect(() => {
    if ((goalType === 'maintain' || goalType === 'recomp') && nudgeRange && currentWeightLb !== null) {
      // Get current value in lb (canonical)
      let currentValueLb: number;
      if (goalWeightLb && goalWeightLb.trim() !== '') {
        currentValueLb = parseFloat(goalWeightLb);
      } else if (goalWeightKg && goalWeightKg.trim() !== '') {
        currentValueLb = kgToLb(parseFloat(goalWeightKg));
      } else {
        currentValueLb = nudgeRange.currentLb;
      }
      
      // Clamp to allowed range
      const clampedLb = Math.max(nudgeRange.minLb, Math.min(nudgeRange.maxLb, currentValueLb));
      
      // Update both fields with clamped value
      if (currentWeightUnit === 'kg') {
        const clampedKg = roundTo1(lbToKg(clampedLb));
        if (goalWeightKg !== clampedKg.toString()) {
          onGoalWeightKgChange(clampedKg.toString());
        }
        if (goalWeightLb !== roundTo3(clampedLb).toString()) {
          onGoalWeightLbChange(roundTo3(clampedLb).toString());
        }
      } else {
        const clampedLbRounded = roundTo1(clampedLb);
        if (goalWeightLb !== clampedLbRounded.toString()) {
          onGoalWeightLbChange(clampedLbRounded.toString());
        }
        if (goalWeightKg !== roundTo1(lbToKg(clampedLb)).toString()) {
          onGoalWeightKgChange(roundTo1(lbToKg(clampedLb)).toString());
        }
      }
    }
  }, [currentWeightUnit, goalType, nudgeRange, currentWeightLb, goalWeightKg, goalWeightLb, onGoalWeightKgChange, onGoalWeightLbChange]);

  return (
    <View style={styles.stepContentAnimated}>
      {/* Illustration */}
      <View style={styles.stepIllustration}>
        <View
          style={{
            width: 172, // Illustration-specific size - not a theme token
            height: 172, // Illustration-specific size - not a theme token
            borderRadius: BorderRadius['3xl'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${onboardingColors.primary}0F`,
            ...Shadows.md,
          }}
        >
          <View
            style={{
              width: 148, // Illustration-specific size - not a theme token
              height: 148, // Illustration-specific size - not a theme token
              borderRadius: BorderRadius['3xl'],
              // Decorative hero surface: reduce glare in dark mode (do NOT use for inputs/toggles/buttons)
              backgroundColor: isDark ? colors.illustrationSurfaceDim : colors.background,
              borderWidth: Spacing.xs, // Using theme token for border width
              borderColor: isDark ? colors.strokeOnSoftStrong : `${onboardingColors.primary}50`,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Flag icon - representing goal */}
            <MaterialCommunityIcons
              name="flag"
              size={100} // Icon size - consistent across onboarding illustrations
              color={onboardingColors.primary}
            />
          </View>
        </View>
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.goal_weight.title')}
      </ThemedText>
      
      {/* Meta block for lose/gain */}
      {currentWeightLb !== null && (goalType === 'lose' || goalType === 'gain') && (
        <View style={styles.metaBlock}>
          <ThemedText style={[styles.metaLine, { color: colors.textSecondary }]}>
            {t('onboarding.goal_weight.your_current_weight')}: {roundTo1(currentWeightUnit === 'kg' ? lbToKg(currentWeightLb) : currentWeightLb)} {currentWeightUnit}
          </ThemedText>
          <ThemedText style={[styles.metaLine, { color: colors.textSecondary }]}>
            {t('onboarding.goal_weight.your_goal')}: {goalType === 'lose' 
              ? t('onboarding.goal.lose_weight.label')
              : t('onboarding.goal.gain_weight.label')}
          </ThemedText>
          {goalWeightSuggestion?.ok ? (
            <ThemedText style={[styles.metaLineLast, { color: colors.textSecondary }]}>
              {String(t('onboarding.goal_weight.suggest_prefix'))}{' '}
              <Text style={{ fontWeight: FontWeight.bold }}>
                {roundToNearestHalf(currentWeightUnit === 'kg' ? lbToKg(goalWeightSuggestion.suggestedLb) : goalWeightSuggestion.suggestedLb)} {currentWeightUnit}
              </Text>
            </ThemedText>
          ) : goalWeightSuggestion ? (
            <ThemedText style={[styles.metaLineLast, { color: colors.textSecondary }]}>
              {String(t(goalWeightSuggestion.messageKey, goalWeightSuggestion.messageParams || {}))}
            </ThemedText>
          ) : null}
        </View>
      )}
      
      {/* Meta block for maintain/recomp */}
      {(goalType === 'maintain' || goalType === 'recomp') && nudgeRange && currentWeightLb !== null && (
        <View style={styles.metaBlock}>
          <ThemedText style={[styles.metaLine, { color: colors.textSecondary }]}>
            {t('onboarding.goal_weight.your_current_weight')}: {roundTo1(currentWeightUnit === 'kg' ? lbToKg(currentWeightLb) : currentWeightLb)} {currentWeightUnit}
          </ThemedText>
          <ThemedText style={[styles.metaLineLast, { color: colors.textSecondary }]}>
            {t('onboarding.goal_weight.your_goal')}: {goalType === 'maintain' 
              ? t('onboarding.goal.maintain_weight.label')
              : t('onboarding.goal.recomp.label')}
          </ThemedText>
        </View>
      )}
      
      {/* Conditional rendering: Nudge Picker for maintain/recomp, TextInput for lose/gain */}
      {(goalType === 'maintain' || goalType === 'recomp') && nudgeRange && currentWeightLb !== null ? (
        <View style={styles.nudgePickerContainer}>
          <WeightNudgePicker
            value={(() => {
              // Get current value in display unit, defaulting to current weight if empty
              if (currentWeightUnit === 'kg') {
                const kgValue = goalWeightKg.trim() !== '' ? parseFloat(goalWeightKg) : null;
                if (kgValue !== null && !isNaN(kgValue)) {
                  return kgValue;
                }
                return roundTo1(lbToKg(nudgeRange.currentLb));
              } else {
                const lbValue = goalWeightLb.trim() !== '' ? parseFloat(goalWeightLb) : null;
                if (lbValue !== null && !isNaN(lbValue)) {
                  return lbValue;
                }
                return roundTo1(nudgeRange.currentLb);
              }
            })()}
            min={
              currentWeightUnit === 'kg'
                ? roundTo1(lbToKg(nudgeRange.minLb))
                : roundTo1(nudgeRange.minLb)
            }
            max={
              currentWeightUnit === 'kg'
                ? roundTo1(lbToKg(nudgeRange.maxLb))
                : roundTo1(nudgeRange.maxLb)
            }
            step={currentWeightUnit === 'kg' ? 0.05 : 0.1}
            unit={currentWeightUnit === 'kg' ? 'kg' : 'lbs'}
            onChange={(nextDisplayValue) => {
              hasManuallyAdjustedRef.current = true;
              // Convert back to canonical lb and clamp
              const nextLb = currentWeightUnit === 'kg'
                ? kgToLb(nextDisplayValue)
                : nextDisplayValue;
              const clampedLb = Math.max(nudgeRange.minLb, Math.min(nudgeRange.maxLb, nextLb));
              
              // Update both kg and lb fields
              if (currentWeightUnit === 'kg') {
                onGoalWeightKgChange(roundTo1(nextDisplayValue).toString());
                onGoalWeightLbChange(roundTo3(clampedLb).toString());
              } else {
                onGoalWeightLbChange(roundTo1(nextDisplayValue).toString());
                onGoalWeightKgChange(roundTo1(lbToKg(clampedLb)).toString());
              }
              onErrorClear();
            }}
            onReset={() => {
              hasManuallyAdjustedRef.current = false;
              const resetLb = nudgeRange.currentLb;
              if (currentWeightUnit === 'kg') {
                const resetKg = roundTo1(lbToKg(resetLb));
                onGoalWeightKgChange(resetKg.toString());
                onGoalWeightLbChange(roundTo3(resetLb).toString());
              } else {
                const resetLbRounded = roundTo1(resetLb);
                onGoalWeightLbChange(resetLbRounded.toString());
                onGoalWeightKgChange(roundTo1(lbToKg(resetLb)).toString());
              }
              onErrorClear();
            }}
            disabled={nudgeRange.disabled || loading}
          />
        </View>
      ) : (
        /* Weight Input for lose/gain */
        <View style={styles.heightInputContainer}>
          {currentWeightUnit === 'kg' ? (
            <NumericUnitInput
              value={goalWeightKg}
              onChangeText={(text) => {
                hasManuallyAdjustedRef.current = true;
                onGoalWeightKgChange(limitWeightInput(text));
                onErrorClear();
              }}
              unitLabel="kg"
              placeholder={placeholder}
              keyboardType="numeric"
              width={88}
              disabled={loading}
              accessibilityLabel={t('onboarding.goal_weight.accessibility_label_kg')}
              accessibilityHint={placeholder}
              error={(error || errorKey) && !goalWeightKg ? (error || undefined) : undefined}
              required
              borderColor={(error || errorKey) && !goalWeightKg ? SemanticColors.error : colors.border}
            />
          ) : (
            <NumericUnitInput
              value={goalWeightLb}
              onChangeText={(text) => {
                hasManuallyAdjustedRef.current = true;
                onGoalWeightLbChange(limitWeightInput(text));
                onErrorClear();
              }}
              unitLabel="lb"
              placeholder={placeholder}
              keyboardType="numeric"
              width={120}
              disabled={loading}
              accessibilityLabel={t('onboarding.goal_weight.accessibility_label_lb')}
              accessibilityHint={placeholder}
              error={(error || errorKey) && !goalWeightLb ? (error || undefined) : undefined}
              required
              borderColor={(error || errorKey) && !goalWeightLb ? SemanticColors.error : colors.border}
            />
          )}
        </View>
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
  suggestionText: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * LineHeight.normal,
  },
  metaBlock: {
    alignItems: 'center',
    marginTop: 0,
  },
  metaLine: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * LineHeight.normal,
    marginBottom: Spacing.xs,
  },
  metaLineLast: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * LineHeight.normal,
    marginBottom: 0,
  },
  heightInputContainer: {
    marginTop: Spacing.md,
    gap: Spacing.md,
    width: '100%',
    maxWidth: '100%',
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  inputModern: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    minHeight: Spacing['5xl'] + Spacing.xs, // 48 + 4 = 52px - using theme tokens
    width: '100%',
    maxWidth: '100%',
    ...Platform.select({
      web: {
        outlineWidth: 0,
        boxSizing: 'border-box',
      },
      default: {},
    }),
  },
  inputUnitLabel: {
    position: 'absolute',
    right: Spacing.lg,
    top: '50%',
    transform: [{ translateY: -Spacing.sm }], // Using theme token instead of hardcoded -10
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  nudgePickerContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
});

