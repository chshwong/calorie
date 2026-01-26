import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

/** BeforeInstallPromptEvent is not in DOM libs; we extend Window locally. */
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type PromptInstallResult = 'accepted' | 'dismissed' | 'unavailable';

function getIsStandalone(): boolean {
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

function getIsIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isSafari;
}

export function useAddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosSafari] = useState(() => getIsIosSafari());

  useEffect(() => {
    setIsStandalone(getIsStandalone());
    const checkStandalone = () => setIsStandalone(getIsStandalone());
    let mq: MediaQueryList | null = null;
    if (typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(display-mode: standalone)');
      mq.addEventListener?.('change', checkStandalone);
    }
    return () => {
      mq?.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const promptInstall = useCallback(async (): Promise<PromptInstallResult> => {
    if (isStandalone) return 'unavailable';
    if (isIosSafari) return 'unavailable';
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      return outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [isStandalone, isIosSafari, deferredPrompt]);

  const canPromptInstall = !isStandalone && !isIosSafari && !!deferredPrompt;

  return {
    canPromptInstall,
    promptInstall,
    isIosSafari,
    isStandalone,
  };
}
