import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, LineHeight, SemanticColors } from '@/constants/theme';
import { PROFILES, DERIVED } from '@/constants/constraints';
import { onboardingColors } from '@/theme/onboardingTheme';
import { validateBodyFatPercent } from '@/utils/validation';
import { kgToLb, lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { filterNumericInput } from '@/utils/inputFilters';
import { getInputAccessibilityProps, getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface CurrentWeightStepProps {
  currentWeightKg: string;
  currentWeightLb: string;
  currentWeightUnit: 'kg' | 'lb';
  currentBodyFatPercent: string;
  onCurrentWeightKgChange: (text: string) => void;
  onCurrentWeightLbChange: (text: string) => void;
  onCurrentWeightUnitChange: (unit: 'kg' | 'lb') => void;
  onCurrentBodyFatPercentChange: (text: string) => void;
  onErrorClear: () => void;
  error: string | null;
  loading: boolean;
  colors: typeof Colors.light;
}

// Helper functions for input limiting
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

const limitBodyFatInput = (text: string): string => {
  const oneDecimal = limitToOneDecimal(text);
  const [intPart, decPart] = oneDecimal.split('.');
  const limitedInt = intPart.slice(0, 2); // max 2 digits before decimal
  return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
};

export const CurrentWeightStep: React.FC<CurrentWeightStepProps> = ({
  currentWeightKg,
  currentWeightLb,
  currentWeightUnit,
  currentBodyFatPercent,
  onCurrentWeightKgChange,
  onCurrentWeightLbChange,
  onCurrentWeightUnitChange,
  onCurrentBodyFatPercentChange,
  onErrorClear,
  error,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  
  // Placeholder examples
  const weightKgPlaceholder = '(e.g., 79)';
  const weightLbPlaceholder = '(e.g., 175)';
  
  const isSelected = (value: string) => currentWeightUnit === value;
  
  const handleUnitChange = (unit: 'kg' | 'lb') => {
    if (unit === 'kg') {
      onCurrentWeightUnitChange('kg');
      if (currentWeightLb) {
        const kg = roundTo1(lbToKg(parseFloat(currentWeightLb)));
        onCurrentWeightKgChange(kg.toString());
      }
    } else {
      onCurrentWeightUnitChange('lb');
      if (currentWeightKg) {
        const lbs = roundTo1(kgToLb(parseFloat(currentWeightKg)));
        onCurrentWeightLbChange(lbs.toString());
      }
    }
    onErrorClear();
  };
  
  return (
    <View style={styles.stepContentAnimated}>
      {/* SVG Illustration */}
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
              justifyContent: 'flex-start',
              paddingTop: Spacing.lg,
              overflow: 'hidden',
            }}
          >
            {/* Scale window */}
            <View
              style={{
                width: 96,
                height: 42,
                borderRadius: BorderRadius.md,
                backgroundColor: `${onboardingColors.primary}12`,
                borderWidth: 2,
                borderColor: `${onboardingColors.primary}50`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 70,
                  height: 6,
                  borderRadius: BorderRadius.sm,
                  backgroundColor: `${onboardingColors.primary}30`,
                  position: 'absolute',
                  top: Spacing.sm,
                }}
              />
              <View
                style={{
                  width: 2,
                  height: 22,
                  backgroundColor: onboardingColors.primary,
                  borderRadius: BorderRadius.sm,
                  transform: [{ rotate: '-8deg' }],
                }}
              />
            </View>

            {/* Foot pads */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: '72%',
                marginTop: Spacing.xl,
              }}
            >
              {[0, 1].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 46,
                    height: 62,
                    borderRadius: BorderRadius['2xl'],
                    backgroundColor: `${onboardingColors.primary}14`,
                    borderWidth: 1.5,
                    borderColor: `${onboardingColors.primary}30`,
                    ...Shadows.sm,
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.current_weight.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.current_weight.subtitle')}
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
                variant="body"
                style={{ color: selected ? Colors.light.textInverse : onboardingColors.primary }}
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
          {currentWeightUnit === 'kg' ? (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: error && !currentWeightKg ? SemanticColors.error : colors.border,
                  color: colors.text,
                  backgroundColor: Colors.light.background,
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={weightKgPlaceholder}
              placeholderTextColor={colors.textSecondary}
              value={currentWeightKg}
              onChangeText={(text) => {
                onCurrentWeightKgChange(limitWeightInput(text));
                onErrorClear();
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Current weight in kilograms',
                weightKgPlaceholder,
                error && !currentWeightKg ? error : undefined,
                true
              )}
            />
          ) : (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: error && !currentWeightLb ? SemanticColors.error : colors.border,
                  color: colors.text,
                  backgroundColor: Colors.light.background,
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={weightLbPlaceholder}
              placeholderTextColor={colors.textSecondary}
              value={currentWeightLb}
              onChangeText={(text) => {
                onCurrentWeightLbChange(limitWeightInput(text));
                onErrorClear();
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Current weight in pounds',
                weightLbPlaceholder,
                error && !currentWeightLb ? error : undefined,
                true
              )}
            />
          )}
          <Text variant="label" style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>
            {currentWeightUnit}
          </Text>
        </View>

        {/* Body Fat % (optional) */}
        <View style={{ width: '100%', marginTop: Spacing.lg }}>
          <ThemedText style={[styles.label, { color: colors.text, marginBottom: Spacing.sm }]}>
            {t('onboarding.current_weight.body_fat_label')}
          </ThemedText>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor:
                    error && currentBodyFatPercent && validateBodyFatPercent(parseFloat(currentBodyFatPercent)) !== null
                      ? SemanticColors.error
                      : colors.border,
                  color: colors.text,
                  backgroundColor: Colors.light.background,
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={t('onboarding.current_weight.body_fat_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={currentBodyFatPercent}
              onChangeText={(text) => {
                onCurrentBodyFatPercentChange(limitBodyFatInput(text));
                onErrorClear();
              }}
              maxLength={4}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                t('onboarding.current_weight.body_fat_accessibility_label'),
                t('onboarding.current_weight.body_fat_accessibility_hint'),
                undefined,
                false
              )}
            />
            <Text variant="label" style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>%</Text>
          </View>
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
  unitToggleModern: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitPill: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
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
    backgroundColor: Colors.light.background,
    borderColor: Colors.light.border,
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
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
});

