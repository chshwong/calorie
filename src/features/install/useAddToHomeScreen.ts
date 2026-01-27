import { useState, useEffect, useCallback } from 'react';
import {
  getDeferredPrompt,
  clearDeferredPrompt,
  subscribe,
  getIsStandalone,
  getIsIosSafari,
} from './installPromptStore';

export type PromptInstallResult =
  | 'accepted'
  | 'dismissed'
  | 'unavailable'
  | 'already_installed'
  | 'ios_manual';

export function useAddToHomeScreen() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return subscribe(() => setVersion((v) => v + 1));
  }, []);

  const deferredPrompt = getDeferredPrompt();
  const isStandalone = getIsStandalone();
  const isIosSafari = getIsIosSafari();
  const canPromptInstall = !!deferredPrompt && !isStandalone && !isIosSafari;

  const promptInstall = useCallback(async (): Promise<PromptInstallResult> => {
    if (isStandalone) return 'already_installed';
    if (isIosSafari) return 'ios_manual';
    const prompt = getDeferredPrompt();
    if (!prompt) return 'unavailable';
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      clearDeferredPrompt();
      return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [isStandalone, isIosSafari]);

  return {
    canPromptInstall,
    promptInstall,
    isIosSafari,
    isStandalone,
  };
}
