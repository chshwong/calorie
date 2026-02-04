import { describe, it, expect } from 'vitest';
import { checkProfanity, cleanForProfanityCheck } from '../profanity';

describe('profanity validation', () => {
  describe('checkProfanity', () => {
    it('should detect clearly profane word (substring match)', () => {
      expect(checkProfanity('fuck')).toBe(true);
      expect(checkProfanity('fucker')).toBe(true);
      expect(checkProfanity('shit')).toBe(true);
    });

    it('should detect profane word in context', () => {
      expect(checkProfanity('whatthefuck')).toBe(true);
      expect(checkProfanity('bullshit')).toBe(true);
    });

    it('should detect exact match profane words', () => {
      expect(checkProfanity('dick')).toBe(true);
      expect(checkProfanity('fag')).toBe(true);
    });

    it('should not flag normal words', () => {
      expect(checkProfanity('apple')).toBe(false);
      expect(checkProfanity('hello')).toBe(false);
      expect(checkProfanity('world')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(checkProfanity('FUCK')).toBe(true);
      expect(checkProfanity('ShIt')).toBe(true);
    });

    it('should ignore punctuation', () => {
      expect(checkProfanity("f'uck")).toBe(true);
      expect(checkProfanity('f-uck')).toBe(true);
      expect(checkProfanity('f.uck')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(checkProfanity('')).toBe(false);
    });
  });

  describe('cleanForProfanityCheck', () => {
    it('should convert to lowercase', () => {
      expect(cleanForProfanityCheck('FUCK')).toBe('fuck');
    });

    it('should remove apostrophes', () => {
      expect(cleanForProfanityCheck("f'uck")).toBe('fuck');
    });

    it('should remove hyphens', () => {
      expect(cleanForProfanityCheck('f-uck')).toBe('fuck');
    });

    it('should remove periods', () => {
      expect(cleanForProfanityCheck('f.uck')).toBe('fuck');
    });

    it('should trim whitespace', () => {
      expect(cleanForProfanityCheck('  fuck  ')).toBe('fuck');
    });

    it('should handle empty string', () => {
      expect(cleanForProfanityCheck('')).toBe('');
    });
  });
});
