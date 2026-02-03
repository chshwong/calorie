import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

import StatusGreen from '@/assets/images/StatusGreen.png';
import StatusGreyYellow from '@/assets/images/StatusGreyYellow.png';
import StatusYellow from '@/assets/images/StatusYellow.png';
import StatusYellowGreen from '@/assets/images/StatusYellowGreen.png';
import { AddFriendSheet } from '@/components/friends/AddFriendSheet';
import { FriendsSettingsModal } from '@/components/friends/FriendsSettingsModal';
import { NudgeEmojiPicker } from '@/components/friends/NudgeEmojiPicker';
import { RecentNudgesOverlay } from '@/components/friends/RecentNudgesOverlay';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { TightBrandHeader } from '@/components/layout/tight-brand-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showAppToast } from '@/components/ui/app-toast';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Layout, Nudge, SemanticColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    useAcceptFriendRequest,
    useBlockUser,
    useCancelFriendRequest,
    useDeclineFriendRequest,
    useFriendCards,
    useFriendRequests,
    useRecentNudges,
    useRemoveFriend,
} from '@/hooks/use-friends';
import { useUserConfig } from '@/hooks/use-user-config';
import {
    maskEmailForDisplay,
    type FriendCard,
    type FriendTargetState
} from '@/lib/services/friends';
import { getFoodLoggingStreakLabel } from '@/src/lib/streaks/foodStreakLabel';
import {
    AccessibilityHints,
    getButtonAccessibilityProps,
    getFocusStyle,
    getMinTouchTargetStyle,
} from '@/utils/accessibility';

/**
 * Outgoing request display: only what the requester supplied.
 * Email requests: masked email only (never AvoID/name/avatar).
 * AvoID requests: AvoID only. Do not reveal resolved profile.
 */
function getOutgoingDisplayLabel(
  req: { requested_via: string; target_avoid: string | null; target_email: string | null },
  t: (key: string, opts?: { defaultValue?: string }) => string
): string {
  if (req.requested_via === 'email') {
    if (req.target_email) return maskEmailForDisplay(req.target_email);
    return t('friends.email_request_fallback', { defaultValue: 'Email request' });
  }
  if (req.requested_via === 'avoid') {
    return req.target_avoid ?? '•••';
  }
  // qr / invite fallback: prefer stored identifier, never resolved profile
  if (req.target_email) return maskEmailForDisplay(req.target_email);
  if (req.target_avoid) return req.target_avoid;
  return t('friends.email_request_fallback', { defaultValue: 'Email request' });
}

function trimOutgoingIdentifier(input: string, maxChars = 24): string {
  const s = input.trim();
  if (!s) return '•••';
  if (s.length <= maxChars) return s;
  // Pre-trim so long identifiers never dominate (RN will still ellipsize if needed).
  return `${s.slice(0, Math.max(1, maxChars - 1))}…`;
}

function getRequesterInitials(req: { requester_first_name: string | null; requester_avoid: string | null }): string {
  const first = req.requester_first_name?.trim();
  if (first && first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first && first.length === 1) return first.toUpperCase();
  const avoid = req.requester_avoid?.trim();
  if (avoid && avoid.length >= 2) return avoid.slice(0, 2).toUpperCase();
  if (avoid && avoid.length === 1) return avoid.toUpperCase();
  return '••';
}

function getRequesterPrimaryLabel(req: { requester_first_name: string | null; requester_avoid: string | null }): string {
  const first = req.requester_first_name?.trim();
  if (first) return first;
  return req.requester_avoid ?? '•••';
}

function getFriendInitials(friend: { first_name: string | null; avoid: string | null }): string {
  const first = friend.first_name?.trim();
  if (first && first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first && first.length === 1) return first.toUpperCase();
  const avoid = friend.avoid?.trim();
  if (avoid && avoid.length >= 2) return avoid.slice(0, 2).toUpperCase();
  if (avoid && avoid.length === 1) return avoid.toUpperCase();
  return '••';
}

