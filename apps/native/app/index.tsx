import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";

export default function Index() {
  const { user, loading, onboardingComplete } = useAuth();

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

  // User exists but onboarding not complete
  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  // User exists and onboarding complete
  return <Redirect href="/(tabs)/today" />;
}
