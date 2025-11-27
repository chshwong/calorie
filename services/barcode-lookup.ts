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
import { normalizeBarcode, BarcodeError } from '@/lib/barcode';
import { fetchProductByBarcode, OpenFoodFactsProduct, sodiumGramsToMg } from './openfoodfacts';

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
  sugars_100g: number | null;
  fiber_100g: number | null;
  sodium_100g: number | null;
  serving_size: string | null;
  raw_payload: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  last_fetched_at: string | null;
  times_scanned: number;
  promoted_food_master_id: string | null;
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
  // Step 1: Normalize the barcode
  let normalizedBarcode: string;
  try {
    normalizedBarcode = normalizeBarcode(rawCode);
  } catch (error) {
    if (error instanceof BarcodeError) {
      return {
        status: 'invalid_barcode',
        source: 'none',
        rawCode,
        error: error.message,
      };
    }
    return {
      status: 'invalid_barcode',
      source: 'none',
      rawCode,
      error: 'Invalid barcode format',
    };
  }
  
  console.log(`[BarcodeLookup] Normalized barcode: ${normalizedBarcode}`);
  
  // Step 2: Check food_master for canonical match
  const foodMasterResult = await lookupFoodMaster(normalizedBarcode);
  if (foodMasterResult) {
    console.log(`[BarcodeLookup] Found in food_master: ${foodMasterResult.name}`);
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
    
    if (!isStale) {
      console.log(`[BarcodeLookup] Found in cache (fresh): ${cacheResult.product_name}`);
      // Update times_scanned
      await incrementCacheScanCount(cacheResult.id);
      return {
        status: 'found_cache',
        source: 'external_food_cache',
        cacheRow: cacheResult,
        normalizedBarcode,
        isStale: false,
      };
    }
    
    console.log(`[BarcodeLookup] Cache is stale, will refresh from OFF`);
  }
  
  // Step 4: Fetch from OpenFoodFacts
  console.log(`[BarcodeLookup] Fetching from OpenFoodFacts...`);
  const offResult = await fetchProductByBarcode(normalizedBarcode);
  
  if (!offResult.found) {
    console.log(`[BarcodeLookup] Not found in OpenFoodFacts`);
    return {
      status: 'not_found',
      source: 'none',
      normalizedBarcode,
      error: offResult.error,
    };
  }
  
  // Step 5: Upsert into cache
  console.log(`[BarcodeLookup] Caching OpenFoodFacts result`);
  const cachedRow = await upsertExternalCache(normalizedBarcode, offResult.product, cacheResult);
  
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
      sugar_g,
      sodium_mg,
      serving_size,
      serving_unit,
      source,
      is_custom,
      barcode
    `)
    .eq('barcode', normalizedBarcode)
    .limit(1)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as FoodMasterMatch;
}

/**
 * Looks up a barcode in the external_food_cache table.
 */
async function lookupExternalCache(
  normalizedBarcode: string
): Promise<ExternalFoodCacheRow | null> {
  const { data, error } = await supabase
    .from('external_food_cache')
    .select('*')
    .eq('barcode', normalizedBarcode)
    .eq('source', 'openfoodfacts')
    .limit(1)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as ExternalFoodCacheRow;
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
 */
async function incrementCacheScanCount(cacheId: string): Promise<void> {
  await supabase.rpc('increment_cache_scan_count', { cache_id: cacheId }).catch(() => {
    // Fallback: direct update if RPC doesn't exist
    supabase
      .from('external_food_cache')
      .update({ times_scanned: supabase.rpc('increment', { x: 1 }) as any })
      .eq('id', cacheId);
  });
  
  // Simple fallback
  const { data: current } = await supabase
    .from('external_food_cache')
    .select('times_scanned')
    .eq('id', cacheId)
    .single();
  
  if (current) {
    await supabase
      .from('external_food_cache')
      .update({ times_scanned: (current.times_scanned || 0) + 1 })
      .eq('id', cacheId);
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
    barcode: normalizedBarcode,
    source: 'openfoodfacts',
    source_food_id: product.sourceId,
    product_name: product.productName,
    brand: product.brand,
    energy_kcal_100g: product.energyKcal100g,
    protein_100g: product.protein100g,
    carbs_100g: product.carbs100g,
    fat_100g: product.fat100g,
    saturated_fat_100g: product.saturatedFat100g,
    sugars_100g: product.sugars100g,
    fiber_100g: product.fiber100g,
    sodium_100g: product.sodium100g,
    serving_size: product.servingSize,
    raw_payload: product.rawPayload,
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
    } as ExternalFoodCacheRow;
  }
  
  return data as ExternalFoodCacheRow;
}

// ============================================================================
// Promotion Functions
// ============================================================================

/**
 * Promotes an external food cache entry to a food_master entry.
 * Creates a new food_master row and links it via promoted_food_master_id.
 * 
 * @param cacheRow - The external_food_cache row to promote
 * @param userId - The user creating the custom food
 * @param overrides - Optional overrides for the food_master fields
 * @returns The new food_master row ID
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
  // Default serving: 100g since cache data is per 100g
  const servingSize = overrides?.serving_size ?? 100;
  const servingUnit = overrides?.serving_unit ?? 'g';
  
  // Create food_master entry
  const { data: newFood, error: insertError } = await supabase
    .from('food_master')
    .insert({
      name: overrides?.name ?? cacheRow.product_name ?? 'Unknown Product',
      brand: overrides?.brand ?? cacheRow.brand,
      barcode: cacheRow.barcode,
      calories_kcal: cacheRow.energy_kcal_100g ?? 0,
      protein_g: cacheRow.protein_100g ?? 0,
      carbs_g: cacheRow.carbs_100g ?? 0,
      fat_g: cacheRow.fat_100g ?? 0,
      fiber_g: cacheRow.fiber_100g,
      saturated_fat_g: cacheRow.saturated_fat_100g,
      sugar_g: cacheRow.sugars_100g,
      sodium_mg: cacheRow.sodium_100g ? sodiumGramsToMg(cacheRow.sodium_100g) : null,
      serving_size: servingSize,
      serving_unit: servingUnit,
      source: 'openfoodfacts',
      is_custom: true,
      owner_user_id: userId,
    })
    .select('id')
    .single();
  
  if (insertError || !newFood) {
    console.error('[BarcodeLookup] Failed to create food_master:', insertError);
    return {
      success: false,
      error: insertError?.message || 'Failed to create food entry',
    };
  }
  
  // Update cache with promoted_food_master_id
  await supabase
    .from('external_food_cache')
    .update({ promoted_food_master_id: newFood.id })
    .eq('id', cacheRow.id);
  
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
    sugar: cache.sugars_100g ? Math.round(cache.sugars_100g * factor * 10) / 10 : null,
    sodium_mg: cache.sodium_100g ? Math.round(cache.sodium_100g * 1000 * factor) : null,
  };
}

