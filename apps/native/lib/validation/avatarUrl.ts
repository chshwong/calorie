/**
 * Avatar URL validation helper.
 * Ensures we only persist remote HTTP(S) URLs, not local file:// or content:// URIs.
 */

export function isRemoteHttpUrl(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith('http://') || uri.startsWith('https://');
}
