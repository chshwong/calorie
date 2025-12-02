import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface HighlightableRowProps {
  /**
   * Whether this row is newly added and should be highlighted
   */
  isNew: boolean;
  
  /**
   * The content to render inside the highlightable row
   */
  children: React.ReactNode;
  
  /**
   * Optional custom highlight color (defaults to a subtle teal/grey that fits the theme)
   */
  highlightColor?: string;
  
  /**
   * Optional additional styles for the container
   */
  style?: ViewStyle;
}

/**
 * A reusable component that adds a highlight animation to newly added list rows.
 * 
 * Behavior:
 * - If isNew is false, renders children with normal background (no animation)
 * - If isNew is true on mount, runs this sequence:
 *   1. Starts with a highlight background color
 *   2. Keeps that highlight color for ~500ms
 *   3. Then animates the background back to normal over ~600-800ms
 * 
 * The animation is purely visual and does not affect layout or height.
 * 
 * @example
 * ```tsx
 * const [newEntryId, setNewEntryId] = useState<string | null>(null);
 * 
 * // After creating a new entry:
 * const newId = await createEntry();
 * setNewEntryId(newId);
 * 
 * // In render:
 * {entries.map(entry => (
 *   <HighlightableRow
 *     key={entry.id}
 *     isNew={entry.id === newEntryId}
 *   >
 *     <View>Your row content</View>
 *   </HighlightableRow>
 * ))}
 * ```
 */
export function HighlightableRow({
  isNew,
  children,
  highlightColor,
  style,
}: HighlightableRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Use a subtle highlight color that works in both light and dark mode
  // Light teal/grey that's visible but not too bright
  const defaultHighlightColor = colorScheme === 'dark' 
    ? '#4A9E9E' // Slightly brighter teal for dark mode
    : '#B8E6E6'; // Light teal for light mode
  
  const highlight = highlightColor || defaultHighlightColor;
  
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasAnimatedRef = useRef(false);
  const [shouldShowOverlay, setShouldShowOverlay] = React.useState(false);

  useEffect(() => {
    // Reset animation state when isNew changes from true to false
    if (!isNew) {
      hasAnimatedRef.current = false;
      setShouldShowOverlay(false);
      opacityAnim.setValue(0);
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      return;
    }

    // Only animate if isNew is true and we haven't animated this instance yet
    if (isNew && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      setShouldShowOverlay(true);
      
      // Start with full highlight opacity
      opacityAnim.setValue(1);
      
      // Hold at full highlight for 500ms
      const holdTimeout = setTimeout(() => {
        // Then fade back to normal over 600-800ms (using 700ms as middle ground)
        animationRef.current = Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: false, // backgroundColor opacity animation doesn't need native driver
        });
        
        animationRef.current.start(() => {
          // Animation complete - hide overlay and reset state
          setShouldShowOverlay(false);
          animationRef.current = null;
        });
      }, 500);

      return () => {
        clearTimeout(holdTimeout);
        if (animationRef.current) {
          animationRef.current.stop();
        }
      };
    }
  }, [isNew, opacityAnim]);

  return (
    <View
      style={[
        {
          position: 'relative',
        },
        style,
      ]}
    >
      {shouldShowOverlay && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: highlight,
              opacity: opacityAnim,
              borderRadius: 0, // No border radius by default - can be overridden via style prop
            },
          ]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

