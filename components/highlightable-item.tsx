import React from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface HighlightableItemProps {
  /**
   * Whether this item should be highlighted
   */
  isHighlighted: boolean;
  
  /**
   * The animation value for the highlight effect (from useNewItemHighlight hook)
   */
  animationValue: Animated.Value | null;
  
  /**
   * The content to render inside the highlightable item
   */
  children: React.ReactNode;
  
  /**
   * Optional custom highlight color (defaults to theme tint color)
   */
  highlightColor?: string;
  
  /**
   * Optional custom opacity for the highlight (0-1, defaults to 0.3)
   */
  highlightOpacity?: number;
  
  /**
   * Optional custom border radius for the highlight
   */
  borderRadius?: number;
  
  /**
   * Optional additional styles for the container
   */
  style?: ViewStyle;
}

/**
 * A wrapper component that adds a fade-out highlight animation to list items
 * 
 * @example
 * ```tsx
 * const { isNewlyAdded, getAnimationValue } = useNewItemHighlight(items, (item) => item.id);
 * 
 * {items.map(item => (
 *   <HighlightableItem
 *     key={item.id}
 *     isHighlighted={isNewlyAdded(item.id)}
 *     animationValue={getAnimationValue(item.id)}
 *   >
 *     <View>Your item content</View>
 *   </HighlightableItem>
 * ))}
 * ```
 */
export function HighlightableItem({
  isHighlighted,
  animationValue,
  children,
  highlightColor,
  highlightOpacity = 0.3,
  borderRadius = 8,
  style,
}: HighlightableItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const highlight = highlightColor || colors.tint;

  // Show overlay if we have an animation value (regardless of isHighlighted state)
  // This ensures the animation completes even if isHighlighted becomes false
  const shouldShowOverlay = animationValue !== null;

  return (
    <View
      style={[
        {
          position: 'relative',
        },
        style,
      ]}
    >
      {shouldShowOverlay && animationValue && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: highlight,
              opacity: animationValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, highlightOpacity],
              }),
              borderRadius,
            },
          ]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

