import React, { useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { TrajectorySummary } from '@/components/onboarding/TrajectorySummary';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps, getFocusStyle, AccessibilityHints } from '@/utils/accessibility';
import {
  LOSS_PACES_LB_PER_WEEK,
  computeTargetDateFromPace,
  computeImpliedLbPerWeek,
  getLossCustomDateWarningKey,
  computeMinSelectableDateForLoss,
} from '@/lib/onboarding/goal-date-rules';
import { lbToKg } from '@/lib/domain/weight-constants';
import { roundTo1 } from '@/utils/bodyMetrics';

interface TimelineStepProps {
  goalType: 'lose' | 'gain' | 'maintain' | 'recomp' | '' | null;
  currentWeightLb: number | null;
  targetWeightLb: number | null;
  currentWeightUnit: 'kg' | 'lb';
  timelineOption: '3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date' | '';
  customTargetDate: string | null;
  onTimelineChange: (option: '3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date') => void;
  onCustomTargetDateChange: (date: string | null) => void;
  onErrorClear: () => void;
  loading: boolean;
  colors: typeof Colors.light;
}

export const TimelineStep: React.FC<TimelineStepProps> = ({
  goalType,
  currentWeightLb,
  targetWeightLb,
  currentWeightUnit,
  timelineOption,
  customTargetDate,
  onTimelineChange,
  onCustomTargetDateChange,
  onErrorClear,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const [pressedCard, setPressedCard] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Only implement for weight loss for now
  if (goalType !== 'lose') {
    return (
      <View style={styles.stepContentAnimated}>
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.timeline.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          Timeline selection for {goalType} goals coming soon.
        </ThemedText>
      </View>
    );
  }
  
  // Compute today's date (at local noon to avoid DST issues)
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  }, []);
  
  // Compute delta and validate
  const deltaLb = useMemo(() => {
    if (currentWeightLb === null || targetWeightLb === null) {
      return null;
    }
    const delta = currentWeightLb - targetWeightLb;
    return delta > 0 ? delta : null;
  }, [currentWeightLb, targetWeightLb]);
  
  // Compute dates for each pace option
  const computedDates = useMemo(() => {
    if (deltaLb === null) {
      return { easy: null, decent: null, aggressive: null };
    }
    
    return {
      easy: computeTargetDateFromPace(deltaLb, LOSS_PACES_LB_PER_WEEK.easy, today),
      decent: computeTargetDateFromPace(deltaLb, LOSS_PACES_LB_PER_WEEK.decent, today),
      aggressive: computeTargetDateFromPace(deltaLb, LOSS_PACES_LB_PER_WEEK.aggressive, today),
    };
  }, [deltaLb, today]);
  
  // Format pace in user's unit
  const formatPace = (paceLbPerWeek: number): string => {
    if (currentWeightUnit === 'kg') {
      const paceKgPerWeek = roundTo1(lbToKg(paceLbPerWeek));
      return `${paceKgPerWeek} kg`;
    }
    return `${paceLbPerWeek} lb`;
  };
  
  // Format date as "MMM DD, YYYY" (local timezone)
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  // Format date as YYYY-MM-DD in local timezone (not UTC)
  const formatDateAsLocalISO = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  
  // Parse YYYY-MM-DD string as local date (not UTC) at noon to avoid DST issues
  const parseLocalDate = useCallback((dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }, []);
  
  // Get minimum date for custom date picker based on max loss pace
  const minSelectableDate = useMemo(() => {
    if (currentWeightLb === null || targetWeightLb === null) {
      // Fallback to tomorrow if weights are not available
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      return tomorrow;
    }
    return computeMinSelectableDateForLoss({
      currentWeightLb,
      targetWeightLb,
      today,
    });
  }, [currentWeightLb, targetWeightLb, today]);
  
  // Get custom date as Date object (parsed as local, not UTC)
  const customDateObj = useMemo(() => {
    if (!customTargetDate) {
      return null;
    }
    return parseLocalDate(customTargetDate);
  }, [customTargetDate, parseLocalDate]);
  
  // Compute implied pace and warning for custom date
  const customDateWarning = useMemo(() => {
    if (!customDateObj || deltaLb === null) {
      return null;
    }
    
    const impliedPace = computeImpliedLbPerWeek(deltaLb, customDateObj, today);
    const warningKey = getLossCustomDateWarningKey(impliedPace);
    
    return warningKey ? { key: warningKey, pace: impliedPace } : null;
  }, [customDateObj, deltaLb, today]);
  
  // Handle pace option selection
  const handlePaceOptionSelect = useCallback((pace: 'easy' | 'decent' | 'aggressive') => {
    const computedDate = computedDates[pace];
    if (!computedDate) {
      // If no computed date, don't proceed
      return;
    }
    // Use local date formatting, not UTC
    const dateStr = formatDateAsLocalISO(computedDate);
    onCustomTargetDateChange(dateStr);
    onTimelineChange('custom_date');
    onErrorClear();
  }, [computedDates, formatDateAsLocalISO, onCustomTargetDateChange, onTimelineChange, onErrorClear]);
  
  // Handle custom date selection
  const handleCustomDateSelect = useCallback((date: Date) => {
    // Use local date formatting, not UTC
    const dateStr = formatDateAsLocalISO(date);
    onCustomTargetDateChange(dateStr);
    onTimelineChange('custom_date');
    setShowDatePicker(false);
    onErrorClear();
  }, [formatDateAsLocalISO, onCustomTargetDateChange, onTimelineChange, onErrorClear]);
  
  // Timeline options - memoized to prevent stale closures
  const timelineOptions = useMemo(() => [
    {
      id: 'easy' as const,
      labelKey: 'onboarding.goal_date.option_easy',
      pace: LOSS_PACES_LB_PER_WEEK.easy,
      computedDate: computedDates.easy,
      onSelect: () => handlePaceOptionSelect('easy'),
    },
    {
      id: 'decent' as const,
      labelKey: 'onboarding.goal_date.option_decent',
      pace: LOSS_PACES_LB_PER_WEEK.decent,
      computedDate: computedDates.decent,
      onSelect: () => handlePaceOptionSelect('decent'),
    },
    {
      id: 'aggressive' as const,
      labelKey: 'onboarding.goal_date.option_aggressive',
      pace: LOSS_PACES_LB_PER_WEEK.aggressive,
      computedDate: computedDates.aggressive,
      onSelect: () => handlePaceOptionSelect('aggressive'),
    },
    {
      id: 'no_deadline' as const,
      labelKey: 'onboarding.goal_date.option_no_deadline',
      onSelect: () => {
        onTimelineChange('no_deadline');
        onCustomTargetDateChange(null);
        onErrorClear();
      },
    },
    {
      id: 'custom_date' as const,
      labelKey: 'onboarding.goal_date.option_custom_date',
      onSelect: () => {
        setShowDatePicker(true);
        onErrorClear();
      },
    },
  ], [computedDates, handlePaceOptionSelect, onTimelineChange, onCustomTargetDateChange, onErrorClear]);
  
  // Default to "decent" if nothing selected and we have valid data
  React.useEffect(() => {
    if (!timelineOption && deltaLb !== null && computedDates.decent) {
      handlePaceOptionSelect('decent');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineOption, deltaLb]);
  
  // Prefill custom date to Decent's computed date when entering step or when weights change
  React.useEffect(() => {
    if (deltaLb !== null && computedDates.decent && !customTargetDate) {
      const decentDateStr = formatDateAsLocalISO(computedDates.decent);
      onCustomTargetDateChange(decentDateStr);
      onTimelineChange('custom_date');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deltaLb, computedDates.decent]);
  
  return (
    <View style={styles.stepContentAnimated}>
      {/* Illustration */}
      <View style={styles.stepIllustration}>
        <View
          style={{
            width: 172, // Illustration-specific size - not a theme token
            height: 172, // Illustration-specific size - not a theme token
            borderRadius: BorderRadius['3xl'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${onboardingColors.primary}0F`,
            ...Shadows.md,
          }}
        >
          <View
            style={{
              width: 148, // Illustration-specific size - not a theme token
              height: 148, // Illustration-specific size - not a theme token
              borderRadius: BorderRadius['3xl'],
              backgroundColor: Colors.light.background,
              borderWidth: Spacing.xs,
              borderColor: `${onboardingColors.primary}50`,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Calendar icon */}
            <MaterialCommunityIcons
              name="calendar"
              size={100} // Icon size - consistent across onboarding illustrations
              color={onboardingColors.primary}
            />
          </View>
        </View>
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.timeline.title')}
      </ThemedText>
      
      {/* Trajectory Summary */}
      {currentWeightLb !== null && targetWeightLb !== null && (
        <TrajectorySummary
          startWeightLabel={`${roundTo1(currentWeightUnit === 'kg' ? lbToKg(currentWeightLb) : currentWeightLb)} ${currentWeightUnit === 'kg' ? 'kg' : 'lb'}`}
          endWeightLabel={`${roundTo1(currentWeightUnit === 'kg' ? lbToKg(targetWeightLb) : targetWeightLb)} ${currentWeightUnit === 'kg' ? 'kg' : 'lb'}`}
          startSubLabel={t('common.today')}
          endSubLabel={
            timelineOption === 'no_deadline'
              ? t('onboarding.timeline.no_deadline')
              : customDateObj
              ? formatDate(customDateObj)
              : computedDates.decent
              ? formatDate(computedDates.decent)
              : t('onboarding.timeline.no_deadline')
          }
          paceLabel={
            timelineOption === 'no_deadline'
              ? undefined
              : timelineOption === 'custom_date' && customDateObj && deltaLb !== null
              ? (() => {
                  const impliedPace = computeImpliedLbPerWeek(deltaLb, customDateObj, today);
                  const formattedPace = formatPace(impliedPace);
                  // Extract number and unit, round to 1 decimal
                  const parts = formattedPace.split(' ');
                  const paceNum = parseFloat(parts[0]);
                  const unit = parts[1];
                  return `~${roundTo1(paceNum)} ${unit}/week`;
                })()
              : (() => {
                  // Find which pace option matches the current custom date
                  const customISO = customTargetDate;
                  if (!customISO) return undefined;
                  
                  const selectedPace = timelineOptions.find(opt => {
                    if (opt.id === 'easy' || opt.id === 'decent' || opt.id === 'aggressive') {
                      if (!opt.computedDate) return false;
                      const optISO = formatDateAsLocalISO(opt.computedDate);
                      return customISO === optISO;
                    }
                    return false;
                  });
                  
                  if (selectedPace && selectedPace.pace) {
                    const formattedPace = formatPace(selectedPace.pace);
                    // Extract number and unit, round to 1 decimal
                    const parts = formattedPace.split(' ');
                    const paceNum = parseFloat(parts[0]);
                    const unit = parts[1];
                    return `~${roundTo1(paceNum)} ${unit}/week`;
                  }
                  return undefined;
                })()
          }
          accentColor={onboardingColors.primary}
          textColor={colors.text}
        />
      )}
      
      {/* Timeline Options */}
      <View style={styles.optionsContainer}>
        {timelineOptions.map((option) => {
          const isPaceOption = option.id === 'easy' || option.id === 'decent' || option.id === 'aggressive';
          const pressed = pressedCard === option.id;
          
          // Determine if this option is selected
          let actuallySelected = false;
          
          if (isPaceOption && option.computedDate) {
            // Pace option is selected if custom date matches its computed date (compare ISO strings, not times)
            const customISO = customTargetDate; // Already YYYY-MM-DD
            const optionISO = formatDateAsLocalISO(option.computedDate);
            actuallySelected = timelineOption === 'custom_date' && 
              customISO !== null && 
              customISO === optionISO;
          } else if (option.id === 'no_deadline') {
            // No deadline is selected if timelineOption is 'no_deadline'
            actuallySelected = timelineOption === 'no_deadline';
          } else if (option.id === 'custom_date') {
            // Custom date option is selected if timelineOption is 'custom_date' but no pace option matches
            const customISO = customTargetDate; // Already YYYY-MM-DD
            const anyPaceSelected = timelineOptions
              .filter(opt => opt.id === 'easy' || opt.id === 'decent' || opt.id === 'aggressive')
              .some(opt => {
                if (!opt.computedDate || !customISO) return false;
                const optISO = formatDateAsLocalISO(opt.computedDate);
                return customISO === optISO;
              });
            actuallySelected = timelineOption === 'custom_date' && !anyPaceSelected;
          }
          
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                {
                  borderColor: actuallySelected ? Colors.light.background : colors.border,
                  backgroundColor: actuallySelected ? undefined : colors.background,
                  borderWidth: actuallySelected ? 0 : 1,
                  borderRadius: BorderRadius.xl,
                  paddingVertical: Spacing.md,
                  paddingHorizontal: Spacing.lg,
                  transform: [{ scale: actuallySelected ? 1.02 : pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.96 : 1,
                },
                !actuallySelected && (Platform.OS === 'web' 
                  ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', transition: 'all 0.2s ease' } as any
                  : Shadows.sm),
                actuallySelected && (Platform.OS === 'web'
                  ? { 
                      background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      transition: 'all 0.2s ease',
                    } as any
                  : { backgroundColor: onboardingColors.primary, ...Shadows.lg }),
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={() => {
                option.onSelect();
              }}
              onPressIn={() => setPressedCard(option.id)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(option.labelKey)}${actuallySelected ? ' selected' : ''}`,
                `${AccessibilityHints.SELECT} ${t(option.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected: actuallySelected || false }}
            >
              <View style={{ flex: 1, paddingRight: actuallySelected ? Spacing['4xl'] : 0 }}>
                <View style={styles.titleRow}>
                  <Text 
                    variant="h4" 
                    style={[styles.optionCardTitle, { color: actuallySelected ? Colors.light.textInverse : colors.text }]}
                  >
                    {t(option.labelKey)}
                  </Text>
                  {option.id === 'decent' && (
                    <Text 
                      variant="body" 
                      style={[styles.recommendedLabel, { color: actuallySelected ? Colors.light.textInverse : onboardingColors.primary }]}
                    >
                      {t('onboarding.goal_date.recommended')}
                    </Text>
                  )}
                </View>
                {isPaceOption && option.computedDate && deltaLb !== null && (
                  <View style={styles.paceInfo}>
                    <Text 
                      variant="body" 
                      style={[styles.paceText, { color: actuallySelected ? Colors.light.textInverse : colors.textSecondary, opacity: actuallySelected ? 0.9 : 1 }]}
                    >
                      {t('onboarding.goal_date.by_date', { date: formatDate(option.computedDate) })}
                    </Text>
                    <Text 
                      variant="body" 
                      style={[styles.paceText, styles.paceTextRight, { color: actuallySelected ? Colors.light.textInverse : colors.textSecondary, opacity: actuallySelected ? 0.9 : 1 }]}
                    >
                      {t('onboarding.goal_date.pace_per_week', { pace: formatPace(option.pace!).split(' ')[0], unit: formatPace(option.pace!).split(' ')[1] })}
                    </Text>
                  </View>
                )}
                {option.id === 'custom_date' && customDateObj && (
                  <View style={styles.paceInfo}>
                    <Text 
                      variant="body" 
                      style={[styles.paceText, { color: actuallySelected ? Colors.light.textInverse : colors.textSecondary, opacity: actuallySelected ? 0.9 : 1 }]}
                    >
                      {formatDate(customDateObj)}
                    </Text>
                  </View>
                )}
              </View>
              {actuallySelected && (
                <View style={styles.optionCardCheckmark}>
                  <IconSymbol name="checkmark.circle.fill" size={Spacing['2xl']} color={Colors.light.textInverse} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Custom Date Warning */}
      {customDateWarning && timelineOption === 'custom_date' && (
        <View style={styles.warningContainer}>
          <ThemedText style={[styles.warningText, { color: colors.textSecondary }]}>
            {t(customDateWarning.key)}
          </ThemedText>
        </View>
      )}
      
      {/* Date Picker */}
      <AppDatePicker
        value={customDateObj || minSelectableDate}
        onChange={handleCustomDateSelect}
        minimumDate={minSelectableDate}
        maximumDate={undefined}
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title={t('onboarding.goal_date.option_custom_date')}
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
    marginBottom: Spacing.none,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  optionCard: {
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  optionCardTitle: {
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  recommendedLabel: {
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },
  paceInfo: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paceText: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  paceTextRight: {
    textAlign: 'right',
  },
  optionCardCheckmark: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
  warningContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.light.warning}20`,
    borderWidth: 1,
    borderColor: `${Colors.light.warning}40`,
  },
  warningText: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * LineHeight.normal,
  },
});
