import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, FontSize, Typography, ModuleThemes, type ModuleType } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getFocusStyle,
} from '@/utils/accessibility';

type SummaryCardHeaderProps = {
  /** i18n key for the title (e.g., 'home.summary.title_other') */
  titleKey: string;
  /** Optional module icon name (SF Symbols) */
  icon?: IconSymbolName;
  /** Optional MaterialCommunityIcons name (for exercise/meds) */
  materialIcon?: string;
  /** Module type for accent color */
  module?: ModuleType;
  /** Optional settings/gear button handler */
  onPressSettings?: () => void;
  /** Optional loading indicator */
  isLoading?: boolean;
  /** Optional right-side content (e.g., entry count, action buttons) */
  rightContent?: React.ReactNode;
  /** Optional right-side title text (e.g., "124 cal") */
  rightTitle?: string;
  /** Optional subtitle text shown below title */
  subtitle?: string;
  /** Custom style for the header container */
  style?: ViewStyle;
};

/**
 * Standardized summary card header component used across all main tab screens.
 * Ensures consistent typography, spacing, and layout for the "Summary" title row.
 * 
 * Used by: Food Log Home, Exercise Home, Meds Home, Water Home
 */
export function SummaryCardHeader({
  titleKey,
  icon,
  materialIcon,
  module,
  onPressSettings,
  isLoading,
  rightContent,
  rightTitle,
  subtitle,
  style,
}: SummaryCardHeaderProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Get module accent color if module is provided
  const iconColor = module ? ModuleThemes[module].accent : colors.tint;
  
  // Apply negative margin only for Exercise and Meds (they use SurfaceCard with Spacing.lg padding)
  // Water uses a regular View with Spacing.md padding, so it doesn't need the negative margin
  const headerStyle = module === 'exercise' || module === 'meds'
    ? [styles.header, styles.headerWithNegativeMargin, style]
    : [styles.header, style];

  return (
    <View style={headerStyle}>
      <View style={styles.headerTop}>
        {/* Left side: Title + Icon */}
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" style={[styles.title, { color: colors.text }]}>
            {t(titleKey)}
          </ThemedText>
          {icon && (
            <IconSymbol 
              name={icon} 
              size={20} 
              color={iconColor} 
              decorative={true} 
            />
          )}
          {materialIcon && (
            <MaterialCommunityIcons 
              name={materialIcon as any} 
              size={20} 
              color={iconColor} 
            />
          )}
        </View>
        
        {/* Right side: Loading indicator, Settings button, or custom content */}
        <View style={styles.headerRight}>
          {rightTitle ? (
            <ThemedText type="subtitle" style={[styles.rightTitle, { color: colors.tint }]}>
              {rightTitle}
            </ThemedText>
          ) : null}

          {isLoading ? (
            <ActivityIndicator size="small" color={colors.tint} />
          ) : rightContent ? (
            rightContent
          ) : onPressSettings ? (
            <TouchableOpacity
              onPress={onPressSettings}
              style={[styles.settingsButton, { backgroundColor: 'transparent' }]}
              activeOpacity={0.7}
              {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
              {...getButtonAccessibilityProps(t('common.settings') || 'Settings')}
            >
              <IconSymbol name="gearshape" size={FontSize.lg} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      
      {/* Subtitle row (optional) */}
      {subtitle && (
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 0, // No top padding - card container already provides padding
    paddingBottom: Spacing.xs, // was md
    paddingHorizontal: Spacing.lg,
  },
  headerWithNegativeMargin: {
    marginTop: -Spacing.md, // Negative margin for Exercise/Meds to counteract SurfaceCard's extra padding (16px vs 12px)
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h4,
    fontSize: FontSize.lg,
    fontWeight: Typography.h4.fontWeight,
    lineHeight: FontSize.lg * 1.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  rightTitle: {
    ...Typography.h4,
    fontSize: FontSize.lg,
    fontWeight: Typography.h4.fontWeight,
    lineHeight: FontSize.lg * 1.2,
  },
});

