import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, SemanticColors, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { filterNumericInput } from '@/utils/inputFilters';
import { getInputAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface GoalWeightStepProps {
  goalWeightKg: string;
  goalWeightLb: string;
  currentWeightUnit: 'kg' | 'lb';
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
  onGoalWeightKgChange,
  onGoalWeightLbChange,
  onErrorClear,
  error,
  errorKey,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  
  // Placeholder examples
  const weightKgPlaceholder = '(e.g., 79)';
  const weightLbPlaceholder = '(e.g., 175)';
  
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
              borderWidth: 2,
              borderColor: `${onboardingColors.primary}50`,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Flag icon - representing goal */}
            <MaterialCommunityIcons
              name="flag"
              size={100}
              color={onboardingColors.primary}
              style={{
                position: 'absolute',
              }}
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
              placeholder={weightKgPlaceholder}
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
                weightKgPlaceholder,
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
              placeholder={weightLbPlaceholder}
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
                weightLbPlaceholder,
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
    minHeight: 52,
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
    transform: [{ translateY: -10 }],
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});

