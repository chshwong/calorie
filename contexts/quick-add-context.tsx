import React, { createContext, useContext, useState, ReactNode } from 'react';

type QuickAddContextType = {
  isQuickAddVisible: boolean;
  setQuickAddVisible: (visible: boolean) => void;
};

const QuickAddContext = createContext<QuickAddContextType>({
  isQuickAddVisible: false,
  setQuickAddVisible: () => {},
});

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [isQuickAddVisible, setQuickAddVisible] = useState(false);

  return (
    <QuickAddContext.Provider value={{ isQuickAddVisible, setQuickAddVisible }}>
      {children}
    </QuickAddContext.Provider>
  );
}

export const useQuickAdd = () => useContext(QuickAddContext);

