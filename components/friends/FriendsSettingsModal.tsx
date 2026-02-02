import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Switch, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BlockedUsersModal } from '@/components/friends/BlockedUsersModal';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { showAppToast } from '@/components/ui/app-toast';
import { BorderRadius, Colors, FontSize, Layout, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFriendVisibilityPrefs, useUpsertFriendVisibilityPrefs } from '@/hooks/use-friend-visibility-prefs';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type FriendVisibilityPrefsDraft = {
  show_protein: boolean;
  show_fibre: boolean;
  show_water: boolean;
  show_steps: boolean;
  show_food_streak: boolean;
};

export function FriendsSettingsModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopOrTablet = windowWidth >= 768;

  const prefsQuery = useFriendVisibilityPrefs(open);
  const upsertMut = useUpsertFriendVisibilityPrefs();

  const defaultDraft = useMemo<FriendVisibilityPrefsDraft>(
    () => ({
      show_protein: true,
      show_fibre: true,
      show_water: true,
      show_steps: true,
      show_food_streak: true,
    }),
    []
  );

  const [draft, setDraft] = useState<FriendVisibilityPrefsDraft>(defaultDraft);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);

  // Save-only flow:
  // - On open, initialize draft from server prefs (or defaults)
  // - On cancel/close, discard local changes
  useEffect(() => {
    if (!open) return;
    if (prefsQuery.data) {
      setDraft(prefsQuery.data);
      return;
    }
    setDraft(defaultDraft);
  }, [open, prefsQuery.data, defaultDraft]);

  const toggle = (key: keyof FriendVisibilityPrefsDraft) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    if (upsertMut.isPending) return;
    upsertMut.mutate(draft, {
      onSuccess: () => onClose(),
      onError: () => {
        showAppToast(t('friends.settings_save_error', { defaultValue: 'Could not save settings. Try again.' }));
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
              {t('friends.settings_title', { defaultValue: 'Friends Settings' })}
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
            <View style={styles.settingsSection}>
              <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
                {t('friends.settings_section_title', { defaultValue: 'Sharing preferences' })}
              </ThemedText>
              <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
                {t('friends.settings_helper', {
                  defaultValue: 'Choose what your friends can see. You can change this anytime.',
                })}
              </ThemedText>

              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomColor: colors.separator }]}
                onPress={() => toggle('show_protein')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('friends.settings_protein', { defaultValue: 'Protein' }),
                  AccessibilityHints.TOGGLE
                )}
              >
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                  {t('friends.settings_protein', { defaultValue: 'Protein' })}
                </ThemedText>
                <Switch
                  value={draft.show_protein}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, show_protein: value }))}
                  trackColor={{ false: colors.border, true: colors.tint + '60' }}
                  thumbColor={draft.show_protein ? colors.tint : colors.textTertiary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomColor: colors.separator }]}
                onPress={() => toggle('show_fibre')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('friends.settings_fibre', { defaultValue: 'Fibre' }),
                  AccessibilityHints.TOGGLE
                )}
              >
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                  {t('friends.settings_fibre', { defaultValue: 'Fibre' })}
                </ThemedText>
                <Switch
                  value={draft.show_fibre}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, show_fibre: value }))}
                  trackColor={{ false: colors.border, true: colors.tint + '60' }}
                  thumbColor={draft.show_fibre ? colors.tint : colors.textTertiary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomColor: colors.separator }]}
                onPress={() => toggle('show_water')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('friends.settings_water', { defaultValue: 'Water' }),
                  AccessibilityHints.TOGGLE
                )}
              >
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                  {t('friends.settings_water', { defaultValue: 'Water' })}
                </ThemedText>
                <Switch
                  value={draft.show_water}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, show_water: value }))}
                  trackColor={{ false: colors.border, true: colors.tint + '60' }}
                  thumbColor={draft.show_water ? colors.tint : colors.textTertiary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomColor: colors.separator }]}
                onPress={() => toggle('show_steps')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('friends.settings_steps', { defaultValue: 'Steps' }),
                  AccessibilityHints.TOGGLE
                )}
              >
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                  {t('friends.settings_steps', { defaultValue: 'Steps' })}
                </ThemedText>
                <Switch
                  value={draft.show_steps}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, show_steps: value }))}
                  trackColor={{ false: colors.border, true: colors.tint + '60' }}
                  thumbColor={draft.show_steps ? colors.tint : colors.textTertiary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomColor: colors.separator }]}
                onPress={() => toggle('show_food_streak')}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('friends.settings_food_streak', { defaultValue: 'Food logging streak' }),
                  AccessibilityHints.TOGGLE
                )}
              >
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                  {t('friends.settings_food_streak', { defaultValue: 'Food logging streak' })}
                </ThemedText>
                <Switch
                  value={draft.show_food_streak}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, show_food_streak: value }))}
                  trackColor={{ false: colors.border, true: colors.tint + '60' }}
                  thumbColor={draft.show_food_streak ? colors.tint : colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
                {t('friends.settings_safety_section', { defaultValue: 'Safety' })}
              </ThemedText>
              <TouchableOpacity
                style={[styles.navRow, { borderBottomColor: colors.separator }]}
                onPress={() => setBlockedUsersOpen(true)}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('friends.blocked_users_title', { defaultValue: 'Blocked users' }),
                  AccessibilityHints.BUTTON
                )}
              >
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                  {t('friends.blocked_users_title', { defaultValue: 'Blocked users' })}
                </ThemedText>
                <IconSymbol name="chevron.right" size={18} color={colors.textTertiary} decorative={true} />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <BlockedUsersModal open={blockedUsersOpen} onClose={() => setBlockedUsersOpen(false)} />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
              {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
              {...getButtonAccessibilityProps(t('common.cancel'), AccessibilityHints.CLOSE)}
            >
              <ThemedText style={{ color: colors.text }}>{t('common.cancel')}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.tint }]}
              onPress={handleSave}
              disabled={upsertMut.isPending}
              activeOpacity={0.7}
              {...(Platform.OS === 'web' ? getFocusStyle('#fff') : {})}
              {...getButtonAccessibilityProps(t('common.save'), AccessibilityHints.SUBMIT, upsertMut.isPending)}
            >
              <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                {upsertMut.isPending ? t('common.loading', { defaultValue: 'Loading' }) : t('common.save')}
              </ThemedText>
            </TouchableOpacity>
          </View>
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
    marginBottom: Spacing.lg,
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
    gap: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  settingsSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    marginBottom: Spacing.xs,
  },
  helperText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set inline
  },
  saveButtonText: {
    fontWeight: '600',
  },
});

