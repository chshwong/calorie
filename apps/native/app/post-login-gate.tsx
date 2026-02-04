import { Redirect } from "expo-router";
import * as React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_WEB_PATH } from "@/lib/webWrapper/webConfig";

export default function PostLoginGate() {
  const { user, session, loading, onboardingComplete } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session || !user) {
    return <Redirect href="/login" />;
  }

  if (onboardingComplete === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (onboardingComplete === false) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href={{ pathname: "/web", params: { path: DEFAULT_WEB_PATH } }} />;
}

