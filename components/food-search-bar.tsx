/**
 * FoodSearchBar - Shared component for food search
 * 
 * Per engineering guidelines section 5.1:
 * - Reusable UI component shared across screens
 * - Consistent styling and behavior
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FoodSourceBadge } from '@/components/food-source-badge';
import { FoodStatusChip } from '@/components/food-status-chip';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import type { FoodMaster } from '@/utils/nutritionMath';

export interface FoodSearchBarProps {
  /** Current search query */
  searchQuery: string;
  /** Handler for search text changes */
  onSearchChange: (text: string) => void;
  /** Handler for Enter key press */
  onEnterPress?: () => FoodMaster | null;
  /** Handler to clear search and close dropdown */
  onClearSearch?: () => void;
  /** Handler to set show search results */
  onSetShowSearchResults?: (show: boolean) => void;
  /** Handler to ensure local foods are loaded (for empty query state) */
  onEnsureLocalFoodsLoaded?: () => void;
  /** Search results to display */
  searchResults: EnhancedFoodItem[];
  /** Whether search is loading */
  searchLoading: boolean;
  /** Whether to show search results dropdown */
  showSearchResults: boolean;
  /** Handler when a food is selected */
  onSelectFood: (food: FoodMaster) => void;
  /** Placeholder text */
  placeholder: string;
  /** Theme colors */
  colors: {
    text: string;
    textSecondary: string;
    background: string;
    icon: string;
    tint: string;
  };
  /** Optional custom styles for the container */
  containerStyle?: object;
  /** Optional test ID for testing */
  testID?: string;
  /** 
   * Optional quick add handler - if provided, shows a quick add button on each result
   * Used for quickly adding items with default quantity/serving (e.g., on mealtype-log)
   * Not used on screens like create-bundle where different add behavior is needed
   */
  onQuickAdd?: (food: FoodMaster) => void;
  /** Optional label for quick add button (for i18n) */
  quickAddLabel?: string;
  /** Currently highlighted index (for keyboard navigation) */
  highlightedIndex?: number;
  /** Set highlighted index */
  onHighlightChange?: (index: number) => void;
}

/**
 * Shared food search bar component
 * Renders search input and floating results dropdown overlay
 * Supports keyboard navigation (ArrowUp/Down, Enter, ESC)
 */
