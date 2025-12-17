import React from 'react';
import { View, Modal, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import { Spacing } from '@/constants/theme';
import type { Colors } from '@/constants/theme';

type FoodLogMenuModalProps = {
  visible: boolean;
  onClose: () => void;
  onQuickLog: () => void;
  onNotes: () => void;
  onMassDelete: () => void;
  hasEntries: boolean;
  mealTypeLabel: string;
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string) => string;
  styles: any;
};

export function FoodLogMenuModal({
  visible,
  onClose,
  onQuickLog,
  onNotes,
  onMassDelete,
  hasEntries,
  mealTypeLabel,
  colors,
  t,
  styles,
}: FoodLogMenuModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.threeDotMenuOverlay, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.threeDotMenuContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Close button header */}
            <View style={styles.threeDotMenuHeader}>
              <TouchableOpacity
                style={[styles.threeDotMenuCloseButton, getMinTouchTargetStyle()]}
                onPress={onClose}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('common.close', { defaultValue: 'Close' }),
                  t('common.close_hint', { defaultValue: 'Double tap to close menu' })
                )}
              >
                <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.threeDotMenuItem}
              onPress={onQuickLog}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                `⚡Quick Log for ${mealTypeLabel}`,
                `Add quick log for ${mealTypeLabel}`
              )}
            >
              <ThemedText style={[styles.threeDotMenuItemText, { color: colors.text }]}>
                ⚡Quick Log
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.threeDotMenuItem}
              onPress={onNotes}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                `Notes for ${mealTypeLabel}`,
                `Add or edit notes for ${mealTypeLabel}`
              )}
            >
              <ThemedText style={[styles.threeDotMenuItemText, { color: colors.text }]}>
                📝 {t('food.menu.notes', { defaultValue: 'Notes' })}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.threeDotMenuItem}
              onPress={onMassDelete}
              activeOpacity={hasEntries ? 0.7 : 1}
              disabled={!hasEntries}
              {...getButtonAccessibilityProps(
                t('mealtype_log.food_log.mass_delete', { defaultValue: 'Mass Delete' }),
                hasEntries
                  ? t('mealtype_log.food_log.mass_delete_hint', { defaultValue: 'Double tap to enter mass delete mode' })
                  : t('mealtype_log.food_log.mass_delete_disabled_hint', { defaultValue: 'Mass delete is not available when there are no entries' })
              )}
            >
              <ThemedText style={[
                styles.threeDotMenuItemText, 
                { 
                  color: hasEntries ? colors.text : colors.textSecondary,
                  opacity: hasEntries ? 1 : 0.5,
                }
              ]}>
                🗑️ {t('mealtype_log.food_log.mass_delete', { defaultValue: 'Mass Delete' })}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

