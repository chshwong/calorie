import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
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
        justifyContent: 'center',
      }}
    >
      {/* Head */}
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: onboardingColors.primary,
          marginBottom: 6,
        }}
      />
      {/* Torso */}
      <View
        style={{
          width: 10,
          height: 40,
          borderRadius: 8,
          backgroundColor: onboardingColors.primary,
          transform: [{ rotate: '-5deg' }],
        }}
      />
      {/* Arms */}
      <View
        style={{
          position: 'absolute',
          top: 70,
          width: 60,
          height: 10,
          borderRadius: 8,
          backgroundColor: `${onboardingColors.primary}90`,
          transform: [{ rotate: '-20deg' }],
        }}
      />
      {/* Front Leg */}
      <View
        style={{
          position: 'absolute',
          bottom: 34,
          left: 70,
          width: 14,
          height: 54,
          borderRadius: 10,
          backgroundColor: onboardingColors.primary,
          transform: [{ rotate: 22 }],
        }}
      />
      {/* Back Leg */}
      <View
        style={{
          position: 'absolute',
          bottom: 28,
          right: 66,
          width: 12,
          height: 46,
          borderRadius: 10,
          backgroundColor: `${onboardingColors.primary}70`,
          transform: [{ rotate: -18 }],
        }}
      />
      {/* Ground */}
      <View
        style={{
          position: 'absolute',
          bottom: 18,
          width: 96,
          height: 8,
          borderRadius: 6,
          backgroundColor: `${onboardingColors.primary}12`,
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
      {/* SVG Illustration */}
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
          
          return (
            <TouchableOpacity
              key={activity.value}
              style={[
                styles.goalCard,
                {
                  borderColor: selected ? 'transparent' : colors.border,
                  backgroundColor: selected ? undefined : colors.background,
                  borderWidth: selected ? 0 : 1,
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  transform: [{ scale: selected ? 1.02 : pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.96 : 1,
                },
                !selected && {
                  ...Platform.select({
                    web: {
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s ease',
                    },
                    default: {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 2,
                    },
                  }),
                },
                selected && {
                  ...Platform.select({
                    web: {
                      background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      transition: 'all 0.2s ease',
                    },
                    default: {
                      backgroundColor: onboardingColors.primary,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 12,
                      elevation: 4,
                    },
                  }),
                },
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
              <View style={{ flex: 1, paddingRight: selected ? 40 : 0 }}>
                <Text style={[styles.goalCardTitle, { color: selected ? '#fff' : colors.text }]}>
                  {t(activity.labelKey)}
                </Text>
                <Text style={[styles.goalCardDescription, { color: selected ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
                  {t(activity.descriptionKey)}
                </Text>
              </View>
              {selected && (
                <View style={styles.goalCardCheckmark}>
                  <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
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
  goalContainer: {
    gap: 12,
    marginTop: 8,
  },
  goalCard: {
    padding: 20,
    borderRadius: 16,
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
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  goalCardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  goalCardCheckmark: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});

