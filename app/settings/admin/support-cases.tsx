import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { PressableCard } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCases } from '@/hooks/use-cases';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatUTCDate } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import type { SupportCase, SupportCaseCategory, SupportCaseStatus } from '@/utils/types';

const PAGE_SIZE = 20;

type FilterOption<T extends string> = { value: T | 'all'; labelKey: string };

export default function AdminSupportCasesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAdmin, loading } = useAuth();

  const statusOptions: FilterOption<SupportCaseStatus>[] = useMemo(
    () => [
      { value: 'all', labelKey: 'support.admin.filters.all' },
      { value: 'new', labelKey: 'support.status.new' },
      { value: 'in_progress', labelKey: 'support.status.in_progress' },
      { value: 'resolved', labelKey: 'support.status.resolved' },
    ],
    []
  );

  const categoryOptions: FilterOption<SupportCaseCategory>[] = useMemo(
    () => [
      { value: 'all', labelKey: 'support.admin.filters.all' },
      { value: 'bug', labelKey: 'support.categories.bug' },
      { value: 'feature_request', labelKey: 'support.categories.feature_request' },
      { value: 'improvement', labelKey: 'support.categories.improvement' },
      { value: 'food_addition', labelKey: 'support.categories.food_addition' },
      { value: 'appreciation', labelKey: 'support.categories.appreciation' },
      { value: 'other', labelKey: 'support.categories.other' },
    ],
    []
  );

  const [status, setStatus] = useState<SupportCaseStatus | 'all'>('all');
  const [category, setCategory] = useState<SupportCaseCategory | 'all'>('all');

  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [items, setItems] = useState<SupportCase[]>([]);
  const [nextCursor, setNextCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const appendedCursors = useRef(new Set<string>());

  const { data, isLoading, isFetching, refetch } = useAdminCases({ pageSize: PAGE_SIZE, cursor, status, category });

  useFocusEffect(
    useCallback(() => {
      if (!loading && !isAdmin) {
        Alert.alert(t('settings.admin.access_denied_title'), t('settings.admin.access_denied_message'));
        router.back();
      }
    }, [isAdmin, loading, router, t])
  );

  // Reset pagination when filters change
  useEffect(() => {
    appendedCursors.current.clear();
    setCursor(null);
    setItems([]);
    setNextCursor(null);
  }, [status, category]);

  useEffect(() => {
    if (!data) return;
    const cursorKey = cursor ? `${cursor.createdAt}-${cursor.id}` : 'first';
    if (appendedCursors.current.has(cursorKey)) return;
    appendedCursors.current.add(cursorKey);
    setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
  }, [data, cursor]);

  if (loading) {
    return (
      <ThemedView style={styles.loadingState}>
        <ActivityIndicator size="small" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.loadingState}>
        <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
          {t('settings.admin.access_denied_title')}
        </ThemedText>
      </ThemedView>
    );
  }

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
    const title = item.subject?.trim() ? item.subject : categoryLabel;

    return (
      <PressableCard
        variant="outlined"
        padding="md"
        style={styles.card}
        onPress={() => router.push(`/settings/admin/support-cases/${item.id}`)}
        {...getButtonAccessibilityProps(`${title}. ${statusLabel}`, AccessibilityHints.NAVIGATE)}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
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
          {t('support.admin.inbox_title')}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('support.admin.filters.status')}</ThemedText>
          <View style={styles.pills}>
            {statusOptions.map((opt) => {
              const selected = opt.value === status;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: selected ? colors.tintLight : colors.backgroundSecondary,
                      borderColor: selected ? colors.tint : colors.border,
                    },
                    Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                  ]}
                  onPress={() => setStatus(opt.value)}
                >
                  <ThemedText style={[styles.pillText, { color: selected ? colors.tint : colors.textSecondary }]}>
                    {t(opt.labelKey)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.filterRow}>
          <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('support.admin.filters.category')}</ThemedText>
          <View style={styles.pills}>
            {categoryOptions.map((opt) => {
              const selected = opt.value === category;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: selected ? colors.tintLight : colors.backgroundSecondary,
                      borderColor: selected ? colors.tint : colors.border,
                    },
                    Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                  ]}
                  onPress={() => setCategory(opt.value)}
                >
                  <ThemedText style={[styles.pillText, { color: selected ? colors.tint : colors.textSecondary }]}>
                    {t(opt.labelKey)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {isLoading && items.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={colors.tint} />
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
    width: '100%',
    maxWidth: Layout.desktopMaxWidth,
    alignSelf: 'center',
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
  filters: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  filterRow: {
    gap: Spacing.xs,
  },
  filterLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  pillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
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
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
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

