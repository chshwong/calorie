/**
 * Validation utilities for user input
 * 
 * Per engineering guidelines: Pure TypeScript functions in shared domain layer
 * No React/browser/UI imports allowed
 */

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates preferred name with visible rules only:
 * - Must not be empty after trimming
 * - Must contain at least 2 letters
 * 
 * Note: Other rules (max length, invalid characters, emojis) are enforced silently
 * in the UI via onChangeText filtering.
 */
export function validatePreferredName(rawValue: string): ValidationResult {
  const value = rawValue.trim();
  if (!value) return { valid: false, error: "Please enter a name." };
  const chars = Array.from(value);
  let letterCount = 0;
  for (const ch of chars) {
    if (/\p{L}/u.test(ch)) letterCount += 1;
  }
  if (letterCount < 2) return { valid: false, error: "Name must contain at least 2 letters." };
  return { valid: true };
}

