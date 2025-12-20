import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, LineHeight } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle, AccessibilityHints } from '@/utils/accessibility';

type GoalType = 'lose' | 'gain' | 'maintain' | 'recomp';

interface GoalStepProps {
  goal: GoalType | '';
  showAdvancedGoals: boolean;
  onGoalChange: (goal: GoalType) => void;
  onShowAdvancedGoals: () => void;
  onErrorClear: () => void;
  loading: boolean;
  colors: typeof Colors.light;
}

export const GoalStep: React.FC<GoalStepProps> = ({
  goal,
  showAdvancedGoals,
  onGoalChange,
  onShowAdvancedGoals,
  onErrorClear,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const [pressedCard, setPressedCard] = useState<string | null>(null);
  
  const basicGoals: Array<{ value: GoalType; labelKey: string; descriptionKey: string }> = [
    {
      value: 'lose',
      labelKey: 'onboarding.goal.lose_weight.label',
      descriptionKey: 'onboarding.goal.lose_weight.description',
    },
    {
      value: 'maintain',
      labelKey: 'onboarding.goal.maintain_weight.label',
      descriptionKey: 'onboarding.goal.maintain_weight.description',
    },
    {
      value: 'gain',
      labelKey: 'onboarding.goal.gain_weight.label',
      descriptionKey: 'onboarding.goal.gain_weight.description',
    },
  ];
  
  const advancedGoals: Array<{ value: GoalType; labelKey: string; descriptionKey: string }> = [
    {
      value: 'recomp',
      labelKey: 'onboarding.goal.recomp.label',
      descriptionKey: 'onboarding.goal.recomp.description',
    },
  ];
  
  const allGoals = showAdvancedGoals ? [...basicGoals, ...advancedGoals] : basicGoals;
  
  return (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.goal.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.goal.subtitle')}
      </ThemedText>
      
      <View style={styles.goalContainer}>
        {allGoals.map((goalOption) => {
          const selected = goal === goalOption.value;
          const pressed = pressedCard === goalOption.value;
          
          return (
            <TouchableOpacity
              key={goalOption.value}
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
                // Web-only CSS properties (transition, background gradient) are not in React Native's ViewStyle type
                // but are valid on web. Using 'as any' is necessary to apply these styles conditionally.
                !selected && (Platform.OS === 'web' 
                  ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', transition: 'all 0.2s ease' } as any
                  : Shadows.sm),
                selected && (Platform.OS === 'web'
                  ? { 
                      background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      transition: 'all 0.2s ease',
                    } as any
                  : { backgroundColor: onboardingColors.primary, ...Shadows.lg }),
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={() => {
                onGoalChange(goalOption.value);
                onErrorClear();
              }}
              onPressIn={() => setPressedCard(goalOption.value)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(goalOption.labelKey)}${selected ? ' selected' : ''}`,
                `${AccessibilityHints.SELECT} ${t(goalOption.labelKey)}`,
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
                  {t(goalOption.labelKey)}
                </Text>
                <Text 
                  variant="body" 
                  style={[styles.goalCardDescription, { color: selected ? Colors.light.textInverse : colors.textSecondary, opacity: selected ? 0.9 : 1 }]}
                >
                  {t(goalOption.descriptionKey)}
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
      
      {!showAdvancedGoals && (
        <TouchableOpacity
          style={styles.advancedGoalLink}
          onPress={onShowAdvancedGoals}
          disabled={loading}
          {...getButtonAccessibilityProps(
            t('onboarding.goal.advanced_goal'),
            t('onboarding.goal.advanced_goal_hint')
          )}
        >
          <ThemedText style={[styles.advancedGoalLinkText, { color: onboardingColors.primary }]}>
            {t('onboarding.goal.advanced_goal')}
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stepContent: {
    gap: Spacing.xl,
  },
  stepTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
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
    fontWeight: FontWeight.bold, // Override h4 variant's semibold to bold
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
  advancedGoalLink: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignSelf: 'flex-start',
  },
  advancedGoalLinkText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});

