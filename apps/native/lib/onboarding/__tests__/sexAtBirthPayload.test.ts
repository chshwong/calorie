import { describe, it, expect } from 'vitest';
import { buildSexAtBirthPayload } from '../sexAtBirthPayload';

describe('sexAtBirthPayload', () => {
  describe('buildSexAtBirthPayload', () => {
    it('should build payload for "male"', () => {
      const result = buildSexAtBirthPayload('male');
      expect(result).toEqual({ gender: 'male' });
    });

    it('should build payload for "female"', () => {
      const result = buildSexAtBirthPayload('female');
      expect(result).toEqual({ gender: 'female' });
    });
  });
});
