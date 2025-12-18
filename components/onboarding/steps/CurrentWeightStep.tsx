import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
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
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${onboardingColors.primary}0F`,
            shadowColor: '#000',
            shadowOpacity: Platform.OS === 'web' ? 0 : 0.08,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <View
            style={{
              width: 148,
              height: 148,
              borderRadius: 24,
              backgroundColor: '#fff',
              borderWidth: 2,
              borderColor: `${onboardingColors.primary}50`,
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingTop: 18,
              overflow: 'hidden',
            }}
          >
            {/* Scale window */}
            <View
              style={{
                width: 96,
                height: 42,
                borderRadius: 12,
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
                  borderRadius: 3,
                  backgroundColor: `${onboardingColors.primary}30`,
                  position: 'absolute',
                  top: 10,
                }}
              />
              <View
                style={{
                  width: 2,
                  height: 22,
                  backgroundColor: onboardingColors.primary,
                  borderRadius: 2,
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
                marginTop: 22,
              }}
            >
              {[0, 1].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 46,
                    height: 62,
                    borderRadius: 18,
                    backgroundColor: `${onboardingColors.primary}14`,
                    borderWidth: 1.5,
                    borderColor: `${onboardingColors.primary}30`,
                    shadowColor: '#000',
                    shadowOpacity: Platform.OS === 'web' ? 0 : 0.05,
                    shadowOffset: { width: 0, height: 4 },
                    shadowRadius: 6,
                    elevation: 2,
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
          {currentWeightUnit === 'kg' ? (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: error && !currentWeightKg ? '#EF4444' : '#E5E7EB',
                  color: colors.text,
                  backgroundColor: '#FFFFFF',
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={t('onboarding.current_weight.weight_kg_placeholder')}
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
                t('onboarding.current_weight.weight_kg_placeholder'),
                error && !currentWeightKg ? error : undefined,
                true
              )}
            />
          ) : (
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: error && !currentWeightLb ? '#EF4444' : '#E5E7EB',
                  color: colors.text,
                  backgroundColor: '#FFFFFF',
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={t('onboarding.current_weight.weight_lb_placeholder')}
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
                t('onboarding.current_weight.weight_lb_placeholder'),
                error && !currentWeightLb ? error : undefined,
                true
              )}
            />
          )}
          <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>
            {currentWeightUnit}
          </Text>
        </View>

        {/* Body Fat % (optional) */}
        <View style={{ width: '100%', marginTop: 16 }}>
          <ThemedText style={[styles.label, { color: colors.text, marginBottom: 8 }]}>
            Body Fat % (optional)
          </ThemedText>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor:
                    error && currentBodyFatPercent && (parseFloat(currentBodyFatPercent) <= 0 || parseFloat(currentBodyFatPercent) > 80)
                      ? '#EF4444'
                      : '#E5E7EB',
                  color: colors.text,
                  backgroundColor: '#FFFFFF',
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder="Optional (e.g., 18.5)"
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
                'Body fat percentage',
                'Enter your body fat percentage',
                undefined,
                false
              )}
            />
            <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>%</Text>
          </View>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
});

