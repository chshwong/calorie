import React from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FoodSourceBadge } from '@/components/food-source-badge';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import type { CalorieEntry } from '@/utils/types';
import type { Colors } from '@/constants/theme';

type RecentFoodsTabProps = {
  recentFoods: EnhancedFoodItem[];
  recentFoodsLoading: boolean;
  searchQuery: string;
  colors: typeof Colors.light;
  t: (key: string) => string;
  onFoodSelect: (food: EnhancedFoodItem) => void;
  onQuickAdd: (food: EnhancedFoodItem, latestEntry?: CalorieEntry) => void;
  styles: any;
  useTabBackgroundColor?: boolean;
  getTabListBackgroundColor?: (tab: string) => string;
};

export function RecentFoodsTab({
  recentFoods,
  recentFoodsLoading,
  searchQuery,
  colors,
  t,
  onFoodSelect,
  onQuickAdd,
  styles,
  useTabBackgroundColor = false,
  getTabListBackgroundColor,
}: RecentFoodsTabProps) {
  const containerStyle = useTabBackgroundColor && getTabListBackgroundColor
    ? { backgroundColor: getTabListBackgroundColor('recent'), borderColor: colors.icon + '20' }
    : { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) };

  const scrollViewStyle = useTabBackgroundColor
    ? styles.searchResultsList
    : [styles.searchResultsList, { backgroundColor: 'transparent' }];

  return (
    <View style={styles.tabContent}>
      {!searchQuery && (
        <>
          {recentFoodsLoading ? (
            <View style={styles.emptyTabState}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 8 }]}>
                {t('mealtype_log.recent_foods.loading')}
              </ThemedText>
            </View>
          ) : recentFoods.length > 0 ? (
            <View style={[styles.searchResultsContainer, containerStyle]}>
              <ScrollView 
                style={scrollViewStyle}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {recentFoods.map((food) => {
                  const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                  // Recent tab: Always use latest entry serving info for display
                  // Fallback to default only in edge case where latestEntry is missing
                  const servingQty = food.latestEntry ? food.latestServingQty : food.defaultServingQty;
                  const servingUnit = food.latestEntry ? food.latestServingUnit : food.defaultServingUnit;
                  const servingCalories = food.latestEntry ? food.latestServingCalories : food.defaultServingCalories;
                  const nutritionInfo = `${servingQty} ${servingUnit} • ${servingCalories} cal`;
                  const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                  const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                  const rightSideText = `${brandText}${nutritionInfo}`;
                  const isCustom = food.is_custom === true;

                  return (
                    <View
                      key={food.id}
                      style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
                          onPress={() => onFoodSelect(food)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
                            <ThemedText 
                              style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {truncatedName}
                            </ThemedText>
                            <FoodSourceBadge
                              isCustom={isCustom}
                              colors={colors}
                              marginLeft={6}
                              containerStyle={{ marginRight: 0 }}
                            />
                          </View>
                          <ThemedText 
                            style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                            numberOfLines={1}
                          >
                            {rightSideText}
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.quickAddButton, { backgroundColor: colors.tint + '15' }]}
                          onPress={() => onQuickAdd(food, food.latestEntry || undefined)}
                          activeOpacity={0.7}
                          accessibilityLabel={t('mealtype_log.quick_add')}
                          accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                        >
                          <IconSymbol
                            name="plus.circle.fill"
                            size={22}
                            color={colors.tint}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyTabState}>
              <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                {t('mealtype_log.recent_foods.empty')}
              </ThemedText>
              <ThemedText style={[styles.emptyTabSubtext, { color: colors.textSecondary }]}>
                {t('mealtype_log.recent_foods.hint')}
              </ThemedText>
            </View>
          )}
        </>
      )}
    </View>
  );
}

