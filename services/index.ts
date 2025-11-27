/**
 * Services Index
 * 
 * Central exports for all service modules.
 * Services handle data access and external API integrations.
 * 
 * Following engineering guidelines:
 * - All Supabase calls through service layer
 * - External API integrations isolated in services
 * - No React/browser imports in services
 */

// Barcode lookup and validation
export {
  handleScannedBarcode,
  promoteToFoodMaster,
  calculateNutritionForServing,
  type BarcodeLookupResult,
  type FoodMasterMatch,
  type ExternalFoodCacheRow,
} from './barcode-lookup';

// OpenFoodFacts API
export {
  fetchProductByBarcode,
  sodiumGramsToMg,
  type OpenFoodFactsProduct,
  type OpenFoodFactsResult,
} from './openfoodfacts';

