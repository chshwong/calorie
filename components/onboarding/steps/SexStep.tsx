import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Layout, Typography, Shadows, LineHeight } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SexStepProps {
  sex: 'male' | 'female' | '';
  onSexChange: (sex: 'male' | 'female') => void;
  onErrorClear: () => void;
  loading: boolean;
  colors: typeof Colors.light;
}

const GenderIllustration = ({ colors, isDark }: { colors: typeof Colors.light; isDark: boolean }) => {
  
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
            // Decorative hero surface: reduce glare in dark mode (do NOT use for inputs/toggles/buttons)
            backgroundColor: isDark ? colors.illustrationSurfaceDim : colors.background,
            borderColor: isDark ? colors.strokeOnSoftStrong : `${onboardingColors.primary}50`,
          },
        ]}
      >
        <View style={styles.illustrationSymbols}>
          {[
            { bg: `${onboardingColors.primary}12`, color: onboardingColors.primary, symbol: '♀' },
            { bg: `${onboardingColors.primary}10`, color: onboardingColors.primaryDark, symbol: '♂' },
          ].map((item, idx) => (
            <View
              key={idx}
              style={[
                styles.illustrationSymbol,
                {
                  backgroundColor: item.bg,
                  borderColor: `${onboardingColors.primary}40`,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.illustrationSymbolText,
                  { color: item.color },
                ]}
              >
                {item.symbol}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export const SexStep: React.FC<SexStepProps> = ({
  sex,
  onSexChange,
  onErrorClear,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const [pressedCard, setPressedCard] = useState<string | null>(null);
  
  const isSelected = (value: string) => sex === value;
  
  return (
    <View style={styles.stepContentAnimated}>
      {/* SVG Illustration */}
      <View style={styles.stepIllustration}>
        <GenderIllustration colors={colors} isDark={isDark} />
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.sex.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.sex.subtitle')}
      </ThemedText>
      
      <View style={styles.sexContainer}>
        {[
          { value: 'male' as const, labelKey: 'onboarding.sex.male' },
          { value: 'female' as const, labelKey: 'onboarding.sex.female' },
        ].map((sexOption) => {
          const selected = isSelected(sexOption.value);
          const pressed = pressedCard === sexOption.value;
          
          return (
            <TouchableOpacity
              key={sexOption.value}
              style={[
                styles.sexCard,
                {
                  borderColor: selected ? 'transparent' : colors.border,
                  backgroundColor: selected ? undefined : colors.background,
                  borderWidth: selected ? 0 : 1, // Standard border width - not a theme token
                  transform: [{ scale: selected ? 1.02 : pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.96 : 1,
                },
                !selected && {
                  ...(Platform.OS === 'web' 
                    ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', transition: 'all 0.2s ease' } // Shadows.sm web value
                    : Shadows.sm
                  ),
                },
                selected && {
                  ...(Platform.OS === 'web'
                    ? {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', // Shadows.lg web value
                        transition: 'all 0.2s ease',
                      }
                    : {
                        backgroundColor: onboardingColors.primary,
                        ...Shadows.lg,
                      }
                  ),
                },
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={() => {
                onSexChange(sexOption.value);
                onErrorClear();
              }}
              onPressIn={() => setPressedCard(sexOption.value)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(sexOption.labelKey)}${selected ? ' selected' : ''}`,
                `Double tap to select ${t(sexOption.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={[styles.sexCardContent, { paddingRight: selected ? Spacing['4xl'] : 0 }]}>
                <ThemedText style={[styles.sexCardTitle, { color: selected ? colors.textInverse : colors.text }]}>
                  {t(sexOption.labelKey)}
                </ThemedText>
              </View>
              {selected && (
                <View style={styles.sexCardCheckmark}>
                  <IconSymbol name="checkmark.circle.fill" size={FontSize['2xl']} color={colors.textInverse} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
  sexContainer: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  sexCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1, // Standard border width - not a theme token
    position: 'relative',
    minHeight: Layout.minTouchTarget, // WCAG 2.0 AA: minimum 44x44 touch target
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  sexCardContent: {
    flex: 1,
  },
  sexCardTitle: {
    ...Typography.h4,
  },
  sexCardCheckmark: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  illustrationSymbols: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '88%', // Percentage-based layout - not a theme token
    gap: Spacing.md + Spacing.xs, // 14px gap for illustration
  },
  illustrationSymbol: {
    width: 60, // Illustration-specific size - not a theme token
    height: 96, // Illustration-specific size - not a theme token
    borderRadius: BorderRadius.xl,
    borderWidth: 1, // Standard border width - not a theme token
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + Spacing.xs, // 10px padding for illustration
  },
  illustrationSymbolText: {
    fontSize: FontSize['4xl'],
    lineHeight: FontSize['4xl'] * LineHeight.tight,
    fontWeight: FontWeight.semibold,
  },
});

