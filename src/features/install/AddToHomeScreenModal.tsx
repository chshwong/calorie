import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export type AddToHomeScreenModalPlatform = 'ios' | 'android' | 'fallback';

export interface AddToHomeScreenModalProps {
  visible: boolean;
  onClose: () => void;
  platform: AddToHomeScreenModalPlatform;
}

const modalMessageStyles = {
  fontSize: 16,
  lineHeight: 22,
  textAlign: 'center' as const,
};

export function AddToHomeScreenModal({ visible, onClose, platform }: AddToHomeScreenModalProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const title = t('settings.add_to_home_screen.modal_title');
  const gotIt = t('settings.add_to_home_screen.modal_got_it');
  const body1 = t('settings.add_to_home_screen.modal_body_1');

  const message =
    platform === 'ios' ? (
      <View style={styles.body}>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>{body1}</ThemedText>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>
          {t('settings.add_to_home_screen.modal_instruction_ios')}
        </ThemedText>
      </View>
    ) : platform === 'android' ? (
      <View style={styles.body}>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>{body1}</ThemedText>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>
          {t('settings.add_to_home_screen.modal_instruction_android')}
        </ThemedText>
      </View>
    ) : (
      <View style={styles.body}>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>{body1}</ThemedText>
        <ThemedText style={[modalMessageStyles, { color: colors.textSecondary }]}>
          {t('settings.add_to_home_screen.modal_body_2_fallback')}
        </ThemedText>
      </View>
    );

  return (
    <ConfirmModal
      visible={visible}
      title={title}
      message={message}
      confirmText={gotIt}
      cancelText={null}
      onConfirm={onClose}
      onCancel={onClose}
      confirmButtonStyle={{ backgroundColor: colors.tint }}
      animationType="fade"
    />
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 10,
  },
});
