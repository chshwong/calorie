/**
 * Global install-prompt store. Capture beforeinstallprompt at app startup
 * (e.g. in root layout) so we never miss the event when user opens Settings.
 */

const DEBUG_A2HS = (typeof __DEV__ !== 'undefined' && __DEV__) || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEBUG_A2HS === '1');

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let initialized = false;

function notify() {
  listeners.forEach((cb) => cb());
}

export function initInstallPromptCapture(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  initialized = true;
  if (DEBUG_A2HS) console.log('[A2HS] initInstallPromptCapture ran');

  window.addEventListener(
    'beforeinstallprompt',
    (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      if (DEBUG_A2HS) console.log('[A2HS] beforeinstallprompt captured', e);
      notify();
    },
    { passive: false }
  );

  window.addEventListener('appinstalled', () => {
    if (DEBUG_A2HS) console.log('[A2HS] appinstalled fired');
    deferredPrompt = null;
    notify();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function clearDeferredPrompt(): void {
  deferredPrompt = null;
  notify();
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (mq?.matches) return true;
    const nav = navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function getIsIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isSafari;
}
