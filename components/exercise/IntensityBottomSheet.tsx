import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getMinTouchTargetStyle } from '@/utils/accessibility';

type IntensityBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (intensity: 'low' | 'medium' | 'high' | 'max') => void;
  currentIntensity: 'low' | 'medium' | 'high' | 'max' | null;
};

const INTENSITY_OPTIONS: Array<{ value: 'low' | 'medium' | 'high' | 'max'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

export function IntensityBottomSheet({
  visible,
  onClose,
  onSave,
  currentIntensity,
}: IntensityBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

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
  }, [visible]);

  const handleSelect = (intensity: 'low' | 'medium' | 'high' | 'max') => {
    onSave(intensity);
    onClose();
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
                Intensity
              </ThemedText>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps('Close')}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Intensity options */}
            <View style={styles.optionsContainer}>
              {INTENSITY_OPTIONS.map((option) => {
                const isSelected = currentIntensity === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: isSelected ? colors.tintLight : colors.backgroundSecondary,
                        borderColor: isSelected ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(`Select ${option.label} intensity`)}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? colors.tint : colors.text,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                    {isSelected && (
                      <IconSymbol name="checkmark" size={20} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                );
              })}
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
    maxHeight: '60%',
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
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...getMinTouchTargetStyle(),
  },
  optionText: {
    fontSize: FontSize.base,
  },
});

