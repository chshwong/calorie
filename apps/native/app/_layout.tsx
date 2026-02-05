import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";

import { queryClient } from "@/lib/queryClient";

import "../i18n";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="post-login-gate" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="web-onboarding" />
          <Stack.Screen name="web" />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
