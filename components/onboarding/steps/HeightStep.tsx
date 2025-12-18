import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Layout, Typography, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { filterNumericInput } from '@/utils/inputFilters';
import { getInputAccessibilityProps, getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { ftInToCm, cmToFtIn, roundTo1 } from '@/utils/bodyMetrics';

interface HeightStepProps {
  heightCm: string;
  heightFt: string;
  heightIn: string;
  heightUnit: 'cm' | 'ft/in';
  onHeightCmChange: (text: string) => void;
  onHeightFtChange: (text: string) => void;
  onHeightInChange: (text: string) => void;
  onHeightUnitChange: (unit: 'cm' | 'ft/in') => void;
  onErrorClear: () => void;
  error: string | null;
  loading: boolean;
  colors: typeof Colors.light;
}

const HeightIllustration = () => {
  const colorScheme = 'light'; // Illustration uses fixed colors
  const colors = Colors[colorScheme];
  
  return (
    <View
      style={[
        styles.illustrationContainer,
        {
          backgroundColor: `${onboardingColors.primary}0F`,
          ...(Platform.OS === 'web' ? {} : Shadows.card),
        },
      ]}
    >
      <View
        style={[
          styles.illustrationInner,
          {
            backgroundColor: colors.background,
            borderColor: `${onboardingColors.primary}50`,
          },
        ]}
      >
        {/* Ruler */}
        <View
          style={[
            styles.illustrationRuler,
            {
              backgroundColor: `${onboardingColors.primary}12`,
              borderColor: `${onboardingColors.primary}60`,
            },
          ]}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.illustrationRulerMark,
                {
                  backgroundColor: onboardingColors.primary,
                  opacity: i % 2 === 0 ? 0.9 : 0.6,
                },
              ]}
            />
          ))}
        </View>

        {/* Person silhouette */}
        <View style={styles.illustrationPerson}>
          {/* Head */}
          <View
            style={[
              styles.illustrationHead,
              { backgroundColor: onboardingColors.primary },
            ]}
          />
          {/* Torso */}
          <View
            style={[
              styles.illustrationTorso,
              { backgroundColor: onboardingColors.primary },
            ]}
          />
          {/* Arms */}
          <View
            style={[
              styles.illustrationArms,
              { backgroundColor: `${onboardingColors.primary}85` },
            ]}
          />
          {/* Legs */}
          <View style={styles.illustrationLegs}>
            {[0, 1].map((i) => (
              <View
                key={i}
                style={[
                  styles.illustrationLeg,
                  {
                    backgroundColor: i === 0 ? onboardingColors.primary : `${onboardingColors.primary}75`,
                    transform: [{ rotate: i === 0 ? '6deg' : '-6deg' }],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export const HeightStep: React.FC<HeightStepProps> = ({
  heightCm,
  heightFt,
  heightIn,
  heightUnit,
  onHeightCmChange,
  onHeightFtChange,
  onHeightInChange,
  onHeightUnitChange,
  onErrorClear,
  error,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  
  const isSelected = (value: string) => heightUnit === value;
  
  const handleUnitChange = (unit: 'cm' | 'ft/in') => {
    if (unit === 'cm') {
      onHeightUnitChange('cm');
      if (heightFt && heightIn) {
        const ft = parseFloat(heightFt);
        const inches = parseFloat(heightIn);
        if (!isNaN(ft) && !isNaN(inches)) {
          const cm = ftInToCm(ft, inches);
          onHeightCmChange(roundTo1(cm).toString());
        }
      }
    } else {
      onHeightUnitChange('ft/in');
      if (heightCm) {
        const cm = parseFloat(heightCm);
        if (!isNaN(cm)) {
          const result = cmToFtIn(cm);
          if (result) {
            onHeightFtChange(result.feet.toString());
            onHeightInChange(result.inches.toString());
          }
        }
      }
    }
    onErrorClear();
  };
  
  return (
    <View style={styles.stepContentAnimated}>
      {/* Illustration */}
      <View style={styles.stepIllustration}>
        <HeightIllustration />
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.height.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.height.subtitle')}
      </ThemedText>
      
      {/* Unit Toggle - Modern Pill Style */}
      <View style={styles.unitToggleModern}>
        {[
          { value: 'cm', label: 'cm' },
          { value: 'ft/in', label: 'ft/in' },
        ].map((unitOption) => {
          const selected = isSelected(unitOption.value);
          
          return (
            <TouchableOpacity
              key={unitOption.value}
              style={[
                styles.unitPill,
                selected && styles.unitPillSelected,
                {
                  transform: [{ scale: selected ? 1.02 : 1 }],
                },
                selected && {
                  ...(Platform.OS === 'web'
                    ? {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: `0 4px 12px ${onboardingColors.primary}40`,
                      }
                    : {
                        backgroundColor: onboardingColors.primary,
                        ...Shadows.lg,
                      }
                  ),
                },
                !selected && {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  ...(Platform.OS === 'web' ? { boxShadow: 'none' as any, transition: 'all 0.2s ease' as any } : {}),
                },
              ]}
              onPress={() => handleUnitChange(unitOption.value as 'cm' | 'ft/in')}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${unitOption.label}${selected ? ' selected' : ''}`,
                `Double tap to select ${unitOption.label}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <ThemedText
                style={[
                  styles.unitPillText,
                  { color: selected ? colors.textInverse : onboardingColors.primary },
                ]}
              >
                {unitOption.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Height Inputs */}
      <View style={styles.heightInputContainer}>
        {heightUnit === 'cm' ? (
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor: error && !heightCm ? colors.error : colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder={t('onboarding.height.height_cm_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={heightCm}
              onChangeText={(text) => {
                onHeightCmChange(filterNumericInput(text));
                onErrorClear();
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                t('onboarding.height.height_cm_accessibility_label'),
                t('onboarding.height.height_cm_placeholder'),
                error && !heightCm ? error : undefined,
                true
              )}
            />
            <ThemedText style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>cm</ThemedText>
          </View>
        ) : (
          <View style={styles.dualInputRowModern}>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <TextInput
                style={[
                  styles.inputModern,
                  {
                    borderColor: error && !heightFt ? colors.error : colors.border,
                    color: colors.text,
                    backgroundColor: colors.background,
                  },
                  Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                ]}
                placeholder={t('onboarding.height.height_ft_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={heightFt}
                onChangeText={(text) => {
                  onHeightFtChange(filterNumericInput(text));
                  onErrorClear();
                }}
                keyboardType="numeric"
                editable={!loading}
                {...getInputAccessibilityProps(
                  t('onboarding.height.height_ft_accessibility_label'),
                  t('onboarding.height.height_ft_placeholder'),
                  error && !heightFt ? error : undefined,
                  true
                )}
              />
              <ThemedText style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>ft</ThemedText>
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <TextInput
                style={[
                  styles.inputModern,
                  {
                    borderColor: error && !heightIn ? colors.error : colors.border,
                    color: colors.text,
                    backgroundColor: colors.background,
                  },
                  Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                ]}
                placeholder={t('onboarding.height.height_in_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={heightIn}
                onChangeText={(text) => {
                  onHeightInChange(filterNumericInput(text));
                  onErrorClear();
                }}
                keyboardType="numeric"
                editable={!loading}
                {...getInputAccessibilityProps(
                  t('onboarding.height.height_in_accessibility_label'),
                  t('onboarding.height.height_in_placeholder'),
                  error && !heightIn ? error : undefined,
                  true
                )}
              />
              <ThemedText style={[styles.inputUnitLabel, { color: colors.textSecondary }]}>in</ThemedText>
            </View>
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
  stepTitle: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    ...Typography.bodyLarge,
    marginBottom: Spacing['2xl'],
    textAlign: 'center',
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
    borderWidth: 1, // Standard border width - not a theme token
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100, // Minimum width for pill buttons - not a theme token
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
  unitPillText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
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
    borderWidth: 1, // Standard border width - not a theme token
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    minHeight: Layout.minTouchTarget, // WCAG 2.0 AA: minimum 44x44 touch target
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
    transform: [{ translateY: -Spacing.sm - Spacing.xs }], // -10px for centering
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  dualInputRowModern: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    minWidth: 0,
    alignItems: 'stretch',
    flexShrink: 1,
    maxWidth: '100%',
  },
  illustrationContainer: {
    width: 172, // Illustration-specific size - not a theme token
    height: 172, // Illustration-specific size - not a theme token
    borderRadius: BorderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationInner: {
    width: 148, // Illustration-specific size - not a theme token
    height: 148, // Illustration-specific size - not a theme token
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1, // Standard border width - not a theme token
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  illustrationRuler: {
    width: 16, // Illustration-specific size - not a theme token
    height: 118, // Illustration-specific size - not a theme token
    borderRadius: BorderRadius.lg,
    borderWidth: 1, // Standard border width - not a theme token
    marginRight: Spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + Spacing.xs, // 10px padding for illustration
    paddingHorizontal: Spacing.xs,
  },
  illustrationRulerMark: {
    height: 1, // 2px height for ruler marks - not a theme token
  },
  illustrationPerson: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 82, // Illustration-specific size - not a theme token
    height: 118, // Illustration-specific size - not a theme token
    position: 'relative',
  },
  illustrationHead: {
    width: 28, // Illustration-specific size - not a theme token
    height: 28, // Illustration-specific size - not a theme token
    borderRadius: 14, // Half of width/height for circle - not a theme token
    marginBottom: Spacing.xs + Spacing.xxs, // 6px margin for illustration
  },
  illustrationTorso: {
    width: 14, // Illustration-specific size - not a theme token
    height: 44, // Illustration-specific size - not a theme token
    borderRadius: BorderRadius.lg,
  },
  illustrationArms: {
    position: 'absolute',
    top: 44, // Illustration-specific positioning - not a theme token
    width: 72, // Illustration-specific size - not a theme token
    height: Spacing.md, // 12px height for illustration
    borderRadius: BorderRadius.lg,
    transform: [{ rotate: '-10deg' }],
  },
  illustrationLegs: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 62, // Illustration-specific size - not a theme token
  },
  illustrationLeg: {
    width: 14, // Illustration-specific size - not a theme token
    height: 44, // Illustration-specific size - not a theme token
    borderRadius: BorderRadius.lg,
  },
});

