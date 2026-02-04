import { describe, it, expect } from 'vitest';
import { isRemoteHttpUrl } from '../avatarUrl';

describe('avatarUrl validation', () => {
  describe('isRemoteHttpUrl', () => {
    it('should accept https URLs', () => {
      expect(isRemoteHttpUrl('https://example.com/a.jpg')).toBe(true);
      expect(isRemoteHttpUrl('https://supabase.co/storage/v1/object/public/avatars/user123/avatar.jpg')).toBe(true);
    });

    it('should accept http URLs', () => {
      expect(isRemoteHttpUrl('http://example.com/a.jpg')).toBe(true);
    });

    it('should reject file:// URIs', () => {
      expect(isRemoteHttpUrl('file:///data/user/0/com.example.app/cache/image.jpg')).toBe(false);
      expect(isRemoteHttpUrl('file:///Users/john/photo.jpg')).toBe(false);
    });

    it('should reject content:// URIs', () => {
      expect(isRemoteHttpUrl('content://media/external/images/media/123')).toBe(false);
      expect(isRemoteHttpUrl('content://com.android.providers.media.documents/document/image%3A123')).toBe(false);
    });

    it('should reject null', () => {
      expect(isRemoteHttpUrl(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isRemoteHttpUrl(undefined)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isRemoteHttpUrl('')).toBe(false);
    });

    it('should reject relative paths', () => {
      expect(isRemoteHttpUrl('/path/to/image.jpg')).toBe(false);
      expect(isRemoteHttpUrl('./image.jpg')).toBe(false);
    });
  });
});
