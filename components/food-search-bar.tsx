/**
 * FoodSearchBar - Shared component for food search
 * 
 * Per engineering guidelines section 5.1:
 * - Reusable UI component shared across screens
 * - Consistent styling and behavior
 */

import React from 'react';
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
import { type FoodMaster } from '@/utils/nutritionMath';

export interface FoodSearchBarProps {
  /** Current search query */
  searchQuery: string;
  /** Handler for search text changes */
  onSearchChange: (text: string) => void;
  /** Search results to display */
  searchResults: FoodMaster[];
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
}

/**
 * Shared food search bar component
 * Renders search input and floating results dropdown overlay
 */
export function FoodSearchBar({
  searchQuery,
  onSearchChange,
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
}: FoodSearchBarProps) {
  return (
    <View style={[styles.wrapper, containerStyle]} testID={testID}>
      {/* Search Input */}
      <View style={[styles.searchContainer, { borderColor: colors.icon + '30', backgroundColor: colors.background }]}>
        <IconSymbol
          name="magnifyingglass"
          size={18}
          color={colors.icon}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.searchInput,
            {
              color: colors.text,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.icon}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchLoading && (
          <ActivityIndicator
            size="small"
            color={colors.tint}
            style={styles.searchLoader}
          />
        )}
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
            style={styles.searchResultsList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {searchResults.map((food, index) => (
              <View
                key={food.id}
                style={[
                  styles.searchResultItem,
                  { 
                    borderBottomColor: colors.icon + '15',
                    backgroundColor: colors.background,
                  },
                  // Remove bottom border on last item
                  index === searchResults.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <TouchableOpacity
                  style={styles.searchResultTouchable}
                  onPress={() => onSelectFood(food)}
                  activeOpacity={0.7}
                >
                  <View style={styles.searchResultContent}>
                    <ThemedText
                      style={[styles.searchResultName, { color: colors.text }]}
                    >
                      {food.name}
                    </ThemedText>
                    {food.brand && (
                      <ThemedText
                        style={[styles.searchResultBrand, { color: colors.icon }]}
                      >
                        {food.brand}
                      </ThemedText>
                    )}
                    <ThemedText
                      style={[
                        styles.searchResultNutrition,
                        { color: colors.icon },
                      ]}
                    >
                      {food.serving_size} {food.serving_unit} •{' '}
                      {food.calories_kcal} kcal
                    </ThemedText>
                  </View>
                </TouchableOpacity>
                {/* Quick Add button - only shown when onQuickAdd is provided */}
                {onQuickAdd && (
                  <TouchableOpacity
                    style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                    onPress={() => onQuickAdd(food)}
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
            ))}
          </ScrollView>
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
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  searchLoader: {
    marginLeft: 8,
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
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchResultTouchable: {
    flex: 1,
    paddingVertical: 4,
  },
  searchResultContent: {
    flex: 1,
  },
  quickAddButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchResultBrand: {
    fontSize: 12,
    marginTop: 2,
  },
  searchResultNutrition: {
    fontSize: 12,
    marginTop: 4,
  },
});

