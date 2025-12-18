import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

interface TimelineStepProps {
  timelineOption: '3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date' | '';
  onTimelineChange: (option: '3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date') => void;
  onCustomTargetDateChange: (date: string | null) => void;
  onErrorClear: () => void;
  currentWeightDisplay: string;
  goalWeightDisplay: string;
  loading: boolean;
  colors: typeof Colors.light;
}

export const TimelineStep: React.FC<TimelineStepProps> = ({
  timelineOption,
  onTimelineChange,
  onCustomTargetDateChange,
  onErrorClear,
  currentWeightDisplay,
  goalWeightDisplay,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const [pressedCard, setPressedCard] = useState<string | null>(null);
  
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
              __html: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${onboardingColors.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
            }}
          />
        ) : (
          <IconSymbol name="clock" size={48} color={onboardingColors.primary} />
        )}
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.timeline.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.timeline.subtitle')}
      </ThemedText>
      
      {/* Trajectory Summary Box - Neutral Style */}
      {currentWeightDisplay && goalWeightDisplay && (
        <View style={styles.trajectorySummaryBox}>
          <Text style={styles.trajectorySummaryLabel}>
            {t('onboarding.timeline.summary_label')}
          </Text>
          <Text style={styles.trajectorySummaryValue}>
            From {currentWeightDisplay} to {goalWeightDisplay}
          </Text>
        </View>
      )}
      
      {/* Timeline Options */}
      <View style={styles.goalContainer}>
        {[
          { value: '3_months' as const, labelKey: 'onboarding.timeline.three_months' },
          { value: '6_months' as const, labelKey: 'onboarding.timeline.six_months' },
          { value: '12_months' as const, labelKey: 'onboarding.timeline.twelve_months' },
          { value: 'no_deadline' as const, labelKey: 'onboarding.timeline.no_deadline' },
        ].map((timeline) => {
          const selected = timelineOption === timeline.value;
          const pressed = pressedCard === timeline.value;
          
          return (
            <TouchableOpacity
              key={timeline.value}
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
                onTimelineChange(timeline.value);
                onCustomTargetDateChange(null);
                onErrorClear();
              }}
              onPressIn={() => setPressedCard(timeline.value)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(timeline.labelKey)}${selected ? ' selected' : ''}`,
                `Double tap to select ${t(timeline.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={{ flex: 1, paddingRight: selected ? 40 : 0 }}>
                <Text style={[styles.goalCardTitle, { color: selected ? '#fff' : colors.text }]}>
                  {t(timeline.labelKey)}
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
  trajectorySummaryBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  trajectorySummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    color: '#6B7280',
  },
  trajectorySummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
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
  goalCardCheckmark: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});

