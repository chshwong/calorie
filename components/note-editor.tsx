/**
 * Note Editor - Bottom sheet/modal for entering meal notes
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

interface NoteEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (note: string | null) => void;
  initialNote: string | null;
  mealTypeLabel: string;
  isLoading?: boolean;
}

const MAX_NOTE_LENGTH = 200;

export function NoteEditor({
  visible,
  onClose,
  onSave,
  initialNote,
  mealTypeLabel,
  isLoading = false,
}: NoteEditorProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [note, setNote] = useState('');

  // Initialize form from initialNote
  useEffect(() => {
    if (visible) {
      setNote(initialNote || '');
    }
  }, [visible, initialNote]);

  const handleSave = () => {
    const trimmedNote = note.trim();
    onSave(trimmedNote.length > 0 ? trimmedNote : null);
  };

  const handleClear = () => {
    onSave(null);
  };

  const hasExistingNote = initialNote && initialNote.trim().length > 0;
  const characterCount = note.length;
  const isOverLimit = characterCount > MAX_NOTE_LENGTH;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.content, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'web' ? Spacing.lg : insets.bottom + Spacing.lg }]}>
          <View style={styles.header}>
            <ThemedText type="title" style={{ color: colors.text }}>
              {t('food.note.title', { defaultValue: 'Notes', mealType: mealTypeLabel })}
            </ThemedText>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
              {...getButtonAccessibilityProps(t('common.close'))}
            >
              <IconSymbol name="xmark" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.formContent}>
              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  {t('food.note.label', { defaultValue: 'Meal notes' })}
                </ThemedText>
                <TextInput
                  style={[
                    styles.textArea,
                    { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
                    isOverLimit && { borderColor: colors.error },
                  ]}
                  value={note}
                  onChangeText={(text) => {
                    if (text.length <= MAX_NOTE_LENGTH) {
                      setNote(text);
                    }
                  }}
                  placeholder={t('food.note.placeholder', { defaultValue: 'Add notes about this meal...' })}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={MAX_NOTE_LENGTH}
                />
                <ThemedText
                  style={[
                    styles.characterCount,
                    { color: isOverLimit ? colors.error : colors.textSecondary },
                  ]}
                >
                  {characterCount}/{MAX_NOTE_LENGTH}
                </ThemedText>
              </View>

              <View style={styles.buttons}>
                {hasExistingNote && (
                  <TouchableOpacity
                    style={[styles.button, styles.clearButton, { borderColor: colors.error }]}
                    onPress={handleClear}
                    disabled={isLoading}
                    {...getButtonAccessibilityProps(t('food.note.clear', { defaultValue: 'Clear Note' }))}
                  >
                    <ThemedText style={{ color: colors.error }}>
                      {t('food.note.clear', { defaultValue: 'Clear Note' })}
                    </ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={onClose}
                  disabled={isLoading}
                  {...getButtonAccessibilityProps(t('common.cancel'))}
                >
                  <ThemedText style={{ color: colors.text }}>{t('common.cancel')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, { backgroundColor: colors.tint }]}
                  onPress={handleSave}
                  disabled={isLoading}
                  {...getButtonAccessibilityProps(t('common.save'))}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                      {t('common.save')}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
    paddingTop: Spacing.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...getMinTouchTargetStyle(),
  },
  scrollView: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    minHeight: 100,
    maxHeight: 200,
  },
  characterCount: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    flexWrap: 'wrap',
  },
  button: {
    flex: 1,
    minWidth: 100,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // Already has backgroundColor from props
  },
  clearButton: {
    borderWidth: 1,
    width: '100%',
    flex: 1,
    minWidth: '100%',
  },
  saveButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
