/**
 * Barcode validation and normalization utilities.
 * 
 * This module handles barcode validation and conversion between formats:
 * - UPC-A (12 digits) -> EAN-13 (13 digits) by adding leading zero
 * - EAN-13 (13 digits) -> kept as-is
 * 
 * CRITICAL: All barcodes are treated as STRINGS, never as integers.
 * This preserves leading zeros which are significant in barcode standards.
 * 
 * Following engineering guidelines: domain logic in plain TS, no React/browser imports.
 */

export type BarcodeFormat = 'UPC-A' | 'EAN-13' | 'EAN-8' | 'GTIN-14' | 'unknown';

export type BarcodeValidationResult = {
  isValid: boolean;
  rawCode: string;
  normalizedCode: string | null;
  error: string | null;
  format: BarcodeFormat;
};

export class BarcodeError extends Error {
  constructor(
    message: string,
    public readonly rawCode: string,
    public readonly detectedLength: number
  ) {
    super(message);
    this.name = 'BarcodeError';
  }
}

/**
 * Normalizes a barcode to 13-digit EAN-13 format.
 * 
 * This is the primary function to use for all barcode operations.
 * The normalized 13-digit string should be used for all database storage and lookups.
 * 
 * @param rawCode - The raw barcode string from scanner
 * @returns Normalized 13-digit EAN-13 string
 * @throws BarcodeError if the barcode cannot be normalized
 * 
 * Rules:
 * - Strip all non-digit characters
 * - 13 digits → EAN-13/GTIN-13, return as-is
 * - 12 digits → UPC-A, prefix with "0" to make EAN-13
 * - Other lengths → throw error (8, 14, etc. not yet supported)
 */
export function normalizeBarcode(rawCode: string): string {
  // Strip all non-digit characters
  const cleanCode = rawCode.replace(/\D/g, '');
  
  if (cleanCode.length === 0) {
    throw new BarcodeError(
      'Barcode is empty after removing non-digit characters',
      rawCode,
      0
    );
  }
  
  if (cleanCode.length === 13) {
    // Already EAN-13 / GTIN-13 format
    return cleanCode;
  }
  
  if (cleanCode.length === 12) {
    // UPC-A format - prefix with "0" to convert to EAN-13
    return '0' + cleanCode;
  }
  
  // Unsupported lengths
  if (cleanCode.length === 8) {
    throw new BarcodeError(
      'EAN-8 barcodes are not yet supported. Please use a product with a standard 12 or 13 digit barcode.',
      rawCode,
      8
    );
  }
  
  if (cleanCode.length === 14) {
    throw new BarcodeError(
      'GTIN-14 barcodes are not yet supported. Please use a product with a standard 12 or 13 digit barcode.',
      rawCode,
      14
    );
  }
  
  throw new BarcodeError(
    `Invalid barcode length: ${cleanCode.length} digits. Expected 12 (UPC-A) or 13 (EAN-13) digits.`,
    rawCode,
    cleanCode.length
  );
}

/**
 * Validates and normalizes a barcode string, returning a result object.
 * Use this when you need detailed information about the validation result.
 * 
 * @param rawCode - The raw barcode string from scanner
 * @returns Validation result with normalized 13-digit code if valid
 */
export function validateAndNormalizeBarcode(rawCode: string): BarcodeValidationResult {
  // Strip all non-digit characters
  const cleanCode = rawCode.replace(/\D/g, '');
  
  if (cleanCode.length === 0) {
    return {
      isValid: false,
      rawCode,
      normalizedCode: null,
      error: 'Barcode must contain numbers',
      format: 'unknown',
    };
  }
  
  // Check length and normalize
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
  
  // Specific error messages for known unsupported formats
  if (cleanCode.length === 8) {
    return {
      isValid: false,
      rawCode,
      normalizedCode: null,
      error: 'EAN-8 barcodes (8 digits) are not yet supported.',
      format: 'EAN-8',
    };
  }
  
  if (cleanCode.length === 14) {
    return {
      isValid: false,
      rawCode,
      normalizedCode: null,
      error: 'GTIN-14 barcodes (14 digits) are not yet supported.',
      format: 'GTIN-14',
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
  const cleanCode = code.replace(/\D/g, '');
  return cleanCode.length === 12 || cleanCode.length === 13;
}

/**
 * Formats a barcode for display with visual grouping.
 * EAN-13: X XXXXXX XXXXXX (1-6-6 grouping)
 */
export function formatBarcodeForDisplay(code: string): string {
  const cleanCode = code.replace(/\D/g, '');
  if (cleanCode.length === 13) {
    return `${cleanCode[0]} ${cleanCode.slice(1, 7)} ${cleanCode.slice(7)}`;
  }
  if (cleanCode.length === 12) {
    // Display as UPC-A: XXXXXX XXXXXX
    return `${cleanCode.slice(0, 6)} ${cleanCode.slice(6)}`;
  }
  return cleanCode;
}

/**
 * Detects the format of a barcode based on its length.
 */
export function detectBarcodeFormat(code: string): BarcodeFormat {
  const cleanCode = code.replace(/\D/g, '');
  switch (cleanCode.length) {
    case 8:
      return 'EAN-8';
    case 12:
      return 'UPC-A';
    case 13:
      return 'EAN-13';
    case 14:
      return 'GTIN-14';
    default:
      return 'unknown';
  }
}

