import { useState, useRef, useEffect } from 'react';
import { Animated } from 'react-native';

interface UseNewItemHighlightOptions {
  /**
   * Duration of the fade-out animation in milliseconds
   * @default 2000
   */
  duration?: number;
  
  /**
   * Delay before starting the animation (to ensure component has rendered)
   * @default 100
   */
  animationDelay?: number;
  
  /**
   * Initial opacity for the highlight (0-1)
   * @default 0.3
   */
  initialOpacity?: number;
}

interface UseNewItemHighlightReturn<T> {
  /**
   * Mark an item as newly added (call this after creating the item)
   * @param itemId - The unique identifier of the newly added item
   */
  markAsNewlyAdded: (itemId: string) => void;
  
  /**
   * Check if an item should be highlighted
   * @param itemId - The unique identifier of the item to check
   * @returns true if the item should be highlighted
   */
  isNewlyAdded: (itemId: string) => boolean;
  
  /**
   * Get the animation value for an item (for use in Animated.View)
   * @param itemId - The unique identifier of the item
   * @returns The Animated.Value or null if not animating
   */
  getAnimationValue: (itemId: string) => Animated.Value | null;
  
  /**
   * Clear the newly added state (useful for cleanup or manual reset)
   */
  clearNewlyAdded: () => void;
}

/**
 * Custom hook for highlighting newly added items in a list with a fade-out animation
 * 
 * @param items - Array of items in the list (used to detect when new item appears)
 * @param getItemId - Function to extract the unique ID from an item
 * @param options - Configuration options for the animation
 * 
 * @example
 * ```tsx
 * const { markAsNewlyAdded, isNewlyAdded, getAnimationValue } = useNewItemHighlight(
 *   entries,
 *   (entry) => entry.id
 * );
 * 
 * // After saving a new entry:
 * const newEntryId = await saveEntry();
 * markAsNewlyAdded(newEntryId);
 * 
 * // In render:
 * {entries.map(entry => (
 *   <HighlightableItem
 *     key={entry.id}
 *     isHighlighted={isNewlyAdded(entry.id)}
 *     animationValue={getAnimationValue(entry.id)}
 *   >
 *     <View>entry content</View>
 *   </HighlightableItem>
 * ))}
 * ```
 */
export function useNewItemHighlight<T>(
  items: T[],
  getItemId: (item: T) => string,
  options: UseNewItemHighlightOptions = {}
): UseNewItemHighlightReturn<T> {
  const {
    duration = 2000,
    animationDelay = 100,
    initialOpacity = 0.3,
  } = options;

  const [newlyAddedItemIds, setNewlyAddedItemIds] = useState<Set<string>>(new Set());
  const pendingNewItemIds = useRef<Set<string>>(new Set());
  const highlightAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const animatingItems = useRef<Set<string>>(new Set());

  // Trigger highlight animation when newly added items appear in the list
  useEffect(() => {
    // Combine both sets of IDs to check
    const allPendingIds = new Set([...newlyAddedItemIds, ...pendingNewItemIds.current]);
    
    allPendingIds.forEach((itemId) => {
      if (items.some(item => getItemId(item) === itemId) && !animatingItems.current.has(itemId)) {
        // Mark as animating to prevent duplicate animations
        animatingItems.current.add(itemId);
        
        // Item is now in the list, create animation value and start animation
        if (!highlightAnimations.current.has(itemId)) {
          highlightAnimations.current.set(itemId, new Animated.Value(1));
          // Ensure state is set for rendering - this triggers a re-render so the overlay appears
          if (!newlyAddedItemIds.has(itemId)) {
            setNewlyAddedItemIds(prev => new Set([...prev, itemId]));
          }
        }
        
        // Get the animation value (it should exist now)
        const animValue = highlightAnimations.current.get(itemId);
        if (animValue) {
          // Small delay to ensure component has rendered with the animation value
          setTimeout(() => {
            // Start fade-out animation
            Animated.timing(animValue, {
              toValue: 0,
              duration,
              useNativeDriver: false, // opacity animation doesn't need native driver for backgroundColor
            }).start(() => {
              // Clean up after animation completes
              highlightAnimations.current.delete(itemId);
              animatingItems.current.delete(itemId);
              setNewlyAddedItemIds(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
              });
              pendingNewItemIds.current.delete(itemId);
            });
          }, animationDelay);
        }
      }
    });
    // Use items.length and Array.from(newlyAddedItemIds).join(',') to track changes properly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, Array.from(newlyAddedItemIds).join(','), getItemId, duration, animationDelay]);

  const markAsNewlyAdded = (itemId: string) => {
    pendingNewItemIds.current.add(itemId);
    setNewlyAddedItemIds(prev => new Set([...prev, itemId]));
  };

  const isNewlyAdded = (itemId: string): boolean => {
    return newlyAddedItemIds.has(itemId) || pendingNewItemIds.current.has(itemId);
  };

  const getAnimationValue = (itemId: string): Animated.Value | null => {
    return highlightAnimations.current.get(itemId) || null;
  };

  const clearNewlyAdded = () => {
    setNewlyAddedItemIds(new Set());
    pendingNewItemIds.current.clear();
  };

  return {
    markAsNewlyAdded,
    isNewlyAdded,
    getAnimationValue,
    clearNewlyAdded,
  };
}

