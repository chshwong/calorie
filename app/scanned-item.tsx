import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { formatBarcodeForDisplay } from '@/lib/barcode';
import { 
  handleScannedBarcode, 
  BarcodeLookupResult,
  promoteToFoodMaster,
  calculateNutritionForServing,
  lookupExistingCustomFood,
} from '@/services/barcode-lookup';
import { getFoodMasterById } from '@/lib/services/foodMaster';
import type { FoodMaster } from '@/utils/nutritionMath';
import { getLocalDateKey } from '@/utils/dateTime';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

/**
 * Scanned Item page - handles barcode lookup and displays results.
 * 
 * Flow:
 * 1. Receives normalized barcode from scanner
 * 2. Performs lookup: food_master → cache → OpenFoodFacts
 * 3. Displays result with appropriate actions
 * 
 * Route params:
 * - barcode: The normalized 13-digit barcode (EAN-13 format)
 * - mealType: The meal type context (breakfast, lunch, dinner, snack)
 * - entryDate: The date for the entry
 */
export default function ScannedItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    barcode: string;
    mealType: string;
    entryDate: string;
  }>();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { barcode, mealType, entryDate } = params;

  // Lookup state
  const [lookupResult, setLookupResult] = useState<BarcodeLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Existing custom food state
  const [alreadySavedAsCustom, setAlreadySavedAsCustom] = useState(false);
  const [existingCustomFoodId, setExistingCustomFoodId] = useState<string | null>(null);
  const [existingCustomFoodName, setExistingCustomFoodName] = useState<string | null>(null);
  
  // Ref guard to prevent double navigation
  const hasNavigatedToLogRef = useRef(false);

  // Perform lookup on mount
  useEffect(() => {
    if (barcode) {
      performLookup(barcode);
    }
  }, [barcode]);

  const performLookup = async (code: string) => {
    setIsLoading(true);
    try {
      const result = await handleScannedBarcode(code);
      setLookupResult(result);
      
      // After lookup, check if user already has a custom food for this barcode
      // Only check for cache/OpenFoodFacts results (not food_master canonical matches)
      if (user && (result.status === 'found_cache' || result.status === 'found_openfoodfacts')) {
        const normalizedBarcode = result.normalizedBarcode;
        const existingCustom = await lookupExistingCustomFood(normalizedBarcode, user.id);
        
        if (existingCustom) {
          setAlreadySavedAsCustom(true);
          setExistingCustomFoodId(existingCustom.id);
          setExistingCustomFoodName(existingCustom.name);
        } else {
          setAlreadySavedAsCustom(false);
          setExistingCustomFoodId(null);
          setExistingCustomFoodName(null);
        }
      } else {
        // Reset state for other result types
        setAlreadySavedAsCustom(false);
        setExistingCustomFoodId(null);
        setExistingCustomFoodName(null);
      }
    } catch (error: any) {
      console.error('Lookup error:', error);
      setLookupResult({
        status: 'not_found',
        source: 'none',
        normalizedBarcode: code,
        error: error.message || 'Lookup failed',
      });
      setAlreadySavedAsCustom(false);
      setExistingCustomFoodId(null);
      setExistingCustomFoodName(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleScanAnother = () => {
    // Navigate to mealtype-log with the same params and a flag to open the scanner
    router.push({
      pathname: '/(tabs)/mealtype-log',
      params: {
        mealType: mealType || 'breakfast',
        entryDate: entryDate || getLocalDateKey(new Date()),
        openBarcodeScanner: 'true',
      },
    });
  };

  // Use canonical food from food_master - navigate directly to food-edit
  const handleUseCanonicalFood = async (foodId: string) => {
    if (hasNavigatedToLogRef.current) {
      return;
    }
    hasNavigatedToLogRef.current = true;
    
    try {
      // Prime cache with food data
      const foodKey = ['foodMasterFull', foodId];
      let foodData = queryClient.getQueryData<FoodMaster>(foodKey);
      
      if (!foodData) {
        const fetched = await getFoodMasterById(foodId);
        foodData = fetched || undefined;
        if (foodData) {
          queryClient.setQueryData(foodKey, foodData);
        }
      }
      
      // Navigate directly to food-edit
      router.replace({
        pathname: '/food-edit',
        params: {
          foodId: foodId,
          date: entryDate || getLocalDateKey(new Date()),
          mealType: mealType || 'breakfast',
        },
      });
    } catch (error) {
      console.error('[ScannedItem] Error priming cache for canonical food:', error);
      // Fallback: navigate anyway
      router.replace({
        pathname: '/food-edit',
        params: {
          foodId: foodId,
          date: entryDate || getLocalDateKey(new Date()),
          mealType: mealType || 'breakfast',
        },
      });
    }
  };

  // Single-shot navigation guard - prevents double navigation
  // Navigates directly to food-edit and primes React Query cache to avoid flicker
  const goToLogEntryOnce = async (
    foodMasterId: string, 
    cacheRow?: Extract<BarcodeLookupResult, { status: 'found_cache' | 'found_openfoodfacts' }>['cacheRow']
  ) => {
    if (hasNavigatedToLogRef.current) {
      return;
    }
    hasNavigatedToLogRef.current = true;

    try {
      // Prime React Query cache with food data to avoid loading flicker
      const foodKey = ['foodMasterFull', foodMasterId];
      
      // Try to get from cache first
      let foodData = queryClient.getQueryData<FoodMaster>(foodKey);
      
      // If not in cache, fetch it (for existing custom foods)
      if (!foodData) {
        const fetched = await getFoodMasterById(foodMasterId);
        foodData = fetched || undefined;
      }
      
      // If still no data and we have cacheRow (newly created), build FoodMaster from cacheRow
      if (!foodData && cacheRow) {
        const nutrition = calculateNutritionForServing(cacheRow, 100);
        foodData = {
          id: foodMasterId,
          name: cacheRow.product_name || 'Scanned Product',
          brand: cacheRow.brand || null,
          barcode: cacheRow.barcode,
          serving_size: 100,
          serving_unit: 'g',
          calories_kcal: nutrition.calories,
          protein_g: nutrition.protein,
          carbs_g: nutrition.carbs,
          fat_g: nutrition.fat,
          saturated_fat_g: nutrition.saturated_fat,
          trans_fat_g: nutrition.trans_fat,
          sugar_g: nutrition.sugar,
          fiber_g: nutrition.fiber,
          sodium_mg: nutrition.sodium_mg,
          source: cacheRow.source || 'openfoodfacts',
          is_custom: true,
        } as FoodMaster;
      }
      
      // Prime the cache if we have data
      if (foodData) {
        queryClient.setQueryData(foodKey, foodData);
      }
      
      // Navigate directly to food-edit (no intermediate mealtype-log screen)
      router.replace({
        pathname: '/food-edit',
        params: {
          foodId: foodMasterId,
          date: entryDate || getLocalDateKey(new Date()),
          mealType: mealType || 'breakfast',
        },
      });
    } catch (error) {
      console.error('[ScannedItem] Error priming cache or navigating:', error);
      // Fallback: navigate anyway (food-edit will fetch data)
      router.replace({
        pathname: '/food-edit',
        params: {
          foodId: foodMasterId,
          date: entryDate || getLocalDateKey(new Date()),
          mealType: mealType || 'breakfast',
        },
      });
    }
  };

  // Save external food as custom food (promote to food_master), then auto-select
  // Save as Custom and Log Food - promotes to food_master and auto-selects for logging
  // OR: Log existing custom food if it already exists
  const handleSaveAsCustomAndLog = async () => {
    // Prevent multiple submissions
    if (isSaving || hasNavigatedToLogRef.current) {
      return;
    }

    if (!lookupResult || !user) return;
    
    // Only allow saving from cache or OpenFoodFacts results
    if (lookupResult.status !== 'found_cache' && lookupResult.status !== 'found_openfoodfacts') {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // If custom food already exists, use it directly (no creation needed)
      if (alreadySavedAsCustom && existingCustomFoodId) {
        // Invalidate custom foods cache to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['customFoods', user.id] });
        
        // Navigate directly to food-edit (will fetch full food data)
        await goToLogEntryOnce(existingCustomFoodId);
        return;
      }
      
      // Otherwise, create new custom food (idempotent - will return existing if race condition)
      const cacheRow = lookupResult.cacheRow;
      const result = await promoteToFoodMaster(cacheRow, user.id);
      
      if (result.success) {
        // Invalidate custom foods cache immediately so it appears right away
        queryClient.invalidateQueries({ queryKey: ['customFoods', user.id] });
        
        // Navigate directly to food-edit with cacheRow data to prime cache
        await goToLogEntryOnce(result.foodMasterId, cacheRow);
      } else {
        setSaveError(result.error);
        setIsSaving(false);
        // Reset navigation guard on error so user can retry
        hasNavigatedToLogRef.current = false;
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save food');
      setIsSaving(false);
      // Reset navigation guard on error so user can retry
      hasNavigatedToLogRef.current = false;
    }
  };

  // Keep old handler name for compatibility (now unused, but keeping for now)
  const handleSaveAsCustomFood = handleSaveAsCustomAndLog;

  // Use external food once without saving to food_master
  const handleUseOnce = () => {
    if (!lookupResult) return;
    
    if (lookupResult.status !== 'found_cache' && lookupResult.status !== 'found_openfoodfacts') {
      return;
    }

    const cacheRow = lookupResult.cacheRow;
    
    // Pass external food data as JSON to mealtype-log for one-time use
    const scannedFoodData = JSON.stringify({
      barcode: cacheRow.barcode,
      product_name: cacheRow.product_name,
      brand: cacheRow.brand,
      energy_kcal_100g: cacheRow.energy_kcal_100g,
      protein_100g: cacheRow.protein_100g,
      carbs_100g: cacheRow.carbs_100g,
      fat_100g: cacheRow.fat_100g,
      fiber_100g: cacheRow.fiber_100g,
      saturated_fat_100g: cacheRow.saturated_fat_100g,
      sugars_100g: cacheRow.sugars_100g,
      sodium_100g: cacheRow.sodium_100g,
      serving_size: cacheRow.serving_size,
    });

    router.replace({
      pathname: '/(tabs)/mealtype-log',
      params: {
        mealType: mealType || 'breakfast',
        entryDate: entryDate,
        scannedFoodData: scannedFoodData,
      },
    });
  };

  const handleCreateManualFood = () => {
    // Navigate to create custom food with barcode pre-filled
    router.push({
      pathname: '/create-custom-food',
      params: {
        mealType: mealType || 'breakfast',
        entryDate: entryDate,
        scannedBarcode: barcode,
      },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <BlockingBrandedLoader enabled={true} timeoutMs={5000} />
      </View>
    );
  }

  // Render based on lookup result
  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
        {/* Result display based on status */}
        {lookupResult && renderResult(lookupResult)}
      </ScrollView>
    </ThemedView>
  );

  function renderResult(result: BarcodeLookupResult) {
    switch (result.status) {
      case 'found_food_master':
        return renderFoodMasterResult(result);
      case 'found_cache':
      case 'found_openfoodfacts':
        return renderExternalResult(result);
      case 'not_found':
        return renderNotFound(result);
      case 'invalid_barcode':
        return renderInvalidBarcode(result);
      default:
        return renderNotFound(result as any);
    }
  }

  function renderFoodMasterResult(result: Extract<BarcodeLookupResult, { status: 'found_food_master' }>) {
    const { food } = result;
    
    return (
      <>
        {/* Success Icon */}
        <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' + '20' }]}>
          <IconSymbol name="checkmark.circle.fill" size={48} color="#4CAF50" />
        </View>

        <ThemedText style={styles.successText}>
          {t('scanned_item.found_in_database')}
        </ThemedText>

        {/* Product info */}
        <View style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <ThemedText style={styles.productName}>{food.name}</ThemedText>
          {food.brand && (
            <ThemedText style={[styles.productBrand, { color: colors.textSecondary }]}>
              {food.brand}
            </ThemedText>
          )}
          
          <View style={styles.nutritionGrid}>
            <NutritionItem label={t('nutrition.calories')} value={`${food.calories_kcal}`} unit={t('units.kcal')} colors={colors} />
            <NutritionItem label={t('nutrition.protein')} value={`${food.protein_g}`} unit="g" colors={colors} />
            <NutritionItem label={t('nutrition.carbs')} value={`${food.carbs_g}`} unit="g" colors={colors} />
            <NutritionItem label={t('nutrition.fat')} value={`${food.fat_g}`} unit="g" colors={colors} />
          </View>

          <ThemedText style={[styles.servingInfo, { color: colors.textSecondary }]}>
            {t('scanned_item.per_serving')} {food.serving_size} {food.serving_unit}
          </ThemedText>
        </View>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.ean13_code')}
          </ThemedText>
          <ThemedText style={[styles.barcodeValue, { color: colors.text }]}>
            {formatBarcodeForDisplay(result.normalizedBarcode)}
          </ThemedText>
        </View>

        {/* Actions */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.tint }]}
            onPress={() => handleUseCanonicalFood(food.id)}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              t('scanned_item.log_it'),
              t('scanned_item.log_it_hint')
            )}
          >
            <ThemedText style={styles.primaryButtonText}>
              {t('scanned_item.log_it')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.textSecondary }]}>
              {t('common.go_back')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderExternalResult(
    result: Extract<BarcodeLookupResult, { status: 'found_cache' | 'found_openfoodfacts' }>
  ) {
    const { cacheRow, normalizedBarcode } = result;
    
    // Calculate nutrition for 100g display
    const nutrition = calculateNutritionForServing(cacheRow, 100);

    // Format source name for display (capitalize properly)
    const formatSourceName = (source: string | null): string => {
      if (!source) return 'OpenFoodFacts';
      // Handle common source names with proper capitalization
      const sourceLower = source.toLowerCase();
      if (sourceLower === 'openfoodfacts') return 'OpenFoodFacts';
      // Otherwise capitalize first letter of each word
      return source
        .split(/[\s_-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    const sourceName = formatSourceName(cacheRow.source);

    return (
      <>
        {/* Success Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
          <IconSymbol name="checkmark.circle.fill" size={48} color={colors.tint} />
        </View>

        <View style={styles.foundOnContainer}>
          <ThemedText style={styles.foundOnText}>
            {t('scanned_item.found_on')}{' '}
          </ThemedText>
          <View style={[styles.sourceBadge, { backgroundColor: colors.tint + '20' }]}>
            <ThemedText style={[styles.sourceBadgeText, { color: colors.tint }]}>
              {sourceName}
            </ThemedText>
          </View>
        </View>

        {/* Show message if user already saved this as custom food */}
        {alreadySavedAsCustom && existingCustomFoodName && (
          <View style={[styles.alreadySavedContainer, { backgroundColor: colors.tint + '15' }]}>
            <IconSymbol name="checkmark.circle.fill" size={18} color={colors.tint} />
            <ThemedText style={[styles.alreadySavedText, { color: colors.tint }]}>
              {t('scanned_item.already_saved_as_custom')}
            </ThemedText>
          </View>
        )}

        {/* Product info */}
        <View style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <ThemedText style={styles.productName}>
            {cacheRow.product_name || t('scanned_item.unknown_product')}
          </ThemedText>
          {cacheRow.brand && (
            <ThemedText style={[styles.productBrand, { color: colors.icon }]}>
              {cacheRow.brand}
            </ThemedText>
          )}
          
          <View style={styles.nutritionGrid}>
            <NutritionItem 
              label={t('nutrition.calories')} 
              value={nutrition.calories.toString()} 
              unit={t('units.kcal')} 
              colors={colors} 
            />
            <NutritionItem 
              label={t('nutrition.protein')} 
              value={nutrition.protein.toString()} 
              unit="g" 
              colors={colors} 
            />
            <NutritionItem 
              label={t('nutrition.carbs')} 
              value={nutrition.carbs.toString()} 
              unit="g" 
              colors={colors} 
            />
            <NutritionItem 
              label={t('nutrition.fat')} 
              value={nutrition.fat.toString()} 
              unit="g" 
              colors={colors} 
            />
          </View>

          <ThemedText style={[styles.servingInfo, { color: colors.textSecondary }]}>
            {t('scanned_item.per_100g')}
          </ThemedText>

          {cacheRow.serving_size && (
            <ThemedText style={[styles.servingSizeHint, { color: colors.textSecondary }]}>
              {t('scanned_item.typical_serving')}: {cacheRow.serving_size}
            </ThemedText>
          )}
        </View>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.ean13_code')}
          </ThemedText>
          <ThemedText style={[styles.barcodeValue, { color: colors.text }]}>
            {formatBarcodeForDisplay(normalizedBarcode)}
          </ThemedText>
        </View>

        {/* Save error */}
        {saveError && (
          <View style={[styles.errorContainer, { backgroundColor: '#ffebee' }]}>
            <ThemedText style={styles.errorText}>{saveError}</ThemedText>
          </View>
        )}

        {/* Actions */}
        <View style={styles.buttonsContainer}>
          {/* Primary: Save as Custom and Log Food OR Log existing Custom food */}
          <TouchableOpacity
            style={[
              styles.primaryButton, 
              { 
                backgroundColor: isSaving ? colors.tint + '80' : colors.tint,
              }
            ]}
            onPress={handleSaveAsCustomAndLog}
            disabled={isSaving}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              alreadySavedAsCustom 
                ? t('scanned_item.log_existing_custom')
                : t('scanned_item.save_and_log'),
              alreadySavedAsCustom
                ? t('scanned_item.log_existing_custom_hint')
                : t('scanned_item.save_and_log_hint')
            )}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {alreadySavedAsCustom 
                  ? t('scanned_item.log_existing_custom')
                  : t('scanned_item.save_and_log')}
              </ThemedText>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.textSecondary }]}>
              {t('common.cancel')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderNotFound(result: Extract<BarcodeLookupResult, { status: 'not_found' }>) {
    return (
      <>
        {/* Not Found Icon */}
        <View style={[styles.iconContainer, { backgroundColor: '#FF9800' + '20' }]}>
          <IconSymbol name="questionmark.circle.fill" size={48} color="#FF9800" />
        </View>

        <ThemedText style={styles.notFoundText}>
          {t('scanned_item.not_found_title')}
        </ThemedText>

        <ThemedText style={[styles.notFoundDescription, { color: colors.textSecondary }]}>
          {t('scanned_item.not_found_description', 
            'This product was not found in our databases.'
          )}
        </ThemedText>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.scanned_barcode')}
          </ThemedText>
          <ThemedText style={[styles.barcodeValue, { color: colors.text }]}>
            {formatBarcodeForDisplay(result.normalizedBarcode)}
          </ThemedText>
        </View>

        {/* Actions */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.textSecondary }]}>
              {t('common.go_back')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderInvalidBarcode(result: Extract<BarcodeLookupResult, { status: 'invalid_barcode' }>) {
    return (
      <>
        {/* Error Icon */}
        <View style={[styles.iconContainer, { backgroundColor: '#f44336' + '20' }]}>
          <IconSymbol name="xmark.circle.fill" size={48} color="#f44336" />
        </View>

        <ThemedText style={styles.errorTitle}>
          {t('scanned_item.invalid_barcode_title')}
        </ThemedText>

        <ThemedText style={[styles.errorDescription, { color: colors.textSecondary }]}>
          {result.error}
        </ThemedText>

        {/* Raw code */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.scanned_code')}
          </ThemedText>
          <ThemedText style={[styles.barcodeRaw, { color: colors.text }]}>
            {result.rawCode}
          </ThemedText>
        </View>

        {/* Actions */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.tint }]}
            onPress={handleScanAnother}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.primaryButtonText}>
              {t('scanned_item.try_again')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.textSecondary }]}>
              {t('common.go_back')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </>
    );
  }
}

