import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { router as appRouter, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

import { TightBrandHeader } from '@/components/layout/tight-brand-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PressableCard } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useAnnouncementsByIds } from '@/hooks/use-announcements';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    inboxNotificationsQueryKeyBase,
    useInboxNotifications,
    useMarkAllInboxNotificationsRead,
    useMarkNotificationRead,
} from '@/hooks/use-notifications';
import { useUserConfig } from '@/hooks/use-user-config';
import {
    AccessibilityHints,
    getButtonAccessibilityProps,
    getFocusStyle,
    getMinTouchTargetStyle,
} from '@/utils/accessibility';
import { projectAnnouncementBodyPlainText } from '@/utils/announcementRichText';
import { formatUTCDate } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { pickI18n } from '@/utils/i18n';
import type { Notification } from '@/utils/types';

const PAGE_SIZE = 20;

export default function InboxScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const { user } = useAuth();
  const { data: userConfig } = useUserConfig();
  const profile = userConfig;
  const avatarUrl = profile?.avatar_url ?? null;
  const preferredName = profile?.first_name ?? null;
  const isNativeWebWrapper =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    ['native', 'native_onboarding'].includes((window as any).__AVOVIBE_CONTAINER__?.type);

  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [nextCursor, setNextCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const appendedCursors = useRef(new Set<string>());

  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useInboxNotifications({ pageSize: PAGE_SIZE, cursor });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllInboxNotificationsRead();

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read_at).length,
    [items]
  );
  const canMarkAll = unreadCount > 0 && !markAllRead.isPending;

  // Track last non-inbox location for safe back navigation
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      // Only track if current path is NOT an inbox route
      if (pathname && !pathname.startsWith('/inbox')) {
        try {
          sessionStorage.setItem('last_non_inbox_path', pathname);
        } catch (e) {
          // sessionStorage not available or quota exceeded, ignore
        }
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!data) return;
    const cursorKey = cursor ? `${cursor.createdAt}-${cursor.id}` : 'first';
    if (appendedCursors.current.has(cursorKey)) return;

    appendedCursors.current.add(cursorKey);
    setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
  }, [data, cursor]);

  const announcementIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => {
      if (item.type === 'announcement' && item.announcement_id) {
        ids.add(item.announcement_id);
      }
    });
    return Array.from(ids);
  }, [items]);

  const { data: announcements = [] } = useAnnouncementsByIds(announcementIds);

  const announcementMap = useMemo(() => {
    return new Map(announcements.map((announcement) => [announcement.id, announcement]));
  }, [announcements]);

  const handleBack = () => {
    const HOME_PATH = '/'; // Food log home route

    // Safe back: never return to announcement routes to prevent loops
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Check referrer - if it's an announcement route, go home instead
      const referrer = document.referrer;
      if (referrer) {
        try {
          const referrerUrl = new URL(referrer);
          // Same-origin check
          if (referrerUrl.origin === window.location.origin) {
            const referrerPath = referrerUrl.pathname;
            // If referrer is an announcement route, go home to prevent loop
            if (referrerPath.startsWith('/inbox/announcements/')) {
              router.replace(HOME_PATH);
              return;
            }
          }
        } catch (e) {
          // Invalid URL, continue with normal logic
        }
      }

      // Check sessionStorage for last non-inbox location
      try {
        const lastNonInboxPath = sessionStorage.getItem('last_non_inbox_path');
        if (lastNonInboxPath) {
          // If stored path is an announcement route, ignore it and go home
          if (lastNonInboxPath.startsWith('/inbox/announcements/')) {
            sessionStorage.removeItem('last_non_inbox_path');
            router.replace(HOME_PATH);
            return;
          }
          // If stored path is valid and not an inbox route, navigate to it
          if (!lastNonInboxPath.startsWith('/inbox')) {
            sessionStorage.removeItem('last_non_inbox_path');
            router.replace(lastNonInboxPath as any);
            return;
          }
        }
      } catch (e) {
        // sessionStorage not available, continue with normal logic
      }

      // If history exists and we haven't detected an announcement route, try going back
      if (window.history.length > 1) {
        // Check if router.canGoBack is available
        const canGoBack =
          typeof (appRouter as any).canGoBack === 'function' && (appRouter as any).canGoBack();
        if (canGoBack) {
          router.back();
          return;
        }
        // Fallback to window.history.back() but this is risky, so we'll prefer home
        // Actually, let's be safe and go home if we can't verify the previous route
        router.replace(HOME_PATH);
        return;
      }
    }

    // Native or no history: go home
    router.replace(HOME_PATH);
  };

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

  const handleMarkAllRead = async () => {
    if (!canMarkAll) return;
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev
        .filter((n) => n.type !== 'friend_request_accepted')
        .map((n) => (n.read_at ? n : { ...n, read_at: nowIso }))
    );
    try {
      await markAllRead.mutateAsync();
      await refetch();
    } catch {
      appendedCursors.current.clear();
      setCursor(null);
      setItems([]);
      setNextCursor(null);
      await queryClient.invalidateQueries({
        queryKey: inboxNotificationsQueryKeyBase(user?.id),
      });
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const announcement = item.announcement_id ? announcementMap.get(item.announcement_id) : null;
    const isAnnouncement = item.type === 'announcement';
    const isCaseReply = item.type === 'case_reply';
    const isFriendRequest = item.type === 'friend_request';
    const isFriendRequestAccepted = item.type === 'friend_request_accepted';
    const isNudges = item.type === 'nudges';

    const isAggregateFriendRequest =
      isFriendRequest && (item.dedupe_key as string) === 'friend_request_incoming_aggregate';
    const pendingCount = (item.meta as any)?.pending_count as number | undefined;
    const friendRequestCount = isAggregateFriendRequest && typeof pendingCount === 'number' ? pendingCount : 1;

    const nudgeCount = isNudges ? ((item.meta as any)?.unack_count as number | undefined) ?? 1 : 0;
    const fallbackTitle = item.title_i18n ? pickI18n(item.title_i18n, locale) : null;
    const fallbackBody = item.body_i18n ? pickI18n(item.body_i18n, locale) : '';

    const title = isAnnouncement
      ? announcement
        ? pickI18n(announcement.title_i18n, locale)
        : fallbackTitle || t('inbox.announcement_default_title')
      : isCaseReply
        ? t('inbox.case_reply_title')
        : isFriendRequestAccepted
          ? t('inbox.friend_request_accepted_title', { defaultValue: 'Friend request accepted' })
        : isAggregateFriendRequest
          ? t('inbox.friend_requests_title', { defaultValue: 'Friend requests' })
        : isNudges
          ? t('inbox.nudges_title', { defaultValue: 'Nudges' })
        : isFriendRequest
          ? t('inbox.friend_request_title', { defaultValue: 'Friend request' })
        : fallbackTitle || t('inbox.announcement_default_title');

    const body = isAnnouncement && announcement ? pickI18n(announcement.body_i18n, locale) : fallbackBody;
    const preview = isCaseReply
      ? t('inbox.case_reply_body')
      : isNudges
        ? t('inbox.nudges_body', { count: nudgeCount, defaultValue: 'You have {{count}} new nudge(s)' })
      : isFriendRequestAccepted
        ? t('inbox.friend_request_accepted_body', {
            defaultValue: '{{name}} accepted your friend request.',
            name:
              ((item.meta as any)?.accepter_first_name as string | undefined) ||
              ((item.meta as any)?.accepter_avoid as string | undefined) ||
              t('common.someone', { defaultValue: 'Someone' }),
          })
      : isAggregateFriendRequest
        ? t('inbox.friend_requests_body', {
            count: friendRequestCount,
            defaultValue: 'You have {{count}} pending friend request(s).',
          })
        : isFriendRequest
          ? t('inbox.friend_request_body', { defaultValue: 'You have a new friend request.' })
          : buildPreview(body);
    const dateLabel = formatDate(formatUTCDate(item.created_at), t);
    const isUnread = !item.read_at;

    return (
      <PressableCard
        variant="outlined"
        padding="md"
        style={styles.card}
        onPress={() => {
          if (isFriendRequestAccepted) {
            setItems((prev) => prev.filter((n) => n.id !== item.id));
            if (isUnread) markRead.mutate(item.id);
          } else if (isUnread) {
            markRead.mutate(item.id);
          }
          if (isAnnouncement && item.announcement_id) {
            router.push(`/inbox/announcements/${item.announcement_id}`);
            return;
          }
          if (isFriendRequestAccepted) {
            const path = item.link_path || '/friends';
            router.push(path as any);
            return;
          }
          if (isFriendRequest) {
            const path = item.link_path || '/friends';
            router.push(path as any);
            return;
          }
          if (isNudges) {
            const path = item.link_path || '/friends';
            router.push(path as any);
            return;
          }
          if (isCaseReply) {
            const metaCaseId = (item.meta as any)?.case_id ? String((item.meta as any).case_id) : null;
            const path = item.link_path || (metaCaseId ? `/support/cases/${metaCaseId}` : null);
            if (path) {
              router.push(path as any);
            }
          }
        }}
        {...getButtonAccessibilityProps(
          `${title}. ${isUnread ? t('inbox.unread') : t('inbox.read')}`,
          AccessibilityHints.NAVIGATE
        )}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardIcon}>
            <View
              style={[
                styles.unreadDot,
                {
                  backgroundColor: isUnread ? colors.tint : colors.border,
                },
              ]}
              accessibilityElementsHidden={true}
              importantForAccessibility="no-hide-descendants"
            />
          </View>
          <View style={styles.cardContent}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </ThemedText>
            {!!preview && (
              <ThemedText style={[styles.cardPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                {preview}
              </ThemedText>
            )}
            <ThemedText style={[styles.cardDate, { color: colors.textTertiary }]}>{dateLabel}</ThemedText>
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
      <TightBrandHeader
        avatarUrl={avatarUrl}
        preferredName={preferredName}
        onPressAvatar={() => router.push('/settings')}
      />

      <View style={styles.content}>
        <TouchableOpacity
          style={[
            styles.backLink,
            { paddingTop: isNativeWebWrapper ? 0 : Spacing.md },
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
          ]}
          onPress={handleBack}
          {...getButtonAccessibilityProps(t('common.back'), AccessibilityHints.BACK)}
        >
          <IconSymbol name="chevron.left" size={18} color={colors.textSecondary} decorative={true} />
          <ThemedText style={[styles.backLinkText, { color: colors.textSecondary }]}>
            {t('common.back')}
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <ThemedText style={[styles.pageTitle, { color: colors.text }]} accessibilityRole="header">
            {t('inbox.title')}
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.markAllReadButton,
              getMinTouchTargetStyle(),
              Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
            ]}
            onPress={handleMarkAllRead}
            disabled={!canMarkAll}
            hitSlop={10}
            {...getButtonAccessibilityProps(
              t('inbox.mark_all_as_read'),
              AccessibilityHints.BUTTON,
              !canMarkAll
            )}
          >
            <ThemedText
              style={[
                styles.markAllReadText,
                { color: canMarkAll ? colors.tint : colors.textSecondary },
                !canMarkAll && styles.markAllReadTextDisabled,
              ]}
            >
              {t('inbox.mark_all_as_read')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        ) : showEmpty ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="inbox-outline" size={48} color={colors.textTertiary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              {t('inbox.empty_title')}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {t('inbox.empty_body')}
            </ThemedText>
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
      </View>
    </ThemedView>
  );
}

function buildPreview(body: string) {
  return projectAnnouncementBodyPlainText(body, { maxLength: 120 });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: Layout.desktopMaxWidth,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
  },
  backLinkText: {
    fontSize: FontSize.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPadding,
    marginTop: 0,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pageTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  markAllReadButton: {
    flexShrink: 0,
  },
  markAllReadText: {
    fontSize: FontSize.sm,
  },
  markAllReadTextDisabled: {
    opacity: 0.45,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  card: {
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  cardIcon: {
    paddingTop: Platform.OS === 'web' ? 2 : 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
  },
  cardContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cardPreview: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  cardDate: {
    fontSize: FontSize.xs,
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
    fontWeight: FontWeight.semibold,
  },
  footerSpacer: {
    height: Spacing.lg,
  },
});
