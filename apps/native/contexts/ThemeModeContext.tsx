import React, { createContext, useContext, useMemo, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  hasProvider: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "system",
  setMode: () => {},
  hasProvider: false,
});

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");

  const value = useMemo(
    () => ({
      mode,
      setMode,
      hasProvider: true,
    }),
    [mode]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
