import React, { createContext, useContext, useState, ReactNode } from 'react';

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

  return (
    <OfflineModeContext.Provider value={{ isOfflineMode, setIsOfflineMode }}>
      {children}
    </OfflineModeContext.Provider>
  );
}

export function useOfflineMode() {
  return useContext(OfflineModeContext);
}

