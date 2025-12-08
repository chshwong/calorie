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
    // Web: do not attach any online/offline listeners.
    // Web stays "online" unless something explicitly calls setIsOfflineMode.
    if (Platform.OS === 'web') {
      return;
    }

    // Native: you can later wire NetInfo here.
    return;
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
