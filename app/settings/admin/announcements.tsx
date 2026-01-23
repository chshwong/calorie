import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { PressableCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAnnouncementsList, useAnnouncementNotificationStats } from '@/hooks/use-announcements';
import { pickI18n } from '@/utils/i18n';
import { formatUTCDate } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import type { Announcement } from '@/utils/types';

const PAGE_SIZE = 20;

export default function AdminAnnouncementsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAdmin, loading } = useAuth();

  const [cursor, setCursor] = useState<{ updatedAt: string; id: string } | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [nextCursor, setNextCursor] = useState<{ updatedAt: string; id: string } | null>(null);
  const appendedCursors = useRef(new Set<string>());

  const { data, isLoading, isFetching, refetch } = useAdminAnnouncementsList({ pageSize: PAGE_SIZE, cursor });
  const announcementIds = useMemo(() => items.map((item) => item.id), [items]);
  const { data: stats = [] } = useAnnouncementNotificationStats(announcementIds);

  const statsMap = useMemo(() => {
    return new Map(stats.map((row) => [row.announcement_id, row]));
  }, [stats]);

  useFocusEffect(
    useCallback(() => {
      if (!loading && !isAdmin) {
        Alert.alert(t('settings.admin.access_denied_title'), t('settings.admin.access_denied_message'));
        router.back();
      }
    }, [isAdmin, loading, router, t])
  );

  useEffect(() => {
    if (!data) return;
    const cursorKey = cursor ? `${cursor.updatedAt}-${cursor.id}` : 'first';
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

  const renderItem = ({ item }: { item: Announcement }) => {
    const title = pickI18n(item.title_i18n, locale);
    const updatedLabel = formatDate(formatUTCDate(item.updated_at), t);
    const isPublished = !!item.is_published;
    const stat = statsMap.get(item.id);
    const total = stat?.total ?? 0;
    const read = stat?.read ?? 0;

    return (
      <PressableCard
        variant="outlined"
        padding="md"
        style={styles.card}
        onPress={() => router.push(`/settings/admin/announcements/${item.id}`)}
        {...getButtonAccessibilityProps(title || t('settings.admin.announcements'), AccessibilityHints.NAVIGATE)}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {title || t('settings.admin.untitled_announcement')}
            </ThemedText>
            <ThemedText style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {updatedLabel}
            </ThemedText>
            {isPublished ? (
              <ThemedText style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {t('settings.admin.read_stats', { read, total })}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {t('settings.admin.status_draft')}
              </ThemedText>
            )}
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isPublished ? colors.tintLight : colors.backgroundSecondary,
                borderColor: isPublished ? colors.tint : colors.border,
              },
            ]}
          >
            <ThemedText style={[styles.statusText, { color: isPublished ? colors.tint : colors.textSecondary }]}>
              {isPublished ? t('settings.admin.status_published') : t('settings.admin.status_draft')}
            </ThemedText>
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
          {t('settings.admin.announcements')}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.actionRow}>
        <Button
          variant="primary"
          size="md"
          onPress={() => router.push('/settings/admin/announcements/new')}
          fullWidth
        >
          {t('settings.admin.create_announcement')}
        </Button>
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
                  <ThemedText style={[styles.loadMoreText, { color: colors.text }]}>
                    {t('inbox.load_more')}
                  </ThemedText>
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
  actionRow: {
    marginBottom: Spacing.md,
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
  statusPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
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
