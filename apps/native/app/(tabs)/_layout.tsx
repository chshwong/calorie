import { Tabs, Redirect } from "expo-router";
import { View, Text } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export default function TabLayout() {
  const { user, loading, onboardingComplete } = useAuth();

  // Auth and onboarding guards
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, opacity: 0.7 }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Profile is still loading
  if (onboardingComplete === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, opacity: 0.7 }}>Loading...</Text>
      </View>
    );
  }

  // Onboarding not complete
  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  // User authenticated and onboarded - render tabs
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
