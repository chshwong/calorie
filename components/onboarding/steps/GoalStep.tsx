import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

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
                onGoalChange(goalOption.value);
                onErrorClear();
              }}
              onPressIn={() => setPressedCard(goalOption.value)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(goalOption.labelKey)}${selected ? ' selected' : ''}`,
                `Double tap to select ${t(goalOption.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={{ flex: 1, paddingRight: selected ? 40 : 0 }}>
                <Text style={[styles.goalCardTitle, { color: selected ? '#fff' : colors.text }]}>
                  {t(goalOption.labelKey)}
                </Text>
                <Text style={[styles.goalCardDescription, { color: selected ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
                  {t(goalOption.descriptionKey)}
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
      
      {!showAdvancedGoals && (
        <TouchableOpacity
          style={styles.advancedGoalLink}
          onPress={onShowAdvancedGoals}
          disabled={loading}
          {...getButtonAccessibilityProps(
            t('onboarding.goal.advanced_goal'),
            'Double tap to show advanced goal options'
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
    gap: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    marginBottom: 8,
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
  advancedGoalLink: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  advancedGoalLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

