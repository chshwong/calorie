import React from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity, Text, Alert, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { HighlightableRow } from '@/components/common/highlightable-row';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';
import type { Colors } from '@/constants/theme';
import { getLocalDateString } from '@/utils/calculations';

type BundleItem = {
  id: string;
  bundle_id: string;
  food_id: string | null;
  item_name: string | null;
  quantity: number;
  unit: string;
  serving_id: string | null;
};

type Bundle = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFiber?: number;
  foodsMap?: Map<string, any> | Record<string, any>;
  servingsMap?: Map<string, any> | Record<string, any>;
};

type BundlesTabProps = {
  bundles: Bundle[];
  bundlesLoading: boolean;
  searchQuery: string;
  colors: typeof Colors.light;
  t: (key: string) => string;
  onAddBundle: (bundle: Bundle) => void;
  onDelete: (bundle: Bundle) => void;
  formatBundleItemsList: (bundle: Bundle) => string;
  isBundleNewlyAdded: (bundleId: string) => boolean;
  editMode: boolean;
  onToggleEditMode: () => void;
  loading: boolean;
  mealType: string;
  entryDate: string;
  styles: any;
  useTabBackgroundColor?: boolean;
  getTabListBackgroundColor?: (tab: string) => string;
};

export function BundlesTab({
  bundles,
  bundlesLoading,
  searchQuery,
  colors,
  t,
  onAddBundle,
  onDelete,
  formatBundleItemsList,
  isBundleNewlyAdded,
  editMode,
  onToggleEditMode,
  loading,
  mealType,
  entryDate,
  styles,
  useTabBackgroundColor = false,
  getTabListBackgroundColor,
}: BundlesTabProps) {
  const router = useRouter();

  const containerStyle = useTabBackgroundColor && getTabListBackgroundColor
    ? { backgroundColor: getTabListBackgroundColor('bundle'), borderColor: colors.icon + '20' }
    : { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) };

  const scrollViewStyle = useTabBackgroundColor
    ? styles.searchResultsList
    : [styles.searchResultsList, { backgroundColor: 'transparent' }];

  return (
    <View style={styles.tabContent}>
      {/* Create New Bundle Button */}
      <View style={[styles.searchResultsContainer, { backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0, marginBottom: bundlesLoading || bundles.length === 0 ? 0 : 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } }) }]}>
        <TouchableOpacity
          style={[
            styles.searchResultItem, 
            { 
              borderBottomColor: colors.icon + '15', 
              backgroundColor: bundles.length >= 20 ? colors.icon + '20' : colors.tint + '10',
              opacity: bundles.length >= 20 ? 0.6 : 1,
            }
          ]}
          onPress={() => {
            if (bundles.length >= 20) {
              Alert.alert(t('alerts.limit_reached'), t('mealtype_log.bundles.limit_reached'));
              return;
            }
            router.push({
              pathname: '/create-bundle',
              params: {
                mealType: mealType || 'breakfast',
                entryDate: entryDate || new Date().toISOString().split('T')[0],
              },
            });
          }}
          disabled={bundles.length >= 20}
          activeOpacity={0.7}
        >
          <View style={[styles.searchResultContent, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
            <ThemedText style={[
              styles.searchResultName, 
              { 
                color: bundles.length >= 20 ? colors.icon : colors.tint, 
                fontWeight: '700',
                flex: 1,
              }
            ]}>
              {t('mealtype_log.bundles.create_new')}{' '}
              <ThemedText style={{
                fontWeight: '400',
                fontSize: 13,
                color: bundles.length >= 20 ? colors.icon + '80' : colors.tint + 'CC',
              }}>
                {t('mealtype_log.bundles.bundles_count', { count: bundles.length })}
              </ThemedText>
            </ThemedText>
            {bundles.length > 0 && (
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

      {bundlesLoading ? (
        <View style={styles.emptyTabState}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary, marginTop: 12 }]}>
            {t('mealtype_log.bundles.loading')}
          </ThemedText>
        </View>
      ) : bundles.length > 0 ? (
        <View style={[styles.searchResultsContainer, containerStyle]}>
          <ScrollView 
            style={scrollViewStyle}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {bundles.map((bundle) => (
              <HighlightableRow
                key={bundle.id}
                isNew={isBundleNewlyAdded(bundle.id)}
                style={[styles.searchResultItem, { borderBottomColor: colors.icon + '15' }]}
              >
                {!editMode ? (
                  <TouchableOpacity
                    style={[
                      { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
                      getMinTouchTargetStyle(),
                    ]}
                    onPress={() => {
                      if (!loading) {
                        onAddBundle(bundle);
                      }
                    }}
                    disabled={loading}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(
                      t('mealtype_log.add_bundle.label'),
                      t('mealtype_log.add_bundle.hint')
                    )}
                    {...(Platform.OS === 'web' ? getWebAccessibilityProps(
                      'button',
                      t('mealtype_log.add_bundle.label'),
                      `add-bundle-${bundle.id}`
                    ) : {})}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <ThemedText 
                        style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: 4 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {bundle.name}{' '}
                        <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }}>
                          ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                        </ThemedText>
                      </ThemedText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        {bundle.totalCalories !== undefined && (
                          <ThemedText style={[styles.searchResultNutrition, { color: colors.tint, fontSize: 12, fontWeight: '600' }]}>
                            {bundle.totalCalories} cal
                          </ThemedText>
                        )}
                        {(bundle.totalProtein || bundle.totalCarbs || bundle.totalFat || bundle.totalFiber) && (
                          <>
                            <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 8 }]}>
                              •
                            </ThemedText>
                            {bundle.totalProtein ? (
                              <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                P: {bundle.totalProtein}g
                              </ThemedText>
                            ) : null}
                            {bundle.totalCarbs ? (
                              <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                C: {bundle.totalCarbs}g
                              </ThemedText>
                            ) : null}
                            {bundle.totalFat ? (
                              <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                Fat: {bundle.totalFat}g
                              </ThemedText>
                            ) : null}
                            {bundle.totalFiber ? (
                              <ThemedText style={[styles.searchResultNutrition, { color: colors.textSecondary, fontSize: 11, marginLeft: 4 }]}>
                                Fib: {bundle.totalFiber}g
                              </ThemedText>
                            ) : null}
                          </>
                        )}
                      </View>
                      <ThemedText 
                        style={[styles.searchResultNutrition, { color: colors.icon, fontSize: 11, marginTop: 2 }]}
                        numberOfLines={3}
                        ellipsizeMode="tail"
                      >
                        {formatBundleItemsList(bundle)}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <ThemedText 
                        style={[styles.searchResultName, { color: colors.text, flexShrink: 1, marginBottom: 0 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {bundle.name}{' '}
                        <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }}>
                          ({bundle.items?.length || 0} {bundle.items?.length === 1 ? 'item' : 'items'})
                        </ThemedText>
                      </ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
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
                        onPress={() => onDelete(bundle)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>🗑️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0, marginRight: 6 }]}
                        onPress={() => {
                          router.push({
                            pathname: '/create-bundle',
                            params: {
                              mealType: mealType || 'breakfast',
                              entryDate: entryDate || getLocalDateString(),
                              bundleId: bundle.id,
                            },
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.editButtonText, { color: colors.tint }]}>✏️</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </HighlightableRow>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyTabState}>
          <ThemedText style={[styles.emptyTabText, { color: colors.textSecondary }]}>
            {t('mealtype_log.bundles.empty')}
          </ThemedText>
          <ThemedText style={[styles.emptyTabSubtext, { color: colors.textSecondary }]}>
            {t('mealtype_log.bundles.hint')}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