function getFriendPrimaryLabel(friend: { first_name: string | null; avoid: string | null }): string {
  const first = friend.first_name?.trim();
  if (first) return first;
  // Friends list cards should be people-first: do not fall back to AvoID for the primary label.
  return '•••';
}

function getStatusIcon(state: FriendTargetState | null | undefined): any | null {
  if (state === 'win') return StatusGreen;          // 100%
  if (state === 'almost') return StatusYellowGreen; // 85%+
  if (state === 'halfway') return StatusYellow;     // 50%+
  if (state === 'started') return StatusGreyYellow; // >0%
  return null;                                       // 0% (none)
}

export default function FriendsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width } = useWindowDimensions();

  const { profile: authProfile } = useAuth();
  const { data: userConfig } = useUserConfig();
  const effectiveProfile = userConfig || authProfile;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFriendsSettings, setShowFriendsSettings] = useState(false);
  const [showNudgesOverlay, setShowNudgesOverlay] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<FriendCard | null>(null);
  const [showFriendActions, setShowFriendActions] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ userId: string; name: string } | null>(null);

  const { incoming, outgoing, isLoading: requestsLoading } = useFriendRequests();
  const { data: recentNudges = [] } = useRecentNudges(true);
  const { data: friends = [], isLoading: friendsLoading } = useFriendCards();
  const acceptMut = useAcceptFriendRequest();
  const declineMut = useDeclineFriendRequest();
  const blockMut = useBlockUser();
  const cancelMut = useCancelFriendRequest();
  const removeFriendMut = useRemoveFriend();

  const hasRequests = incoming.length > 0 || outgoing.length > 0;
  const hasFriends = friends.length > 0;
  const hideTitleActions = showFriendsSettings || showAddModal;

  const handleSendSuccess = () => {
    setShowAddModal(false);
  };

  // Reset overlay visibility when nudges become empty (e.g. after ack) so future nudges show again
  useEffect(() => {
    if (recentNudges.length === 0) setShowNudgesOverlay(true);
  }, [recentNudges.length]);

  const showNudgesOverlayVisible = recentNudges.length > 0 && showNudgesOverlay;

  const AddButton = () => (
    <TouchableOpacity
      style={[
        styles.actionButton,
        getMinTouchTargetStyle(),
        Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
      ]}
      onPress={() => setShowAddModal(true)}
      activeOpacity={0.7}
      {...getButtonAccessibilityProps(t('friends.add_modal_title'), AccessibilityHints.BUTTON)}
    >
      <IconSymbol name="plus" size={20} color={colors.tint} decorative={true} />
    </TouchableOpacity>
  );

  const SettingsButton = () => (
    <TouchableOpacity
      style={[
        styles.actionButton,
        getMinTouchTargetStyle(),
        Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
      ]}
      onPress={() => setShowFriendsSettings(true)}
      activeOpacity={0.7}
      {...getButtonAccessibilityProps(
        t('friends.settings_title', { defaultValue: 'Friends Settings' }),
        AccessibilityHints.BUTTON
      )}
    >
      <IconSymbol name="gearshape" size={20} color={colors.textSecondary} decorative={true} />
    </TouchableOpacity>
  );

  const TitleRowActions = () => (
    <View style={[styles.titleRowActions, hideTitleActions && styles.titleRowActionsHidden]}>
      <SettingsButton />
      <AddButton />
    </View>
  );

  const Section = ({
    title,
    rightTitle,
    showRightTitle = true,
    children,
  }: {
    title: string;
    rightTitle?: string;
    showRightTitle?: boolean;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      {rightTitle && showRightTitle ? (
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</ThemedText>
          <ThemedText style={[styles.sectionTitle, styles.sectionTitleRight, { color: colors.textSecondary }]}>
            {rightTitle}
          </ThemedText>
        </View>
      ) : (
        <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</ThemedText>
      )}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const isLoading = requestsLoading || friendsLoading;

  return (
    <ThemedView style={styles.container}>
      <TightBrandHeader
        avatarUrl={effectiveProfile?.avatar_url ?? null}
        preferredName={effectiveProfile?.first_name ?? null}
        onPressAvatar={() => router.push('/settings')}
        logoVariant="nameOnly"
      />

      <View style={[styles.titleRow, { borderBottomColor: colors.separator }]}>
        <View style={styles.titleRowLeftSpacer} />
        <View style={styles.titleRowCenter}>
          <ThemedText style={[styles.screenTitle, { color: colors.text }]} numberOfLines={1}>
            {t('friends.title')}
          </ThemedText>
        </View>
        <View style={styles.titleRowRight}>
          <TitleRowActions />
        </View>
      </View>

      {isLoading ? (
        <View style={[styles.loadingRow, { paddingTop: Spacing.xl }]}>
          <ActivityIndicator size="small" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading')}
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <DesktopPageContainer style={styles.pageContent}>
            {hasRequests && (
              <Section title={t('friends.requests')}>
                {incoming.length > 0 && (
                  <>
                    <ThemedText style={[styles.subsectionLabel, { color: colors.textTertiary }]}>
                      {t('friends.incoming')}
                    </ThemedText>
                    {incoming.map((req) => (
                      <View
                        key={req.id}
                        style={[
                          styles.incomingRequestRow,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderLeftWidth: 2,
                            borderLeftColor: (colors.tint ?? '#3B82F6') + '25',
                          },
                        ]}
                      >
                        {req.requester_avatar_url ? (
                          <Image
                            source={{ uri: req.requester_avatar_url }}
                            style={[styles.friendAvatar, { borderColor: colors.border }]}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.friendAvatarInitials,
                              { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                            ]}
                          >
                            <ThemedText style={[styles.friendAvatarText, { color: colors.textSecondary }]}>
                              {getRequesterInitials(req)}
                            </ThemedText>
                          </View>
                        )}

                        <View style={styles.friendContent}>
                          <ThemedText style={[styles.friendPrimary, { color: colors.text }]} numberOfLines={1}>
                            {getRequesterPrimaryLabel(req)}
                          </ThemedText>
                          {req.requester_avoid && getRequesterPrimaryLabel(req) !== req.requester_avoid ? (
                            <ThemedText style={[styles.friendSecondary, { color: colors.textSecondary }]} numberOfLines={1}>
                              {req.requester_avoid}
                            </ThemedText>
                          ) : null}
                        </View>

                        <View style={styles.incomingActions}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.incomingActionBtn,
                              getMinTouchTargetStyle(),
                              Platform.OS === 'web' ? getFocusStyle(SemanticColors.success) : {},
                              { opacity: pressed ? 1 : 0.88 },
                            ]}
                            onPress={() =>
                              acceptMut.mutate(req.id, {
                                onError: (err) =>
                                  showAppToast(
                                    err instanceof Error && err.message === 'FRIENDS_BLOCKED'
                                      ? t('friends.error_blocked')
                                      : t('common.unexpected_error')
                                  ),
                              })
                            }
                            disabled={acceptMut.isPending}
                            {...getButtonAccessibilityProps(t('friends.accept_a11y'), AccessibilityHints.BUTTON)}
                          >
                            <IconSymbol name="checkmark.circle" size={20} color={SemanticColors.success} decorative={true} />
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.incomingActionBtn,
                              getMinTouchTargetStyle(),
                              Platform.OS === 'web' ? getFocusStyle(colors.error) : {},
                              { opacity: pressed ? 1 : 0.88 },
                            ]}
                            onPress={() => declineMut.mutate(req.id)}
                            disabled={declineMut.isPending}
                            {...getButtonAccessibilityProps(t('friends.decline_a11y'), AccessibilityHints.BUTTON)}
                          >
                            <IconSymbol name="xmark.circle" size={20} color={colors.error} decorative={true} />
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.incomingActionBtn,
                              getMinTouchTargetStyle(),
                              Platform.OS === 'web' ? getFocusStyle(colors.error) : {},
                              { opacity: pressed ? 1 : 0.88 },
                            ]}
                            onPress={() =>
                              setBlockTarget({
                                userId: req.requester_user_id,
                                name: getRequesterPrimaryLabel(req),
                              })
                            }
                            disabled={blockMut.isPending}
                            {...getButtonAccessibilityProps(t('friends.block_a11y'), AccessibilityHints.BUTTON)}
                          >
                            <IconSymbol name="block" size={20} color={colors.error} decorative={true} />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {outgoing.length > 0 && (
                  <>
                    <ThemedText style={[styles.subsectionLabel, { color: colors.textTertiary }]}>
                      {t('friends.outgoing')}
                    </ThemedText>
                    {outgoing.map((req) => (
                      <View
                        key={req.id}
                        style={[styles.requestRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <View style={styles.outgoingLeft}>
                          <ThemedText
                            style={[styles.outgoingIdentifier, { color: colors.textTertiary }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {t('friends.outgoing_to_prefix', { defaultValue: 'To:' })}{' '}
                            {trimOutgoingIdentifier(getOutgoingDisplayLabel(req, t))}
                          </ThemedText>
                        </View>

                        <View style={styles.outgoingRight}>
                          <ThemedText style={[styles.outgoingPending, { color: colors.textTertiary }]}>
                            {t('common.pending')}
                          </ThemedText>
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => cancelMut.mutate(req.id)}
                            disabled={cancelMut.isPending}
                            textStyle={{ color: colors.textTertiary }}
                          >
                            {t('common.cancel')}
                          </Button>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </Section>
            )}

            <Section
              title={`${t('friends.title')} (${friends.length})`}
              rightTitle={t('friends.daily_goals_header', { defaultValue: 'Daily goals' })}
              showRightTitle={width >= 360}
            >
              {hasFriends ? (
                friends.map((friend) => (
                  <View
                    key={friend.friend_user_id}
                    style={[
                      styles.friendRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.friendRowTouchable,
                        styles.friendRowTouchableLeft,
                        styles.friendRowLeftContent,
                        getMinTouchTargetStyle(),
                        Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
                      ]}
                      onPress={() => {
                        setSelectedFriend(friend);
                        setShowFriendActions(true);
                      }}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(`${getFriendPrimaryLabel(friend)}`, AccessibilityHints.BUTTON)}
                    >
                      {friend.avatar_url ? (
                        <Image
                          source={{ uri: friend.avatar_url }}
                          style={[styles.friendAvatar, { borderColor: colors.border }]}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.friendAvatarInitials,
                            { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                          ]}
                        >
                          <ThemedText style={[styles.friendAvatarText, { color: colors.textSecondary }]}>
                            {getFriendInitials(friend)}
                          </ThemedText>
                        </View>
                      )}

                      <View style={styles.friendContent}>
                        <ThemedText style={[styles.friendPrimary, { color: colors.text }]} numberOfLines={1}>
                          {getFriendPrimaryLabel(friend)}
                        </ThemedText>
                        {(() => {
                          const streak = getFoodLoggingStreakLabel(friend.food_streak_days);
                          if (!streak) return null;
                          return (
                            <ThemedText style={[styles.friendTertiary, { color: colors.textSecondary }]} numberOfLines={1}>
                              {t('friends.food_streak_line', { count: streak.days, emoji: streak.emoji })}
                            </ThemedText>
                          );
                        })()}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.friendNudgeWrapper}>
                      <NudgeEmojiPicker
                        friendUserId={friend.friend_user_id}
                        friendName={getFriendPrimaryLabel(friend)}
                      />
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.friendRowTouchable,
                        styles.friendRowTouchableRight,
                        styles.friendGoalsColumn,
                        getMinTouchTargetStyle(),
                        Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
                      ]}
                      onPress={() => {
                        setSelectedFriend(friend);
                        setShowFriendActions(true);
                      }}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(`${getFriendPrimaryLabel(friend)}`, AccessibilityHints.BUTTON)}
                    >
                      <View style={[styles.friendGoalsSeparator, { backgroundColor: colors.border }]} />

                      {(() => {
                      // Privacy: if a friend has hidden a metric via sharing prefs, the server returns NULL.
                      // Per UX: still render the titles, but show blank value/icon.
                      return (
                        <View style={styles.friendSignals} accessibilityElementsHidden={true}>
                          <View style={styles.goalsCluster}>
                            <View style={[styles.nutrientBlock, styles.nutrientBlockIcon]}>
                              <ThemedText style={[styles.nutrientTitle, { color: colors.textSecondary }]}>Pro</ThemedText>
                              <View style={styles.nutrientIconRow}>
                                {getStatusIcon(friend.protein_state) ? (
                                  <Image source={getStatusIcon(friend.protein_state)} style={styles.statusIcon} />
                                ) : null /* 'none' OR NULL => blank value cell */}
                              </View>
                            </View>

                            <View style={[styles.nutrientBlock, styles.nutrientBlockIcon]}>
                              <ThemedText style={[styles.nutrientTitle, { color: colors.textSecondary }]}>Fib</ThemedText>
                              <View style={styles.nutrientIconRow}>
                                {getStatusIcon(friend.fibre_state) ? (
                                  <Image source={getStatusIcon(friend.fibre_state)} style={styles.statusIcon} />
                                ) : null /* 'none' OR NULL => blank value cell */}
                              </View>
                            </View>

                            <View style={[styles.nutrientBlock, styles.nutrientBlockIcon]}>
                              <ThemedText style={[styles.nutrientTitle, { color: colors.textSecondary }]}>💧</ThemedText>
                              <View style={styles.nutrientIconRow}>
                                {getStatusIcon(friend.water_state) ? (
                                  <Image source={getStatusIcon(friend.water_state)} style={styles.statusIcon} />
                                ) : null /* 'none' OR NULL => blank value cell */}
                              </View>
                            </View>

                            <View style={[styles.nutrientBlock, styles.nutrientBlockSteps]}>
                              <ThemedText style={[styles.nutrientTitle, { color: colors.textSecondary }]}>👣</ThemedText>
                              <View style={[styles.nutrientIconRow, styles.nutrientIconRowSteps]}>
                                {friend.steps != null && friend.steps > 0 ? (
                                  <ThemedText
                                    style={[
                                      styles.nutrientValue,
                                      styles.nutrientValueRight,
                                      { color: colors.textSecondary, width: '100%' },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {Number(friend.steps).toLocaleString()}
                                  </ThemedText>
                                ) : null /* 0 OR NULL => blank value cell */}
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText style={[styles.emptyTitle, { color: colors.text }]} accessibilityRole="header">
                    {t('friends.empty_title')}
                  </ThemedText>
                  <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    {t('friends.empty_subtitle')}
                  </ThemedText>
                  <Button
                    variant="primary"
                    size="md"
                    onPress={() => setShowAddModal(true)}
                    style={styles.emptyButton}
                    {...getButtonAccessibilityProps(t('friends.add_modal_title'), AccessibilityHints.BUTTON)}
                  >
                    {t('friends.add_modal_title')}
                  </Button>
                </View>
              )}
            </Section>
          </DesktopPageContainer>
        </ScrollView>
      )}

      <AddFriendSheet visible={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={handleSendSuccess} />

      <FriendsSettingsModal open={showFriendsSettings} onClose={() => setShowFriendsSettings(false)} />

      {showNudgesOverlayVisible && (
        <RecentNudgesOverlay nudges={recentNudges} onClose={() => setShowNudgesOverlay(false)} />
      )}

      <Modal
        visible={showFriendActions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFriendActions(false)}
      >
        <View style={styles.actionSheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFriendActions(false)} accessible={false} />
          <View style={[styles.actionSheetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.actionSheetRow, getMinTouchTargetStyle()]}
              onPress={() => {
                setShowFriendActions(false);
                setShowRemoveConfirm(true);
              }}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                t('friends.remove_friend_action', { defaultValue: 'Remove Friend' }),
                AccessibilityHints.BUTTON
              )}
            >
              <ThemedText style={[styles.actionSheetDestructiveText, { color: colors.error }]}>
                {t('friends.remove_friend_action', { defaultValue: 'Remove Friend' })}
              </ThemedText>
            </TouchableOpacity>

            <View style={[styles.actionSheetDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.actionSheetRow, getMinTouchTargetStyle()]}
              onPress={() => {
                const userId = selectedFriend?.friend_user_id;
                if (!userId || blockMut.isPending) return;
                setShowFriendActions(false);
                setBlockTarget({
                  userId,
                  name: selectedFriend ? getFriendPrimaryLabel(selectedFriend) : '',
                });
              }}
              activeOpacity={0.7}
              disabled={blockMut.isPending}
              {...getButtonAccessibilityProps(
                t('friends.block_button', { defaultValue: 'Block' }),
                AccessibilityHints.BUTTON,
                blockMut.isPending
              )}
            >
              <ThemedText style={[styles.actionSheetDestructiveText, { color: colors.error }]}>
                {t('friends.block_button', { defaultValue: 'Block' })}
              </ThemedText>
            </TouchableOpacity>

            <View style={[styles.actionSheetDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.actionSheetRow, getMinTouchTargetStyle()]}
              onPress={() => setShowFriendActions(false)}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('common.cancel'), AccessibilityHints.BUTTON)}
            >
              <ThemedText style={[styles.actionSheetCancelText, { color: colors.text }]}>{t('common.cancel')}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={showRemoveConfirm}
        title={t('friends.remove_friend_confirm_title', { defaultValue: 'Remove Friend?' })}
        message={t('friends.remove_friend_confirm_message', { defaultValue: "They won't be notified." })}
        confirmText={t('friends.remove_friend_confirm_button', { defaultValue: 'Remove' })}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          const id = selectedFriend?.friend_user_id;
          if (!id || removeFriendMut.isPending) return;
          removeFriendMut.mutate(id, {
            onSuccess: () => {
              setShowRemoveConfirm(false);
              setSelectedFriend(null);
            },
          });
        }}
        onCancel={() => {
          setShowRemoveConfirm(false);
          setSelectedFriend(null);
        }}
        confirmButtonStyle={{ backgroundColor: colors.error }}
        cancelButtonStyle={{ backgroundColor: colors.backgroundSecondary }}
        cancelTextStyle={{ color: colors.text }}
        confirmDisabled={removeFriendMut.isPending}
        animationType="fade"
      />

      <ConfirmModal
        visible={!!blockTarget}
        title={t('friends.block_confirm_title', { name: blockTarget?.name ?? '' })}
        message={t('friends.block_confirm_message')}
        confirmText={t('friends.block_button')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          const userId = blockTarget?.userId;
          if (!userId || blockMut.isPending) return;
          blockMut.mutate(userId, {
            onSuccess: () => {
              setBlockTarget(null);
              setSelectedFriend(null);
            },
          });
        }}
        onCancel={() => setBlockTarget(null)}
        confirmButtonStyle={{ backgroundColor: colors.error }}
        cancelButtonStyle={{ backgroundColor: colors.backgroundSecondary }}
        cancelTextStyle={{ color: colors.text }}
        confirmDisabled={blockMut.isPending}
        animationType="fade"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.none,
    // TightBrandHeader includes bottom padding; pull this row up to reduce the
    // perceived gap without changing the global header height.
    marginTop: -Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Keep the title truly centered while the right-side actions take space.
  // This works because left spacer matches the right actions width.
  titleRowLeftSpacer: {
    width: Layout.minTouchTarget * 2 + Spacing.xs, // 2 icon buttons + gap
  },
  titleRowCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  titleRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: Layout.minTouchTarget * 2 + Spacing.xs, // keep symmetric with left spacer
  },
  screenTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: FontSize.lg + 2,
    marginTop: -2,
  },
  titleRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  titleRowActionsHidden: {
    opacity: 0,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  pageContent: {
    // Reduced gutters so cards are closer to edges (mobile-first).
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    // Align with card content (avatar edge); cards use paddingHorizontal Spacing.sm.
    paddingLeft: Spacing.sm,
    paddingRight: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRight: {
    textAlign: 'right',
    paddingRight: Spacing.sm, // Align with Daily Goals cluster in cards.
  },
  subsectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xxs,
  },
  sectionContent: {
    gap: 6,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    // Outgoing requests: compact, list-like; minimal vertical padding.
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  outgoingLeft: {
    flex: 1,
    minWidth: 0, // critical: allow identifier to truncate instead of overlapping actions
  },
  outgoingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  outgoingPending: {
    fontSize: FontSize.xs,
    opacity: 0.75,
  },
  outgoingIdentifier: {
    // Outgoing identifier (AvoID or masked email) should be subtle/secondary.
    fontSize: FontSize.sm,
    fontWeight: '400',
  },
  incomingRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  incomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  incomingActionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  requestContent: {
    flex: 1,
  },
  requestLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  requestNote: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingLeft: 0,
    paddingRight: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  friendRowLeftContent: {
    paddingLeft: Spacing.md,
    paddingVertical: 0,
  },
  friendRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  friendRowTouchableLeft: {
    flex: 1,
    // Allow left content to shrink on narrow widths so goals never get pushed off-screen.
    flexShrink: 1,
    minWidth: 0,
  },
  friendRowTouchableRight: {
    /**
     * Daily Goals panel:
     * - Must never overflow off-screen
     * - Must not steal horizontal space from the name/streak column
     *
     * Cap its width (percentage) and allow shrinking/wrapping within.
     */
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    maxWidth: '42%',
    minWidth: 0,
  },
  friendGoalsColumn: {
    paddingRight: 0,
    marginRight: 0,
    alignItems: 'flex-end',
  },
  friendNudgeWrapper: {
    width: 36,
    marginLeft: Spacing.xxs,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  friendAvatarInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  friendContent: {
    flex: 1,
    minWidth: 0,
  },
  friendGoalsSeparator: {
    width: 1,
    alignSelf: 'stretch',
    opacity: 0.5,
    // Keep divider close to the goals to maximize left-column space.
    marginLeft: 0,
  },
  friendSignals: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    // Remove extra inset between divider and first goal label (Pro).
    marginLeft: 0,
    paddingRight: 0,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  goalsCluster: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: Nudge.px1,
    flexShrink: 1,
    minWidth: 0,
    flexWrap: 'wrap',
    alignContent: 'flex-end',
  },
  friendPrimary: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  friendSecondary: {
    fontSize: FontSize.sm,
    marginTop: Spacing.none,
  },
  friendTertiary: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xxs,
    opacity: 0.75,
  },
  nutrientBlock: {
    alignItems: 'center',
  },
  nutrientBlockIcon: {
    width: 18,
  },
  nutrientBlockSteps: {
    minWidth: 28,
    maxWidth: 52,
    // Keep the 👣 closer to 💧 (less perceived gap), while the number stays right-aligned via width: 100% + textAlign.
    alignItems: 'flex-start',
  },
  nutrientTitle: {
    fontSize: FontSize.xs,
    opacity: 0.75,
    marginBottom: Spacing.xxs,
  },
  nutrientIconRow: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutrientIconRowSteps: {
    alignItems: 'stretch',
    minWidth: 0,
  },
  nutrientValue: {
    fontSize: FontSize.xs,
    lineHeight: 14,
    opacity: 0.85,
  },
  nutrientValueRight: {
    textAlign: 'right',
  },
  statusIcon: {
    width: 13,
    height: 13,
    resizeMode: 'contain',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    minWidth: 160,
  },
  actionSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: Spacing.lg,
  },
  actionSheetCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionSheetRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetDivider: {
    height: 1,
    width: '100%',
  },
  actionSheetDestructiveText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  actionSheetCancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});

