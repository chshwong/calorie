/**
 * Barcode Lookup Service
 * 
 * Implements the full scan + lookup flow:
 * 1. Normalize barcode to 13-digit EAN-13
 * 2. Check food_master for canonical match
 * 3. Check external_food_cache for cached external data
 * 4. Fetch from OpenFoodFacts if not cached or stale
 * 5. Cache the result in external_food_cache
 * 
 * Following engineering guidelines:
 * - All Supabase calls through service layer
 * - Clear separation of concerns
 * - Typed return values
 */

import { supabase } from '@/lib/supabase';
import { normalizeBarcode, BarcodeError, normalizeBarcodeToEan13 } from '@/lib/barcode';
import { fetchProductByBarcode, OpenFoodFactsProduct, sodiumGramsToMg } from './openfoodfacts';
import { mapExternalFoodToBase } from '@/lib/food/mapExternalFoodToBase';

// ============================================================================
// Types
// ============================================================================

/** Food from food_master table */
export type FoodMasterMatch = {
  id: string;
  name: string;
  brand: string | null;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  serving_size: number;
  serving_unit: string;
  source: string | null;
  is_custom: boolean;
  barcode: string | null;
};

/** Cached external food from external_food_cache table */
export type ExternalFoodCacheRow = {
  id: string;
  barcode: string;
  source: string;
  source_food_id: string | null;
  product_name: string | null;
  brand: string | null;
  energy_kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  saturated_fat_100g: number | null;
  trans_fat_100g: number | null;
  sugars_100g: number | null;
  fiber_100g: number | null;
  sodium_100g: number | null;
  serving_size: string | null;
  created_at: string;
  updated_at: string;
  last_fetched_at: string | null;
  times_scanned: number;
  promoted_food_master_id: string | null;
  is_verified: boolean;
};

/** Result types for barcode lookup */
export type BarcodeLookupResult =
  | {
      status: 'found_food_master';
      source: 'food_master';
      food: FoodMasterMatch;
      normalizedBarcode: string;
    }
  | {
      status: 'found_cache';
      source: 'external_food_cache';
      cacheRow: ExternalFoodCacheRow;
      normalizedBarcode: string;
      isStale: boolean;
    }
  | {
      status: 'found_openfoodfacts';
      source: 'openfoodfacts';
      product: OpenFoodFactsProduct;
      cacheRow: ExternalFoodCacheRow;
      normalizedBarcode: string;
    }
  | {
      status: 'not_found';
      source: 'none';
      normalizedBarcode: string;
      error: string;
    }
  | {
      status: 'invalid_barcode';
      source: 'none';
      rawCode: string;
      error: string;
    };

// ============================================================================
// Configuration
// ============================================================================

/** Cache is considered stale after this many days */
const CACHE_STALE_DAYS = 30;

// ============================================================================
// Main Lookup Function
// ============================================================================

/**
 * Handles a scanned barcode through the full lookup flow.
 * 
 * Flow:
 * 1. Normalize the barcode to 13-digit EAN-13
 * 2. Check food_master for canonical match (by barcode)
 * 3. Check external_food_cache for cached external data
 * 4. If not cached or stale, fetch from OpenFoodFacts
 * 5. Cache the result
 * 
 * @param rawCode - Raw barcode string from scanner
 * @returns Lookup result with product data or error
 */
