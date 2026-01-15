import { useAuth } from "@/contexts/AuthContext";
import { useTodaySummary } from "@/lib/today/useTodaySummary";
import { Pressable, Text, View } from "react-native";

export default function TodayScreen() {
  const { user, loading: loadingAuth } = useAuth();
  const { status, data, error, refresh } = useTodaySummary(user?.id ?? null);
  const isLoading = status === "loading";

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Today
      </Text>

      {loadingAuth ? (
        <Text style={{ fontSize: 16, opacity: 0.7 }}>Loading...</Text>
      ) : !user ? (
        <Text style={{ fontSize: 16, opacity: 0.7 }}>Not signed in.</Text>
      ) : (
        <>
          {status === "loading" && (
            <Text style={{ fontSize: 16, opacity: 0.7 }}>Loading...</Text>
          )}
          {status === "empty" && (
            <Text style={{ fontSize: 16, opacity: 0.7, marginBottom: 12 }}>
              No entries logged today yet.
            </Text>
          )}
          {status === "error" && (
            <Text style={{ fontSize: 14, color: "#dc3545", marginBottom: 12 }}>
              {error || "Failed to load today summary."}
            </Text>
          )}
          {status === "success" && data && (
            <>
              <Text style={{ fontSize: 16, marginBottom: 6 }}>
                Calories: {data.calories}
              </Text>
              <Text style={{ fontSize: 16, marginBottom: 6 }}>
                Protein/Carbs/Fat/Fibre: {data.protein}/{data.carbs}/{data.fat}/
                {data.fiber}
              </Text>
              <Text style={{ fontSize: 16, marginBottom: 16 }}>
                Entries: {data.entries ?? 0}
              </Text>
            </>
          )}

          <Pressable
            onPress={refresh}
            disabled={isLoading}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: isLoading ? "#999" : "#111",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              Refresh
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
