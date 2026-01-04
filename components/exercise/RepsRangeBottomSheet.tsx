import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, TextInput, Platform, Animated, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { QuickAddChip } from '@/components/common/quick-add-chip';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { RANGES } from '@/constants/constraints';

type RepsRangeBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (repsMin: number | null, repsMax: number | null) => void;
  initialRepsMin: number | null;
  initialRepsMax: number | null;
};

const REPS_PRESETS = [
  { min: 6, max: 10 },
  { min: 8, max: 12 },
  { min: 10, max: 15 },
  { min: 15, max: 20 },
];

export function RepsRangeBottomSheet({
  visible,
  onClose,
  onSave,
  initialRepsMin,
  initialRepsMax,
}: RepsRangeBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [repsMin, setRepsMin] = useState<string>('');
  const [repsMax, setRepsMax] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  useEffect(() => {
    if (visible) {
      setRepsMin(initialRepsMin?.toString() || '');
      setRepsMax(initialRepsMax?.toString() || '');
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
  }, [visible, initialRepsMin, initialRepsMax]);

  const handleSave = () => {
    const min = repsMin.trim() ? parseInt(repsMin.trim(), 10) : null;
    const max = repsMax.trim() ? parseInt(repsMax.trim(), 10) : null;

    // Validation
    if (min !== null && (isNaN(min) || min < RANGES.EXERCISE_REPS_MIN.MIN || min > RANGES.EXERCISE_REPS_MIN.MAX)) {
      return;
    }
    if (max !== null && (isNaN(max) || max < RANGES.EXERCISE_REPS_MAX.MIN || max > RANGES.EXERCISE_REPS_MAX.MAX)) {
      return;
    }
    if (min !== null && max !== null && min > max) {
      return;
    }

    onSave(min, max);
    onClose();
  };

  const handleClear = () => {
    setRepsMin('');
    setRepsMax('');
    onSave(null, null);
    onClose();
  };

  const handlePreset = (min: number, max: number) => {
    setRepsMin(min.toString());
    setRepsMax(max.toString());
  };

  const adjustValue = (type: 'min' | 'max', delta: number) => {
    const currentValue = type === 'min' ? repsMin : repsMax;
    const numValue = currentValue.trim() ? parseInt(currentValue.trim(), 10) : (type === 'min' ? 1 : 30);
    if (isNaN(numValue)) return;

    const newValue = Math.max(
      RANGES.EXERCISE_REPS_MIN.MIN,
      Math.min(
        RANGES.EXERCISE_REPS_MAX.MAX,
        numValue + delta
      )
    );

    if (type === 'min') {
      setRepsMin(newValue.toString());
      // Ensure min doesn't exceed max
      if (repsMax.trim()) {
        const maxValue = parseInt(repsMax.trim(), 10);
        if (!isNaN(maxValue) && newValue > maxValue) {
          setRepsMax(newValue.toString());
        }
      }
    } else {
      setRepsMax(newValue.toString());
      // Ensure max isn't less than min
      if (repsMin.trim()) {
        const minValue = parseInt(repsMin.trim(), 10);
        if (!isNaN(minValue) && newValue < minValue) {
          setRepsMin(newValue.toString());
        }
      }
    }
  };

  const handleMinChange = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    if (numericOnly === '') {
      setRepsMin('');
      return;
    }
    const numValue = parseInt(numericOnly, 10);
    if (!isNaN(numValue) && numValue >= RANGES.EXERCISE_REPS_MIN.MIN && numValue <= RANGES.EXERCISE_REPS_MIN.MAX) {
      setRepsMin(numericOnly);
      // Auto-adjust max if needed
      if (repsMax.trim()) {
        const maxValue = parseInt(repsMax.trim(), 10);
        if (!isNaN(maxValue) && maxValue < numValue) {
          setRepsMax(numericOnly);
        }
      }
    }
  };

  const handleMaxChange = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    if (numericOnly === '') {
      setRepsMax('');
      return;
    }
    const numValue = parseInt(numericOnly, 10);
    if (!isNaN(numValue) && numValue >= RANGES.EXERCISE_REPS_MAX.MIN && numValue <= RANGES.EXERCISE_REPS_MAX.MAX) {
      setRepsMax(numericOnly);
      // Auto-adjust min if needed
      if (repsMin.trim()) {
        const minValue = parseInt(repsMin.trim(), 10);
        if (!isNaN(minValue) && minValue > numValue) {
          setRepsMin(numericOnly);
        }
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
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
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={styles.handleBar}>
              <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
                Reps Range
              </ThemedText>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps('Close')}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Presets */}
            <View style={styles.presetsContainer}>
              <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                Quick presets
              </ThemedText>
              <View style={styles.presetsRow}>
                {REPS_PRESETS.map((preset, index) => (
                  <QuickAddChip
                    key={index}
                    label={`${preset.min}–${preset.max}`}
                    colors={colors}
                    textStyle={{ fontSize: FontSize.sm }}
                    onPress={() => handlePreset(preset.min, preset.max)}
                  />
                ))}
              </View>
            </View>

            {/* Min/Max inputs */}
            <View style={styles.inputsContainer}>
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.inputLabel, { color: colors.text }]}>
                  Min Reps
                </ThemedText>
                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => adjustValue('min', -1)}
                    {...getButtonAccessibilityProps('Decrease min reps')}
                  >
                    <IconSymbol name="minus" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={repsMin}
                    onChangeText={handleMinChange}
                    placeholder="Min"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => adjustValue('min', 1)}
                    {...getButtonAccessibilityProps('Increase min reps')}
                  >
                    <IconSymbol name="plus" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={[styles.inputLabel, { color: colors.text }]}>
                  Max Reps
                </ThemedText>
                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => adjustValue('max', -1)}
                    {...getButtonAccessibilityProps('Decrease max reps')}
                  >
                    <IconSymbol name="minus" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={repsMax}
                    onChangeText={handleMaxChange}
                    placeholder="Max"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => adjustValue('max', 1)}
                    {...getButtonAccessibilityProps('Increase max reps')}
                  >
                    <IconSymbol name="plus" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.clearButton, { borderColor: colors.border }]}
                onPress={handleClear}
                {...getButtonAccessibilityProps('Clear reps')}
              >
                <ThemedText style={{ color: colors.text }}>Clear</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: colors.tint }]}
                onPress={handleSave}
                {...getButtonAccessibilityProps('Save reps')}
              >
                <ThemedText style={{ color: colors.textInverse }}>Save</ThemedText>
              </TouchableOpacity>
            </View>
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
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '80%',
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
  presetsContainer: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  inputsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  input: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.base,
    textAlign: 'center',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  clearButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  saveButton: {
    // backgroundColor set inline
  },
});

