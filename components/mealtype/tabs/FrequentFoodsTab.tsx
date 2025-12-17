import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FoodSourceBadge } from '@/components/food-source-badge';
import { showAppToast } from '@/components/ui/app-toast';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import type { Colors } from '@/constants/theme';

type FrequentFoodsTabProps = {
  frequentFoods: EnhancedFoodItem[];
  frequentFoodsLoading: boolean;
  searchQuery: string;
  colors: typeof Colors.light;
  t: (key: string) => string;
  onFoodSelect: (food: EnhancedFoodItem) => void;
  onQuickAdd: (food: EnhancedFoodItem) => void;
  styles: any;
  useTabBackgroundColor?: boolean;
  getTabListBackgroundColor?: (tab: string) => string;
};

export function FrequentFoodsTab({
  frequentFoods,
  frequentFoodsLoading,
  searchQuery,
  colors,
  t,
  onFoodSelect,
  onQuickAdd,
  styles,
  useTabBackgroundColor = false,
  getTabListBackgroundColor,
}: FrequentFoodsTabProps) {
  const [disabledButtons, setDisabledButtons] = useState<Set<string>>(new Set());

  const handleQuickAdd = (food: EnhancedFoodItem) => {
    // Show toast message
    const foodName = food.name.length > 20 ? food.name.substring(0, 20) + '...' : food.name;
    showAppToast(`Quick-Adding ${foodName}`);
    
    // Disable button for 3 seconds to prevent multiple clicks
    setDisabledButtons(prev => new Set(prev).add(food.id));
    setTimeout(() => {
      setDisabledButtons(prev => {
        const next = new Set(prev);
        next.delete(food.id);
        return next;
      });
    }, 3000);
    
    onQuickAdd(food);
  };

  const containerStyle = useTabBackgroundColor && getTabListBackgroundColor
    ? { backgroundColor: getTabListBackgroundColor('frequent'), borderColor: colors.icon + '20' }
    : { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) };

  const scrollViewStyle = useTabBackgroundColor
    ? styles.searchResultsList
    : [styles.searchResultsList, { backgroundColor: 'transparent' }];

  return (
    <View style={styles.tabContent}>
      {!searchQuery && (
        <>
          {frequentFoodsLoading ? (
            <View style={styles.emptyTabState}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 8 }]}>
                {t('mealtype_log.frequent_foods.loading')}
              </ThemedText>
            </View>
          ) : frequentFoods.length > 0 ? (
            <View style={[styles.searchResultsContainer, containerStyle]}>
              <ScrollView 
                style={scrollViewStyle}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {frequentFoods.map((food) => {
                  const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                  const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} cal`;
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
                          style={[styles.quickAddButton, { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0, marginLeft: 4 }]}
                          onPress={() => handleQuickAdd(food)}
                          disabled={disabledButtons.has(food.id)}
                          activeOpacity={0.7}
                          accessibilityLabel={t('mealtype_log.quick_add')}
                          accessibilityHint={t('mealtype_log.accessibility.quick_add_hint')}
                        >
                          <IconSymbol
                            name="plus.circle.fill"
                            size={22}
                            color={disabledButtons.has(food.id) ? colors.textSecondary : colors.tint}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

