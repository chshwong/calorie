import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getIconAccessibilityProps } from '@/utils/accessibility';

type VolumeRow = {
  key: string;
  emoji: string;
  emojiLabel: string;
  title: string;
  value: string;
  examples: string;
};

const VOLUME_ROWS: VolumeRow[] = [
  {
    key: 'tsp & tbsp',
    emoji: '🥄',
    emojiLabel: 'Teaspoon & tablespoon',
    title: '1 Teaspoon & 1 tablespoon',
    value: '5 ml & 15 ml',
    examples: 'Salt, seasoning. Oil, sauce, dressing',
  },
  {
    key: 'juice_box',
    emoji: '🧃',
    emojiLabel: 'Juice box',
    title: '1 juice box',
    value: '200 ml',
    examples: 'Small ☕cappuccino',
  },
  
  {
    key: 'cup',
    emoji: '🥛',
    emojiLabel: 'Cup',
    title: '1 cup',
    value: '240 ml',
    examples: 'Cup of 🥛milk, small 🥣soup bowl',
  },
    {
    key: 'mug',
    emoji: '☕',
    emojiLabel: 'Mug or small glass',
    title: 'Mug / small glass',
    value: '≈ 250–300 ml',
    examples: 'Latte, juice',
  },
  {
    key: 'can_soda',
    emoji: '🥤',
    emojiLabel: 'Soda can',
    title: '1 standard soda can',
    value: '355 ml',
    examples: 'Pop can, standard 🥣soup bowl',
  },
  
  {
    key: 'can_soup',
    emoji: '🥫',
    emojiLabel: 'Canned soup',
    title: '1 standard can',
    value: '400 ml',
    examples: 'Canned soup, stews',
  },  
  {
    key: 'bottle',
    emoji: '🧴',
    emojiLabel: 'Water bottle',
    title: 'Water bottle',
    value: '≈ 500 ml',
    examples: 'Half bottle ≈ 250 ml',
  },
];

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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.contextLine, { color: colors.textSecondary }]}>
        For foods measured by volume (ml)
      </ThemedText>

      <View style={styles.rows}>
        {VOLUME_ROWS.map((row) => (
          <VolumeReferenceRow key={row.key} {...row} />
        ))}
      </View>

      <ThemedText style={[styles.footer, { color: colors.textSecondary }]}>
        Use everyday items around you.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
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


