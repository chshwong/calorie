import { View, Text } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export default function TodayScreen() {
  const { user } = useAuth();

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Today
      </Text>
      {user && (
        <Text style={{ fontSize: 16, opacity: 0.7 }}>
          Signed in as {user.email}
        </Text>
      )}
    </View>
  );
}
