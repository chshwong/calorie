import React, { useMemo, useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, SemanticColors, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { filterNumericInput } from '@/utils/inputFilters';
import { getInputAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { type GoalType, type SuggestionResult } from '@/lib/onboarding/goal-weight-rules';
import { lbToKg } from '@/lib/domain/weight-constants';
import { roundTo1 } from '@/utils/bodyMetrics';

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
        ? roundTo1(lbToKg(goalWeightSuggestion.suggestedLb))
        : roundTo1(goalWeightSuggestion.suggestedLb);
      
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

  // Reset prefill flag when goalType changes (user navigated from GoalStep)
  useEffect(() => {
    if (goalType && goalType !== previousGoalTypeRef.current) {
      previousGoalTypeRef.current = goalType;
      hasPrefilledForCurrentGoalRef.current = false;
    }
  }, [goalType]);

  // Prefill weight fields with suggested weight only when:
  // 1. User just navigated from GoalStep (goalType changed, we haven't prefilled yet)
  // 2. Suggestion is available
  // 3. Fields are empty
  useEffect(() => {
    if (suggestedWeightLb === null || !goalType) {
      return;
    }

    // Only prefill once when goalType changes and fields are empty
    if (
      !hasPrefilledForCurrentGoalRef.current &&
      goalWeightKg.trim() === '' &&
      goalWeightLb.trim() === ''
    ) {
      if (currentWeightUnit === 'kg') {
        const suggestedKg = roundTo1(lbToKg(suggestedWeightLb));
        onGoalWeightKgChange(suggestedKg.toString());
      } else {
        const suggestedLb = roundTo1(suggestedWeightLb);
        onGoalWeightLbChange(suggestedLb.toString());
      }
      // Mark that we've prefilled for this goalType
      // This prevents refilling if user manually clears the field later
      hasPrefilledForCurrentGoalRef.current = true;
    }
  }, [suggestedWeightLb, currentWeightUnit, goalType, goalWeightKg, goalWeightLb, onGoalWeightKgChange, onGoalWeightLbChange]);
  
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
              backgroundColor: Colors.light.background,
              borderWidth: Spacing.xs, // Using theme token for border width
              borderColor: `${onboardingColors.primary}50`,
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
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.goal_weight.subtitle')}
      </ThemedText>
      
      {/* Suggestion Text */}
      {suggestionText && (
        <ThemedText style={[styles.suggestionText, { color: colors.textSecondary }]}>
          {suggestionText}
        </ThemedText>
      )}
      
      {/* Weight Input */}
      <View style={styles.heightInputContainer}>
        <View style={styles.inputWrapper}>
          {currentWeightUnit === 'kg' ? (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: (error || errorKey) && !goalWeightKg ? SemanticColors.error : colors.border,
                  color: colors.text,
                  backgroundColor: Colors.light.background,
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              value={goalWeightKg}
              onChangeText={(text) => {
                onGoalWeightKgChange(limitWeightInput(text));
                onErrorClear();
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                t('onboarding.goal_weight.accessibility_label_kg'),
                placeholder,
                error && !goalWeightKg ? error : undefined,
                true
              )}
            />
          ) : (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: (error || errorKey) && !goalWeightLb ? SemanticColors.error : colors.border,
                  color: colors.text,
                  backgroundColor: Colors.light.background,
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              value={goalWeightLb}
              onChangeText={(text) => {
                onGoalWeightLbChange(limitWeightInput(text));
                onErrorClear();
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                t('onboarding.goal_weight.accessibility_label_lb'),
                placeholder,
                error && !goalWeightLb ? error : undefined,
                true
              )}
            />
          )}
          <Text variant="label" style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>
            {currentWeightUnit}
          </Text>
        </View>
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
        animation: 'fadeUp 0.3s ease',
        '@keyframes fadeUp': {
          from: { opacity: 0, transform: `translateY(${Spacing.md}px)` },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
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
  suggestionText: {
    fontSize: FontSize.base,
    marginBottom: Spacing.md,
    textAlign: 'center',
    lineHeight: FontSize.base * LineHeight.normal,
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
        outline: 'none',
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
});

