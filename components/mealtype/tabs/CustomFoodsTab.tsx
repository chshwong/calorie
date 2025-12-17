import React, { useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity, Text, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { showAppToast } from '@/components/ui/app-toast';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import type { FoodMaster } from '@/utils/nutritionMath';
import type { Colors } from '@/constants/theme';
import { getLocalDateString } from '@/utils/calculations';

type CustomFoodsTabProps = {
  customFoods: EnhancedFoodItem[];
  customFoodsLoading: boolean;
  searchQuery: string;
  colors: typeof Colors.light;
  t: (key: string) => string;
  onFoodSelect: (food: EnhancedFoodItem) => void;
  onQuickAdd: (food: EnhancedFoodItem) => void;
  onDelete: (food: FoodMaster) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  newlyAddedFoodId: React.RefObject<string | undefined>;
  newlyEditedFoodId: React.RefObject<string | undefined>;
  mealType: string;
  entryDate: string;
  styles: any;
};

export function CustomFoodsTab({
  customFoods,
  customFoodsLoading,
  searchQuery,
  colors,
  t,
  onFoodSelect,
  onQuickAdd,
  onDelete,
  editMode,
  onToggleEditMode,
  newlyAddedFoodId,
  newlyEditedFoodId,
  mealType,
  entryDate,
  styles,
}: CustomFoodsTabProps) {
  const router = useRouter();
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

  return (
    <View style={styles.tabContent}>
      {/* Create New Custom Food Button (always visible) */}
      <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: customFoodsLoading || customFoods.length === 0 ? 0 : 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
        <TouchableOpacity
          style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15', backgroundColor: colors.tint + '10' }]}
          onPress={() => {
            router.push({
              pathname: '/create-custom-food',
              params: {
                mealType: mealType || 'breakfast',
                entryDate: entryDate || getLocalDateString(),
              },
            });
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.searchResultContent, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
            <ThemedText style={[styles.searchResultName, { color: colors.tint, fontWeight: '700', flex: 1 }]}>
              {t('mealtype_log.custom_foods.create_new')}
            </ThemedText>
            {customFoods.length > 0 && (
              <TouchableOpacity
                onPress={onToggleEditMode}
                style={[styles.editButton, { 
                  backgroundColor: editMode ? '#10B981' + '20' : colors.tint + '20', 
                  borderColor: editMode ? '#10B981' + '40' : colors.tint + '40' 
                }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.editButtonText, { 
                  color: editMode ? '#10B981' : colors.tint 
                }]}>
                  {editMode ? '✓' : '✏️'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {customFoodsLoading ? (
        <View style={styles.emptyTabState}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 12 }]}>
            {t('mealtype_log.custom_foods.loading')}
          </ThemedText>
        </View>
      ) : customFoods.length > 0 ? (
        <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
          <ScrollView 
            style={[styles.searchResultsList, { backgroundColor: 'transparent' }]}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {(() => {
              let sortedFoods;
              if (editMode) {
                sortedFoods = [...customFoods];
                const newlyAddedIndex = sortedFoods.findIndex(f => f.id === newlyAddedFoodId.current || f.id === newlyEditedFoodId.current);
                if (newlyAddedIndex > 0) {
                  const newlyAdded = sortedFoods.splice(newlyAddedIndex, 1)[0];
                  sortedFoods.unshift(newlyAdded);
                }
              } else {
                sortedFoods = [...customFoods].sort((a, b) => {
                  if (newlyAddedFoodId.current === a.id || newlyEditedFoodId.current === a.id) return -1;
                  if (newlyAddedFoodId.current === b.id || newlyEditedFoodId.current === b.id) return 1;
                  const indexA = customFoods.findIndex(f => f.id === a.id);
                  const indexB = customFoods.findIndex(f => f.id === b.id);
                  return indexA - indexB;
                });
              }
              
              return sortedFoods.map((food) => {
                const isNewlyAdded = newlyAddedFoodId.current === food.id;
                const isNewlyEdited = newlyEditedFoodId.current === food.id;
                const truncatedName = food.name.length > 30 ? food.name.substring(0, 30) + '...' : food.name;
                const nutritionInfo = `${food.defaultServingQty} ${food.defaultServingUnit} • ${food.defaultServingCalories} cal`;
                const truncatedBrand = food.brand && food.brand.length > 14 ? food.brand.substring(0, 14) + '...' : food.brand;
                const brandText = truncatedBrand ? `${truncatedBrand} • ` : '';
                const rightSideText = `${brandText}${nutritionInfo}`;
                
                return (
                  <View
                    key={food.id}
                    style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, opacity: editMode ? 0.6 : 1 }}
                        onPress={() => {
                          if (!editMode) {
                            onFoodSelect(food);
                          }
                        }}
                        disabled={editMode}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                          <ThemedText 
                            style={[styles.searchResultName, { color: colors.text, flexShrink: 1 }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {truncatedName}
                          </ThemedText>
                          {isNewlyAdded && (
                            <View style={[styles.justAddedBadge, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40' }]}>
                              <ThemedText style={[styles.justAddedText, { color: colors.tint }]}>
                                just added
                              </ThemedText>
                            </View>
                          )}
                          {isNewlyEdited && (
                            <View style={[styles.justAddedBadge, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40' }]}>
                              <ThemedText style={[styles.justAddedText, { color: colors.tint }]}>
                                just edited
                              </ThemedText>
                            </View>
                          )}
                        </View>
                        {!editMode && (
                          <ThemedText 
                            style={[styles.searchResultNutrition, { color: colors.textSecondary, marginLeft: 6, fontSize: 11, flexShrink: 0 }]}
                            numberOfLines={1}
                          >
                            {rightSideText}
                          </ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                    {editMode && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                        <TouchableOpacity
                          style={[styles.deleteButton, { 
                            backgroundColor: 'transparent', 
                            borderColor: 'transparent', 
                            borderWidth: 0,
                            borderRadius: 0,
                            paddingHorizontal: 0, 
                            paddingVertical: 0, 
                            width: 'auto',
                            height: 'auto',
                            minWidth: 0,
                            minHeight: 0,
                            marginRight: 6 
                          }]}
                          onPress={() => onDelete(food)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editButton, { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0 }]}
                          onPress={() => {
                            router.push({
                              pathname: '/create-custom-food',
                              params: {
                                mealType: mealType || 'breakfast',
                                entryDate: entryDate || getLocalDateString(),
                                foodId: food.id,
                              },
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.editButtonText, { color: colors.tint }]}>✏️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {!editMode && (
                      <>
                        <TouchableOpacity
                          style={[styles.editButton, { 
                            backgroundColor: 'transparent', 
                            borderColor: 'transparent', 
                            borderWidth: 0,
                            borderRadius: 0,
                            paddingHorizontal: 2, 
                            paddingVertical: 0, 
                            width: 'auto',
                            height: 'auto',
                            minWidth: 0,
                            minHeight: 0,
                            marginLeft: 6 
                          }]}
                          onPress={() => {
                            router.push({
                              pathname: '/create-custom-food',
                              params: {
                                mealType: mealType || 'breakfast',
                                entryDate: entryDate || getLocalDateString(),
                                cloneFoodId: food.id,
                              },
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.editButtonText, { color: colors.tint }]}>⧉</Text>
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
                      </>
                    )}
                  </View>
                );
              });
            })()}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyTabState}>
          <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
            {t('mealtype_log.custom_foods.empty')}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

