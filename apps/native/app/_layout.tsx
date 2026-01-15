import { AuthProvider } from "@/contexts/AuthContext";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";

import "../i18n";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="home" />
          <Stack.Screen name="index" />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
