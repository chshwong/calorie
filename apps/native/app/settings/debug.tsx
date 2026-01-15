import * as React from "react";
import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { router, useFocusEffect, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function DebugScreen() {
  const { user, loading } = useAuth();
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<any | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);

  // Auth guard: redirect to login if not authenticated
  if (loading) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, opacity: 0.7 }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Extract profile fetch logic into reusable function
  const fetchProfile = React.useCallback(async () => {
    if (!user) return;

    setProfileLoading(true);
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, created_at, onboarding_complete")
        .eq("user_id", user.id)
        .single();

      if (error) {
        // If profile doesn't exist (PGRST116 = no rows), treat as no profile
        if (error.code === "PGRST116" || error.message.includes("No rows")) {
          setProfileError(null);
          setProfile(null);
        } else {
          setProfileError(error.message);
          setProfile(null);
        }
      } else {
        setProfile(data);
        setProfileError(null);
      }
    } catch (e: any) {
      setProfileError(e?.message || "An unexpected error occurred");
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  // Fetch profile when user is authenticated
  useEffect(() => {
    if (!loading && user) {
      void fetchProfile();
    }
  }, [loading, user, fetchProfile]);

  // Refetch profile when screen comes into focus (e.g., returning from onboarding)
  useFocusEffect(
    React.useCallback(() => {
      if (!loading && user) {
        void fetchProfile();
      }
    }, [loading, user, fetchProfile])
  );

  const handleMarkOnboardingComplete = async () => {
    if (!user) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_complete: true })
        .eq("user_id", user.id);

      if (error) {
        // Check if error is due to missing required fields constraint
        if (
          error.message.includes("profiles_require_fields_when_onboarding_complete") ||
          error.message.includes("violates check constraint")
        ) {
          setSaveError("Please complete onboarding details first.");
          // Navigate to onboarding screen
          router.push("/onboarding");
        } else {
          setSaveError(error.message);
        }
      } else {
        setSaveSuccess("Saved.");
        // Re-fetch profile after successful update
        await fetchProfile();
      }
    } catch (e: any) {
      setSaveError(e?.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Pressable
        onPress={() => router.back()}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginBottom: 24,
        }}
      >
        <Text style={{ fontSize: 16, color: "#007bff" }}>← Back</Text>
      </Pressable>

      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 24 }}>
        Debug
      </Text>

      <View style={{ marginTop: 16, paddingTop: 24, borderTopWidth: 1, borderTopColor: "#eee" }}>
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 16 }}>
          Profile fetch (RLS test)
        </Text>

        {profileLoading ? (
          <Text style={{ fontSize: 14, opacity: 0.7 }}>Loading profile...</Text>
        ) : profileError ? (
          <Text style={{ fontSize: 14, fontWeight: "600", opacity: 0.8, color: "#dc3545" }}>
            Error: {profileError}
          </Text>
        ) : profile ? (
          <View>
            <Text style={{ fontSize: 14, marginBottom: 8 }}>
              user_id: {profile.user_id || "N/A"}
            </Text>
            <Text style={{ fontSize: 14, marginBottom: 8 }}>
              first_name: {profile.first_name || "N/A"}
            </Text>
            <Text style={{ fontSize: 14, marginBottom: 8 }}>
              created_at: {profile.created_at || "N/A"}
            </Text>
            <Text style={{ fontSize: 14, marginBottom: 8 }}>
              onboarding_complete: {profile.onboarding_complete ? "Yes" : "No"}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 14, opacity: 0.7 }}>
            No profile row found for this user.
          </Text>
        )}

        {profile ? (
          <>
            <Pressable
              onPress={handleMarkOnboardingComplete}
              disabled={saving || profile?.onboarding_complete === true}
              style={{
                marginTop: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: saving || profile?.onboarding_complete === true ? "#999" : "#007bff",
                opacity: saving || profile?.onboarding_complete === true ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                {saving ? "Saving..." : "Mark onboarding complete"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/onboarding")}
              style={{
                marginTop: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: "#6c757d",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                Complete onboarding details
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={{ fontSize: 14, opacity: 0.7, marginTop: 16 }}>
            No profile row found; cannot update.
          </Text>
        )}

        {saveError && (
          <Text style={{ fontSize: 14, fontWeight: "600", opacity: 0.8, color: "#dc3545", marginTop: 8 }}>
            Error: {saveError}
          </Text>
        )}

        {saveSuccess && (
          <Text style={{ fontSize: 14, fontWeight: "600", opacity: 0.8, color: "#28a745", marginTop: 8 }}>
            {saveSuccess}
          </Text>
        )}
      </View>
    </View>
  );
}
