import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Layout, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { blockedUsersQueryKey, useBlockedUsers, useUnblockUser } from '@/hooks/use-friends';
import type { BlockedUser } from '@/lib/services/friends';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

function getBlockedUserInitials(user: { first_name: string | null; avoid: string | null }): string {
  const first = user.first_name?.trim();
  if (first && first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first && first.length === 1) return first.toUpperCase();
  const avoid = user.avoid?.trim();
  if (avoid && avoid.length >= 2) return avoid.slice(0, 2).toUpperCase();
  if (avoid && avoid.length === 1) return avoid.toUpperCase();
  return '••';
}

function getBlockedUserPrimaryLabel(user: { first_name: string | null; avoid: string | null }): string {
  const first = user.first_name?.trim();
  if (first) return first;
  return user.avoid ?? '•••';
}

export function BlockedUsersModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopOrTablet = windowWidth >= 768;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const blockedQuery = useBlockedUsers(open);
  const unblockMut = useUnblockUser();
  const list = blockedQuery.data ?? [];

  const handleUnblock = (userToUnblock: BlockedUser) => {
    if (unblockMut.isPending) return;
    const id = userToUnblock.blocked_user_id;
    // Optimistic: remove from list immediately
    queryClient.setQueryData(blockedUsersQueryKey(user?.id), (old: BlockedUser[] | undefined) =>
      old ? old.filter((u) => u.blocked_user_id !== id) : []
    );
    unblockMut.mutate(id, {
      onError: () => {
        queryClient.invalidateQueries({ queryKey: blockedUsersQueryKey(user?.id) });
      },
    });
  };

  return (
    <Modal visible={open} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalContent,
            isDesktopOrTablet && styles.modalContentDesktop,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <ThemedText type="title" style={{ color: colors.text }}>
              {t('friends.blocked_users_title', { defaultValue: 'Blocked users' })}
            </ThemedText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
              {...getButtonAccessibilityProps(t('common.close'), AccessibilityHints.CLOSE)}
            >
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} decorative={true} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            <ThemedText style={[styles.subtext, { color: colors.textSecondary }]}>
              {t('friends.blocked_users_subtext', {
                defaultValue:
                  "Blocked users can't send you requests or interact with you. They won't be notified.",
              })}
            </ThemedText>

            {blockedQuery.isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            ) : list.length === 0 ? (
              <ThemedText style={[styles.emptyState, { color: colors.textTertiary }]}>
                {t('friends.blocked_users_empty', { defaultValue: 'No blocked users' })}
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {list.map((user) => (
                  <View
                    key={user.blocked_user_id}
                    style={[styles.row, { borderBottomColor: colors.separator }]}
                  >
                    {user.avatar_url ? (
                      <Image
                        source={{ uri: user.avatar_url }}
                        style={[styles.avatar, { borderColor: colors.border }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.avatarInitials, { borderColor: colors.border }]}>
                        <ThemedText style={[styles.avatarText, { color: colors.textSecondary }]}>
                          {getBlockedUserInitials(user)}
                        </ThemedText>
                      </View>
                    )}
                    <View style={styles.rowContent}>
                      <ThemedText style={[styles.primaryLabel, { color: colors.text }]} numberOfLines={1}>
                        {getBlockedUserPrimaryLabel(user)}
                      </ThemedText>
                      {user.avoid ? (
                        <ThemedText
                          style={[styles.secondaryLabel, { color: colors.textTertiary }]}
                          numberOfLines={1}
                        >
                          {user.avoid}
                        </ThemedText>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUnblock(user)}
                      disabled={unblockMut.isPending}
                      style={styles.unblockButton}
                      activeOpacity={0.7}
                      {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                      {...getButtonAccessibilityProps(
                        t('friends.unblock', { defaultValue: 'Unblock' }),
                        AccessibilityHints.BUTTON,
                        unblockMut.isPending
                      )}
                    >
                      <ThemedText style={[styles.unblockLabel, { color: colors.tint }]}>
                        {t('friends.unblock', { defaultValue: 'Unblock' })}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    maxHeight: '85%',
    width: '100%',
  },
  modalContentDesktop: {
    maxWidth: Layout.maxContentWidth,
    borderRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  closeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...getMinTouchTargetStyle(),
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingBottom: Spacing.lg,
  },
  subtext: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  loadingRow: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyState: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  avatarInitials: {
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
  rowContent: {
    flex: 1,
    minWidth: 0,
    marginRight: Spacing.sm,
  },
  primaryLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  secondaryLabel: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xxs,
  },
  unblockButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    ...getMinTouchTargetStyle(),
  },
  unblockLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
