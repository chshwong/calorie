import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity, Text, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { showAppToast } from '@/components/ui/app-toast';
import type { EnhancedFoodItem } from '@/src/domain/foodSearch';
import type { FoodMaster } from '@/utils/nutritionMath';
import { FontWeight, Nudge, Spacing, type Colors } from '@/constants/theme';
import { getLocalDateString } from '@/utils/calculations';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type CustomFoodsTabProps = {
  customFoods: EnhancedFoodItem[];
  customFoodsLoading: boolean;
  searchQuery: string;
  colors: typeof Colors.light;
  t: (key: string, options?: any) => string;
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
  onQuickLogTabPress?: () => void;
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
  onQuickLogTabPress,
}: CustomFoodsTabProps) {
  const router = useRouter();
  const [disabledButtons, setDisabledButtons] = useState<Set<string>>(new Set());
  const [isCustomFoodInfoOpen, setIsCustomFoodInfoOpen] = useState(false);

  const handleQuickLogLinkPress = () => {
    setIsCustomFoodInfoOpen(false);
    setTimeout(() => {
      onQuickLogTabPress?.();
    }, 0);
  };

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
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <ThemedText style={[styles.searchResultName, { color: colors.tint, fontWeight: '700', flexShrink: 1 }]}>
                {t('mealtype_log.custom_foods.create_new')}
              </ThemedText>
              <TouchableOpacity
                onPress={(event) => {
                  event?.stopPropagation?.();
                  setIsCustomFoodInfoOpen(true);
                }}
                style={[
                  localStyles.infoIconButton,
                  Platform.OS === 'web' && getFocusStyle(colors.tint),
                ]}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('mealtype_log.custom.info_a11y_label', { defaultValue: 'About custom food' }),
                  t('mealtype_log.custom.info_a11y_hint', { defaultValue: 'Opens an explanation of custom food' })
                )}
              >
                <IconSymbol name="info.circle.fill" size={16} color={colors.icon} decorative={true} />
              </TouchableOpacity>
            </View>
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
      <ConfirmModal
        visible={isCustomFoodInfoOpen}
        title={t('mealtype_log.custom.info_title', { defaultValue: 'Custom Food' })}
        message={
          <View>
            <ThemedText style={[localStyles.infoBullet, { color: colors.textSecondary }]}>
              • {t('mealtype_log.custom.info_bullet_1', { defaultValue: "For foods you can't find in the database." })}
            </ThemedText>
            <ThemedText style={[localStyles.infoBullet, { color: colors.textSecondary }]}>
              • {t('mealtype_log.custom.info_bullet_2', { defaultValue: "Best for foods you'll log more than once." })}
            </ThemedText>
            <ThemedText style={[localStyles.infoBullet, { color: colors.textSecondary }]}>
              • {t('mealtype_log.custom.info_bullet_3', { defaultValue: 'After you create it, it becomes searchable in the search bar.' })}
            </ThemedText>
            <View style={localStyles.infoBulletRow}>
              <ThemedText style={[localStyles.infoBulletText, { color: colors.textSecondary }]}>
                • {t('mealtype_log.custom.info_bullet_4_prefix', { defaultValue: 'For one-time foods, use ' })}
              </ThemedText>
              <TouchableOpacity
                onPress={handleQuickLogLinkPress}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  t('mealtype_log.custom.info_quick_log_a11y_label', { defaultValue: 'Go to Quick Log' }),
                  t('mealtype_log.custom.info_quick_log_a11y_hint', { defaultValue: 'Closes this and opens Quick Log' })
                )}
              >
                <Text
                  style={[
                    localStyles.infoQuickLogText,
                    {
                      color: colors.tint,
                      textDecorationLine: Platform.OS === 'web' ? 'underline' : 'none',
                    },
                  ]}
                >
                  {t('mealtype_log.custom.info_quick_log_text', { defaultValue: 'Quick Log' })}
                </Text>
              </TouchableOpacity>
              <ThemedText style={[localStyles.infoBulletText, { color: colors.textSecondary }]}>
                {t('mealtype_log.custom.info_bullet_4_suffix', { defaultValue: '.' })}
              </ThemedText>
            </View>
          </View>
        }
        confirmText={t('common.close', { defaultValue: 'Close' })}
        cancelText={null}
        onConfirm={() => setIsCustomFoodInfoOpen(false)}
        onCancel={() => setIsCustomFoodInfoOpen(false)}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  infoIconButton: {
    marginLeft: Spacing.sm,
    alignSelf: 'center',
    padding: Spacing.xs + Nudge.px2,
    minWidth: Spacing['3xl'] + Nudge.px2 * 2,
    minHeight: Spacing['3xl'] + Nudge.px2 * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBullet: {
    marginBottom: Spacing.sm,
  },
  infoBulletRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoBulletText: {
    // Color supplied at call site
  },
  infoQuickLogText: {
    fontWeight: FontWeight.semibold,
  },
});
