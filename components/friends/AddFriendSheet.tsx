import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { showAppToast } from '@/components/ui/app-toast';
import { useSendFriendRequest } from '@/hooks/use-friends';
import { validateAvoId, validateEmailFormat } from '@/utils/validation';
import { Colors, Spacing, BorderRadius, FontSize, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

type AddFriendSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const TAB_KEYS = ['avoid', 'email'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export function AddFriendSheet({ visible, onClose, onSuccess }: AddFriendSheetProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopOrTablet = windowWidth >= 768;
  const [activeTab, setActiveTab] = useState<TabKey>('avoid');
  const [avoidInput, setAvoidInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const sendMut = useSendFriendRequest();

  const avoidValid = validateAvoId(avoidInput).valid;
  const emailValid = validateEmailFormat(emailInput).valid;
  const canSendAvoid = avoidValid;
  const canSendEmail = emailValid;
  const isBusy = sendMut.isPending;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleSendAvoid = async () => {
    if (!canSendAvoid || isBusy) return;
    try {
      await sendMut.mutateAsync({
        targetType: 'avoid',
        targetValue: avoidInput.trim().toLowerCase(),
        noteKey: null,
      });
      showAppToast(t('friends.request_sent_toast'));
      setAvoidInput('');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'FRIENDS_CANNOT_REQUEST_SELF') showAppToast(t('friends.cannot_request_self'));
      else if (msg === 'FRIENDS_BLOCKED') showAppToast(t('friends.error_blocked'));
      else if (msg === 'FRIENDS_ALREADY_FRIENDS') showAppToast(t('friends.error_already_friends'));
      else if (msg === 'FRIENDS_REQUEST_ALREADY_SENT') showAppToast(t('friends.error_request_already_sent'));
      else if (msg === 'FRIENDS_THEY_SENT_YOU_REQUEST') showAppToast(t('friends.error_they_sent_you_request'));
      else if (msg === 'FRIENDS_TARGET_REQUIRED') showAppToast(t('friends.error_blocked'));
      else showAppToast(t('common.unexpected_error'));
    }
  };

  const handleSendEmail = async () => {
    if (!canSendEmail || isBusy) return;
    try {
      await sendMut.mutateAsync({
        targetType: 'email',
        targetValue: emailInput.trim().toLowerCase(),
        noteKey: null,
      });
      showAppToast(t('friends.request_sent_toast'));
      setEmailInput('');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'FRIENDS_CANNOT_REQUEST_SELF') showAppToast(t('friends.cannot_request_self'));
      else if (msg === 'FRIENDS_BLOCKED') showAppToast(t('friends.error_blocked'));
      else if (msg === 'FRIENDS_ALREADY_FRIENDS') showAppToast(t('friends.error_already_friends'));
      else if (msg === 'FRIENDS_REQUEST_ALREADY_SENT') showAppToast(t('friends.error_request_already_sent'));
      else if (msg === 'FRIENDS_THEY_SENT_YOU_REQUEST') showAppToast(t('friends.error_they_sent_you_request'));
      else if (msg === 'FRIENDS_TARGET_REQUIRED') showAppToast(t('friends.error_blocked'));
      else showAppToast(t('common.unexpected_error'));
    }
  };

  const tabItems = [
    { key: 'avoid', label: t('friends.add_modal_avoid') },
    { key: 'email', label: t('friends.add_modal_email') },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.bottomSheet,
            isDesktopOrTablet && styles.bottomSheetDesktop,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handleBar}>
              <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
            </View>

            <View style={styles.header}>
              <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
                {t('friends.add_modal_title')}
              </ThemedText>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps(t('common.close'), 'Double tap to close')}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} decorative={true} />
              </TouchableOpacity>
            </View>

            <View style={styles.tabsWrapper}>
              <SegmentedTabs
                items={tabItems}
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as TabKey)}
              />
            </View>

            {activeTab === 'avoid' && (
              <View style={styles.tabContent}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="blue-happy-avocado-42"
                  placeholderTextColor={colors.textSecondary}
                  value={avoidInput}
                  onChangeText={(val) => setAvoidInput(val.toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isBusy}
                />
                <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
                  {t('friends.avoid_helper')}
                </ThemedText>
                <Button
                  variant="primary"
                  size="md"
                  disabled={!canSendAvoid || isBusy}
                  loading={isBusy}
                  fullWidth
                  onPress={handleSendAvoid}
                >
                  {t('friends.send_request')}
                </Button>
              </View>
            )}

            {activeTab === 'email' && (
              <View style={styles.tabContent}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder={t('friends.add_modal_email')}
                  placeholderTextColor={colors.textSecondary}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isBusy}
                />
                <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
                  {t('friends.email_helper')}
                </ThemedText>
                <Button
                  variant="primary"
                  size="md"
                  disabled={!canSendEmail || isBusy}
                  loading={isBusy}
                  fullWidth
                  onPress={handleSendEmail}
                >
                  {t('friends.send_request')}
                </Button>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    width: '100%',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '80%',
  },
  bottomSheetDesktop: {
    maxWidth: Layout.desktopMaxWidth,
    alignSelf: 'center',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  closeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...getMinTouchTargetStyle(),
  },
  tabsWrapper: {
    marginBottom: Spacing.lg,
  },
  tabContent: {
    gap: Spacing.sm,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    fontSize: FontSize.base,
  },
  helperText: {
    fontSize: FontSize.sm,
  },
});
