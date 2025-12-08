import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';

type OfflineModeContextType = {
  isOfflineMode: boolean;
  setIsOfflineMode: (value: boolean) => void;
};

const OfflineModeContext = createContext<OfflineModeContextType>({
  isOfflineMode: false,
  setIsOfflineMode: () => {},
});

export function OfflineModeProvider({ children }: { children: ReactNode }) {
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    // Web: listen for online/offline events only.
    // We *don't* initialize from navigator.onLine to avoid false "offline"
    // on some mobile browsers / PWA contexts.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setIsOfflineMode(false);
      };

      const handleOffline = () => {
        setIsOfflineMode(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // Native: still rely on manual setIsOfflineMode calls from error handlers.
    return undefined;
  }, []);

  return (
    <OfflineModeContext.Provider value={{ isOfflineMode, setIsOfflineMode }}>
      {children}
    </OfflineModeContext.Provider>
  );
}

export function useOfflineMode() {
  return useContext(OfflineModeContext);
}