// ============================================================================
// Helper Components
// ============================================================================

function NutritionItem({ 
  label, 
  value, 
  unit, 
  colors 
}: { 
  label: string; 
  value: string; 
  unit: string;
  colors: any;
}) {
  return (
    <View style={styles.nutritionItem}>
      <ThemedText style={[styles.nutritionValue, { color: colors.text }]}>
        {value}
        <ThemedText style={[styles.nutritionUnit, { color: colors.textSecondary }]}> {unit}</ThemedText>
      </ThemedText>
      <ThemedText style={[styles.nutritionLabel, { color: colors.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  barcodeSmall: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 8,
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  notFoundText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  notFoundDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#f44336',
  },
  errorDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  foundOnContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  foundOnText: {
    fontSize: 20,
    fontWeight: '700',
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
  },
  sourceBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sourceTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  sourceTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productCard: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  productBrand: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  nutritionItem: {
    alignItems: 'center',
    width: '25%',
    paddingVertical: 8,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  nutritionUnit: {
    fontSize: 12,
    fontWeight: '400',
  },
  nutritionLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  servingInfo: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  servingSizeHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  barcodeContainer: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  barcodeLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  barcodeValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  barcodeRaw: {
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonsContainer: {
    width: '100%',
    gap: 8,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  textButtonText: {
    fontSize: 14,
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  errorContainer: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  alreadySavedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  alreadySavedText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
