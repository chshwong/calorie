/**
 * Quick Add Chip - Reusable chip/button for quick-add actions
 * 
 * This component provides a consistent quick-add button experience across
 * the app (Meds, Exercise, etc.). It ensures proper tap behavior:
 * - Only triggers onPress when user taps (down + up inside button)
 * - Uses onPressIn/onPressOut only for visual feedback
 * - Prevents accidental adds from touch-and-hold
 * 
 * Per engineering guidelines:
 * - Uses theme tokens for all styling
 * - Theme-aware (dark/light mode)
 * - Accessibility compliant
 */

import { useRef } from 'react';
import { TouchableOpacity, Animated, Platform, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { getButtonAccessibilityProps, getMinTouchTargetStyle } from '@/utils/accessibility';

type QuickAddChipProps = {
  label: string;
  icon?: string;
  /** Optional metadata to display after label (e.g., "5 min", "10 mg") */
  metadata?: string | null;
  colors: typeof Colors.light;
  onPress: () => void;
  textStyle?: StyleProp<TextStyle>;
};

export function QuickAddChip({ label, icon, metadata, colors, onPress, textStyle }: QuickAddChipProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Visual feedback only - scale down on press in
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: Platform.OS !== 'web',
      damping: 15,
      stiffness: 300,
    }).start();
  };

  // Visual feedback only - scale back up on press out
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      damping: 15,
      stiffness: 300,
    }).start();
  };

  // The actual action is triggered by onPress (tap completed)
  const handlePress = () => {
    onPress();
  };

  const accessibilityLabel = metadata ? `${label} – ${metadata}` : label;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        {...getButtonAccessibilityProps(accessibilityLabel)}
      >
        {icon && (
          <IconSymbol 
            name={icon as any} 
            size={14} 
            color={colors.tint} 
            style={{ marginRight: Spacing.xs }} 
          />
        )}
        <ThemedText style={[styles.chipText, { color: colors.text }, textStyle]}>
          {label}
          {metadata && ` – ${metadata}`}
        </ThemedText>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    ...getMinTouchTargetStyle(),
  },
  chipText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
});

