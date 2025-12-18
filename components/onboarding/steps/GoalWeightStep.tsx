import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { kgToLb, lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { filterNumericInput } from '@/utils/inputFilters';
import { getInputAccessibilityProps, getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface GoalWeightStepProps {
  goalWeightKg: string;
  goalWeightLb: string;
  goalWeightUnit: 'kg' | 'lb';
  onGoalWeightKgChange: (text: string) => void;
  onGoalWeightLbChange: (text: string) => void;
  onGoalWeightUnitChange: (unit: 'kg' | 'lb') => void;
  onErrorClear: () => void;
  error: string | null;
  errorKey: string | null;
  errorParams: Record<string, any> | undefined;
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
  goalWeightUnit,
  onGoalWeightKgChange,
  onGoalWeightLbChange,
  onGoalWeightUnitChange,
  onErrorClear,
  error,
  errorKey,
  errorParams,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  
  const isSelected = (value: string) => goalWeightUnit === value;
  
  const handleUnitChange = (unit: 'kg' | 'lb') => {
    if (unit === 'kg') {
      onGoalWeightUnitChange('kg');
      if (goalWeightLb) {
        const kg = roundTo1(lbToKg(parseFloat(goalWeightLb)));
        onGoalWeightKgChange(kg.toString());
      }
    } else {
      onGoalWeightUnitChange('lb');
      if (goalWeightKg) {
        const lbs = roundTo1(kgToLb(parseFloat(goalWeightKg)));
        onGoalWeightLbChange(lbs.toString());
      }
    }
    onErrorClear();
  };
  
  return (
    <View style={styles.stepContentAnimated}>
      {/* SVG Illustration */}
      <View style={styles.stepIllustration}>
        {Platform.OS === 'web' ? (
          <View
            style={{
              width: 48,
              height: 48,
            }}
            // @ts-ignore - web-specific prop
            dangerouslySetInnerHTML={{
              __html: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${onboardingColors.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
            }}
          />
        ) : (
          <IconSymbol name="target" size={48} color={onboardingColors.primary} />
        )}
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.goal_weight.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.goal_weight.subtitle')}
      </ThemedText>
      
      {/* Unit Toggle - Modern Pill Style */}
      <View style={styles.unitToggleModern}>
        {[
          { value: 'kg', label: 'kg' },
          { value: 'lb', label: 'lbs' },
        ].map((unitOption) => {
          const selected = isSelected(unitOption.value);
          
          return (
            <TouchableOpacity
              key={unitOption.value}
              style={[
                styles.unitPill,
                selected ? styles.unitPillSelected : styles.unitPillUnselected,
                {
                  transform: [{ scale: selected ? 1.02 : 1 }],
                },
                selected && {
                  ...Platform.select({
                    web: {
                      background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                      boxShadow: `0 4px 12px ${onboardingColors.primary}40`,
                    },
                    default: {
                      backgroundColor: onboardingColors.primary,
                    },
                  }),
                },
                Platform.select({
                  web: {
                    transition: 'all 0.2s ease',
                  },
                  default: {},
                }),
              ]}
              onPress={() => handleUnitChange(unitOption.value as 'kg' | 'lb')}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${unitOption.label}${selected ? ' selected' : ''}`,
                `Double tap to select ${unitOption.label}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.unitPillText,
                  { color: selected ? '#FFFFFF' : onboardingColors.primary },
                ]}
              >
                {unitOption.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Weight Input */}
      <View style={styles.heightInputContainer}>
        <View style={styles.inputWrapper}>
          {goalWeightUnit === 'kg' ? (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: (error || errorKey) && !goalWeightKg ? '#EF4444' : '#E5E7EB',
                  color: colors.text,
                  backgroundColor: '#FFFFFF',
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={t('onboarding.goal_weight.weight_kg_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={goalWeightKg}
              onChangeText={(text) => {
                onGoalWeightKgChange(limitWeightInput(text));
                onErrorClear();
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Goal weight in kilograms',
                t('onboarding.goal_weight.weight_kg_placeholder'),
                error && !goalWeightKg ? error : undefined,
                true
              )}
            />
          ) : (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: (error || errorKey) && !goalWeightLb ? '#EF4444' : '#E5E7EB',
                  color: colors.text,
                  backgroundColor: '#FFFFFF',
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={t('onboarding.goal_weight.weight_lb_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={goalWeightLb}
              onChangeText={(text) => {
                onGoalWeightLbChange(limitWeightInput(text));
                onErrorClear();
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Goal weight in pounds',
                t('onboarding.goal_weight.weight_lb_placeholder'),
                error && !goalWeightLb ? error : undefined,
                true
              )}
            />
          )}
          <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>
            {goalWeightUnit}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepContentAnimated: {
    gap: 20,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        animation: 'fadeUp 0.3s ease',
        '@keyframes fadeUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
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
    marginBottom: 16,
  },
  stepTitleModern: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitleModern: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  unitToggleModern: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitPill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  unitPillSelected: {
    borderWidth: 0,
  },
  unitPillUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  unitPillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  heightInputContainer: {
    marginTop: 12,
    gap: 12,
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
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
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
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
    fontSize: 14,
    fontWeight: '600',
  },
});

