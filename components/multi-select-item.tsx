import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
import { Platform } from 'react-native';

interface MultiSelectItemProps {
  /**
   * Whether this item is selected
   */
  isSelected: boolean;
  
  /**
   * Callback when the checkbox is toggled
   */
  onToggle: () => void;
  
  /**
   * The content to render inside the multi-select item
   */
  children: React.ReactNode;
  
  /**
   * Optional additional styles for the container
   */
  style?: ViewStyle;
  
  /**
   * Optional: Size of the checkbox (default: 24)
   */
  checkboxSize?: number;
}

/**
 * A wrapper component that adds a checkbox to list items for multi-select functionality
 * 
 * @example
 * ```tsx
 * const { isSelected, toggleSelection } = useMultiSelect();
 * 
 * {items.map(item => (
 *   <MultiSelectItem
 *     key={item.id}
 *     isSelected={isSelected(item.id)}
 *     onToggle={() => toggleSelection(item.id)}
 *   >
 *     <View>Your item content</View>
 *   </MultiSelectItem>
 * ))}
 * ```
 */
export function MultiSelectItem({
  isSelected,
  onToggle,
  children,
  style,
  checkboxSize = 24,
}: MultiSelectItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={[
          styles.checkbox,
          {
            width: checkboxSize,
            height: checkboxSize,
            borderColor: isSelected ? colors.tint : colors.icon + '60',
            backgroundColor: isSelected ? colors.tint : 'transparent',
          },
          getMinTouchTargetStyle(),
          ...(Platform.OS === 'web' ? [getFocusStyle(colors.tint)] : []),
        ]}
        {...getButtonAccessibilityProps(
          isSelected ? 'Deselect item' : 'Select item',
          isSelected ? 'Double tap to deselect this item' : 'Double tap to select this item'
        )}
      >
        {isSelected && (
          <IconSymbol
            name="checkmark"
            size={checkboxSize * 0.6}
            color="#fff"
          />
        )}
      </TouchableOpacity>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  checkbox: {
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});

