import { useState, useCallback, useRef } from 'react';

interface UseMultiSelectOptions {
  /**
   * Whether multi-select mode is enabled
   * @default false
   */
  enabled?: boolean;
}

interface UseMultiSelectReturn<T> {
  /**
   * Set of selected item IDs
   */
  selectedIds: Set<string>;
  
  /**
   * Check if an item is selected
   */
  isSelected: (itemId: string) => boolean;
  
  /**
   * Toggle selection of an item
   */
  toggleSelection: (itemId: string) => void;
  
  /**
   * Select an item
   */
  selectItem: (itemId: string) => void;
  
  /**
   * Deselect an item
   */
  deselectItem: (itemId: string) => void;
  
  /**
   * Select all items
   */
  selectAll: (items: T[], getItemId: (item: T) => string) => void;
  
  /**
   * Deselect all items
   */
  deselectAll: () => void;
  
  /**
   * Check if all items are selected
   */
  areAllSelected: (items: T[], getItemId: (item: T) => string) => boolean;
  
  /**
   * Get count of selected items
   */
  selectedCount: number;
  
  /**
   * Check if any items are selected
   */
  hasSelection: boolean;
  
  /**
   * Clear all selections
   */
  clearSelection: () => void;
}

/**
 * Custom hook for managing multi-select state
 * 
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * const {
 *   selectedIds,
 *   isSelected,
 *   toggleSelection,
 *   selectAll,
 *   deselectAll,
 *   areAllSelected,
 *   selectedCount,
 *   hasSelection,
 * } = useMultiSelect();
 * 
 * // In render:
 * {items.map(item => (
 *   <MultiSelectItem
 *     key={item.id}
 *     isSelected={isSelected(item.id)}
 *     onToggle={() => toggleSelection(item.id)}
 *   >
 *     <View>item content</View>
 *   </MultiSelectItem>
 * ))}
 * ```
 */
export function useMultiSelect<T = any>(
  options: UseMultiSelectOptions = {}
): UseMultiSelectReturn<T> {
  const { enabled = true } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((itemId: string): boolean => {
    return enabled && selectedIds.has(itemId);
  }, [enabled, selectedIds]);

  const toggleSelection = useCallback((itemId: string) => {
    if (!enabled) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, [enabled]);

  const selectItem = useCallback((itemId: string) => {
    if (!enabled) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, [enabled]);

  const deselectItem = useCallback((itemId: string) => {
    if (!enabled) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, [enabled]);

  const selectAll = useCallback((items: T[], getItemId: (item: T) => string) => {
    if (!enabled) return;
    const allIds = new Set(items.map(item => getItemId(item)));
    setSelectedIds(allIds);
  }, [enabled]);

  const deselectAll = useCallback(() => {
    if (!enabled) return;
    setSelectedIds(new Set());
  }, [enabled]);

  const areAllSelected = useCallback((items: T[], getItemId: (item: T) => string): boolean => {
    if (!enabled || items.length === 0) return false;
    return items.every(item => selectedIds.has(getItemId(item)));
  }, [enabled, selectedIds]);

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectItem,
    deselectItem,
    selectAll,
    deselectAll,
    areAllSelected,
    selectedCount,
    hasSelection,
    clearSelection,
  };
}

