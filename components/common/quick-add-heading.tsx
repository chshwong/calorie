/**
 * Quick Add Heading - Section heading with optional module icon
 * 
 * Reusable component for Quick Add section headings that can include
 * a module-specific icon for visual differentiation.
 * 
 * Per engineering guidelines:
 * - Uses theme tokens for all styling
 * - All text via i18n
 * - Theme-aware (dark/light mode)
 */

import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize, FontWeight, ModuleThemes, type ModuleType } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type QuickAddHeadingProps = {
  labelKey: string;
  module?: ModuleType;
  icon?: string;
};

export function QuickAddHeading({ labelKey, module, icon }: QuickAddHeadingProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const iconColor = module ? ModuleThemes[module].iconColor : colors.textSecondary;

  return (
    <View style={styles.container}>
      {icon && (
        <IconSymbol 
          name={icon as any} 
          size={14} 
          color={iconColor} 
          style={styles.icon}
        />
      )}
      <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
        {t(labelKey)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

