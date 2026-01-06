import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getIconAccessibilityProps } from '@/utils/accessibility';

type WeightCard = {
  key: string;
  emoji: string;
  emojiLabel: string;
  title: string;
  estimate: string;
  examples: string;
  reinforceEmoji?: string;
};

const WEIGHT_CARDS: WeightCard[] = [
  {
    key: 'palm',
    emoji: '🖐️',
    reinforceEmoji: '🥩',
    emojiLabel: 'Palm of hand',
    title: 'Palm, no fingers',
    estimate: '≈ 100 g / 3.5 oz',
    examples: 'Protein: Tofu, meat🥩, fish🐟, 2x eggs🥚',
  },
  {
    key: 'deck',
    emoji: '🃏',
    reinforceEmoji: '🍗',
    emojiLabel: 'Deck of cards',
    title: 'Deck of cards',
    estimate: '≈ 85 g / 3 oz',
    examples: 'Tofu, meat🍗, cheese🧀, Protein bar',
  },
  {
    key: 'fist',
    emoji: '✊',
    reinforceEmoji: '🍚',
    emojiLabel: 'Closed fist',
    title: 'Closed fist',
    estimate: '≈ 200 g / 7 oz',
    examples: 'Rice, pasta, veggies',
  },
  {
    key: 'thumb',
    emoji: '👍',
    reinforceEmoji: '🧈',
    emojiLabel: 'Thumb',
    title: 'Thumb',
    estimate: '≈ 15 g / 0.5 oz',
    examples: 'Butter, oils',
  },
  {
    key: 'slice',
    emoji: '🍫',
    reinforceEmoji: '🧀',
    emojiLabel: 'Chocolate bar slice',
    title: 'Chocolate bar slice',
    estimate: '≈ 30 g / 1 oz',
    examples: 'Cheese, chocolate',
  },
  {
    key: 'scale',
    emoji: '⚖️',
    emojiLabel: 'Small kitchen scale',
    title: 'Small kitchen scale',
    estimate: 'Most accurate',
    examples: 'When available',
  },
];

function WeightPortionCard({
  emoji,
  emojiLabel,
  title,
  estimate,
  examples,
  reinforceEmoji,
}: WeightCard) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.emojiChip, { backgroundColor: colors.tint + '18' }]}>
        <Text
          style={styles.emoji}
          {...getIconAccessibilityProps(emojiLabel)}
        >
          {emoji}
        </Text>
      </View>

      <ThemedText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
        {reinforceEmoji ? ` ${reinforceEmoji}` : ''}
      </ThemedText>

      <ThemedText style={[styles.cardEstimate, { color: colors.text }]} numberOfLines={1}>
        {estimate}
      </ThemedText>

      <ThemedText style={[styles.cardExamples, { color: colors.textSecondary }]} numberOfLines={2}>
        {examples}
      </ThemedText>
    </View>
  );
}

export function WeightPortionPage() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.contextLine, { color: colors.textSecondary }]}>
        For foods measured by weight (g / oz)
      </ThemedText>

      <View style={styles.grid}>
        {WEIGHT_CARDS.map((card) => (
          <View key={card.key} style={styles.gridItem}>
            <WeightPortionCard {...card} />
          </View>
        ))}
      </View>

      <ThemedText style={[styles.footer, { color: colors.textSecondary }]}>
        Precision not required. Estimate confidently.
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emoji: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  cardEstimate: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 2,
  },
  cardExamples: {
    fontSize: FontSize.sm,
  },
  footer: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
});


