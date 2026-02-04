import { View, Text } from "react-native";

export default function LogScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Log
      </Text>
    </View>
  );
}
