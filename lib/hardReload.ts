import { Platform } from 'react-native';

/**
 * Hard reload the app *now*.
 *
 * Web:
 * - Cache-bust by adding a changing `__r` query param
 * - Use location.replace() to avoid back-button loops
 *
 * Native:
 * - Best-effort reload via expo-updates (if available). This is not URL cache-busting,
 *   but it restarts the JS bundle/runtime which is the closest equivalent.
 */
export function hardReloadNow(): void {
  // Web: exact behavior requested
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('__r', String(Date.now()));
    // replace() avoids back-button loops
    window.location.replace(url.toString());
    return;
  }

  // Native: best-effort reload without adding new deps.
  // DevSettings.reload() is dev-only in many environments; if unavailable, no-op.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DevSettings } = require('react-native') as any;
    if (typeof DevSettings?.reload === 'function') {
      DevSettings.reload();
    }
  } catch {
    // ignore
  }
}


