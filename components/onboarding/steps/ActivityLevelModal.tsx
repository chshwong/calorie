import React, { useState } from 'react';
import { View, Modal, StyleSheet, Platform, ScrollView } from 'react-native';
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
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <ActivityStep
              mode="modal"
              value={tempActivity}
              onChange={setTempActivity}
              colors={colors}
              loading={false}
              onErrorClear={() => {}}
            />
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
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
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: {
        ...Shadows.lg,
      },
    }),
    // Ensure flex layout works on all platforms
    flexDirection: 'column',
  },
  scroll: {
    flex: 1,
    ...Platform.select({
      web: {
        minHeight: 0,
      },
      default: {},
    }),
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 96, // Space for footer
  },
  footer: {
    ...Platform.select({
      web: {
        position: 'sticky' as const,
        bottom: 0,
      },
      default: {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
      },
    }),
    padding: Spacing.xl,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    ...Platform.select({
      web: {
        backgroundColor: 'inherit',
      },
      default: {},
    }),
  },
  modalButton: {
    flex: 1,
  },
});