export async function handleScannedBarcode(
  rawCode: string
): Promise<BarcodeLookupResult> {
  // Step 1: Normalize the barcode using strict EAN-13 normalization
  const normalizeResult = normalizeBarcodeToEan13(rawCode);
  
  if (!normalizeResult.ok) {
    let errorMessage = 'Invalid barcode format';
    if (normalizeResult.reason === 'empty') {
      errorMessage = 'Barcode is empty';
    } else if (normalizeResult.reason === 'non_numeric') {
      errorMessage = 'Barcode must contain only numbers';
    } else if (normalizeResult.reason === 'too_long') {
      errorMessage = 'Barcode cannot exceed 13 digits';
    }
    
    return {
      status: 'invalid_barcode',
      source: 'none',
      rawCode,
      error: errorMessage,
    };
  }
  
  const normalizedBarcode = normalizeResult.value;
  
  // Step 2: Check food_master for canonical match
  const foodMasterResult = await lookupFoodMaster(normalizedBarcode);
  if (foodMasterResult) {
    return {
      status: 'found_food_master',
      source: 'food_master',
      food: foodMasterResult,
      normalizedBarcode,
    };
  }
  
  // Step 3: Check external_food_cache
  const cacheResult = await lookupExternalCache(normalizedBarcode);
  if (cacheResult) {
    const isStale = isCacheStale(cacheResult.last_fetched_at);
    
    if (isStale) {
      // Even if stale, return the cached data - user can refresh later if needed
      await incrementCacheScanCount(cacheResult.id);
      return {
        status: 'found_cache',
        source: 'external_food_cache',
        cacheRow: cacheResult,
        normalizedBarcode,
        isStale: true,
      };
    }
    
    // Fresh cache - return it
    await incrementCacheScanCount(cacheResult.id);
    return {
      status: 'found_cache',
      source: 'external_food_cache',
      cacheRow: cacheResult,
      normalizedBarcode,
      isStale: false,
    };
  }
  
  // Step 4: Fetch from OpenFoodFacts (only if no cache exists)
  const offResult = await fetchProductByBarcode(normalizedBarcode);
  
  if (!offResult.found) {
    return {
      status: 'not_found',
      source: 'none',
      normalizedBarcode,
      error: offResult.error || 'Product not found in OpenFoodFacts database',
    };
  }
  
  // Step 5: Upsert into cache
  const cachedRow = await upsertExternalCache(normalizedBarcode, offResult.product, null);
  
  return {
    status: 'found_openfoodfacts',
    source: 'openfoodfacts',
    product: offResult.product,
    cacheRow: cachedRow,
    normalizedBarcode,
  };
}

// ============================================================================
// Database Lookup Functions
// ============================================================================

/**
 * Looks up a barcode in the food_master table.
 */
async function lookupFoodMaster(
  normalizedBarcode: string
): Promise<FoodMasterMatch | null> {
  // Ensure barcode is trimmed and normalized for strict matching
  const cleanBarcode = normalizedBarcode.trim();
  
  const { data, error } = await supabase
    .from('food_master')
    .select(`
      id,
      name,
      brand,
      calories_kcal,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      saturated_fat_g,
      trans_fat_g,
      sugar_g,
      sodium_mg,
      serving_size,
      serving_unit,
      source,
      is_custom,
      barcode
    `)
    .eq('barcode', cleanBarcode)
    .eq('is_custom', false) // Only match canonical foods, not user-created custom foods
    .not('barcode', 'is', null) // Ensure barcode is not null
    .limit(1)
    .maybeSingle(); // Use maybeSingle() to avoid errors when no row exists
  
  // Handle errors (database errors, not "no row found")
  if (error) {
    // If it's a "not found" error, that's expected - return null
    if (error.code === 'PGRST116' || error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
      return null;
    }
    console.error('[BarcodeLookup] Error querying food_master:', error);
    return null;
  }
  
  // No data found
  if (!data) {
    return null;
  }
  
  // Verify the barcode actually matches (defensive check)
  if (data.barcode !== cleanBarcode) {
    return null;
  }
  
  return data as FoodMasterMatch;
}

/**
 * Looks up a barcode in the external_food_cache table.
 * Uses array-based query for more reliable results.
 */
async function lookupExternalCache(
  normalizedBarcode: string
): Promise<ExternalFoodCacheRow | null> {
  // Ensure barcode is trimmed for comparison
  const cleanBarcode = normalizedBarcode.trim();
  
  // Use array-based query (more reliable than maybeSingle)
  const { data: rows, error } = await supabase
    .from('external_food_cache')
    .select('*')
    .eq('barcode', cleanBarcode)
    .eq('source', 'openfoodfacts')
    .limit(1);
  
  // Handle errors
  if (error) {
    console.error('[BarcodeLookup] Error querying external_food_cache:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    
    // Try fallback query without source filter (in case source wasn't saved correctly)
    const fallbackResult = await supabase
      .from('external_food_cache')
      .select('*')
      .eq('barcode', cleanBarcode)
      .limit(1);
    
    if (fallbackResult.error) {
      console.error('[BarcodeLookup] Fallback query also failed:', fallbackResult.error);
      return null;
    }
    
    if (fallbackResult.data && fallbackResult.data.length > 0) {
      const row = fallbackResult.data[0] as ExternalFoodCacheRow;
      return row;
    }
    
    return null;
  }
  
  // Check if we got any rows
  if (!rows || rows.length === 0) {
    // Try fallback query without source filter
    const fallbackResult = await supabase
      .from('external_food_cache')
      .select('*')
      .eq('barcode', normalizedBarcode)
      .limit(1);
    
    if (!fallbackResult.error && fallbackResult.data && fallbackResult.data.length > 0) {
      const row = fallbackResult.data[0] as ExternalFoodCacheRow;
      return row;
    }
    
    return null;
  }
  
  // Found a row
  const row = rows[0] as ExternalFoodCacheRow;
  return row;
}

/**
 * Checks if a cache entry is stale based on last_fetched_at.
 */
function isCacheStale(lastFetchedAt: string | null): boolean {
  if (!lastFetchedAt) return true;
  
  const lastFetched = new Date(lastFetchedAt);
  const now = new Date();
  const diffDays = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60 * 24);
  
  return diffDays > CACHE_STALE_DAYS;
}

