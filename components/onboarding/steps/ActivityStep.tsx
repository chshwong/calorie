import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, LineHeight } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface ActivityStepProps {
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | '';
  onActivityLevelChange: (level: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high') => void;
  onErrorClear: () => void;
  loading: boolean;
  colors: typeof Colors.light;
}

const ActivityIllustration = () => (
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
      {/* Running icon from MaterialCommunityIcons - solid fill */}
      <MaterialCommunityIcons
        name="run-fast"
        size={100}
        color={onboardingColors.primary}
        style={{
          position: 'absolute',
        }}
      />
    </View>
  </View>
);

export const ActivityStep: React.FC<ActivityStepProps> = ({
  activityLevel,
  onActivityLevelChange,
  onErrorClear,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const [pressedCard, setPressedCard] = useState<string | null>(null);
  
  return (
    <View style={styles.stepContentAnimated}>
      {/* Illustration */}
      <View style={styles.stepIllustration}>
        <ActivityIllustration />
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.activity.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.activity.subtitle')}
      </ThemedText>
      
      <View style={styles.goalContainer}>
        {[
          { value: 'sedentary' as const, labelKey: 'onboarding.activity.sedentary.label', descriptionKey: 'onboarding.activity.sedentary.description' },
          { value: 'light' as const, labelKey: 'onboarding.activity.light.label', descriptionKey: 'onboarding.activity.light.description' },
          { value: 'moderate' as const, labelKey: 'onboarding.activity.moderate.label', descriptionKey: 'onboarding.activity.moderate.description' },
          { value: 'high' as const, labelKey: 'onboarding.activity.high.label', descriptionKey: 'onboarding.activity.high.description' },
          { value: 'very_high' as const, labelKey: 'onboarding.activity.very_high.label', descriptionKey: 'onboarding.activity.very_high.description' },
        ].map((activity) => {
          const selected = activityLevel === activity.value;
          const pressed = pressedCard === activity.value;
          
          // Compute shadow styles based on selection state
          const shadowStyle = !selected 
            ? (Platform.OS === 'web' 
                ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' as const, transition: 'all 0.2s ease' as const }
                : Shadows.sm)
            : (Platform.OS === 'web'
                ? { 
                    background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})` as const,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' as const,
                    transition: 'all 0.2s ease' as const,
                  }
                : { backgroundColor: onboardingColors.primary, ...Shadows.lg });
          
          return (
            <TouchableOpacity
              key={activity.value}
              style={[
                styles.goalCard,
                {
                  borderColor: selected ? Colors.light.background : colors.border,
                  backgroundColor: selected ? undefined : colors.background,
                  borderWidth: selected ? 0 : 1,
                  borderRadius: BorderRadius.xl,
                  paddingVertical: Spacing.md,
                  paddingHorizontal: Spacing.lg,
                  transform: [{ scale: selected ? 1.02 : pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.96 : 1,
                },
                shadowStyle,
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={() => {
                onActivityLevelChange(activity.value);
                onErrorClear();
              }}
              onPressIn={() => setPressedCard(activity.value)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(activity.labelKey)}${selected ? ' selected' : ''}`,
                `Double tap to select ${t(activity.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={{ flex: 1, paddingRight: selected ? Spacing['4xl'] : 0 }}>
                <Text 
                  variant="h4" 
                  style={[styles.goalCardTitle, { color: selected ? Colors.light.textInverse : colors.text }]}
                >
                  {t(activity.labelKey)}
                </Text>
                <Text 
                  variant="body" 
                  style={[styles.goalCardDescription, { color: selected ? Colors.light.textInverse : colors.textSecondary, opacity: selected ? 0.9 : 1 }]}
                >
                  {t(activity.descriptionKey)}
                </Text>
              </View>
              {selected && (
                <View style={styles.goalCardCheckmark}>
                  <IconSymbol name="checkmark.circle.fill" size={Spacing['2xl']} color={Colors.light.textInverse} />
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
  goalContainer: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  goalCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    position: 'relative',
    minHeight: 80,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  goalCardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  goalCardDescription: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  goalCardCheckmark: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
});
