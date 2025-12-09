/**
 * Quick Log Editor - Bottom sheet/modal for entering quick log data
 */

import { useState, useEffect, useRef } from 'react';
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

export interface QuickLogData {
  quickKcal: number | null;
  quickProteinG: number | null;
  quickCarbsG: number | null;
  quickFatG: number | null;
  quickFiberG: number | null;
  quickSaturatedFatG: number | null;
  quickTransFatG: number | null;
  quickSugarG: number | null;
  quickSodiumMg: number | null;
  quickLogFood: string | null;
}

interface QuickLogEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: QuickLogData) => void;
  onDelete?: () => void;
  initialData?: QuickLogData | null;
  mealTypeLabel: string;
  isLoading?: boolean;
}

export function QuickLogEditor({
  visible,
  onClose,
  onSave,
  onDelete,
  initialData,
  mealTypeLabel,
  isLoading = false,
}: QuickLogEditorProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [quickKcal, setQuickKcal] = useState('');
  const [quickLogFood, setQuickLogFood] = useState('');
  const [quickProteinG, setQuickProteinG] = useState('');
  const [quickCarbsG, setQuickCarbsG] = useState('');
  const [quickFatG, setQuickFatG] = useState('');
  const [quickFiberG, setQuickFiberG] = useState('');
  const [quickSaturatedFatG, setQuickSaturatedFatG] = useState('');
  const [quickTransFatG, setQuickTransFatG] = useState('');
  const [quickSugarG, setQuickSugarG] = useState('');
  const [quickSodiumMg, setQuickSodiumMg] = useState('');

  // Ref for calories input to manually focus
  const caloriesInputRef = useRef<TextInput>(null);

  // Initialize form from initialData
  useEffect(() => {
    if (visible && initialData) {
      setQuickKcal(initialData.quickKcal?.toString() || '');
      setQuickLogFood(initialData.quickLogFood || '');
      setQuickProteinG(initialData.quickProteinG?.toString() || '');
      setQuickCarbsG(initialData.quickCarbsG?.toString() || '');
      setQuickFatG(initialData.quickFatG?.toString() || '');
      setQuickFiberG(initialData.quickFiberG?.toString() || '');
      setQuickSaturatedFatG(initialData.quickSaturatedFatG?.toString() || '');
      setQuickTransFatG(initialData.quickTransFatG?.toString() || '');
      setQuickSugarG(initialData.quickSugarG?.toString() || '');
      setQuickSodiumMg(initialData.quickSodiumMg?.toString() || '');
    } else if (visible && !initialData) {
      // Reset form when opening for new entry
      setQuickKcal('');
      setQuickLogFood('');
      setQuickProteinG('');
      setQuickCarbsG('');
      setQuickFatG('');
      setQuickFiberG('');
      setQuickSaturatedFatG('');
      setQuickTransFatG('');
      setQuickSugarG('');
      setQuickSodiumMg('');
    }
  }, [visible, initialData]);

  // Focus calories input when modal becomes visible
  useEffect(() => {
    if (visible) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        caloriesInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Filter numeric input - only digits and at most one decimal point
  const filterNumericInput = (value: string, allowDecimal: boolean = true): string => {
    let sanitized = value.replace(/[^0-9.]/g, '');
    if (!allowDecimal) {
      sanitized = sanitized.replace(/\./g, '');
    } else {
      const parts = sanitized.split('.');
      if (parts.length > 2) {
        sanitized = parts[0] + '.' + parts.slice(1).join('');
      }
    }
    return sanitized;
  };

  // Handle calories change with max validation
  const handleCaloriesChange = (text: string) => {
    let next = filterNumericInput(text, true);
    if (next !== '' && Number(next) > 10000) {
      next = '10000';
    }
    setQuickKcal(next);
  };

  // Handle other numeric fields
  const handleProteinChange = (text: string) => {
    setQuickProteinG(filterNumericInput(text, true));
  };

  const handleCarbsChange = (text: string) => {
    setQuickCarbsG(filterNumericInput(text, true));
  };

  const handleFatChange = (text: string) => {
    setQuickFatG(filterNumericInput(text, true));
  };

  const handleFiberChange = (text: string) => {
    setQuickFiberG(filterNumericInput(text, true));
  };

  const handleSaturatedFatChange = (text: string) => {
    setQuickSaturatedFatG(filterNumericInput(text, true));
  };

  const handleTransFatChange = (text: string) => {
    setQuickTransFatG(filterNumericInput(text, true));
  };

  const handleSugarChange = (text: string) => {
    setQuickSugarG(filterNumericInput(text, true));
  };

  const handleSodiumChange = (text: string) => {
    setQuickSodiumMg(filterNumericInput(text, true));
  };

  const handleSave = () => {
    const caloriesNumber = quickKcal === '' ? null : Number(quickKcal);
    const proteinNumber = quickProteinG === '' ? null : Number(quickProteinG);
    const carbsNumber = quickCarbsG === '' ? null : Number(quickCarbsG);
    const fatNumber = quickFatG === '' ? null : Number(quickFatG);
    const fiberNumber = quickFiberG === '' ? null : Number(quickFiberG);
    const saturatedFatNumber = quickSaturatedFatG === '' ? null : Number(quickSaturatedFatG);
    const transFatNumber = quickTransFatG === '' ? null : Number(quickTransFatG);
    const sugarNumber = quickSugarG === '' ? null : Number(quickSugarG);
    const sodiumNumber = quickSodiumMg === '' ? null : Number(quickSodiumMg);

    const data: QuickLogData = {
      quickKcal: caloriesNumber !== null && !isNaN(caloriesNumber) ? caloriesNumber : null,
      quickProteinG: proteinNumber !== null && !isNaN(proteinNumber) ? proteinNumber : null,
      quickCarbsG: carbsNumber !== null && !isNaN(carbsNumber) ? carbsNumber : null,
      quickFatG: fatNumber !== null && !isNaN(fatNumber) ? fatNumber : null,
      quickFiberG: fiberNumber !== null && !isNaN(fiberNumber) ? fiberNumber : null,
      quickSaturatedFatG: saturatedFatNumber !== null && !isNaN(saturatedFatNumber) ? saturatedFatNumber : null,
      quickTransFatG: transFatNumber !== null && !isNaN(transFatNumber) ? transFatNumber : null,
      quickSugarG: sugarNumber !== null && !isNaN(sugarNumber) ? sugarNumber : null,
      quickSodiumMg: sodiumNumber !== null && !isNaN(sodiumNumber) ? sodiumNumber : null,
      quickLogFood: quickLogFood.trim() || null,
    };

    // Validate: at least calories must be provided and valid
    if (!data.quickKcal || data.quickKcal <= 0 || isNaN(data.quickKcal)) {
      return; // Don't save if no calories
    }

    onSave(data);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

  const hasExistingData = initialData?.quickKcal !== null && initialData?.quickKcal !== undefined;

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
              ⚡ {t('food.quick_log.title', { defaultValue: 'Quick Log', mealType: mealTypeLabel })}
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
              <View style={[styles.fieldRow, { marginTop: 5 }]}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.calories_label', { defaultValue: 'Calories' })} *
                </ThemedText>
                <TextInput
                  ref={caloriesInputRef}
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickKcal}
                  onChangeText={handleCaloriesChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.calories_placeholder', { defaultValue: 'Enter calories' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.food_label', { defaultValue: 'Food' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickLogFood}
                  onChangeText={setQuickLogFood}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.food_placeholder', { defaultValue: 'Optional (i.e. Buffet)' })}
                  placeholderTextColor={colors.textSecondary}
                  maxLength={20}
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.protein_label', { defaultValue: 'Protein (g)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickProteinG}
                  onChangeText={handleProteinChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.protein_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.carbs_label', { defaultValue: 'Carbs (g)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickCarbsG}
                  onChangeText={handleCarbsChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.carbs_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.fat_label', { defaultValue: 'Fat (g)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickFatG}
                  onChangeText={handleFatChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.fat_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.fiber_label', { defaultValue: 'Fiber (g)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickFiberG}
                  onChangeText={handleFiberChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.fiber_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.saturated_fat_label', { defaultValue: 'Saturated Fat (g)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickSaturatedFatG}
                  onChangeText={handleSaturatedFatChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.saturated_fat_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.trans_fat_label', { defaultValue: 'Trans Fat (g)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickTransFatG}
                  onChangeText={handleTransFatChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.trans_fat_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.sugar_label', { defaultValue: 'Sugar (g)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickSugarG}
                  onChangeText={handleSugarChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.sugar_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('food.quick_log.sodium_label', { defaultValue: 'Sodium (mg)' })}
                </ThemedText>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={quickSodiumMg}
                  onChangeText={handleSodiumChange}
                  onSubmitEditing={handleSave}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  placeholder={t('food.quick_log.sodium_placeholder', { defaultValue: 'Optional' })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.buttons}>
                {hasExistingData && onDelete && (
                  <TouchableOpacity
                    style={[styles.button, styles.deleteButton, { borderColor: colors.error }]}
                    onPress={handleDelete}
                    disabled={isLoading}
                    {...getButtonAccessibilityProps(t('food.quick_log.delete', { defaultValue: 'Delete Quick Log' }))}
                  >
                    <ThemedText style={{ color: colors.error }}>
                      {t('food.quick_log.delete', { defaultValue: 'Delete Quick Log' })}
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
                  disabled={isLoading || !quickKcal || parseFloat(quickKcal) <= 0}
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    flex: 0.35,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldInput: {
    flex: 0.65,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    minHeight: 44,
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
  deleteButton: {
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
