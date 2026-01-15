import { AuthProvider } from "@/contexts/AuthContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="home" />
        <Stack.Screen name="index" />
      </Stack>
    </AuthProvider>
  );
}
