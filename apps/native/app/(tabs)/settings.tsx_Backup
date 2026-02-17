import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

export default function SettingsScreen() {
  const { user, loading } = useAuth();

  // Reactive redirect: navigate to login when user signs out
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[SettingsScreen] Error signing out:", error);
      }
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 24 }}>
        Settings
      </Text>

      <Pressable
        onPress={() => router.push("/settings/debug")}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: "#007bff",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          Debug
        </Text>
      </Pressable>

      <Pressable
        onPress={handleSignOut}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: "#dc3545",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}
