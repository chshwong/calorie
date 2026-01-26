import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export type AddToHomeScreenModalMode = 'ios' | 'fallback';

export interface AddToHomeScreenModalProps {
  visible: boolean;
  onClose: () => void;
  mode: AddToHomeScreenModalMode;
}

const modalMessageStyles = {
  fontSize: 16,
  lineHeight: 22,
  textAlign: 'center' as const,
};

export function AddToHomeScreenModal({ visible, onClose, mode }: AddToHomeScreenModalProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const title =
    mode === 'ios'
      ? t('settings.add_to_home_screen.title')
      : t('settings.add_to_home_screen.modal_fallback_title');
  const gotIt = t('settings.add_to_home_screen.modal_got_it');

  const message =
    mode === 'ios' ? (
      <View style={styles.iosSteps}>
        <ThemedText style={modalMessageStyles}>
          1) {t('settings.add_to_home_screen.modal_ios_step_1')}
        </ThemedText>
        <ThemedText style={modalMessageStyles}>
          2) {t('settings.add_to_home_screen.modal_ios_step_2')}
        </ThemedText>
        <ThemedText style={modalMessageStyles}>
          3) {t('settings.add_to_home_screen.modal_ios_step_3')}
        </ThemedText>
      </View>
    ) : (
      <View style={styles.fallbackBody}>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>
          {t('settings.add_to_home_screen.modal_fallback_primary')}
        </ThemedText>
        <ThemedText style={[modalMessageStyles, { color: colors.textSecondary }]}>
          {t('settings.add_to_home_screen.modal_fallback_secondary')}
        </ThemedText>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>
          {t('settings.add_to_home_screen.modal_fallback_ios')}
        </ThemedText>
        <ThemedText style={[modalMessageStyles, { color: colors.text }]}>
          {t('settings.add_to_home_screen.modal_fallback_android')}
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
  iosSteps: {
    gap: 10,
  },
  fallbackBody: {
    gap: 10,
  },
});
