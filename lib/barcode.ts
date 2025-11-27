/**
 * Barcode validation and normalization utilities.
 * 
 * This module handles barcode validation and conversion between formats:
 * - UPC-A (12 digits) -> EAN-13 (13 digits) by adding leading zero
 * - EAN-13 (13 digits) -> kept as-is
 * 
 * Following engineering guidelines: domain logic in plain TS, no React/browser imports.
 */

export type BarcodeValidationResult = {
  isValid: boolean;
  rawCode: string;
  normalizedCode: string | null;
  error: string | null;
  format: 'UPC-A' | 'EAN-13' | 'unknown';
};

/**
 * Validates and normalizes a barcode string.
 * 
 * @param rawCode - The raw barcode string from scanner
 * @returns Validation result with normalized 13-digit code if valid
 * 
 * Rules:
 * - Must be exactly 12 or 13 digits
 * - 12-digit codes (UPC-A) are normalized to 13-digit (EAN-13) by adding leading 0
 * - Non-numeric characters are rejected
 */
export function validateAndNormalizeBarcode(rawCode: string): BarcodeValidationResult {
  // Remove any whitespace
  const cleanCode = rawCode.trim();
  
  // Check if it's numeric only
  if (!/^\d+$/.test(cleanCode)) {
    return {
      isValid: false,
      rawCode,
      normalizedCode: null,
      error: 'Barcode must contain only numbers',
      format: 'unknown',
    };
  }
  
  // Check length
  if (cleanCode.length === 12) {
    // UPC-A format - add leading zero to convert to EAN-13
    return {
      isValid: true,
      rawCode,
      normalizedCode: '0' + cleanCode,
      error: null,
      format: 'UPC-A',
    };
  }
  
  if (cleanCode.length === 13) {
    // Already EAN-13 format
    return {
      isValid: true,
      rawCode,
      normalizedCode: cleanCode,
      error: null,
      format: 'EAN-13',
    };
  }
  
  // Invalid length
  return {
    isValid: false,
    rawCode,
    normalizedCode: null,
    error: `Invalid barcode length: ${cleanCode.length} digits. Expected 12 (UPC-A) or 13 (EAN-13) digits.`,
    format: 'unknown',
  };
}

/**
 * Checks if a string looks like a valid barcode (12 or 13 digits).
 * Quick validation without full normalization.
 */
export function isValidBarcodeFormat(code: string): boolean {
  const cleanCode = code.trim();
  return /^\d{12,13}$/.test(cleanCode);
}

/**
 * Formats a barcode for display with visual grouping.
 * EAN-13: X XXXXXX XXXXXX (1-6-6 grouping)
 */
export function formatBarcodeForDisplay(code: string): string {
  const cleanCode = code.trim();
  if (cleanCode.length === 13) {
    return `${cleanCode[0]} ${cleanCode.slice(1, 7)} ${cleanCode.slice(7)}`;
  }
  if (cleanCode.length === 12) {
    // Display as UPC-A: XXXXXX XXXXXX
    return `${cleanCode.slice(0, 6)} ${cleanCode.slice(6)}`;
  }
  return cleanCode;
}

