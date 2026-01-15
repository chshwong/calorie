import { useColorScheme as useSystemColorScheme } from "react-native";

import { useThemeMode } from "../contexts/ThemeModeContext";

export function useColorScheme() {
  const systemScheme = useSystemColorScheme();
  const { mode, hasProvider } = useThemeMode();

  if (hasProvider && mode !== "system") {
    return mode;
  }

  return systemScheme ?? "light";
}
