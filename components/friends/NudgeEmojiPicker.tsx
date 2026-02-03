/**
 * NudgeEmojiPicker - Popover with 4 emoji options for sending a friend nudge
 */

import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from 'react-i18next';
import { showAppToast } from '@/components/ui/app-toast';
import { Popover } from '@/components/ui/Popover';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSendNudge } from '@/hooks/use-friends';
import { NUDGE_EMOJIS, type NudgeEmoji } from '@/lib/services/friends';
import {
  AccessibilityHints,
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

type NudgeEmojiPickerProps = {
  friendUserId: string;
  friendName: string;
};

export function NudgeEmojiPicker({ friendUserId, friendName }: NudgeEmojiPickerProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const anchorRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const sendNudge = useSendNudge();

  const handleEmojiPress = async (emoji: NudgeEmoji) => {
    try {
      await sendNudge.mutateAsync({ receiverUserId: friendUserId, emoji });
      showAppToast(t('friends.nudge_sent_toast', { defaultValue: 'Nudge sent' }));
      setIsOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'NUDGE_THROTTLED') {
        showAppToast(t('friends.nudge_throttled', { defaultValue: 'You can nudge again later.' }));
      } else {
        showAppToast(t('common.unexpected_error'));
      }
      setIsOpen(false);
    }
  };

  return (
    <>
      <Pressable
        ref={anchorRef}
        style={[
          styles.nudgeButton,
          getMinTouchTargetStyle(),
          Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
        ]}
        onPress={() => setIsOpen(true)}
        {...getButtonAccessibilityProps(
          t('friends.nudge_a11y', { name: friendName, defaultValue: `Nudge ${friendName}` }),
          AccessibilityHints.BUTTON
        )}
      >
        <IconSymbol name="hand.wave" size={18} color={colors.textSecondary} decorative={true} />
      </Pressable>

      <Popover isOpen={isOpen} onClose={() => setIsOpen(false)} anchorRef={anchorRef} placement="bottom-end">
        <View style={styles.emojiRow}>
          {NUDGE_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[styles.emojiButton, getMinTouchTargetStyle(), { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleEmojiPress(emoji)}
              activeOpacity={0.7}
              disabled={sendNudge.isPending}
              {...getButtonAccessibilityProps(emoji, AccessibilityHints.BUTTON)}
            >
              <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </Popover>
    </>
  );
}

const styles = StyleSheet.create({
  nudgeButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
});
