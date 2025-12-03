import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
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
} from '@/services/barcode-lookup';
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
    } catch (error: any) {
      console.error('Lookup error:', error);
      setLookupResult({
        status: 'not_found',
        source: 'none',
        normalizedBarcode: code,
        error: error.message || 'Lookup failed',
      });
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
      pathname: '/mealtype-log',
      params: {
        mealType: mealType || 'breakfast',
        entryDate: entryDate || new Date().toISOString().split('T')[0],
        openBarcodeScanner: 'true',
      },
    });
  };

  // Use canonical food from food_master - navigate back with auto-select
  const handleUseCanonicalFood = (foodId: string) => {
    router.replace({
      pathname: '/mealtype-log',
      params: {
        mealType: mealType || 'breakfast',
        entryDate: entryDate,
        selectedFoodId: foodId,
      },
    });
  };

  // Save external food as custom food (promote to food_master), then auto-select
  // Save as Custom and Log Food - promotes to food_master and auto-selects for logging
  const handleSaveAsCustomAndLog = async () => {
    // Prevent multiple submissions
    if (isSaving) {
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
      const cacheRow = lookupResult.cacheRow;
      const result = await promoteToFoodMaster(cacheRow, user.id);
      
      if (result.success) {
        // Invalidate custom foods cache immediately so it appears right away
        queryClient.invalidateQueries({ queryKey: ['customFoods', user.id] });
        
        // Navigate back to meal log with auto-select of the new food (this will open the entry form)
        router.replace({
          pathname: '/mealtype-log',
          params: {
            mealType: mealType || 'breakfast',
            entryDate: entryDate,
            refreshCustomFoods: Date.now().toString(),
            selectedFoodId: result.foodMasterId,
          },
        });
      } else {
        setSaveError(result.error);
        setIsSaving(false);
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save food');
      setIsSaving(false);
    }
  };

  // 1-time Log (Manual) - opens manual mode with prefilled data
  const handleLogAsManual = () => {
    if (!lookupResult) return;
    
    if (lookupResult.status !== 'found_cache' && lookupResult.status !== 'found_openfoodfacts') {
      return;
    }

    const cacheRow = lookupResult.cacheRow;
    
    // Convert cache data (per 100g) to a standard serving for manual entry
    // Default to 100g serving
    const servingGrams = 100;
    const nutrition = calculateNutritionForServing(cacheRow, servingGrams);
    
    // Pass manual entry data as JSON - this will trigger manual mode with prefilled form
    const manualEntryData = JSON.stringify({
      item_name: cacheRow.product_name || 'Scanned Product',
      quantity: servingGrams,
      unit: 'g',
      calories_kcal: nutrition.calories,
      protein_g: nutrition.protein,
      carbs_g: nutrition.carbs,
      fat_g: nutrition.fat,
      fiber_g: nutrition.fiber,
      saturated_fat_g: null, // Not available from cache calculation
      sugar_g: nutrition.sugar,
      sodium_mg: nutrition.sodium_mg,
      brand: cacheRow.brand || null,
      barcode: cacheRow.barcode,
    });

    router.replace({
      pathname: '/mealtype-log',
      params: {
        mealType: mealType || 'breakfast',
        entryDate: entryDate,
        manualEntryData: manualEntryData,
        openManualMode: 'true',
      },
    });
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
      pathname: '/mealtype-log',
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
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.text }]}>
            {t('scanned_item.looking_up', 'Looking up product...')}
          </ThemedText>
          <ThemedText style={[styles.barcodeSmall, { color: colors.textSecondary }]}>
            {formatBarcodeForDisplay(barcode || '')}
          </ThemedText>
        </View>
      </ThemedView>
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
          {t('scanned_item.found_in_database', 'Found in Database!')}
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
            <NutritionItem label={t('nutrition.calories', 'Calories')} value={`${food.calories_kcal}`} unit="kcal" colors={colors} />
            <NutritionItem label={t('nutrition.protein', 'Protein')} value={`${food.protein_g}`} unit="g" colors={colors} />
            <NutritionItem label={t('nutrition.carbs', 'Carbs')} value={`${food.carbs_g}`} unit="g" colors={colors} />
            <NutritionItem label={t('nutrition.fat', 'Fat')} value={`${food.fat_g}`} unit="g" colors={colors} />
          </View>

          <ThemedText style={[styles.servingInfo, { color: colors.textSecondary }]}>
            {t('scanned_item.per_serving', 'Per')} {food.serving_size} {food.serving_unit}
          </ThemedText>
        </View>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.ean13_code', 'EAN-13 Code')}
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
              t('scanned_item.log_it', 'Log it'),
              t('scanned_item.log_it_hint', 'Add this food to your meal')
            )}
          >
            <ThemedText style={styles.primaryButtonText}>
              {t('scanned_item.log_it', 'Log it')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.textSecondary }]}>
              {t('common.go_back', 'Go Back')}
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
            {t('scanned_item.found_on', 'Found on')}{' '}
          </ThemedText>
          <View style={[styles.sourceBadge, { backgroundColor: colors.tint + '20' }]}>
            <ThemedText style={[styles.sourceBadgeText, { color: colors.tint }]}>
              {sourceName}
            </ThemedText>
          </View>
        </View>

        {/* Product info */}
        <View style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <ThemedText style={styles.productName}>
            {cacheRow.product_name || t('scanned_item.unknown_product', 'Unknown Product')}
          </ThemedText>
          {cacheRow.brand && (
            <ThemedText style={[styles.productBrand, { color: colors.icon }]}>
              {cacheRow.brand}
            </ThemedText>
          )}
          
          <View style={styles.nutritionGrid}>
            <NutritionItem 
              label={t('nutrition.calories', 'Calories')} 
              value={nutrition.calories.toString()} 
              unit="kcal" 
              colors={colors} 
            />
            <NutritionItem 
              label={t('nutrition.protein', 'Protein')} 
              value={nutrition.protein.toString()} 
              unit="g" 
              colors={colors} 
            />
            <NutritionItem 
              label={t('nutrition.carbs', 'Carbs')} 
              value={nutrition.carbs.toString()} 
              unit="g" 
              colors={colors} 
            />
            <NutritionItem 
              label={t('nutrition.fat', 'Fat')} 
              value={nutrition.fat.toString()} 
              unit="g" 
              colors={colors} 
            />
          </View>

          <ThemedText style={[styles.servingInfo, { color: colors.textSecondary }]}>
            {t('scanned_item.per_100g', 'Per 100g/ml')}
          </ThemedText>

          {cacheRow.serving_size && (
            <ThemedText style={[styles.servingSizeHint, { color: colors.textSecondary }]}>
              {t('scanned_item.typical_serving', 'Typical serving')}: {cacheRow.serving_size}
            </ThemedText>
          )}
        </View>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.ean13_code', 'EAN-13 Code')}
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
          {/* Primary: Save as Custom and Log Food */}
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
              t('scanned_item.save_and_log', 'Save as Custom and Log Food'),
              t('scanned_item.save_and_log_hint', 'Save this food and log it in your meal')
            )}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {t('scanned_item.save_and_log', 'Save as Custom and Log Food')}
              </ThemedText>
            )}
          </TouchableOpacity>

          {/* Secondary: 1-time Log (Manual) */}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.tint }]}
            onPress={handleLogAsManual}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              t('scanned_item.log_as_manual', '1-time Log (Manual)'),
              t('scanned_item.log_as_manual_hint', 'Log this food once without saving it')
            )}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>
              {t('scanned_item.log_as_manual', '1-time Log (Manual)')}
            </ThemedText>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.textSecondary }]}>
              {t('common.cancel', 'Cancel')}
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
          {t('scanned_item.not_found_title', 'Product Not Found')}
        </ThemedText>

        <ThemedText style={[styles.notFoundDescription, { color: colors.textSecondary }]}>
          {t('scanned_item.not_found_description', 
            'This product was not found in our databases.'
          )}
        </ThemedText>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.scanned_barcode', 'Scanned Barcode')}
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
              {t('common.go_back', 'Go Back')}
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
          {t('scanned_item.invalid_barcode_title', 'Invalid Barcode')}
        </ThemedText>

        <ThemedText style={[styles.errorDescription, { color: colors.textSecondary }]}>
          {result.error}
        </ThemedText>

        {/* Raw code */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.textSecondary }]}>
            {t('scanned_item.scanned_code', 'Scanned Code')}
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
              {t('scanned_item.try_again', 'Try Again')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.textSecondary }]}>
              {t('common.go_back', 'Go Back')}
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
});
