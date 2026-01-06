import React from 'react';
import { Platform, StyleSheet, Text, View, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getIconAccessibilityProps } from '@/utils/accessibility';
import { useTranslation } from 'react-i18next';

type WeightCard = {
  key: string;
  emoji: string;
  emojiLabel: string;
  title: string;
  estimate: string;
  examples: string;
  reinforceEmoji?: string;
};

// Weight cards data - translations loaded dynamically in component
const WEIGHT_CARD_KEYS = ['palm', 'deck', 'fist', 'thumb', 'fruit', 'scale'] as const;

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
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth >= 768;

  const weightCards: WeightCard[] = WEIGHT_CARD_KEYS.map((key) => {
    const emojis: Record<string, { emoji: string; reinforceEmoji?: string }> = {
      palm: { emoji: '🖐️', reinforceEmoji: '🥩' },
      deck: { emoji: '🃏', reinforceEmoji: '🍗' },
      fist: { emoji: '✊', reinforceEmoji: '🍚' },
      thumb: { emoji: '👍', reinforceEmoji: '🧈' },
      fruit: { emoji: '🥑', reinforceEmoji: '🍎' },
      scale: { emoji: '⚖️' },
    };
    return {
      key,
      emoji: emojis[key].emoji,
      reinforceEmoji: emojis[key].reinforceEmoji,
      emojiLabel: t(`mealtype_log.portion_guide.weight.cards.${key}.emoji_label`),
      title: t(`mealtype_log.portion_guide.weight.cards.${key}.title`),
      estimate: t(`mealtype_log.portion_guide.weight.cards.${key}.estimate`),
      examples: t(`mealtype_log.portion_guide.weight.cards.${key}.examples`),
    };
  });

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={[styles.contentWrapper, isDesktop && styles.contentWrapperDesktop]}>
        <ThemedText style={[styles.contextLine, { color: colors.textSecondary }]}>
          {t('mealtype_log.portion_guide.weight.context_line')}
        </ThemedText>

        <View style={styles.grid}>
          {weightCards.map((card) => (
            <View key={card.key} style={styles.gridItem}>
              <WeightPortionCard {...card} />
            </View>
          ))}
        </View>

        <ThemedText style={[styles.footer, { color: colors.textSecondary }]}>
          {t('mealtype_log.portion_guide.weight.footer')}
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


