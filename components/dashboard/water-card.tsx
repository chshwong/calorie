/**
 * Water Summary Card Component for Dashboard
 * 
 * Displays today's water intake with circular progress indicator
 */

import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WaterDropGauge } from '@/components/water/water-drop-gauge';
import { Colors, BorderRadius, Shadows, Spacing, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWaterDaily } from '@/hooks/use-water-logs';
import { useUserConfig } from '@/hooks/use-user-config';
import { formatWaterDisplay, WaterUnit, fromMl, toMl, getEffectiveGoal } from '@/utils/waterUnits';
import { ModuleThemes } from '@/constants/theme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { Animated } from 'react-native';
import { useRef } from 'react';

type WaterCardProps = {
  onPress?: () => void;
};

export function WaterCard({ onPress }: WaterCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get water data
  const { todayWater, isLoading } = useWaterDaily({ daysBack: 0 });
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  
  // Get unit preference (default to metric)
  const unitPreference = (profile?.water_unit_preference as 'metric' | 'imperial') || 'metric';
  
  // Get today's values
  // Always read goal from water_daily.goal_ml (per-day snapshot)
  // Use getEffectiveGoal to apply unit-specific defaults if goal is missing
  const totalMl = todayWater ? toMl(todayWater.total, todayWater.water_unit as WaterUnit) : 0;
  const storedGoalMl = todayWater?.goal_ml || null;
  const activeWaterUnit = (todayWater?.water_unit as WaterUnit) || (profile?.water_unit as WaterUnit) || 'ml';
  const storedGoalInUnit = storedGoalMl ? fromMl(storedGoalMl, activeWaterUnit) : null;
  const { goalMl } = getEffectiveGoal(activeWaterUnit, storedGoalInUnit);
  
  // Format display
  const display = formatWaterDisplay(totalMl, unitPreference);
  
  // Calculate progress percentage
  const progress = goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
  
  // Water accent color from module theme
  const waterTheme = ModuleThemes.water;
  const accentColor = waterTheme.accent;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/(tabs)/water');
    }
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };


  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      {...(Platform.OS === 'web' && getFocusStyle(accentColor))}
      {...getButtonAccessibilityProps(t('water.dashboard.card_label', { ml: totalMl, goal: goalMl }))}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: colors.card,
            ...Shadows.card,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconSymbol name="drop.fill" size={20} color={accentColor} />
            <ThemedText style={[styles.title, { color: colors.text }]}>
              {t('water.dashboard.title')}
            </ThemedText>
          </View>
        </View>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : (
            <>
              <WaterDropGauge
                totalMl={totalMl}
                goalMl={goalMl}
                unitPreference={unitPreference}
                size="medium"
              />
              <View style={styles.stats}>
                {goalMl > 0 ? (
                  <ThemedText style={[styles.secondaryText, { color: colors.textSecondary }]}>
                    {t('water.dashboard.goal', { goal: goalMl })} • {progress}%
                  </ThemedText>
                ) : (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push('/(tabs)/water');
                    }}
                    {...getButtonAccessibilityProps(t('water.dashboard.set_goal'))}
                  >
                    <ThemedText style={[styles.setGoalText, { color: accentColor }]}>
                      {t('water.dashboard.set_goal')}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  stats: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.xs / 2,
  },
  primaryText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  secondaryText: {
    fontSize: FontSize.xs,
  },
  setGoalText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});

