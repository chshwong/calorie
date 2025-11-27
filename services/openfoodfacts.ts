/**
 * OpenFoodFacts API Service
 * 
 * Handles fetching product data from the OpenFoodFacts API.
 * All nutrition values returned are per 100g/ml.
 * 
 * Following engineering guidelines:
 * - Data access through service layer
 * - No React/browser imports
 * - Platform-agnostic (works on web and native)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed product data from OpenFoodFacts, normalized for our use.
 * All nutrition values are per 100g/ml.
 */
export type OpenFoodFactsProduct = {
  /** The barcode used to fetch this product */
  barcode: string;
  /** OpenFoodFacts internal code (usually same as barcode) */
  sourceId: string;
  /** Product name */
  productName: string | null;
  /** Brand name */
  brand: string | null;
  /** Energy in kcal per 100g/ml */
  energyKcal100g: number | null;
  /** Protein in grams per 100g/ml */
  protein100g: number | null;
  /** Carbohydrates in grams per 100g/ml */
  carbs100g: number | null;
  /** Fat in grams per 100g/ml */
  fat100g: number | null;
  /** Saturated fat in grams per 100g/ml */
  saturatedFat100g: number | null;
  /** Sugars in grams per 100g/ml */
  sugars100g: number | null;
  /** Fiber in grams per 100g/ml */
  fiber100g: number | null;
  /** Sodium in grams per 100g/ml (note: OFF uses grams, not mg) */
  sodium100g: number | null;
  /** Raw serving size text from OFF, e.g., "250 ml" */
  servingSize: string | null;
  /** Full raw JSON payload for debugging/future use */
  rawPayload: Record<string, any>;
};

export type OpenFoodFactsResult = 
  | { found: true; product: OpenFoodFactsProduct }
  | { found: false; error: string };

// ============================================================================
// API Configuration
// ============================================================================

const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2';

// User agent is required by OpenFoodFacts API
const USER_AGENT = 'CalorieTracker/1.0 (https://github.com/your-repo)';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches a product from OpenFoodFacts by barcode.
 * 
 * @param barcode - Normalized 13-digit EAN-13 barcode
 * @returns Product data if found, or error information
 */
export async function fetchProductByBarcode(
  barcode: string
): Promise<OpenFoodFactsResult> {
  const url = `${OFF_API_BASE}/product/${barcode}.json`;
  
  console.log(`[OpenFoodFacts] Fetching product: ${barcode}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[OpenFoodFacts] HTTP error: ${response.status}`);
      return {
        found: false,
        error: `OpenFoodFacts API error: ${response.status} ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    
    // Check if product was found
    if (data.status !== 1 || !data.product) {
      console.log(`[OpenFoodFacts] Product not found: ${barcode}`);
      return {
        found: false,
        error: 'Product not found in OpenFoodFacts database',
      };
    }
    
    const product = data.product;
    const nutriments = product.nutriments || {};
    
    // Parse and normalize the product data
    const parsedProduct: OpenFoodFactsProduct = {
      barcode,
      sourceId: product.code || barcode,
      productName: product.product_name || product.product_name_en || null,
      brand: product.brands || null,
      
      // Nutrition per 100g/ml - OpenFoodFacts field names
      energyKcal100g: parseNumericField(nutriments['energy-kcal_100g']),
      protein100g: parseNumericField(nutriments.proteins_100g),
      carbs100g: parseNumericField(nutriments.carbohydrates_100g),
      fat100g: parseNumericField(nutriments.fat_100g),
      saturatedFat100g: parseNumericField(nutriments['saturated-fat_100g']),
      sugars100g: parseNumericField(nutriments.sugars_100g),
      fiber100g: parseNumericField(nutriments.fiber_100g),
      sodium100g: parseNumericField(nutriments.sodium_100g),
      
      servingSize: product.serving_size || null,
      rawPayload: data,
    };
    
    console.log(`[OpenFoodFacts] Found product: ${parsedProduct.productName}`);
    
    return {
      found: true,
      product: parsedProduct,
    };
    
  } catch (error: any) {
    console.error(`[OpenFoodFacts] Fetch error:`, error);
    return {
      found: false,
      error: `Failed to fetch from OpenFoodFacts: ${error.message || 'Network error'}`,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parses a numeric field from OpenFoodFacts data.
 * Returns null if the value is undefined, null, or not a valid number.
 */
function parseNumericField(value: any): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  const num = typeof value === 'number' ? value : parseFloat(value);
  
  if (isNaN(num)) {
    return null;
  }
  
  // Round to reasonable precision (2 decimal places)
  return Math.round(num * 100) / 100;
}

/**
 * Converts sodium from grams to milligrams.
 * OpenFoodFacts stores sodium in grams, but our app may want mg.
 */
export function sodiumGramsToMg(sodiumGrams: number | null): number | null {
  if (sodiumGrams === null) return null;
  return Math.round(sodiumGrams * 1000);
}