/**
 * Increments the times_scanned counter for a cache entry.
 * Uses direct update instead of RPC to avoid 404 errors when the RPC function doesn't exist.
 */
async function incrementCacheScanCount(cacheId: string): Promise<void> {
  // Use direct update (RPC function doesn't exist in database)
  const { data: current } = await supabase
    .from('external_food_cache')
    .select('times_scanned')
    .eq('id', cacheId)
    .maybeSingle();
  
  if (current) {
    const updateResult = await supabase
      .from('external_food_cache')
      .update({ times_scanned: (current.times_scanned || 0) + 1 })
      .eq('id', cacheId);
    
    if (updateResult.error) {
      // Only log actual errors, not expected "not found" cases
      console.error('[BarcodeLookup] Failed to increment scan count:', updateResult.error);
    }
  }
}

/**
 * Upserts a product into the external_food_cache.
 */
async function upsertExternalCache(
  normalizedBarcode: string,
  product: OpenFoodFactsProduct,
  existingRow: ExternalFoodCacheRow | null
): Promise<ExternalFoodCacheRow> {
  const now = new Date().toISOString();
  
  const upsertData = {
    barcode: normalizedBarcode.trim(), // Ensure no whitespace
    source: 'openfoodfacts',
    source_food_id: product.sourceId,
    product_name: product.productName,
    brand: product.brand,
    energy_kcal_100g: product.energyKcal100g,
    protein_100g: product.protein100g,
    carbs_100g: product.carbs100g,
    fat_100g: product.fat100g,
    saturated_fat_100g: product.saturatedFat100g,
    trans_fat_100g: product.transFat100g,
    sugars_100g: product.sugars100g,
    fiber_100g: product.fiber100g,
    sodium_100g: product.sodium100g,
    serving_size: product.servingSize,
    last_fetched_at: now,
    times_scanned: existingRow ? (existingRow.times_scanned || 0) + 1 : 1,
  };
  
  const { data, error } = await supabase
    .from('external_food_cache')
    .upsert(upsertData, {
      onConflict: 'barcode,source',
    })
    .select()
    .single();
  
  if (error) {
    console.error('[BarcodeLookup] Failed to upsert cache:', error);
    // Return a minimal object if upsert fails
    return {
      id: existingRow?.id || '',
      ...upsertData,
      created_at: existingRow?.created_at || now,
      updated_at: now,
      promoted_food_master_id: existingRow?.promoted_food_master_id || null,
      is_verified: existingRow?.is_verified ?? false,
    } as ExternalFoodCacheRow;
  }
  
  return data as ExternalFoodCacheRow;
}

// ============================================================================
// Existing Custom Food Lookup
// ============================================================================

/**
 * Checks if the user already has a custom food for the given barcode.
 * 
 * @param normalizedBarcode - The normalized 13-digit barcode
 * @param userId - The current user's ID
 * @returns The existing custom food ID and name if found, null otherwise
 */
export async function lookupExistingCustomFood(
  normalizedBarcode: string,
  userId: string
): Promise<{ id: string; name: string; brand: string | null } | null> {
  const cleanBarcode = normalizedBarcode.trim();
  
  const { data: existingCustom, error } = await supabase
    .from('food_master')
    .select('id, name, brand, barcode')
    .eq('barcode', cleanBarcode)
    .eq('owner_user_id', userId)
    .eq('is_custom', true)
    .limit(1)
    .maybeSingle();
  
  if (error) {
    // Log but don't break the flow - treat as "not found"
    console.warn('[BarcodeLookup] Error checking for existing custom food:', error);
    return null;
  }
  
  if (!existingCustom || !existingCustom.id) {
    return null;
  }
  
  return {
    id: existingCustom.id,
    name: existingCustom.name,
    brand: existingCustom.brand,
  };
}

// ============================================================================
// Promotion Functions
// ============================================================================

/**
 * Promotes an external food cache entry to a food_master entry.
 * Creates a new food_master row and links it via promoted_food_master_id.
 * 
 * This function is idempotent: if a custom food already exists for this barcode
 * and user, it will return the existing food ID instead of creating a duplicate.
 * 
 * @param cacheRow - The external_food_cache row to promote
 * @param userId - The user creating the custom food
 * @param overrides - Optional overrides for the food_master fields
 * @returns The new or existing food_master row ID
 */
