/**
 * RecentNudgesOverlay - Pretty overlay listing recent nudges (who + emoji + time ago)
 * Shown on Friends page when user has unacknowledged nudges.
 * Closing acknowledges & clears them.
 */

import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAckNudges } from '@/hooks/use-friends';
import type { RecentNudge } from '@/lib/services/friends';
import { formatTimeAgo } from '@/utils/timeAgo';
import {
  AccessibilityHints,
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

type RecentNudgesOverlayProps = {
  nudges: RecentNudge[];
  onClose: () => void;
};

function getSenderInitials(nudge: RecentNudge): string {
  const name = nudge.sender_name?.trim();
  if (name && name.length >= 2) return name.slice(0, 2).toUpperCase();
  if (name && name.length === 1) return name.toUpperCase();
  return '••';
}

/** Group nudges by sender, with count and latest created_at */
function groupNudgesBySender(nudges: RecentNudge[]): Array<{ sender: RecentNudge; count: number; latestAt: string; ids: string[] }> {
  const bySender = new Map<string, RecentNudge[]>();
  for (const n of nudges) {
    const list = bySender.get(n.sender_user_id) ?? [];
    list.push(n);
    bySender.set(n.sender_user_id, list);
  }
  return Array.from(bySender.entries()).map(([_, list]) => {
    const sorted = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = sorted[0];
    return {
      sender: latest,
      count: list.length,
      latestAt: latest.created_at,
      ids: list.map((n) => n.id),
    };
  });
}

export function RecentNudgesOverlay({ nudges, onClose }: RecentNudgesOverlayProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const ackMut = useAckNudges();
  const groups = groupNudgesBySender(nudges);
  const allIds = nudges.map((n) => n.id);

  const handleClose = () => {
    if (allIds.length > 0 && !ackMut.isPending) {
      ackMut.mutate(allIds, { onSettled: () => onClose() });
    } else {
      onClose();
    }
  };

  if (nudges.length === 0) return null;

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: colors.overlay ?? 'rgba(0,0,0,0.4)' }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ color: colors.text }}>
              {t('friends.nudges_overlay_title', { defaultValue: 'Nudges' })}
            </ThemedText>
            <TouchableOpacity
              style={[styles.closeBtn, getMinTouchTargetStyle(), Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}]}
              onPress={handleClose}
              disabled={ackMut.isPending}
              {...getButtonAccessibilityProps(t('common.close'), AccessibilityHints.CLOSE)}
            >
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} decorative={true} />
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {groups.map((g) => (
              <View key={g.sender.sender_user_id} style={[styles.row, { borderBottomColor: colors.border }]}>
                {g.sender.sender_avatar_url ? (
                  <Image
                    source={{ uri: g.sender.sender_avatar_url }}
                    style={[styles.avatar, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <ThemedText style={[styles.avatarText, { color: colors.textSecondary }]}>
                      {getSenderInitials(g.sender)}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.content}>
                  <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {g.sender.sender_name || t('common.someone', { defaultValue: 'Someone' })}
                  </ThemedText>
                  <ThemedText style={[styles.time, { color: colors.textTertiary }]}>
                    {formatTimeAgo(g.latestAt)}
                  </ThemedText>
                </View>
                <View style={styles.emojiBlock}>
                  <ThemedText style={styles.emoji}>{g.sender.emoji}</ThemedText>
                  {g.count > 1 && (
                    <ThemedText style={[styles.count, { color: colors.textSecondary }]}>×{g.count}</ThemedText>
                  )}
                </View>
              </View>
            ))}
          </View>

          <Pressable
            style={[
              styles.gotItBtn,
              { backgroundColor: colors.tint },
              getMinTouchTargetStyle(),
              Platform.OS === 'web' ? getFocusStyle('#fff') : {},
            ]}
            onPress={handleClose}
            disabled={ackMut.isPending}
            {...getButtonAccessibilityProps(
              t('friends.nudges_got_it', { defaultValue: 'Got it' }),
              AccessibilityHints.BUTTON,
              ackMut.isPending
            )}
          >
            <ThemedText style={[styles.gotItText, { color: colors.textInverse }]}>
              {ackMut.isPending ? t('common.loading', { defaultValue: 'Loading' }) : t('friends.nudges_got_it', { defaultValue: 'Got it' })}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  closeBtn: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  list: {
    maxHeight: 240,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  time: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  emojiBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 24,
  },
  count: {
    fontSize: FontSize.sm,
  },
  gotItBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
