import { describe, it, expect } from 'vitest';
import {
  validatePreferredName,
  normalizePreferredName,
  filterPreferredNameInput,
} from '../preferredName';
import { checkProfanity } from '../profanity';

describe('preferredName validation', () => {
  describe('validatePreferredName', () => {
    it('should accept valid basic name', () => {
      const result = validatePreferredName('Apple');
      expect(result.ok).toBe(true);
      expect(result.errorKey).toBeUndefined();
    });

    it('should trim and normalize whitespace', () => {
      const result = validatePreferredName('  Apple  ');
      expect(result.ok).toBe(true);
    });

    it('should allow one emoji', () => {
      const result = validatePreferredName('🍎 Apple');
      expect(result.ok).toBe(true);
    });

    it('should reject more than one emoji', () => {
      const result = validatePreferredName('🍎🍏 Apple');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_name_invalid');
    });

    it('should reject empty string', () => {
      const result = validatePreferredName('');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_name_required');
    });

    it('should reject whitespace-only string', () => {
      const result = validatePreferredName('   ');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_name_required');
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(31);
      const result = validatePreferredName(longName);
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_name_too_long');
    });

    it('should reject names with profanity', () => {
      // Use a word that checkProfanity definitely catches
      const result = validatePreferredName('fuck');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_name_invalid');
    });

    it('should reject names with too few letters', () => {
      // POLICY.PREFERRED_NAME_MIN_LETTERS is 2
      const result = validatePreferredName('A');
      expect(result.ok).toBe(false);
      expect(result.errorKey).toBe('onboarding.name_age.error_name_invalid');
    });

    it('should accept names with allowed punctuation', () => {
      const result = validatePreferredName("O'Brien");
      expect(result.ok).toBe(true);
    });

    it('should accept names with hyphens', () => {
      const result = validatePreferredName('Mary-Jane');
      expect(result.ok).toBe(true);
    });
  });

  describe('normalizePreferredName', () => {
    it('should trim whitespace', () => {
      expect(normalizePreferredName('  Apple  ')).toBe('Apple');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizePreferredName('Apple    Pie')).toBe('Apple Pie');
    });

    it('should handle empty string', () => {
      expect(normalizePreferredName('')).toBe('');
    });
  });

  describe('filterPreferredNameInput', () => {
    it('should filter disallowed characters', () => {
      const result = filterPreferredNameInput('', 'Apple@#$%');
      expect(result).toBe('Apple');
    });

    it('should allow one emoji', () => {
      const result = filterPreferredNameInput('', '🍎 Apple');
      expect(result).toBe('🍎 Apple');
    });

    it('should block second emoji', () => {
      const result = filterPreferredNameInput('', '🍎🍏 Apple');
      // Should only keep first emoji
      expect(result).toContain('🍎');
      expect(result).not.toContain('🍏');
    });

    it('should block banned emojis', () => {
      const result = filterPreferredNameInput('', '🤬 Apple');
      expect(result).not.toContain('🤬');
    });

    it('should not exceed max length', () => {
      const longText = 'A'.repeat(31);
      const result = filterPreferredNameInput('', longText);
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should preserve existing emoji when adding text', () => {
      const result = filterPreferredNameInput('🍎', '🍎 Apple');
      expect(result).toContain('🍎');
    });
  });
});