export function FoodSearchBar({
  searchQuery,
  onSearchChange,
  onEnterPress,
  onClearSearch,
  onSetShowSearchResults,
  onEnsureLocalFoodsLoaded,
  searchResults,
  searchLoading,
  showSearchResults,
  onSelectFood,
  placeholder,
  colors,
  containerStyle,
  testID,
  onQuickAdd,
  quickAddLabel,
  highlightedIndex = -1,
  onHighlightChange,
}: FoodSearchBarProps) {
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const wrapperRef = useRef<View>(null);
  const isInteractingWithDropdownRef = useRef(false);

  // Canonical clear/close function - handles all clearing and closing logic
  const handleClearAndClose = useCallback(() => {
    if (onClearSearch) {
      onClearSearch();
    }
    // Blur the input
    inputRef.current?.blur();
  }, [onClearSearch]);

  // Handle clear button click
  const handleClear = () => {
    handleClearAndClose();
  };

  // Determine if clear button should be visible
  const showClearButton = showSearchResults || searchQuery.length > 0;

  // Handle blur - close if focus moved outside the component
  const handleBlur = useCallback((e: any) => {
    // Use a small timeout to check if focus moved to an element inside the dropdown
    // This allows clicks on dropdown items to work before blur fires
    setTimeout(() => {
      // Only close if dropdown is still open and we're not interacting with it
      if (showSearchResults && !isInteractingWithDropdownRef.current) {
        // Focus moved outside - close the search
        handleClearAndClose();
      }
      // Reset the flag
      isInteractingWithDropdownRef.current = false;
    }, 150);
  }, [handleClearAndClose, showSearchResults]);

  // Handle focus on input
  // For MealType Log: Always open dropdown when focused, regardless of query length
  const handleFocus = useCallback(() => {
    // Reset the interaction flag when input is focused
    isInteractingWithDropdownRef.current = false;
    
    // When query is empty, ensure local foods are loaded before opening dropdown
    // This prevents showing "No results" when focusing after blur/clear
    if (searchQuery.length === 0 && onEnsureLocalFoodsLoaded) {
      onEnsureLocalFoodsLoaded();
    }
    
    // Always open dropdown when input is focused (for MealType Log behavior)
    // The search algorithm will handle what to display based on query length:
    // - query.length === 0: Show Recent/Frequent (local-only)
    // - query.length 1-2: Show filtered Recent/Frequent (local-only)
    // - query.length >= 3: Show DB search results (with debounce/cache)
    if (onSetShowSearchResults) {
      onSetShowSearchResults(true);
    }
  }, [searchQuery.length, onSetShowSearchResults, onEnsureLocalFoodsLoaded]);

  // Mark that user is interacting with dropdown (prevents blur from closing)
  const handleDropdownInteraction = useCallback(() => {
    isInteractingWithDropdownRef.current = true;
  }, []);

  // Click-outside detection for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      
      // Check if click is outside the wrapper
      const target = event.target as Node;
      // @ts-ignore - web-specific: React Native Web View refs have _nativeNode
      const nativeNode = (wrapperRef.current as any)?._nativeNode || (wrapperRef.current as any);
      
      if (nativeNode && typeof nativeNode.contains === 'function' && !nativeNode.contains(target)) {
        // Clicked outside - close the search
        handleClearAndClose();
      }
    };

    // Only add listener when dropdown is open or query is non-empty
    if (showSearchResults || searchQuery.length > 0) {
      // Use capture phase to catch clicks before they bubble
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [showSearchResults, searchQuery.length, handleClearAndClose]);

  // Handle keyboard navigation
  const handleKeyPress = (e: any) => {
    if (Platform.OS !== 'web') return;
    
    const key = e.nativeEvent?.key || e.key;
    
    if (key === 'ArrowDown') {
      e.preventDefault();
      if (onHighlightChange) {
        const nextIndex = highlightedIndex < searchResults.length - 1 
          ? highlightedIndex + 1 
          : 0;
        onHighlightChange(nextIndex);
        // Scroll to highlighted item
        scrollViewRef.current?.scrollTo({
          y: nextIndex * 60, // Approximate item height
          animated: true,
        });
      }
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      if (onHighlightChange) {
        const prevIndex = highlightedIndex > 0 
          ? highlightedIndex - 1 
          : searchResults.length - 1;
        onHighlightChange(prevIndex);
        // Scroll to highlighted item
        scrollViewRef.current?.scrollTo({
          y: prevIndex * 60,
          animated: true,
        });
      }
    } else if (key === 'Enter') {
      e.preventDefault();
      if (onEnterPress) {
        const selected = onEnterPress();
        if (selected) {
          onSelectFood(selected);
        }
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      // Escape key clears search (same as clicking X)
      handleClear();
    }
  };

  // Scroll to highlighted item when it changes
  useEffect(() => {
    if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
      scrollViewRef.current?.scrollTo({
        y: highlightedIndex * 60,
        animated: true,
      });
    }
  }, [highlightedIndex, searchResults.length]);

  return (
    <View 
      ref={wrapperRef}
      style={[styles.wrapper, containerStyle]} 
      testID={testID}
      onStartShouldSetResponder={() => {
        // Mark interaction when touching the wrapper (mobile)
        if (Platform.OS !== 'web') {
          handleDropdownInteraction();
        }
        return false;
      }}
    >
      {/* Search Input */}
      <View style={[styles.searchContainer, { borderColor: colors.icon + '30', backgroundColor: colors.background }]}>
        <IconSymbol
          name="magnifyingglass"
          size={18}
          color={colors.icon}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={[
            styles.searchInput,
            {
              color: colors.text,
              paddingRight: showClearButton ? 36 : (searchLoading ? 36 : 0), // Add padding when clear button or loader is visible
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={onSearchChange}
          onKeyPress={handleKeyPress}
          onBlur={handleBlur}
          onFocus={handleFocus}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.rightControls}>
          {searchLoading && (
            <ActivityIndicator
              size="small"
              color={colors.tint}
              style={styles.searchLoader}
            />
          )}
          {/* Clear button - visible when dropdown is open OR query is non-empty */}
          {showClearButton && (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              accessibilityHint="Clears the search query and closes the dropdown"
              {...(Platform.OS === 'web' && {
                // @ts-ignore - web-specific props
                'aria-label': 'Clear search',
              })}
            >
              <IconSymbol
                name="xmark"
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results Dropdown - Floats over content below */}
      {showSearchResults && searchResults.length > 0 && (
        <View
          style={[
            styles.searchResultsContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.tint + '40',
            },
          ]}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.searchResultsList}
            contentContainerStyle={styles.searchResultsContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {searchResults.map((food, index) => {
              const isHighlighted = highlightedIndex === index;

              const hasRecentServing =
                (food as any).recent_serving &&
                (food as any).recent_serving.quantity != null &&
                (food as any).recent_serving.unit;

              const displayQuantity = hasRecentServing
                ? (food as any).recent_serving.quantity
                : (food as any).serving_size;

              const displayUnit = hasRecentServing
                ? (food as any).recent_serving.unit
                : (food as any).serving_unit;

              const displayCalories = hasRecentServing
                ? (food as any).recent_serving.calories_kcal
                : (food as any).calories_kcal;

              const nutritionInfo = `${displayQuantity} ${displayUnit} • ${Math.round(
                displayCalories ?? 0
              )} cal`;

              return (
                <View
                  key={food.id}
                  style={[
                    styles.searchResultItem,
                    { 
                      borderBottomColor: colors.icon + '15',
                      backgroundColor: isHighlighted 
                        ? colors.tint + '10' 
                        : colors.background,
                    },
                    // Remove bottom border on last item
                    index === searchResults.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.searchResultTouchable}
                    onPress={() => {
                      // Mark interaction before selecting to prevent blur from closing
                      handleDropdownInteraction();
                      onSelectFood(food);
                      // Note: onSelectFood should call clearSearch to close dropdown
                    }}
                    onPressIn={handleDropdownInteraction}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultContent}>
                      <View style={styles.searchResultNameRow}>
                        <ThemedText
                          style={[styles.searchResultName, { color: colors.text }]}
                        >
                          {food.name}
                        </ThemedText>
                        {/* Food status chips - Frequent/Recent */}
                        <FoodStatusChip
                          isFrequent={food.is_frequent}
                          isRecent={food.is_recent}
                          colors={colors}
                          marginLeft={6}
                        />
                        {/* Food source badge - shows "C" chip only for custom foods */}
                        <FoodSourceBadge
                          isCustom={food.is_custom === true}
                          colors={colors}
                          marginLeft={6}
                        />
                      </View>
                      {/* Combined brand + serving/calories on one line */}
                      <View style={styles.metaRow}>
                        {food.brand && (
                          <ThemedText
                            style={[styles.brandText, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {food.brand}
                          </ThemedText>
                        )}
                        <ThemedText
                          style={[styles.calorieText, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {food.brand ? ' • ' : ''}
                          {nutritionInfo}
                        </ThemedText>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {/* Quick Add button - only shown when onQuickAdd is provided */}
                  {onQuickAdd && (
                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                      onPress={() => {
                        handleDropdownInteraction();
                        onQuickAdd(food);
                      }}
                      onPressIn={handleDropdownInteraction}
                      activeOpacity={0.7}
                      accessibilityLabel={quickAddLabel || 'Quick add'}
                      accessibilityHint="Add with default serving"
                    >
                      <IconSymbol
                        name="plus.circle.fill"
                        size={22}
                        color={colors.tint}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
      {/* Empty state */}
      {showSearchResults && searchResults.length === 0 && !searchLoading && (
        <View
          style={[
            styles.searchResultsContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.tint + '40',
            },
          ]}
        >
          <View style={styles.emptyState}>
            <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              No results found
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1001,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12, // Reduced from 12 to make search bar more compact (py-1.5 equivalent)
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  searchLoader: {
    marginRight: 4,
  },
  clearButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 24,
    minHeight: 24,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1.5,
    borderRadius: 12,
    maxHeight: 280,
    overflow: 'hidden',
    zIndex: 9999,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 0,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  searchResultsList: {
    maxHeight: 280,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  searchResultsContent: {
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 3,
    marginVertical: 0,
    borderBottomWidth: 0.5,
  },
  searchResultTouchable: {
    flex: 1,
    paddingVertical: 0,
    marginVertical: 0,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    flexWrap: 'nowrap',
  },
  brandText: {
    fontSize: 12,
    lineHeight: 16,
  },
  calorieText: {
    fontSize: 12,
    lineHeight: 16,
  },
  quickAddButton: {
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 8,
    marginLeft: 8,
    marginVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
  },
});

