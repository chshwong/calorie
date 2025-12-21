import React, { useState } from 'react';
import { View, Modal, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { Button } from '@/components/ui/button';
import { ActivityStep } from './ActivityStep';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';

type Props = {
  initialActivityLevel: ActivityLevel | '';
  onCancel: () => void;
  onSave: (level: ActivityLevel) => void;
  colors: typeof Colors.light;
};

const ActivityLevelModal: React.FC<Props> = ({ initialActivityLevel, onCancel, onSave, colors }) => {
  const { t } = useTranslation();
  const [tempActivity, setTempActivity] = useState<ActivityLevel>(
    initialActivityLevel || 'sedentary'
  );

  const handleSave = () => {
    onSave(tempActivity);
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <ActivityStep
            mode="modal"
            value={tempActivity}
            onChange={setTempActivity}
            colors={colors}
            loading={false}
            onErrorClear={() => {}}
          />
          <View style={styles.modalButtonsRow}>
            <Button variant="ghost" onPress={onCancel} style={styles.modalButton}>
              {t('common.cancel')}
            </Button>
            <Button onPress={handleSave} style={styles.modalButton}>
              {t('common.save')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ActivityLevelModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: Shadows.lg,
    }),
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  modalButton: {
    flex: 1,
  },
});

