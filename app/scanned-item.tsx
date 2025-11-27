import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
    router.back();
  };

  const handleSaveAsCustomFood = async () => {
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
        // Navigate back to meal log - the food is now in food_master
        // and will appear in search results
        router.replace({
          pathname: '/mealtype-log',
          params: {
            mealType: mealType || 'breakfast',
            entryDate: entryDate,
            refreshCustomFoods: Date.now().toString(),
          },
        });
      } else {
        setSaveError(result.error);
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save food');
    } finally {
      setIsSaving(false);
    }
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
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <TouchableOpacity
            style={[styles.backButton, getMinTouchTargetStyle()]}
            onPress={handleGoBack}
            activeOpacity={0.6}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.text} decorative={true} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>
            {t('scanned_item.title', 'Scanned Item')}
          </ThemedText>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.text }]}>
            {t('scanned_item.looking_up', 'Looking up product...')}
          </ThemedText>
          <ThemedText style={[styles.barcodeSmall, { color: colors.icon }]}>
            {formatBarcodeForDisplay(barcode || '')}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Render based on lookup result
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          onPress={handleGoBack}
          activeOpacity={0.6}
          {...getButtonAccessibilityProps(
            t('common.go_back', 'Go back'),
            t('common.go_back_hint', 'Double tap to go back')
          )}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>
          {t('scanned_item.title', 'Scanned Item')}
        </ThemedText>
        <View style={styles.backButton} />
      </View>

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
          <IconSymbol name="checkmark.circle.fill" size={64} color="#4CAF50" />
        </View>

        <ThemedText style={styles.successText}>
          {t('scanned_item.found_in_database', 'Found in Database!')}
        </ThemedText>

        <View style={[styles.sourceTag, { backgroundColor: '#4CAF50' + '20' }]}>
          <ThemedText style={[styles.sourceTagText, { color: '#4CAF50' }]}>
            {t('scanned_item.source_canonical', 'Canonical Food')}
          </ThemedText>
        </View>

        {/* Product info */}
        <View style={[styles.productCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
          <ThemedText style={styles.productName}>{food.name}</ThemedText>
          {food.brand && (
            <ThemedText style={[styles.productBrand, { color: colors.icon }]}>
              {food.brand}
            </ThemedText>
          )}
          
          <View style={styles.nutritionGrid}>
            <NutritionItem label={t('nutrition.calories', 'Calories')} value={`${food.calories_kcal}`} unit="kcal" colors={colors} />
            <NutritionItem label={t('nutrition.protein', 'Protein')} value={`${food.protein_g}`} unit="g" colors={colors} />
            <NutritionItem label={t('nutrition.carbs', 'Carbs')} value={`${food.carbs_g}`} unit="g" colors={colors} />
            <NutritionItem label={t('nutrition.fat', 'Fat')} value={`${food.fat_g}`} unit="g" colors={colors} />
          </View>

          <ThemedText style={[styles.servingInfo, { color: colors.icon }]}>
            {t('scanned_item.per_serving', 'Per')} {food.serving_size} {food.serving_unit}
          </ThemedText>
        </View>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.icon }]}>
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
            onPress={() => {
              // TODO: Add this food to the meal
              router.back();
            }}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.primaryButtonText}>
              {t('scanned_item.add_to_meal', 'Add to Meal')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.tint }]}
            onPress={handleScanAnother}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>
              {t('scanned_item.scan_another', 'Scan Another')}
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
    const isFromOFF = result.status === 'found_openfoodfacts';
    
    // Calculate nutrition for 100g display
    const nutrition = calculateNutritionForServing(cacheRow, 100);

    return (
      <>
        {/* Success Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
          <IconSymbol name="checkmark.circle.fill" size={64} color={colors.tint} />
        </View>

        <ThemedText style={styles.successText}>
          {t('scanned_item.product_found', 'Product Found!')}
        </ThemedText>

        <View style={[styles.sourceTag, { backgroundColor: colors.tint + '20' }]}>
          <ThemedText style={[styles.sourceTagText, { color: colors.tint }]}>
            {isFromOFF 
              ? t('scanned_item.source_openfoodfacts', 'From OpenFoodFacts')
              : t('scanned_item.source_cached', 'Cached Data')
            }
          </ThemedText>
        </View>

        {/* Product info */}
        <View style={[styles.productCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
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

          <ThemedText style={[styles.servingInfo, { color: colors.icon }]}>
            {t('scanned_item.per_100g', 'Per 100g/ml')}
          </ThemedText>

          {cacheRow.serving_size && (
            <ThemedText style={[styles.servingSizeHint, { color: colors.icon }]}>
              {t('scanned_item.typical_serving', 'Typical serving')}: {cacheRow.serving_size}
            </ThemedText>
          )}
        </View>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.icon }]}>
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
          <TouchableOpacity
            style={[
              styles.primaryButton, 
              { backgroundColor: isSaving ? colors.tint + '80' : colors.tint }
            ]}
            onPress={handleSaveAsCustomFood}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {t('scanned_item.save_as_custom', 'Save as Custom Food')}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.tint }]}
            onPress={handleScanAnother}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>
              {t('scanned_item.scan_another', 'Scan Another')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <ThemedText style={[styles.infoText, { color: colors.icon }]}>
          {t('scanned_item.save_info', 'Saving will add this to your custom foods for easy access in the future.')}
        </ThemedText>
      </>
    );
  }

  function renderNotFound(result: Extract<BarcodeLookupResult, { status: 'not_found' }>) {
    return (
      <>
        {/* Not Found Icon */}
        <View style={[styles.iconContainer, { backgroundColor: '#FF9800' + '20' }]}>
          <IconSymbol name="questionmark.circle.fill" size={64} color="#FF9800" />
        </View>

        <ThemedText style={styles.notFoundText}>
          {t('scanned_item.not_found_title', 'Product Not Found')}
        </ThemedText>

        <ThemedText style={[styles.notFoundDescription, { color: colors.icon }]}>
          {t('scanned_item.not_found_description', 
            'This product was not found in our database or OpenFoodFacts. You can create a custom food entry with this barcode.'
          )}
        </ThemedText>

        {/* Barcode */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.icon }]}>
            {t('scanned_item.scanned_barcode', 'Scanned Barcode')}
          </ThemedText>
          <ThemedText style={[styles.barcodeValue, { color: colors.text }]}>
            {formatBarcodeForDisplay(result.normalizedBarcode)}
          </ThemedText>
        </View>

        {/* Actions */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.tint }]}
            onPress={handleCreateManualFood}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.primaryButtonText}>
              {t('scanned_item.create_custom', 'Create Custom Food')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.tint }]}
            onPress={handleScanAnother}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>
              {t('scanned_item.scan_another', 'Scan Another')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.textButtonText, { color: colors.icon }]}>
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
          <IconSymbol name="xmark.circle.fill" size={64} color="#f44336" />
        </View>

        <ThemedText style={styles.errorTitle}>
          {t('scanned_item.invalid_barcode_title', 'Invalid Barcode')}
        </ThemedText>

        <ThemedText style={[styles.errorDescription, { color: colors.icon }]}>
          {result.error}
        </ThemedText>

        {/* Raw code */}
        <View style={[styles.barcodeContainer, { borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.icon }]}>
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
            <ThemedText style={[styles.textButtonText, { color: colors.icon }]}>
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
        <ThemedText style={[styles.nutritionUnit, { color: colors.icon }]}> {unit}</ThemedText>
      </ThemedText>
      <ThemedText style={[styles.nutritionLabel, { color: colors.icon }]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    lineHeight: 20,
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
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  productBrand: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 12,
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
    marginTop: 16,
  },
  servingSizeHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  barcodeContainer: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
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
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
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
    paddingVertical: 16,
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
    paddingHorizontal: 16,
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