export async function promoteToFoodMaster(
  cacheRow: ExternalFoodCacheRow,
  userId: string,
  overrides?: Partial<{
    name: string;
    brand: string;
    serving_size: number;
    serving_unit: string;
  }>
): Promise<{ success: true; foodMasterId: string } | { success: false; error: string }> {
  const normalizedBarcode = cacheRow.barcode.trim();
  
  // First, check if a custom food already exists for this barcode and user
  const existing = await lookupExistingCustomFood(normalizedBarcode, userId);
  if (existing) {
    // Custom food already exists - return it (idempotent behavior)
    return {
      success: true,
      foodMasterId: existing.id,
    };
  }
  
  // Default serving: 100g since cache data is per 100g
  const servingSize = overrides?.serving_size ?? 100;
  const servingUnit = overrides?.serving_unit ?? 'g';
  
  // Use shared mapping helper to convert external food to base format
  const base = mapExternalFoodToBase({
    externalFood: cacheRow,
    servingSize,
    servingUnit,
  });
  
  // Create food_master entry using the mapped values
  const { data: newFood, error: insertError } = await supabase
    .from('food_master')
    .insert({
      name: overrides?.name ?? base.name ?? 'Unknown Product',
      brand: overrides?.brand ?? base.brand,
      barcode: base.barcode,
      calories_kcal: base.calories_kcal ?? 0,
      protein_g: base.protein_g ?? 0,
      carbs_g: base.carbs_g ?? 0,
      fat_g: base.fat_g ?? 0,
      fiber_g: base.fiber_g,
      saturated_fat_g: base.saturated_fat_g,
      unsaturated_fat_g: base.unsaturated_fat_g,
      trans_fat_g: base.trans_fat_g,
      sugar_g: base.sugar_g,
      sodium_mg: base.sodium_mg,
      serving_size: base.serving_size,
      serving_unit: base.serving_unit,
      source: base.source || 'openfoodfacts',
      is_custom: true,
      owner_user_id: userId,
    })
    .select('id')
    .single();
  
  if (insertError || !newFood) {
    // Check if error is due to unique constraint violation (race condition)
    const isUniqueViolation = insertError?.code === '23505' || 
                              insertError?.message?.includes('duplicate key') ||
                              insertError?.message?.includes('unique constraint');
    
    if (isUniqueViolation) {
      // Race condition: another request created the custom food
      // Re-lookup and return the existing food
      const existingAfterConflict = await lookupExistingCustomFood(normalizedBarcode, userId);
      if (existingAfterConflict) {
        return {
          success: true,
          foodMasterId: existingAfterConflict.id,
        };
      }
    }
    
    console.error('[BarcodeLookup] Failed to create food_master:', insertError);
    return {
      success: false,
      error: insertError?.message || 'Failed to create food entry',
    };
  }
  
  // Note: We do NOT update promoted_food_master_id here.
  // This field is only set during admin promotion on the admin-only page.
  // Regular users creating custom foods should not populate this field.
  
  return {
    success: true,
    foodMasterId: newFood.id,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts cache nutrition data (per 100g) to a specific serving size.
 */
export function calculateNutritionForServing(
  cache: ExternalFoodCacheRow,
  servingGrams: number
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  saturated_fat: number | null;
  trans_fat: number | null;
  sugar: number | null;
  sodium_mg: number | null;
} {
  const factor = servingGrams / 100;
  
  return {
    calories: Math.round((cache.energy_kcal_100g ?? 0) * factor),
    protein: Math.round((cache.protein_100g ?? 0) * factor * 10) / 10,
    carbs: Math.round((cache.carbs_100g ?? 0) * factor * 10) / 10,
    fat: Math.round((cache.fat_100g ?? 0) * factor * 10) / 10,
    fiber: cache.fiber_100g ? Math.round(cache.fiber_100g * factor * 10) / 10 : null,
    saturated_fat: cache.saturated_fat_100g ? Math.round(cache.saturated_fat_100g * factor * 10) / 10 : null,
    trans_fat: cache.trans_fat_100g ? Math.round(cache.trans_fat_100g * factor * 10) / 10 : null,
    sugar: cache.sugars_100g ? Math.round(cache.sugars_100g * factor * 10) / 10 : null,
    sodium_mg: cache.sodium_100g ? Math.round(cache.sodium_100g * 1000 * factor) : null,
  };
}

