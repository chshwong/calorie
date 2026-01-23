import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { PressableCard } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useMyCases } from '@/hooks/use-cases';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatUTCDate } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import type { SupportCase } from '@/utils/types';

const PAGE_SIZE = 20;

export default function MyCasesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [items, setItems] = useState<SupportCase[]>([]);
  const [nextCursor, setNextCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const appendedCursors = useRef(new Set<string>());

  const { data, isLoading, isFetching, refetch } = useMyCases({ pageSize: PAGE_SIZE, cursor });

  useEffect(() => {
    if (!data) return;
    const cursorKey = cursor ? `${cursor.createdAt}-${cursor.id}` : 'first';
    if (appendedCursors.current.has(cursorKey)) return;
    appendedCursors.current.add(cursorKey);
    setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
  }, [data, cursor]);

  const handleRefresh = () => {
    appendedCursors.current.clear();
    setCursor(null);
    setItems([]);
    setNextCursor(null);
    refetch();
  };

  const handleLoadMore = () => {
    if (!nextCursor || isFetching) return;
    setCursor(nextCursor);
  };

  const renderItem = ({ item }: { item: SupportCase }) => {
    const dateLabel = formatDate(formatUTCDate(item.created_at), t);
    const statusLabel = t(`support.status.${item.status}`);
    const categoryLabel = t(`support.categories.${item.category}`);

    return (
      <PressableCard
        variant="outlined"
        padding="md"
        style={styles.card}
        onPress={() => router.push(`/support/cases/${item.id}`)}
        {...getButtonAccessibilityProps(`${categoryLabel}. ${statusLabel}`, AccessibilityHints.NAVIGATE)}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.subject?.trim() ? item.subject : categoryLabel}
            </ThemedText>
            <ThemedText style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {categoryLabel} • {statusLabel}
            </ThemedText>
            <ThemedText style={[styles.cardMeta, { color: colors.textTertiary }]}>{dateLabel}</ThemedText>
          </View>
          <View style={styles.cardChevron}>
            <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} decorative={true} />
          </View>
        </View>
      </PressableCard>
    );
  };

  const showEmpty = !isLoading && items.length === 0;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
          ]}
          onPress={() => router.back()}
          {...getButtonAccessibilityProps(t('common.back'), AccessibilityHints.BACK)}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t('support.my_cases.title')}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading && items.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      ) : showEmpty ? (
        <View style={styles.emptyState}>
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>{t('support.my_cases.empty_title')}</ThemedText>
          <ThemedText style={[styles.emptyBody, { color: colors.textSecondary }]}>{t('support.my_cases.empty_body')}</ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={isFetching && items.length > 0 && cursor === null}
          ListFooterComponent={
            nextCursor ? (
              <TouchableOpacity
                style={[styles.loadMoreButton, { borderColor: colors.border }]}
                onPress={handleLoadMore}
                disabled={isFetching}
                {...getButtonAccessibilityProps(t('inbox.load_more'), AccessibilityHints.BUTTON, isFetching)}
              >
                {isFetching ? (
                  <ActivityIndicator size="small" color={colors.tint} />
                ) : (
                  <ThemedText style={[styles.loadMoreText, { color: colors.text }]}>{t('inbox.load_more')}</ThemedText>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.footerSpacer} />
            )
          }
          ListFooterComponentStyle={styles.footer}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  emptyBody: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  card: {
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  cardContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  cardMeta: {
    fontSize: FontSize.sm,
  },
  cardChevron: {
    paddingTop: 6,
  },
  footer: {
    paddingTop: Spacing.sm,
  },
  loadMoreButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  footerSpacer: {
    height: Spacing.lg,
  },
});

