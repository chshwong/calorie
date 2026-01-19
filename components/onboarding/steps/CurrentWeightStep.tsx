import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, LineHeight, SemanticColors } from '@/constants/theme';
import { PROFILES, DERIVED } from '@/constants/constraints';
import { onboardingColors } from '@/theme/onboardingTheme';
import { validateBodyFatPercent } from '@/utils/validation';
import { kgToLb, lbToKg, roundTo1, roundTo3 } from '@/utils/bodyMetrics';
import { filterNumericInput } from '@/utils/inputFilters';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { NumericUnitInput } from '@/components/forms/NumericUnitInput';
import { BodyFatRangesModal } from '@/components/onboarding/body-fat-ranges-modal';
import { ageFromDob } from '@/utils/calculations';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CurrentWeightStepProps {
  currentWeightKg: string;
  currentWeightLb: string;
  currentWeightUnit: 'kg' | 'lb';
  currentBodyFatPercent: string;
  dobISO?: string | null;
  sexAtBirth: 'male' | 'female' | '' | null;
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
  dobISO,
  sexAtBirth,
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
  const isDark = useColorScheme() === 'dark';
  const [bfModalOpen, setBfModalOpen] = useState(false);
  const ageYears = dobISO ? ageFromDob(dobISO) : null;
  
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
              // Decorative hero surface: reduce glare in dark mode (do NOT use for inputs/toggles/buttons)
              backgroundColor: isDark ? colors.illustrationSurfaceDim : colors.background,
              borderWidth: 2,
              borderColor: isDark ? colors.strokeOnSoftStrong : `${onboardingColors.primary}50`,
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
          
          const selectedStyle = selected
            ? Platform.select({
                web: {
                  background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                  boxShadow: `0 4px 12px ${onboardingColors.primary}40`,
                },
                default: {
                  backgroundColor: onboardingColors.primary,
                },
              })
            : null;

          const transitionStyle = Platform.OS === 'web' ? ({ transition: 'all 0.2s ease' } as any) : null;

          return (
            <TouchableOpacity
              key={unitOption.value}
              style={[
                styles.unitPill,
                selected ? styles.unitPillSelected : null,
                !selected
                  ? {
                      // Unselected should be passive (no "white pill" in dark mode)
                      backgroundColor: colors.surfaceInteractive,
                      borderWidth: 0,
                    }
                  : null,
                {
                  transform: [{ scale: selected ? 1.02 : 1 }],
                },
                selectedStyle,
                transitionStyle,
              ].filter(Boolean)}
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
                style={{ color: selected ? Colors.light.textInverse : colors.textMutedOnDark }}
              >
                {unitOption.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Weight Input */}
      <View style={styles.heightInputContainer}>
        {currentWeightUnit === 'kg' ? (
          <NumericUnitInput
            value={currentWeightKg}
            onChangeText={(text) => {
              const sanitized = limitWeightInput(text);
              onCurrentWeightKgChange(sanitized);
              onErrorClear();
              
              // Sync to canonical LB field
              if (sanitized.trim() === '') {
                if (currentWeightLb !== '') {
                  onCurrentWeightLbChange('');
                }
              } else {
                const kgValue = parseFloat(sanitized);
                if (!isNaN(kgValue)) {
                  const lbs = kgToLb(kgValue);
                  const lbsString = roundTo3(lbs).toString();
                  if (currentWeightLb !== lbsString) {
                    onCurrentWeightLbChange(lbsString);
                  }
                }
              }
            }}
            unitLabel="kg"
            placeholder={weightKgPlaceholder}
            keyboardType="numeric"
            width={100}
            disabled={loading}
            accessibilityLabel="Current weight in kilograms"
            accessibilityHint={weightKgPlaceholder}
            error={error && !currentWeightKg ? error : undefined}
            required
            borderColor={error && !currentWeightKg ? SemanticColors.error : colors.border}
          />
        ) : (
          <NumericUnitInput
            value={currentWeightLb}
            onChangeText={(text) => {
              const sanitized = limitWeightInput(text);
              onCurrentWeightLbChange(sanitized);
              onErrorClear();
              
              // Sync to KG field
              if (sanitized.trim() === '') {
                if (currentWeightKg !== '') {
                  onCurrentWeightKgChange('');
                }
              } else {
                const lbValue = parseFloat(sanitized);
                if (!isNaN(lbValue)) {
                  const kg = lbToKg(lbValue);
                  const kgString = roundTo1(kg).toString();
                  if (currentWeightKg !== kgString) {
                    onCurrentWeightKgChange(kgString);
                  }
                }
              }
            }}
            unitLabel="lb"
            placeholder={weightLbPlaceholder}
            keyboardType="numeric"
            width={100}
            disabled={loading}
            accessibilityLabel="Current weight in pounds"
            accessibilityHint={weightLbPlaceholder}
            error={error && !currentWeightLb ? error : undefined}
            required
            borderColor={error && !currentWeightLb ? SemanticColors.error : colors.border}
          />
        )}

        {/* Body Fat % (optional) */}
        <View style={styles.bfBlock}>
          <View style={styles.bfHeaderRow}>
            <ThemedText style={[styles.bfLabel, { color: colors.text }]}>
              {t('onboarding.current_weight.body_fat_label')}
            </ThemedText>
            <TouchableOpacity
              onPress={() => setBfModalOpen(true)}
              disabled={loading}
              style={[
                styles.bfLinkPressable,
                Platform.OS === 'web' && (getFocusStyle(colors.tint) as any),
              ]}
              hitSlop={8}
              {...getButtonAccessibilityProps(
                t('onboarding.current_weight.body_fat_reference_label'),
                t('onboarding.current_weight.body_fat_reference_hint'),
                loading
              )}
            >
              <ThemedText style={[styles.bfLinkText, { color: colors.tint }]}>
                {t('onboarding.current_weight.body_fat_reference_label')}
              </ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.bfInputRow}>
            <NumericUnitInput
              value={currentBodyFatPercent}
              onChangeText={(text) => {
                onCurrentBodyFatPercentChange(limitBodyFatInput(text));
                onErrorClear();
              }}
              unitLabel="%"
              placeholder={t('onboarding.current_weight.body_fat_placeholder')}
              keyboardType="numeric"
              width={100}
              disabled={loading}
              accessibilityLabel={t('onboarding.current_weight.body_fat_accessibility_label')}
              accessibilityHint={t('onboarding.current_weight.body_fat_accessibility_hint')}
              borderColor={
                error && currentBodyFatPercent && validateBodyFatPercent(parseFloat(currentBodyFatPercent)) !== null
                  ? SemanticColors.error
                  : colors.border
              }
            />
          </View>
        </View>
      </View>

      {/* Body Fat Ranges Modal */}
      <BodyFatRangesModal
        visible={bfModalOpen}
        onClose={() => setBfModalOpen(false)}
        sex={sexAtBirth}
        ageYears={ageYears}
        colors={colors}
      />
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
  heightInputContainer: {
    marginTop: Spacing.none, // Reduced from Spacing.md to bring input closer to unit toggle
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
    transform: [{ translateY: -10 }],
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  bfBlock: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginTop: Spacing.lg,
  },
  bfHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  bfLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  bfLinkPressable: {
    marginLeft: Spacing.md,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  bfLinkText: {
    fontSize: FontSize.sm + 2,
    textDecorationLine: 'underline',
    lineHeight: FontSize.base * LineHeight.normal,
  },
  bfInputRow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

