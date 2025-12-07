import React, { createContext, useContext, useState, ReactNode } from 'react';

type DebugState = {
  active: boolean;
  message: string | null;
};

type DebugContextValue = {
  state: DebugState;
  setDebugLoading: (active: boolean, message?: string | null) => void;
};

const DebugLoadingContext = createContext<DebugContextValue | undefined>(undefined);

export function DebugLoadingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DebugState>({ active: false, message: null });

  const setDebugLoading = (active: boolean, message?: string | null) => {
    setState((prev) => ({
      active,
      // When turning on, use the provided message or keep the previous one.
      // When turning off, clear the message.
      message: active ? (message ?? prev.message) : null,
    }));
  };

  return (
    <DebugLoadingContext.Provider value={{ state, setDebugLoading }}>
      {children}
    </DebugLoadingContext.Provider>
  );
}

export function useDebugLoading() {
  const ctx = useContext(DebugLoadingContext);
  if (!ctx) {
    throw new Error('useDebugLoading must be used inside DebugLoadingProvider');
  }
  return ctx;
}

