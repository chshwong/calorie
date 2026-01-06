import React from 'react';
import { Platform, StyleSheet, Text, View, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getIconAccessibilityProps } from '@/utils/accessibility';
import { useTranslation } from 'react-i18next';

type VolumeRow = {
  key: string;
  emoji: string;
  emojiLabel: string;
  title: string;
  value: string;
  examples: string;
};

// Volume row keys - translations loaded dynamically in component
const VOLUME_ROW_KEYS = ['tsp_tbsp', 'juice_box', 'cup', 'mug', 'can_soda', 'can_soup', 'bottle', 'beer_pint'] as const;

function VolumeReferenceRow({ emoji, emojiLabel, title, value, examples }: VolumeRow) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.leftIcon, { backgroundColor: colors.tint + '18' }]}>
        <Text style={styles.emoji} {...getIconAccessibilityProps(emojiLabel)}>
          {emoji}
        </Text>
      </View>

      <View style={styles.rowText}>
        <ThemedText style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </ThemedText>
        <ThemedText style={[styles.rowExamples, { color: colors.textSecondary }]} numberOfLines={1}>
          {examples}
        </ThemedText>
      </View>
    </View>
  );
}

export function VolumePortionPage() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth >= 768;

  const volumeRows: VolumeRow[] = VOLUME_ROW_KEYS.map((key) => {
    const emojis: Record<string, string> = {
      tsp_tbsp: '🥄',
      juice_box: '🧃',
      cup: '🥛',
      mug: '☕',
      can_soda: '🥤',
      can_soup: '🥫',
      bottle: '🧴',
      beer_pint: '🍺',
    };
    return {
      key,
      emoji: emojis[key],
      emojiLabel: t(`mealtype_log.portion_guide.volume.rows.${key}.emoji_label`),
      title: t(`mealtype_log.portion_guide.volume.rows.${key}.title`),
      value: t(`mealtype_log.portion_guide.volume.rows.${key}.value`),
      examples: t(`mealtype_log.portion_guide.volume.rows.${key}.examples`),
    };
  });

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={[styles.contentWrapper, isDesktop && styles.contentWrapperDesktop]}>
        <ThemedText style={[styles.contextLine, { color: colors.textSecondary }]}>
          {t('mealtype_log.portion_guide.volume.context_line')}
        </ThemedText>

        <View style={styles.rows}>
          {volumeRows.map((row) => {
            const { key, ...rowProps } = row;
            return <VolumeReferenceRow key={key} {...rowProps} />;
          })}
        </View>

        <ThemedText style={[styles.footer, { color: colors.textSecondary }]}>
          {t('mealtype_log.portion_guide.volume.footer')}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  containerDesktop: {
    maxWidth: Layout.desktopMaxWidth,
    alignSelf: 'center',
  },
  contentWrapper: {
    paddingHorizontal: Spacing.lg,
  },
  contentWrapperDesktop: {
    paddingHorizontal: Spacing.lg,
  },
  contextLine: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  rows: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 1,
      },
      default: {},
    }),
  },
  leftIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  emoji: {
    fontSize: 28,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  rowValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: 1,
  },
  rowExamples: {
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  footer: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
});


